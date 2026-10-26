import { useEffect, useId, useRef } from 'react'
import { UserAvatar } from '../../users/components/UserAvatar'
import { formatApprovalDateTime } from '../services/approvalService'
import { ApprovalStatusBadge } from './ApprovalStatusBadge'

export function ApprovalDetailsModal({
  request,
  onClose,
  onRequestApprove,
  onRequestReject,
}) {
  const titleId = useId()
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!request) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [request, onClose])

  if (!request) {
    return null
  }

  const isPending = request.approvalStatus === 'pending'

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="admin-modal__header">
          <div>
            <h2 id={titleId} className="admin-modal__title">
              Signup Request Details
            </h2>
            <p className="admin-modal__subtitle">
              Applicant profile and Data Entry account approval status.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Close request details dialog"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5L15 15M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="admin-modal__body">
          <div className="approval-detail-hero">
            <UserAvatar
              name={request.name}
              image={request.image}
              size="lg"
            />
            <div className="approval-detail-hero__info">
              <div className="approval-detail-hero__name-row">
                <span className="approval-detail-hero__name">
                  {request.name}
                </span>
                <ApprovalStatusBadge
                  status={request.approvalStatus}
                  statusLabel={request.approvalStatusLabel}
                />
              </div>
              <span className="approval-detail-hero__role">
                Requested Role: {request.roleLabel || 'Data Entry'}
              </span>
            </div>
          </div>

          <dl className="profile-details">
            <div className="profile-details__row">
              <dt>Email Address</dt>
              <dd>{request.email || '—'}</dd>
            </div>
            <div className="profile-details__row">
              <dt>Phone Number</dt>
              <dd>{request.phone || 'Not provided'}</dd>
            </div>
            <div className="profile-details__row">
              <dt>Requested Role</dt>
              <dd>{request.roleLabel || 'Data Entry'}</dd>
            </div>
            <div className="profile-details__row">
              <dt>Signup Date</dt>
              <dd>{formatApprovalDateTime(request.signupDate)}</dd>
            </div>
            {request.reviewedAt ? (
              <div className="profile-details__row">
                <dt>Reviewed At</dt>
                <dd>{formatApprovalDateTime(request.reviewedAt)}</dd>
              </div>
            ) : null}
            {request.rejectionReason ? (
              <div className="profile-details__row">
                <dt>Rejection Note</dt>
                <dd>{request.rejectionReason}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="admin-modal__footer">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onClose}
          >
            Close
          </button>
          {isPending ? (
            <>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={() => {
                  onClose()
                  onRequestReject?.(request)
                }}
              >
                Reject
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => {
                  onClose()
                  onRequestApprove?.(request)
                }}
              >
                Approve
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
