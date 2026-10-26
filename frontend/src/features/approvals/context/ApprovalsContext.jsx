/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  MISSING_BACKEND_APPROVAL_ITEMS,
  buildApprovalNotifications,
  computeApprovalCounts,
  defaultApprovalService,
  normalizeApprovalRequest,
} from '../services/approvalService'

const EMPTY_COUNTS = {
  pending: 0,
  approved: 0,
  rejected: 0,
  total: 0,
}

const DEFAULT_CONTEXT_VALUE = {
  requests: [],
  notifications: [],
  counts: EMPTY_COUNTS,
  pendingCount: 0,
  isLoading: false,
  isRefreshing: false,
  error: '',
  integrationStatus: 'unauthenticated',
  capabilities: {
    canApprove: false,
    canReject: false,
    supportsRejectionReason: false,
  },
  missingItems: MISSING_BACKEND_APPROVAL_ITEMS,
  selectedNotificationRequestId: null,
  refreshApprovals: async () => {},
  approveRequest: async () => {
    throw new Error('ApprovalsProvider is not mounted.')
  },
  rejectRequest: async () => {
    throw new Error('ApprovalsProvider is not mounted.')
  },
  focusApprovalRequest: () => {},
  clearFocusedApprovalRequest: () => {},
}

const ApprovalsContext = createContext(DEFAULT_CONTEXT_VALUE)

export function ApprovalsProvider({
  currentUser,
  serviceAdapter = defaultApprovalService,
  children,
}) {
  const [requests, setRequests] = useState([])
  const [serverNotifications, setServerNotifications] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [integrationStatus, setIntegrationStatus] = useState('unauthenticated')
  const [capabilities, setCapabilities] = useState({
    canApprove: false,
    canReject: false,
    supportsRejectionReason: false,
  })
  const [missingItems, setMissingItems] = useState(
    MISSING_BACKEND_APPROVAL_ITEMS,
  )
  const [selectedNotificationRequestId, setSelectedNotificationRequestId] =
    useState(null)

  const applyApprovalPayload = useCallback((result) => {
    const nextRequests = Array.isArray(result?.requests) ? result.requests : []
    setRequests(nextRequests)
    setServerNotifications(
      Array.isArray(result?.notifications) ? result.notifications : null,
    )
    setIntegrationStatus(result?.integrationStatus || 'ready')
    setCapabilities({
      canApprove: Boolean(result?.capabilities?.canApprove),
      canReject: Boolean(result?.capabilities?.canReject),
      supportsRejectionReason: Boolean(
        result?.capabilities?.supportsRejectionReason,
      ),
    })
    setMissingItems(
      Array.isArray(result?.missingItems) ? result.missingItems : [],
    )
    setError('')
  }, [])

  const refreshApprovals = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError('')

      try {
        const result = await serviceAdapter.fetchSignupApprovals()
        applyApprovalPayload(result)
        return result
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unable to load signup approval requests right now.'
        setError(message)
        return null
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [serviceAdapter, applyApprovalPayload],
  )

  useEffect(() => {
    let cancelled = false

    serviceAdapter
      .fetchSignupApprovals()
      .then((result) => {
        if (!cancelled) {
          applyApprovalPayload(result)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load signup approval requests right now.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.email, serviceAdapter, applyApprovalPayload])

  useEffect(() => {
    if (typeof document === 'undefined' || !currentUser) {
      return undefined
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshApprovals({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [currentUser, refreshApprovals])

  const counts = useMemo(() => computeApprovalCounts(requests), [requests])

  const notifications = useMemo(() => {
    if (Array.isArray(serverNotifications)) {
      return serverNotifications
    }
    return buildApprovalNotifications(requests)
  }, [requests, serverNotifications])

  const approveRequest = useCallback(
    async (requestId) => {
      const updated = await serviceAdapter.approveSignupRequest(requestId)
      const normalizedUpdated = updated
        ? normalizeApprovalRequest({
            ...updated,
            approvalStatus: updated.approvalStatus || 'approved',
          })
        : null

      setServerNotifications(null)
      setRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? normalizedUpdated || {
                ...item,
                approvalStatus: 'approved',
                approvalStatusLabel: 'Approved',
                reviewedAt: new Date().toISOString(),
              }
            : item,
        ),
      )

      await refreshApprovals({ silent: true })
      return normalizedUpdated
    },
    [serviceAdapter, refreshApprovals],
  )

  const rejectRequest = useCallback(
    async (requestId, options = {}) => {
      const updated = await serviceAdapter.rejectSignupRequest(
        requestId,
        options,
      )
      const normalizedUpdated = updated
        ? normalizeApprovalRequest({
            ...updated,
            approvalStatus: updated.approvalStatus || 'rejected',
          })
        : null

      setServerNotifications(null)
      setRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? normalizedUpdated || {
                ...item,
                approvalStatus: 'rejected',
                approvalStatusLabel: 'Rejected',
                rejectionReason: options?.reason
                  ? String(options.reason).trim()
                  : item.rejectionReason,
                reviewedAt: new Date().toISOString(),
              }
            : item,
        ),
      )

      await refreshApprovals({ silent: true })
      return normalizedUpdated
    },
    [serviceAdapter, refreshApprovals],
  )

  const focusApprovalRequest = useCallback((requestId) => {
    setSelectedNotificationRequestId(requestId || null)
  }, [])

  const clearFocusedApprovalRequest = useCallback(() => {
    setSelectedNotificationRequestId(null)
  }, [])

  const contextValue = useMemo(
    () => ({
      requests,
      notifications,
      counts,
      pendingCount: counts.pending,
      isLoading,
      isRefreshing,
      error,
      integrationStatus,
      capabilities,
      missingItems,
      selectedNotificationRequestId,
      refreshApprovals,
      approveRequest,
      rejectRequest,
      focusApprovalRequest,
      clearFocusedApprovalRequest,
    }),
    [
      requests,
      notifications,
      counts,
      isLoading,
      isRefreshing,
      error,
      integrationStatus,
      capabilities,
      missingItems,
      selectedNotificationRequestId,
      refreshApprovals,
      approveRequest,
      rejectRequest,
      focusApprovalRequest,
      clearFocusedApprovalRequest,
    ],
  )

  return (
    <ApprovalsContext.Provider value={contextValue}>
      {children}
    </ApprovalsContext.Provider>
  )
}

export function useApprovalsContext() {
  return useContext(ApprovalsContext)
}
