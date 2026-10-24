export function RoleBadge({ roleKey, roleLabel }) {
  const isAdmin = roleKey === 'admin'
  return (
    <span
      className={`user-badge ${
        isAdmin ? 'user-badge--role-admin' : 'user-badge--role-entry'
      }`}
    >
      {roleLabel || (isAdmin ? 'Admin' : 'Data Entry')}
    </span>
  )
}

export function StatusBadge({ isActive, statusLabel }) {
  return (
    <span
      className={`user-badge ${
        isActive ? 'user-badge--status-active' : 'user-badge--status-inactive'
      }`}
    >
      <span className="user-badge__dot" aria-hidden="true" />
      <span>{statusLabel || (isActive ? 'Active' : 'Inactive')}</span>
    </span>
  )
}
