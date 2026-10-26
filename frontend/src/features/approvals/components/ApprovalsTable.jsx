import { UserAvatar } from '../../users/components/UserAvatar'
import { formatApprovalDate } from '../services/approvalService'
import { ApprovalStatusBadge } from './ApprovalStatusBadge'

export function ApprovalsTable({
  requests,
  processingRequestId,
  onViewDetails,
  onRequestApprove,
  onRequestReject,
}) {
  return (
    <div className="approvals-table-wrap">
      <table className="approvals-table">
        <thead>
          <tr>
            <th scope="col">Applicant</th>
            <th scope="col">Email</th>
            <th scope="col" className="approvals-table__col-phone">
              Phone
            </th>
            <th scope="col">Signup Date</th>
            <th scope="col">Status</th>
            <th scope="col" className="approvals-table__col-actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const isPending = request.approvalStatus === 'pending'
            const isBusy = processingRequestId === request.id

            return (
              <tr key={request.id || request.email}>
                <td>
                  <div className="approvals-cell-applicant">
                    <UserAvatar name={request.name} image={request.image} />
                    <div className="approvals-cell-applicant__meta">
                      <span className="approvals-cell-applicant__name">
                        {request.name}
                      </span>
                      <span className="approvals-cell-applicant__sub-tablet">
                        {request.phone || 'No phone provided'}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="approvals-cell-email">{request.email}</span>
                </td>
                <td className="approvals-table__col-phone">
                  <span className={request.phone ? '' : 'approvals-cell-muted'}>
                    {request.phone || '—'}
                  </span>
                </td>
                <td>
                  <span className="approvals-cell-date">
                    {formatApprovalDate(request.signupDate)}
                  </span>
                </td>
                <td>
                  <ApprovalStatusBadge
                    status={request.approvalStatus}
                    statusLabel={request.approvalStatusLabel}
                  />
                </td>
                <td className="approvals-table__col-actions">
                  <div className="approvals-row-actions">
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
