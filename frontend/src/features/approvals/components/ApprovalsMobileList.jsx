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
    <div className="approvals-mobile-list" role="list">
      {requests.map((request) => {
        const isPending = request.approvalStatus === 'pending'
        const isBusy = processingRequestId === request.id

        return (
          <article
            key={request.id || request.email}
            className="approvals-mobile-card"
            role="listitem"
          >
            <div className="approvals-mobile-card__top">
              <div className="approvals-mobile-card__identity">
                <UserAvatar name={request.name} image={request.image} />
                <div className="approvals-mobile-card__title-group">
                  <h3 className="approvals-mobile-card__name">
                    {request.name}
                  </h3>
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

            <dl className="approvals-mobile-card__meta">
              <div className="approvals-mobile-card__meta-item">
                <dt>Phone</dt>
                <dd>{request.phone || 'Not provided'}</dd>
              </div>
              <div className="approvals-mobile-card__meta-item">
                <dt>Signup Date</dt>
                <dd>{formatApprovalDate(request.signupDate)}</dd>
              </div>
            </dl>

            <div className="approvals-mobile-card__actions">
              <button
                type="button"
                className="approvals-action-btn approvals-action-btn--neutral"
                onClick={() => onViewDetails(request)}
                disabled={isBusy}
              >
                View Details
              </button>
              {isPending ? (
                <>
                  <button
                    type="button"
                    className="approvals-action-btn approvals-action-btn--approve"
                    onClick={() => onRequestApprove(request)}
                    disabled={isBusy}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="approvals-action-btn approvals-action-btn--reject"
                    onClick={() => onRequestReject(request)}
                    disabled={isBusy}
                  >
                    Reject
                  </button>
                </>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
