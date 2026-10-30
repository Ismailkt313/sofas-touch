import api from '../../../services/api'
import { getStoredSession } from '../../auth'

function normalizeRoleKey(role) {
  const cleaned = String(role || 'data_entry')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  return cleaned === 'admin' ? 'admin' : 'data_entry'
}

export function normalizeUserRecord(raw = {}) {
  const roleKey = normalizeRoleKey(raw.role)
  const isActive =
    typeof raw.isActive === 'boolean'
      ? raw.isActive
      : String(raw.status || 'active').toLowerCase() !== 'inactive'

  return {
    id: String(raw.id || raw._id || ''),
    name: String(raw.name || '').trim() || 'Unnamed User',
    email: String(raw.email || '').trim(),
    phone: String(raw.phone || '').trim(),
    image: String(raw.image || '').trim(),
    roleKey,
    roleLabel: roleKey === 'admin' ? 'Admin' : 'Data Entry',
    statusKey: isActive ? 'active' : 'inactive',
    statusLabel: isActive ? 'Active' : 'Inactive',
    isActive,
    permissionOverrides: {
      grant: Array.isArray(raw.permissionOverrides?.grant)
        ? raw.permissionOverrides.grant
        : [],
      revoke: Array.isArray(raw.permissionOverrides?.revoke)
        ? raw.permissionOverrides.revoke
        : [],
    },
    assignedProjectIds: Array.isArray(raw.assignedProjectIds)
      ? raw.assignedProjectIds
      : null,
    createdAt: raw.createdAt || null,
  }
}

export function formatJoinedDate(dateInput) {
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
  }).format(parsed)
}

export function getUserInitials(name) {
  const cleaned = String(name || '').trim()
  if (!cleaned) {
    return 'U'
  }
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

const DEV_ONLY_PREVIEW_USERS = [
  {
    id: 'dev_preview_01',
    name: 'Admin Account (Preview)',
    email: 'admin.preview@example.test',
    phone: '+91 98470 10001',
    role: 'Admin',
    isActive: true,
    createdAt: '2026-01-14T09:00:00.000Z',
  },
  {
    id: 'dev_preview_02',
    name: 'Operations Lead (Preview)',
    email: 'operations.preview@example.test',
    phone: '+91 98470 10002',
    role: 'Admin',
    isActive: true,
    createdAt: '2026-02-08T10:30:00.000Z',
  },
  {
    id: 'dev_preview_03',
    name: 'Showroom Coordinator (Preview)',
    email: 'showroom.preview@example.test',
    phone: '+91 98470 10003',
    role: 'Data Entry',
    isActive: true,
    createdAt: '2026-03-19T11:15:00.000Z',
  },
  {
    id: 'dev_preview_04',
    name: 'Procurement Clerk (Preview)',
    email: 'procurement.preview@example.test',
    phone: '+91 98470 10004',
    role: 'Data Entry',
    isActive: true,
    createdAt: '2026-04-22T08:45:00.000Z',
  },
  {
    id: 'dev_preview_05',
    name: 'Workshop Inventory (Preview)',
    email: 'inventory.preview@example.test',
    phone: '+91 98470 10005',
    role: 'Data Entry',
    isActive: false,
    createdAt: '2026-06-05T14:20:00.000Z',
  },
  {
    id: 'dev_preview_06',
    name: 'Accounts Assistant (Preview)',
    email: 'accounts.preview@example.test',
    phone: '+91 98470 10006',
    role: 'Data Entry',
    isActive: true,
    createdAt: '2026-08-11T09:50:00.000Z',
  },
  {
    id: 'dev_preview_07',
    name: 'Former Staff Member (Preview)',
    email: 'archived.preview@example.test',
    phone: '+91 98470 10007',
    role: 'Data Entry',
    isActive: false,
    createdAt: '2026-09-02T16:10:00.000Z',
  },
]

export function getDevPreviewUsers() {
  return DEV_ONLY_PREVIEW_USERS.map(normalizeUserRecord)
}

export async function fetchManagedUsers({ allowDevFallback = true } = {}) {
  const session = getStoredSession()
  const hasToken = Boolean(session?.token)

  try {
    let rawUsers = []
    try {
      const response = await api.get('/api/users', {
        params: { limit: 100 },
      })
      if (Array.isArray(response.data?.users)) {
        rawUsers = response.data.users
      }
    } catch {
      const fallbackResponse = await api.get('/api/admin/users')
      if (Array.isArray(fallbackResponse.data?.users)) {
        rawUsers = fallbackResponse.data.users
      }
    }

    return {
      users: rawUsers.map(normalizeUserRecord),
      source: 'api',
      fallbackReason: '',
    }
  } catch (error) {
    const status = error?.response?.status
    const serverMessage = error?.response?.data?.message

    if (
      import.meta.env.DEV &&
      allowDevFallback &&
      (!hasToken || !error?.response || status === 401)
    ) {
      const reason = !hasToken
        ? 'No authenticated Admin session is active. Showing development-only preview records so layout, filters, pagination, and dialogs can be inspected.'
        : status === 401
          ? 'Your session requires Admin sign-in to query GET /api/admin/users. Showing development-only preview records.'
          : 'Backend API (/api/admin/users) is currently unreachable. Showing development-only preview records.'

      return {
        users: getDevPreviewUsers(),
        source: 'dev-fallback',
        fallbackReason: reason,
      }
    }

    if (status === 401) {
      throw new Error(
        serverMessage ||
          'Authentication is required to view user accounts. Please sign in with an Admin account.',
        { cause: error },
      )
    }

    if (status === 403) {
      throw new Error(
        serverMessage ||
          'Access denied. Administrator privileges are required to view user management.',
        { cause: error },
      )
    }

    throw new Error(
      serverMessage ||
        'Unable to load users from /api/admin/users. Please check your connection and try again.',
      { cause: error },
    )
  }
}

export async function createManagedUser({ name, email, password, role }) {
  const canonicalRole = normalizeRoleKey(role)
  const rolePayload = canonicalRole === 'admin' ? 'Admin' : 'Data Entry'

  try {
    const response = await api.post('/api/admin/users', {
      name: name.trim(),
      email: email.trim(),
      password,
      role: rolePayload,
    })

    const created = response.data?.user
    if (!created || typeof created !== 'object') {
      throw new Error('Server returned an unexpected user creation response.')
    }

    return normalizeUserRecord(created)
  } catch (error) {
    if (!error?.response) {
      throw new Error(
        error instanceof Error && error.message.startsWith('Server returned')
          ? error.message
          : 'Unable to reach POST /api/admin/users. Please ensure the backend server is running.',
        { cause: error },
      )
    }

    const { status, data } = error.response
    if (status === 401) {
      throw new Error(
        data?.message ||
          'You must be signed in as an Administrator to create a user via POST /api/admin/users.',
        { cause: error },
      )
    }
    if (status === 403) {
      throw new Error(
        data?.message || 'Only Administrators are permitted to create users.',
        { cause: error },
      )
    }
    if (status === 409) {
      throw new Error(
        data?.message || 'A user account with this email address already exists.',
        { cause: error },
      )
    }

    throw new Error(
      data?.message || 'Failed to create user account. Please check your inputs.',
      { cause: error },
    )
  }
}

export async function updateManagedUserStatus(userId, isActive) {
  const cleanId = String(userId || '').trim()
  if (!cleanId) {
    throw new Error('User ID is required to update status.')
  }

  try {
    let response
    try {
      response = await api.patch(
        `/api/admin/users/${encodeURIComponent(cleanId)}/status`,
        { isActive: Boolean(isActive) },
      )
    } catch (err) {
      if (err?.response?.status === 404) {
        try {
          response = await api.patch(
            `/api/admin/users/${encodeURIComponent(cleanId)}`,
            { isActive: Boolean(isActive) },
          )
        } catch {
          response = await api.patch(
            `/api/users/${encodeURIComponent(cleanId)}/status`,
            { isActive: Boolean(isActive) },
          )
        }
      } else {
        throw err
      }
    }

    const updated = response.data?.user
    if (!updated || typeof updated !== 'object') {
      throw new Error('Server returned an unexpected response format.')
    }
    return normalizeUserRecord(updated)
  } catch (error) {
    if (!error?.response) {
      throw new Error(
        error instanceof Error && error.message.startsWith('Server returned')
          ? error.message
          : 'Unable to reach user status update endpoint. Please check your connection.',
        { cause: error },
      )
    }

    const { status, data } = error.response
    if (status === 400) {
      throw new Error(data?.message || 'Invalid status update request.', {
        cause: error,
      })
    }
    if (status === 401) {
      throw new Error(
        data?.message ||
          'You must be signed in as an Administrator to update user status.',
        { cause: error },
      )
    }
    if (status === 403) {
      throw new Error(
        data?.message ||
          'Only Administrators are permitted to change user status.',
        { cause: error },
      )
    }
    if (status === 404) {
      throw new Error(data?.message || 'User account not found on server.', {
        cause: error,
      })
    }

    throw new Error(data?.message || 'Failed to update user status.', {
      cause: error,
    })
  }
}

export async function updateManagedUser(userId, fields = {}) {
  const cleanId = String(userId || '').trim()
  if (!cleanId) {
    throw new Error('User ID is required to update account.')
  }

  const payload = {}
  if (fields.name !== undefined) payload.name = fields.name.trim()
  if (fields.email !== undefined) payload.email = fields.email.trim()
  if (fields.phone !== undefined) payload.phone = fields.phone.trim()
  if (fields.roleKey !== undefined || fields.role !== undefined) {
    const canonical = normalizeRoleKey(fields.roleKey || fields.role)
    payload.role = canonical === 'admin' ? 'admin' : 'data_entry'
  }
  if (fields.isActive !== undefined) payload.isActive = Boolean(fields.isActive)

  try {
    let response
    try {
      response = await api.patch(
        `/api/admin/users/${encodeURIComponent(cleanId)}`,
        payload,
      )
    } catch (err) {
      if (err?.response?.status === 404) {
        response = await api.patch(
          `/api/users/${encodeURIComponent(cleanId)}`,
          payload,
        )
      } else {
        throw err
      }
    }

    const updated = response.data?.user
    if (!updated || typeof updated !== 'object') {
      throw new Error('Server returned an unexpected response format.')
    }
    return normalizeUserRecord(updated)
  } catch (error) {
    if (!error?.response) {
      throw new Error(
        error instanceof Error && error.message.startsWith('Server returned')
          ? error.message
          : 'Unable to reach user update endpoint. Please check your connection.',
        { cause: error },
      )
    }

    const { status, data } = error.response
    if (status === 400) {
      throw new Error(data?.message || 'Invalid user update request.', {
        cause: error,
      })
    }
    if (status === 401) {
      throw new Error(
        data?.message ||
          'You must be signed in as an Administrator to update user accounts.',
        { cause: error },
      )
    }
    if (status === 403) {
      throw new Error(
        data?.message || 'Only Administrators are permitted to update users.',
        { cause: error },
      )
    }
    if (status === 404) {
      throw new Error(data?.message || 'User account not found on server.', {
        cause: error,
      })
    }
    if (status === 409) {
      throw new Error(
        data?.message ||
          'Another user account already uses this email address.',
        { cause: error },
      )
    }

    throw new Error(data?.message || 'Failed to update user account.', {
      cause: error,
    })
  }
}

