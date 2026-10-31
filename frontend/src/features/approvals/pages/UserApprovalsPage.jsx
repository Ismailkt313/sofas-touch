import { useListingState } from '../../../services/navigationState'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Toast } from '../../../components/common'
import { ApprovalDetailsModal } from '../components/ApprovalDetailsModal'
import { ApprovalFiltersBar } from '../components/ApprovalFiltersBar'
import { ApprovalsMobileList } from '../components/ApprovalsMobileList'
import { ApprovalsTable } from '../components/ApprovalsTable'
import { ApprovalSummaryBar } from '../components/ApprovalSummaryBar'
import { ConfirmApprovalActionModal } from '../components/ConfirmApprovalActionModal'
import { useApprovalsContext } from '../context/ApprovalsContext'
import '../styles/approvals.css'


const APPROVALS_LISTING_SCHEMA = {
  search: { type: 'string', default: '' },
  status: { type: 'string', default: 'pending' },
}
export function UserApprovalsPage({ currentUser, onNavigate }) {
  const {
    requests,
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
    clearFocusedApprovalRequest,
  } = useApprovalsContext()

  const { values, setValue, resetAll } = useListingState(APPROVALS_LISTING_SCHEMA, {
    routeKey: 'user-approvals',
  })
  const statusFilter = values.status
  const [searchQuery, setSearchQuery] = useState(values.search)

  useEffect(() => {
    setSearchQuery(values.search)
  }, [values.search])

  const setStatusFilter = useCallback((val) => {
    setValue('status', val)
  }, [setValue])

  const handleSearchChange = useCallback((val) => {
    setSearchQuery(val)
    setValue('search', val)
  }, [setValue])
  const [viewingRequestId, setViewingRequestId] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [processingRequestId, setProcessingRequestId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [feedbackBanner, setFeedbackBanner] = useState(null)
  const [isIntegrationBannerExpanded, setIsIntegrationBannerExpanded] =
    useState(false)

  const activeViewingRequest = useMemo(() => {
    const targetId = viewingRequestId || selectedNotificationRequestId
    if (!targetId) {
      return null
    }
    return requests.find((item) => item.id === targetId) || null
  }, [viewingRequestId, selectedNotificationRequestId, requests])

  const hasActiveFilters =
    Boolean(searchQuery.trim()) || statusFilter !== 'pending'

  const resetFilters = useCallback(() => {
    setSearchQuery('')
    resetAll()
  }, [resetAll])

  const statusFilteredRequests = useMemo(() => {
    if (statusFilter === 'all') {
      return requests
    }
    return requests.filter((item) => item.approvalStatus === statusFilter)
  }, [requests, statusFilter])

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return statusFilteredRequests
    }

    return statusFilteredRequests.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query),
    )
  }, [statusFilteredRequests, searchQuery])

  const handleOpenDetails = useCallback((request) => {
    setViewingRequestId(request?.id || null)
  }, [])

  const handleCloseDetails = useCallback(() => {
    setViewingRequestId(null)
    clearFocusedApprovalRequest()
  }, [clearFocusedApprovalRequest])

  const handleRequestApprove = useCallback((request) => {
    if (!request) return
    setActionError('')
    setConfirmTarget({ request, action: 'approve' })
  }, [])

  const handleRequestReject = useCallback((request) => {
    if (!request) return
    setActionError('')
    setConfirmTarget({ request, action: 'reject' })
  }, [])

  const handleCancelConfirm = useCallback(() => {
    if (processingRequestId) {
      return
    }
    setActionError('')
    setConfirmTarget(null)
  }, [processingRequestId])

  const handleConfirmAction = useCallback(
    async (reason) => {
      if (!confirmTarget?.request || processingRequestId) {
        return
      }

      const { request, action } = confirmTarget
      setProcessingRequestId(request.id)
      setActionError('')

      try {
        if (action === 'reject') {
          await rejectRequest(request.id, { reason })
          setFeedbackBanner({
            type: 'success',
            message: `Rejected Data Entry signup request for ${request.name} (${request.email}).`,
          })
        } else {
          await approveRequest(request.id)
          setFeedbackBanner({
            type: 'success',
            message: `Approved Data Entry signup request for ${request.name} (${request.email}).`,
          })
        }
        setConfirmTarget(null)
        if (
          viewingRequestId === request.id ||
          selectedNotificationRequestId === request.id
        ) {
          setViewingRequestId(null)
          clearFocusedApprovalRequest()
        }
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : `Unable to ${action} this signup request. Please try again.`,
        )
      } finally {
        setProcessingRequestId(null)
      }
    },
    [
      confirmTarget,
      processingRequestId,
      approveRequest,
      rejectRequest,
      viewingRequestId,
      selectedNotificationRequestId,
      clearFocusedApprovalRequest,
    ],
  )

  const emptyStateCopy = useMemo(() => {
    if (statusFilter === 'approved') {
      return {
        title: 'No approved signup requests',
        message:
          'Approved Data Entry account applications will be listed here once reviewed.',
      }
    }
    if (statusFilter === 'rejected') {
      return {
        title: 'No rejected signup requests',
        message:
          'Declined Data Entry signup requests will appear in this view.',
      }
    }
    if (statusFilter === 'all') {
      return {
        title: 'No signup requests recorded',
        message:
          'New Data Entry account applications submitted from the signup page will appear here.',
      }
    }
    return {
      title: 'No pending signup requests',
      message:
        'All Data Entry account signup applications have been reviewed.',
    }
  }, [statusFilter])

  return (
    <div className="approvals-page">
      <header className="approvals-header">
        <div className="approvals-header__text">
          <h1 className="approvals-header__title">User Approvals</h1>
          <p className="approvals-header__subtitle">
            Review and manage Data Entry account signup requests.
          </p>
        </div>

        <div className="approvals-header__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => refreshApprovals({ silent: false })}
            disabled={isLoading || isRefreshing}
          >
            <svg
              className={
                isLoading || isRefreshing ? 'header-notifications__spin' : ''
              }
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M16.5 10A6.5 6.5 0 1 1 14.6 5.4L16.5 7.25V3.25"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {feedbackBanner ? (
        <Toast
          message={feedbackBanner.message || feedbackBanner.text || feedbackBanner}
          tone={feedbackBanner.type || feedbackBanner.tone || 'success'}
          onClose={() => setFeedbackBanner(null)}
        />
      ) : null}

      <ApprovalSummaryBar
        counts={counts}
        activeStatus={statusFilter}
        onSelectStatus={setStatusFilter}
        integrationStatus={integrationStatus}
      />

      {integrationStatus === 'missing_backend_api' && !isLoading && !error ? (
        <aside
          className={`approvals-integration-banner${
            isIntegrationBannerExpanded
              ? ' approvals-integration-banner--expanded'
              : ''
          }`}
          aria-label="Backend approval integration status"
        >
          <div className="approvals-integration-banner__header">
            <div className="approvals-integration-banner__header-main">
              <span className="approvals-integration-banner__badge">
                Backend API Pending
              </span>
              <strong className="approvals-integration-banner__title">
                Signup approval &amp; notification endpoints are not yet
                configured on the server
              </strong>
            </div>
            <button
              type="button"
              className="approvals-integration-banner__toggle"
              onClick={() => setIsIntegrationBannerExpanded((prev) => !prev)}
              aria-expanded={isIntegrationBannerExpanded}
            >
              {isIntegrationBannerExpanded ? 'Hide' : 'Details'}
            </button>
          </div>
          <div className="approvals-integration-banner__details">
            <p className="approvals-integration-banner__desc">
              No fake requests or simulated approvals are shown. Once the
              backend exposes approval status fields and review endpoints,
              pending Data Entry signups and header notifications will populate
              here automatically.
            </p>
            {missingItems.length > 0 ? (
              <ul className="approvals-integration-banner__list">
                {missingItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </aside>
      ) : null}

      <section
        className="approvals-panel"
        aria-label="Signup approval requests"
      >
        <ApprovalFiltersBar
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          counts={counts}
          filteredCount={filteredRequests.length}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={resetFilters}
        />

        {isLoading ? (
          <div
            className="approvals-skeleton-wrap"
            role="status"
            aria-label="Loading signup approval requests"
          >
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="approvals-skeleton-row">
                <span className="approvals-skeleton-avatar" />
                <div className="approvals-skeleton-lines">
                  <span className="approvals-skeleton-bar approvals-skeleton-bar--name" />
                  <span className="approvals-skeleton-bar approvals-skeleton-bar--email" />
                </div>
                <span className="approvals-skeleton-pill" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="approvals-state" role="alert">
            <div
              className="approvals-state__icon approvals-state__icon--error"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M12 7.5V12.5M12 16H12.01"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="approvals-state__title">
              Unable to load approval requests
            </h2>
            <p className="approvals-state__message">{error}</p>
            <div className="approvals-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => refreshApprovals({ silent: false })}
              >
                Retry
              </button>
              {!currentUser ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => onNavigate?.('/login')}
                >
                  Go to Sign In
                </button>
              ) : null}
            </div>
          </div>
        ) : integrationStatus === 'unauthenticated' ? (
          <div className="approvals-state">
            <div className="approvals-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect
                  x="5"
                  y="11"
                  width="14"
                  height="9"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M8 11V8C8 5.79086 9.79086 4 12 4C14.2091 4 16 5.79086 16 8V11"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="approvals-state__title">
              Administrator sign-in required
            </h2>
            <p className="approvals-state__message">
              Sign in with an Administrator account to inspect and manage Data
              Entry signup requests.
            </p>
            <div className="approvals-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => onNavigate?.('/login')}
              >
                Sign In as Administrator
              </button>
            </div>
          </div>
        ) : integrationStatus === 'missing_backend_api' ? (
          <div className="approvals-state">
            <div className="approvals-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="10"
                  cy="8.5"
                  r="3.25"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M4.25 18.5C4.85 15.6 7.05 14 10 14C11.4 14 12.68 14.36 13.7 15.05"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path
                  d="M15.25 14.75L17.25 16.75L20.75 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="approvals-state__title">
              Awaiting backend approval endpoint integration
            </h2>
            <p className="approvals-state__message">
              Public signups on <code>POST /api/auth/signup</code> currently
              create active Data Entry accounts directly without a pending
              approval queue. Connect the backend approval APIs to review
              requests here.
            </p>
            <div className="approvals-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => onNavigate?.('/users')}
              >
                View User Management
              </button>
            </div>
          </div>
        ) : statusFilteredRequests.length === 0 && !searchQuery.trim() ? (
          <div className="approvals-state">
            <div className="approvals-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="8.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M8.5 12.25L11 14.75L15.75 9.75"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="approvals-state__title">{emptyStateCopy.title}</h2>
            <p className="approvals-state__message">
              {emptyStateCopy.message}
            </p>
            {statusFilter !== 'all' && counts.total > 0 ? (
              <div className="approvals-state__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={() => setStatusFilter('all')}
                >
                  View all requests ({counts.total})
                </button>
              </div>
            ) : null}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="approvals-state">
            <div className="approvals-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="10.5"
                  cy="10.5"
                  r="6.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M15.5 15.5L20 20"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="approvals-state__title">
              No matching applicants found
            </h2>
            <p className="approvals-state__message">
              No signup requests matched &ldquo;{searchQuery.trim()}&rdquo; in
              the current filter. Try another name or email address.
            </p>
            <div className="approvals-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            </div>
          </div>
        ) : (
          <>
            <ApprovalsTable
              requests={filteredRequests}
              processingRequestId={processingRequestId}
              onViewDetails={handleOpenDetails}
              onRequestApprove={handleRequestApprove}
              onRequestReject={handleRequestReject}
            />

            <ApprovalsMobileList
              requests={filteredRequests}
              processingRequestId={processingRequestId}
              onViewDetails={handleOpenDetails}
              onRequestApprove={handleRequestApprove}
              onRequestReject={handleRequestReject}
            />

            <div className="approvals-footer-summary">
              <span>
                Showing <strong>{filteredRequests.length}</strong>{' '}
                {filteredRequests.length === 1
                  ? 'signup request'
                  : 'signup requests'}
              </span>
            </div>
          </>
        )}
      </section>

      <ApprovalDetailsModal
        request={activeViewingRequest}
        onClose={handleCloseDetails}
        onRequestApprove={handleRequestApprove}
        onRequestReject={handleRequestReject}
      />

      {confirmTarget ? (
        <ConfirmApprovalActionModal
          key={`${confirmTarget.request.id}-${confirmTarget.action}`}
          target={confirmTarget}
          supportsRejectionReason={capabilities.supportsRejectionReason}
          isSubmitting={processingRequestId === confirmTarget.request.id}
          errorMessage={actionError}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelConfirm}
        />
      ) : null}
    </div>
  )
}
