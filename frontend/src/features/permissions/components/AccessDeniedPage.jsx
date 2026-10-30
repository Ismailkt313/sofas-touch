import { useState } from 'react'
import {
  normalizeRoleKey,
  PERMISSION_LABELS,
} from '../constants/permissionsCatalog'
import '../styles/permissions.css'

export function AccessDeniedPage({
  pathname,
  currentUser,
  accessEvaluation,
  onNavigate,
  onRefreshPermissions,
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const roleKey = normalizeRoleKey(currentUser?.role)
  const roleLabel =
    roleKey === 'admin' ? 'Administrator' : 'Data Entry Operator'
  const moduleTitle = accessEvaluation?.moduleTitle || 'Restricted Section'
  const reason =
    accessEvaluation?.reason ||
    'Your account does not have permission to open this workspace section.'
  const fallbackPath = accessEvaluation?.fallbackPath || '/dashboard'
  const missingLabels = (accessEvaluation?.requiredKeys || []).map(
    (k) => PERMISSION_LABELS[k] || k,
  )

  const handleRefresh = async () => {
    if (typeof onRefreshPermissions !== 'function' || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefreshPermissions()
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="rbac-denied-shell" role="alert" aria-live="polite">
      <div className="rbac-denied-card">
        <div className="rbac-denied-card__code-row">
          <span className="rbac-denied-card__status-code">403 Forbidden</span>
          <span className="rbac-denied-card__role-pill">{roleLabel}</span>
        </div>

        <div className="rbac-denied-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect
              x="4.5"
              y="10.5"
              width="15"
              height="10"
              rx="2.2"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <path
              d="M8 10.5V7.5C8 5.29086 9.79086 3.5 12 3.5C14.2091 3.5 16 5.29086 16 7.5V10.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <circle cx="12" cy="15.5" r="1.4" fill="currentColor" />
          </svg>
        </div>

        <h1 className="rbac-denied-card__title">
          Access Restricted: {moduleTitle}
        </h1>
        <p className="rbac-denied-card__reason">{reason}</p>

        <dl className="rbac-denied-card__meta">
          <div className="rbac-denied-card__meta-row">
            <dt>Requested Path</dt>
            <dd>
              <code>{pathname}</code>
            </dd>
          </div>
          {missingLabels.length > 0 ? (
            <div className="rbac-denied-card__meta-row">
              <dt>Required Permission</dt>
              <dd>{missingLabels.join(' + ')}</dd>
            </div>
          ) : null}
        </dl>

        <div className="rbac-denied-card__actions">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => onNavigate?.(fallbackPath)}
          >
            Return to Permitted Workspace
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Checking Access...' : 'Refresh Permissions'}
          </button>
        </div>
      </div>
    </div>
  )
}
