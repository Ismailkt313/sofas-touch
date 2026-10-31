import { useEffect, useRef } from 'react'
import {
  formatActivityTimestamp,
  formatHumanReadableActivity,
  resolvePermittedActivityPath,
} from '../utils/activityFormatters'

export function ActivityDetailsDrawer({
  item,
  userRole = 'data_entry',
  onClose,
  onNavigate,
}) {
  const drawerRef = useRef(null)

  useEffect(() => {
    if (!item) return undefined

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    // Prevent body scrolling while drawer is open
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [item, onClose])

  if (!item) return null

  const human = formatHumanReadableActivity(item)
  const timeInfo = formatActivityTimestamp(item.timestamp)
  const permittedPath = resolvePermittedActivityPath(item, userRole)

  const handleNavigate = () => {
    if (!permittedPath) return
    onClose?.()
    onNavigate?.(permittedPath)
  }

  return (
    <div
      className="sts-act-drawer-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={drawerRef}
        className="sts-act-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sts-act-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="sts-act-drawer__header">
          <div className="sts-act-drawer__badges">
            <span
              className={`sts-act-badge sts-act-badge--${human.tone}`}
            >
              {human.moduleBadge}
            </span>
            <span className="sts-act-drawer__action-pill">
              {human.title}
            </span>
          </div>

          <button
            type="button"
            className="sts-act-drawer__close"
            onClick={onClose}
            aria-label="Close activity details"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Drawer Content */}
        <div className="sts-act-drawer__body">
          <h2 id="sts-act-drawer-title" className="sts-act-drawer__title">
            {human.description}
          </h2>

          <div className="sts-act-drawer__meta-grid">
            <div className="sts-act-drawer__meta-row">
              <span className="sts-act-drawer__meta-label">Performed By</span>
              <span className="sts-act-drawer__meta-val sts-act-drawer__actor">
                <strong>{item.actorName || 'Workspace User'}</strong>
                <span className="sts-act-drawer__role-tag">
                  {item.actorRole === 'admin'
                    ? 'Administrator'
                    : 'Data Entry Operator'}
                </span>
              </span>
            </div>

            <div className="sts-act-drawer__meta-row">
              <span className="sts-act-drawer__meta-label">Date &amp; Time</span>
              <span className="sts-act-drawer__meta-val">
                {timeInfo.full}
                <span className="sts-act-drawer__relative">
                  ({timeInfo.relative})
                </span>
              </span>
            </div>

            <div className="sts-act-drawer__meta-row">
              <span className="sts-act-drawer__meta-label">Module &amp; Action</span>
              <span className="sts-act-drawer__meta-val">
                {human.moduleBadge} &bull; <code>{item.actionType}</code>
              </span>
            </div>

            {item.entityLabel ? (
              <div className="sts-act-drawer__meta-row">
                <span className="sts-act-drawer__meta-label">
                  Affected Record
                </span>
                <span className="sts-act-drawer__meta-val">
                  <strong>{item.entityLabel}</strong>
                  {item.entityId && item.entityId !== item.entityLabel ? (
                    <code className="sts-act-drawer__code-sub">
                      {item.entityId}
                    </code>
                  ) : null}
                </span>
              </div>
            ) : null}

            {item.projectName || item.projectCode ? (
              <div className="sts-act-drawer__meta-row">
                <span className="sts-act-drawer__meta-label">
                  Linked Project
                </span>
                <span className="sts-act-drawer__meta-val">
                  <strong>{item.projectCode}</strong>
                  {item.projectName ? ` — ${item.projectName}` : ''}
                </span>
              </div>
            ) : null}

            <div className="sts-act-drawer__meta-row">
              <span className="sts-act-drawer__meta-label">Audit Event ID</span>
              <span className="sts-act-drawer__meta-val">
                <code className="sts-act-drawer__id-code">{item.id}</code>
              </span>
            </div>
          </div>

          {/* Action Destination */}
          <div className="sts-act-drawer__footer">
            {permittedPath ? (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={handleNavigate}
              >
                <span>View Related Record</span>
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.44 8 6.22 4.78a.75.75 0 010-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            ) : (
              <p className="sts-act-drawer__restricted-notice">
                {item.actionType?.endsWith('.deleted')
                  ? 'This record has been deleted from the database.'
                  : 'Access to this record is restricted based on your role permissions.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

