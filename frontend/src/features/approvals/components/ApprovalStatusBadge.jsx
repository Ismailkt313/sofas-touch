export function ApprovalStatusBadge({ status, statusLabel }) {
  const normalized = String(status || 'pending').toLowerCase()
  const modifier =
    normalized === 'approved'
      ? 'approval-badge--approved'
      : normalized === 'rejected'
        ? 'approval-badge--rejected'
        : 'approval-badge--pending'

  const label =
    statusLabel ||
    (normalized === 'approved'
      ? 'Approved'
      : normalized === 'rejected'
        ? 'Rejected'
        : 'Pending')

  return (
    <span className={`approval-badge ${modifier}`}>
      <span className="approval-badge__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
