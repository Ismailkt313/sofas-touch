import api from '../../../services/api'
import { getStoredSession } from '../../auth'
import { formatJoinedDate } from '../../users/services/userManagementService'

export const APPROVAL_STATUS_VALUES = ['pending', 'approved', 'rejected']

export const MISSING_BACKEND_APPROVAL_ITEMS = [
  'Pending signup workflow on POST /api/auth/signup (currently creates Data Entry accounts with isActive: true immediately instead of pending approval)',
  'Signup approval listing & status fields (e.g., approvalStatus: "pending" | "approved" | "rejected" or a dedicated GET approval requests endpoint)',
  'Approve & Reject action endpoints (to transition pending signup requests to approved or rejected)',
  'Admin signup approval notifications / unread pending count endpoint',
]

export function hasExplicitApprovalStatus(raw) {
  if (!raw || typeof raw !== 'object') {
    return false
  }

  const candidate =
    raw.approvalStatus ?? raw.signupStatus ?? raw.requestStatus ?? raw.status

  if (typeof candidate !== 'string') {
    return false
  }

  const normalized = candidate.trim().toLowerCase()
  return APPROVAL_STATUS_VALUES.includes(normalized)
}

export function normalizeApprovalStatus(value) {
  const cleaned = String(value || 'pending').trim().toLowerCase()
  if (cleaned === 'approved') {
    return {
      statusKey: 'approved',
      statusLabel: 'Approved',
    }
  }
  if (cleaned === 'rejected') {
    return {
      statusKey: 'rejected',
      statusLabel: 'Rejected',
    }
  }
  return {
    statusKey: 'pending',
    statusLabel: 'Pending',
  }
}

export function formatApprovalDate(dateInput) {
  return formatJoinedDate(dateInput)
}

export function formatApprovalDateTime(dateInput) {
  if (!dateInput) {
    return '—'
  }
  const parsed = new Date(dateInput)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

export function normalizeApprovalRequest(raw = {}) {
  const rawStatus =
    raw.approvalStatus ?? raw.signupStatus ?? raw.requestStatus ?? raw.status
  const { statusKey, statusLabel } = normalizeApprovalStatus(rawStatus)

  return {
    id: String(raw.id || raw._id || raw.requestId || ''),
    name: String(raw.name || raw.applicantName || '').trim() || 'Unnamed Applicant',
    email: String(raw.email || raw.applicantEmail || '').trim(),
    phone: String(raw.phone || '').trim(),
    image: String(raw.image || raw.avatar || '').trim(),
    roleKey: 'data_entry',
    roleLabel: 'Data Entry',
    approvalStatus: statusKey,
    approvalStatusLabel: statusLabel,
    signupDate: raw.signupDate || raw.requestedAt || raw.createdAt || null,
    reviewedAt: raw.reviewedAt || raw.approvedAt || raw.rejectedAt || null,
    rejectionReason: String(raw.rejectionReason || raw.reason || '').trim(),
  }
}

export function computeApprovalCounts(requests = []) {
  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: requests.length,
  }

  for (const item of requests) {
    if (item.approvalStatus === 'approved') {
      counts.approved += 1
    } else if (item.approvalStatus === 'rejected') {
      counts.rejected += 1
    } else {
      counts.pending += 1
    }
  }

  return counts
}

export function buildApprovalNotifications(requests = [], maxItems = 8) {
  return requests
    .filter((item) => item.approvalStatus === 'pending')
    .slice()
    .sort((a, b) => {
      const timeA = a.signupDate ? new Date(a.signupDate).getTime() : 0
      const timeB = b.signupDate ? new Date(b.signupDate).getTime() : 0
      return timeB - timeA
    })
    .slice(0, maxItems)
    .map((item) => ({
      id: `signup-req-${item.id || item.email}`,
      requestId: item.id,
      applicantName: item.name,
      applicantEmail: item.email,
      image: item.image,
      message: 'Requested Data Entry account approval.',
      createdAt: item.signupDate,
    }))
}

/**
 * Queries the existing backend (`GET /api/users?role=data_entry&limit=100`) to inspect
 * real Data Entry records without inventing non-existent endpoint URLs or fake data.
 *
 * - If records returned by the backend include explicit approval status fields
 *   (`approvalStatus` / `signupStatus` in `pending | approved | rejected`), they are
 *   normalized into live requests, counts, and recent signup notifications.
 * - If the backend does not yet return approval status metadata (current repository state),
 *   returns `integrationStatus: 'missing_backend_api'` with empty lists and `0` counts so
 *   the UI clearly identifies the missing backend functionality without showing fake items.
 */
export async function fetchSignupApprovals() {
  const session = getStoredSession()
  const hasToken = Boolean(session?.token)

  if (!hasToken) {
    return {
      requests: [],
      notifications: [],
      counts: { pending: 0, approved: 0, rejected: 0, total: 0 },
      integrationStatus: 'unauthenticated',
      capabilities: {
        canApprove: false,
        canReject: false,
        supportsRejectionReason: false,
      },
      missingItems: MISSING_BACKEND_APPROVAL_ITEMS,
    }
  }

  try {
    const response = await api.get('/api/users', {
      params: {
        role: 'data_entry',
        limit: 100,
      },
    })

    const rawUsers = Array.isArray(response.data?.users)
      ? response.data.users
      : []

    const recordsWithApprovalField = rawUsers.filter(hasExplicitApprovalStatus)

    // When backend records do not include approval status fields yet,
    // never fabricate pending/approved/rejected statuses from active user accounts.
    if (rawUsers.length === 0 && response.data?.approvalsSupported !== true) {
      return {
        requests: [],
        notifications: [],
        counts: { pending: 0, approved: 0, rejected: 0, total: 0 },
        integrationStatus: 'missing_backend_api',
        capabilities: {
          canApprove: false,
          canReject: false,
          supportsRejectionReason: false,
        },
        missingItems: MISSING_BACKEND_APPROVAL_ITEMS,
      }
    }

    if (
      recordsWithApprovalField.length === 0 &&
      response.data?.approvalsSupported !== true
    ) {
      return {
        requests: [],
        notifications: [],
        counts: { pending: 0, approved: 0, rejected: 0, total: 0 },
        integrationStatus: 'missing_backend_api',
        capabilities: {
          canApprove: false,
          canReject: false,
          supportsRejectionReason: false,
        },
        missingItems: MISSING_BACKEND_APPROVAL_ITEMS,
      }
    }

    const requests = recordsWithApprovalField
      .map(normalizeApprovalRequest)
      .sort((a, b) => {
        const timeA = a.signupDate ? new Date(a.signupDate).getTime() : 0
        const timeB = b.signupDate ? new Date(b.signupDate).getTime() : 0
        return timeB - timeA
      })

    const counts = computeApprovalCounts(requests)
    const notifications = buildApprovalNotifications(requests)

    return {
      requests,
      notifications,
      counts,
      integrationStatus: 'ready',
      capabilities: {
        canApprove: Boolean(response.data?.capabilities?.canApprove),
        canReject: Boolean(response.data?.capabilities?.canReject),
        supportsRejectionReason: Boolean(
          response.data?.capabilities?.supportsRejectionReason,
        ),
      },
      missingItems: [],
    }
  } catch (error) {
    const status = error?.response?.status
    const serverMessage = error?.response?.data?.message

    if (status === 401) {
      throw new Error(
        serverMessage ||
        'Your Admin session has expired or is not signed in. Please sign in again to view signup approvals.',
        { cause: error },
      )
    }

    if (status === 403) {
      throw new Error(
        serverMessage ||
        'Administrator permissions are required to review signup approval requests.',
        { cause: error },
      )
    }

    throw new Error(
      serverMessage ||
      'Unable to load signup approval data from the server. Please check your connection and try again.',
      { cause: error },
    )
  }
}

export async function approveSignupRequest(requestId) {
  if (!requestId) {
    throw new Error('A valid signup request ID is required.')
  }

  throw new Error(
    'Backend signup approval endpoint is not yet implemented in this repository. Unable to approve request without simulating a fake API response.',
  )
}

export async function rejectSignupRequest(requestId) {
  if (!requestId) {
    throw new Error('A valid signup request ID is required.')
  }

  throw new Error(
    'Backend signup rejection endpoint is not yet implemented in this repository. Unable to reject request without simulating a fake API response.',
  )
}

export const defaultApprovalService = {
  fetchSignupApprovals,
  approveSignupRequest,
  rejectSignupRequest,
}
