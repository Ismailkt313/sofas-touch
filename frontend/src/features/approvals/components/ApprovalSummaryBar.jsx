export function ApprovalSummaryBar({
  counts,
  activeStatus,
  onSelectStatus,
  integrationStatus,
}) {
  const pending = counts?.pending ?? 0
  const approved = counts?.approved ?? 0
  const rejected = counts?.rejected ?? 0

  const pendingCaption =
    integrationStatus === 'missing_backend_api'
      ? 'Awaiting backend approval endpoint connection'
      : integrationStatus === 'unauthenticated'
        ? 'Sign in as Administrator to load live counts'
        : pending === 0
          ? 'No signup requests currently awaiting review'
          : pending === 1
            ? '1 Data Entry signup request needs review'
            : `${pending} Data Entry signup requests need review`

  return (
    <section
      className="approvals-summary"
      aria-label="Signup approval summary"
    >
      <button
        type="button"
        className={`approvals-summary__card approvals-summary__card--pending${activeStatus === 'pending' ? ' approvals-summary__card--selected' : ''
          }`}
        onClick={() => onSelectStatus?.('pending')}
      >
        <div className="approvals-summary__top">
          <span className="approvals-summary__label">Pending Requests</span>
          {pending > 0 ? (
            <span className="approvals-summary__attention-pill">
              Action needed
            </span>
          ) : null}
        </div>
        <span className="approvals-summary__value">{pending}</span>
        <span className="approvals-summary__caption">{pendingCaption}</span>
      </button>

      <button
        type="button"
        className={`approvals-summary__card${activeStatus === 'approved'
            ? ' approvals-summary__card--selected'
            : ''
          }`}
        onClick={() => onSelectStatus?.('approved')}
      >
        <div className="approvals-summary__top">
          <span className="approvals-summary__label">Approved</span>
        </div>
        <span className="approvals-summary__value">{approved}</span>
        <span className="approvals-summary__caption">
          Approved Data Entry signups
        </span>
      </button>

      <button
        type="button"
        className={`approvals-summary__card${activeStatus === 'rejected'
            ? ' approvals-summary__card--selected'
            : ''
          }`}
        onClick={() => onSelectStatus?.('rejected')}
      >
        <div className="approvals-summary__top">
          <span className="approvals-summary__label">Rejected</span>
        </div>
        <span className="approvals-summary__value">{rejected}</span>
        <span className="approvals-summary__caption">
          Declined signup requests
        </span>
      </button>
    </section>
  )
}
