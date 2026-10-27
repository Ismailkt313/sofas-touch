import { UserAvatar } from '../../users/components/UserAvatar'
import { formatApprovalDate } from '../services/approvalService'
import { ApprovalStatusBadge } from './ApprovalStatusBadge'

export function ApprovalsMobileList({
  requests,
  processingRequestId,
  onViewDetails,
  onRequestApprove,
  onRequestReject,
}) {
  return (
    <div
      className="approvals-mobile-list"
      role="list"
      aria-label="Signup approval requests"
    >
      {requests.map((request) => {
        const isPending = request.approvalStatus === 'pending'
        const isBusy = processingRequestId === request.id
        const hasPhone = Boolean(request.phone && String(request.phone).trim())

        return (
          <article
            key={request.id || request.email}
            className={`approvals-mobile-card${
              isPending ? ' approvals-mobile-card--pending' : ''
            }`}
            role="listitem"
          >
            <div className="approvals-mobile-card__top">
              <div className="approvals-mobile-card__identity">
                <UserAvatar name={request.name} image={request.image} />
                <div className="approvals-mobile-card__title-group">
                  <button
                    type="button"
                    className="approvals-mobile-card__name-btn"
                    onClick={() => onViewDetails(request)}
                  >
                    {request.name || 'Unnamed Applicant'}
                  </button>
                  <p className="approvals-mobile-card__email">
                    {request.email}
                  </p>
                </div>
              </div>

              <ApprovalStatusBadge
                status={request.approvalStatus}
                statusLabel={request.approvalStatusLabel}
              />
            </div>

            <div className="approvals-mobile-card__submeta">
              <span>Applied {formatApprovalDate(request.signupDate)}</span>
              {hasPhone ? (
                <>
                  <span aria-hidden="true">&bull;</span>
                  <span>{request.phone}</span>
                </>
              ) : null}
            </div>

            {isPending ? (
              <div className="approvals-mobile-card__actions">
                <button
                  type="button"
                  className="approvals-action-btn approvals-action-btn--approve approvals-mobile-card__primary-action"
                  onClick={() => onRequestApprove(request)}
                  disabled={isBusy}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="approvals-action-btn approvals-action-btn--reject approvals-mobile-card__secondary-action"
                  onClick={() => onRequestReject(request)}
                  disabled={isBusy}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="approvals-action-btn approvals-action-btn--neutral approvals-mobile-card__details-btn"
                  onClick={() => onViewDetails(request)}
                  disabled={isBusy}
                >
                  Details
                </button>
              </div>
            ) : (
              <div className="approvals-mobile-card__reviewed-footer">
                <button
                  type="button"
                  className="approvals-mobile-card__details-link"
                  onClick={() => onViewDetails(request)}
                >
                  <span>View request details</span>
                  <svg viewBox="0 0 15 15" fill="none" aria-hidden="true">
                    <path
                      d="M5.5 3.5L9.5 7.5L5.5 11.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
