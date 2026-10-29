import { formatDashboardDate } from '../utils/dashboardFormatters'

export function PendingApprovalsCard({
  pendingApprovals,
  contextPendingCount,
  onNavigate,
}) {
  if (!pendingApprovals) {
    return null
  }

  const effectiveCount =
    typeof contextPendingCount === 'number' && contextPendingCount >= 0
      ? Math.max(pendingApprovals.count, contextPendingCount)
      : pendingApprovals.count

  const previewItems = Array.isArray(pendingApprovals.items)
    ? pendingApprovals.items.slice(0, 4)
    : []

  const handleLinkClick = (event, path) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      onNavigate?.(path)
    }
  }

  return (
    <section
      className="sts-dash-card sts-dash-approvals-card"
      aria-labelledby="sts-dash-approvals-heading"
    >
      <header className="sts-dash-card__header">
        <div>
          <span className="sts-dash-card__eyebrow">Admin Access Control</span>
          <h2 id="sts-dash-approvals-heading" className="sts-dash-card__title">
            Pending User Approvals
          </h2>
        </div>

        <span
          className={`sts-dash-approvals-count${effectiveCount > 0 ? ' sts-dash-approvals-count--active' : ''}`}
        >
          {effectiveCount}
        </span>
      </header>

      {effectiveCount === 0 ? (
        <p className="sts-dash-approvals-empty">
          All Data Entry operator signup requests have been reviewed.
        </p>
      ) : (
        <>
          <p className="sts-dash-approvals-note">
            {effectiveCount}{' '}
            {effectiveCount === 1
              ? 'account signup request awaits'
              : 'account signup requests await'}{' '}
            administrator verification.
          </p>

          {previewItems.length > 0 ? (
            <ul className="sts-dash-approvals-list">
              {previewItems.map((u) => (
                <li key={u.id} className="sts-dash-approvals-item">
                  <div className="sts-dash-approvals-item__info">
                    <strong>{u.name}</strong>
                    <span>{u.email}</span>
                  </div>
                  <span className="sts-dash-approvals-item__date">
                    {formatDashboardDate(u.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}

      <div className="sts-dash-approvals-footer">
        <a
          href="/user-approvals"
          className={`sts-dash-link-btn${effectiveCount > 0 ? '' : ' sts-dash-link-btn--subtle'}`}
          onClick={(e) => handleLinkClick(e, '/user-approvals')}
        >
          {effectiveCount > 0 ? 'Review Pending Approvals' : 'Open Approvals'}
        </a>
      </div>
    </section>
  )
}
