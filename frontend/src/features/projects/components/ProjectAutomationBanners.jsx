import { useState } from 'react'
import {
  formatCurrency,
  formatPercentage,
  formatProjectDate,
} from '../services/projectService'

export function ProjectAutomationBanners({
  adminAccess,
  automationState,
  onViewProject,
  onRunInactivityCheck,
  isEvaluatingInactivity,
}) {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      const saved = sessionStorage.getItem('sts_dismissed_project_alerts')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return sessionStorage.getItem('sts_project_alerts_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const handleDismiss = (alertKey) => {
    setDismissedAlerts((prev) => {
      if (prev.includes(alertKey)) return prev
      const next = [...prev, alertKey]
      try {
        sessionStorage.setItem('sts_dismissed_project_alerts', JSON.stringify(next))
      } catch {}
      return next
    })
  }

  const handleRestore = () => {
    setDismissedAlerts([])
    try {
      sessionStorage.removeItem('sts_dismissed_project_alerts')
    } catch {}
  }

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        sessionStorage.setItem('sts_project_alerts_collapsed', String(next))
      } catch {}
      return next
    })
  }

  if (!adminAccess || !automationState) {
    return null
  }

  if (automationState.status === 'loading') {
    return (
      <section
        className="projects-alerts-panel projects-alerts-panel--loading"
        aria-label="Loading project automation alerts"
        aria-busy="true"
      >
        <div className="projects-alerts-skeleton" />
      </section>
    )
  }

  if (automationState.status === 'unavailable') {
    return (
      <section
        className="projects-alerts-panel projects-alerts-panel--unavailable"
        role="status"
      >
        <div className="projects-alerts-panel__header">
          <div>
            <h2 className="projects-alerts-panel__title">
              Automation Alert Feeds Unavailable
            </h2>
            <p className="projects-alerts-panel__subtitle">
              {automationState.errorMessage ||
                'Backend cost threshold and inactivity endpoints could not be reached right now.'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  const activeCostAlerts = (automationState.costAlerts || []).filter(
    (item) => item.status === 'active',
  )
  const activeWarnings = (automationState.activityWarnings || []).filter(
    (item) => item.status === 'active',
  )

  const allCriticalAlerts = activeCostAlerts.filter(
    (item) => item.thresholdType === 'critical',
  )
  const allWarningAlerts = activeCostAlerts.filter(
    (item) => item.thresholdType === 'warning',
  )

  const visibleCriticalAlerts = allCriticalAlerts.filter(
    (item) => !dismissedAlerts.includes(item.id || `${item.projectId}-critical`),
  )
  const visibleWarningAlerts = allWarningAlerts.filter(
    (item) => !dismissedAlerts.includes(item.id || `${item.projectId}-warning`),
  )
  const visibleInactiveWarnings = activeWarnings.filter(
    (item) => !dismissedAlerts.includes(item.id || `${item.projectId}-inactive`),
  )

  const hasAnyActive = activeCostAlerts.length > 0 || activeWarnings.length > 0
  const hasCritical = visibleCriticalAlerts.length > 0
  const totalVisibleCount =
    visibleCriticalAlerts.length +
    visibleWarningAlerts.length +
    visibleInactiveWarnings.length
  const totalActiveCount =
    allCriticalAlerts.length + allWarningAlerts.length + activeWarnings.length
  const hiddenCount = totalActiveCount - totalVisibleCount

  return (
    <section
      className={`projects-alerts-wrapper${
        hasAnyActive ? '' : ' projects-alerts-wrapper--calm'
      }${hasCritical ? ' projects-alerts-wrapper--critical' : ''}`}
      aria-label="Project cost alerts and inactivity warnings"
    >
      <div className="projects-mobile-alert-bar">
        <button
          type="button"
          className={`projects-mobile-alert-toggle${
            hasCritical
              ? ' projects-mobile-alert-toggle--critical'
              : hasAnyActive
                ? ' projects-mobile-alert-toggle--active'
                : ''
          }`}
          onClick={() => setIsMobileExpanded((prev) => !prev)}
          aria-expanded={isMobileExpanded}
        >
          <div className="projects-mobile-alert-toggle__summary">
            <span
              className={`projects-mobile-alert-pill${
                visibleCriticalAlerts.length > 0 || visibleWarningAlerts.length > 0
                  ? hasCritical
                    ? ' projects-mobile-alert-pill--critical'
                    : ' projects-mobile-alert-pill--warning'
                  : ''
              }`}
            >
              <strong>{visibleCriticalAlerts.length + visibleWarningAlerts.length}</strong> cost{' '}
              {visibleCriticalAlerts.length + visibleWarningAlerts.length === 1
                ? 'alert'
                : 'alerts'}
            </span>
            <span
              className={`projects-mobile-alert-pill${
                visibleInactiveWarnings.length > 0
                  ? ' projects-mobile-alert-pill--inactive'
                  : ''
              }`}
            >
              <strong>{visibleInactiveWarnings.length}</strong> inactivity
            </span>
          </div>

          <span className="projects-mobile-alert-toggle__action">
            <span>{isMobileExpanded ? 'Hide' : 'Details'}</span>
            <svg
              className={`projects-mobile-alert-toggle__chevron${
                isMobileExpanded
                  ? ' projects-mobile-alert-toggle__chevron--open'
                  : ''
              }`}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

        {hasCritical && !isMobileExpanded ? (
          <div className="projects-mobile-critical-callout" role="alert">
            <span
              className="projects-mobile-critical-callout__dot"
              aria-hidden="true"
            />
            <span className="projects-mobile-critical-callout__text">
              Critical:{' '}
              <strong>
                {visibleCriticalAlerts
                  .slice(0, 2)
                  .map((item) => item.projectId)
                  .join(', ')}
                {visibleCriticalAlerts.length > 2
                  ? ` +${visibleCriticalAlerts.length - 2}`
                  : ''}
              </strong>{' '}
              at &ge;100% contract cost
            </span>
            {onViewProject && visibleCriticalAlerts[0]?.projectId ? (
              <button
                type="button"
                className="projects-mobile-critical-callout__link"
                onClick={() => onViewProject(visibleCriticalAlerts[0].projectId)}
              >
                Open
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={`projects-alerts-panel${
          isMobileExpanded ? ' projects-alerts-panel--mobile-open' : ''
        }${!hasAnyActive ? ' projects-alerts-panel--desktop-hidden' : ''}`}
      >
        <div className="projects-alerts-panel__header">
          <div>
            <h2 className="projects-alerts-panel__title">
              Active Project Alerts &amp; Warnings
            </h2>
            <p className="projects-alerts-panel__subtitle">
              {totalVisibleCount}{' '}
              {totalVisibleCount === 1 ? 'warning' : 'warnings'} requiring attention
              {hiddenCount > 0 ? ` (${hiddenCount} hidden)` : ''}
            </p>
          </div>

          <div className="projects-alerts-panel__header-actions">
            {hiddenCount > 0 ? (
              <button
                type="button"
                className="projects-alerts-panel__reset-btn"
                onClick={handleRestore}
                title="Unhide all dismissed warnings"
              >
                Restore Hidden ({hiddenCount})
              </button>
            ) : null}

            {hasAnyActive && totalVisibleCount > 0 ? (
              <button
                type="button"
                className="projects-alerts-panel__toggle-btn"
                onClick={handleToggleCollapse}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? 'Show warnings list' : 'Hide warnings list'}
              >
                <span>{isCollapsed ? 'Show Warnings' : 'Hide Warnings'}</span>
                <svg
                  className={`projects-alerts-panel__toggle-icon${
                    isCollapsed
                      ? ' projects-alerts-panel__toggle-icon--collapsed'
                      : ''
                  }`}
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {hasAnyActive && !isCollapsed ? (
          totalVisibleCount > 0 ? (
            <div className="projects-alerts-list">
              {visibleCriticalAlerts.map((alert) => {
                const alertKey = alert.id || `${alert.projectId}-critical`
                return (
                  <div
                    key={alertKey}
                    className="projects-alert-item projects-alert-item--critical"
                    role="alert"
                  >
                    <div className="projects-alert-item__body">
                      <div className="projects-alert-item__badges">
                        <span className="projects-alert-item__tag projects-alert-item__tag--critical">
                          Contract Value Reached / Exceeded
                        </span>
                        <span className="projects-alert-item__code">
                          {alert.projectId}
                        </span>
                      </div>
                      <p className="projects-alert-item__message">
                        {alert.message ||
                          `${alert.projectName}: Recorded cost (${formatCurrency(
                            alert.totalCost,
                          )}) has reached or exceeded contract value (${formatCurrency(
                            alert.contractValue,
                          )}).`}
                      </p>
                      <span className="projects-alert-item__meta">
                        Total Cost: {formatCurrency(alert.totalCost)} &bull;
                        Contract: {formatCurrency(alert.contractValue)}
                        {alert.contractValue > 0
                          ? ` (${formatPercentage(alert.costPercentage)})`
                          : ''}{' '}
                        &bull; Triggered {formatProjectDate(alert.triggeredAt)}
                      </span>
                    </div>

                    <div className="projects-alert-item__actions">
                      {onViewProject && alert.projectId ? (
                        <button
                          type="button"
                          className="projects-alert-item__action"
                          onClick={() => onViewProject(alert.projectId)}
                        >
                          View Project
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="projects-alert-item__dismiss-btn"
                        onClick={() => handleDismiss(alertKey)}
                        title="Hide this warning"
                        aria-label={`Hide warning for project ${alert.projectId}`}
                      >
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M4 4L12 12M12 4L4 12"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span>Hide</span>
                      </button>
                    </div>
                  </div>
                )
              })}

              {visibleWarningAlerts.map((alert) => {
                const alertKey = alert.id || `${alert.projectId}-warning`
                return (
                  <div
                    key={alertKey}
                    className="projects-alert-item projects-alert-item--warning"
                    role="status"
                  >
                    <div className="projects-alert-item__body">
                      <div className="projects-alert-item__badges">
                        <span className="projects-alert-item__tag projects-alert-item__tag--warning">
                          {formatPercentage(alert.thresholdPercent)} Cost
                          Threshold Warning
                        </span>
                        <span className="projects-alert-item__code">
                          {alert.projectId}
                        </span>
                      </div>
                      <p className="projects-alert-item__message">
                        {alert.message ||
                          `${alert.projectName} has reached ${formatPercentage(
                            alert.costPercentage,
                          )} of its contract value.`}
                      </p>
                      <span className="projects-alert-item__meta">
                        Total Cost: {formatCurrency(alert.totalCost)} of{' '}
                        {formatCurrency(alert.contractValue)} (
                        {formatPercentage(alert.costPercentage)}) &bull;
                        Triggered {formatProjectDate(alert.triggeredAt)}
                      </span>
                    </div>

                    <div className="projects-alert-item__actions">
                      {onViewProject && alert.projectId ? (
                        <button
                          type="button"
                          className="projects-alert-item__action"
                          onClick={() => onViewProject(alert.projectId)}
                        >
                          View Project
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="projects-alert-item__dismiss-btn"
                        onClick={() => handleDismiss(alertKey)}
                        title="Hide this warning"
                        aria-label={`Hide warning for project ${alert.projectId}`}
                      >
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M4 4L12 12M12 4L4 12"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span>Hide</span>
                      </button>
                    </div>
                  </div>
                )
              })}

              {visibleInactiveWarnings.map((warning) => {
                const alertKey = warning.id || `${warning.projectId}-inactive`
                return (
                  <div
                    key={alertKey}
                    className="projects-alert-item projects-alert-item--inactive"
                    role="status"
                  >
                    <div className="projects-alert-item__body">
                      <div className="projects-alert-item__badges">
                        <span className="projects-alert-item__tag projects-alert-item__tag--inactive">
                          Inactivity Warning
                        </span>
                        <span className="projects-alert-item__code">
                          {warning.projectId}
                        </span>
                      </div>
                      <p className="projects-alert-item__message">
                        {warning.message ||
                          `${warning.projectName} has had no recorded updates or vouchers for ${Math.floor(
                            warning.inactiveDays,
                          )} day(s).`}
                      </p>
                      <span className="projects-alert-item__meta">
                        Last Activity: {formatProjectDate(warning.lastActivityAt)}{' '}
                        &bull; Threshold: {warning.inactivityThresholdDays} days
                      </span>
                    </div>

                    <div className="projects-alert-item__actions">
                      {onViewProject && warning.projectId ? (
                        <button
                          type="button"
                          className="projects-alert-item__action"
                          onClick={() => onViewProject(warning.projectId)}
                        >
                          View Project
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="projects-alert-item__dismiss-btn"
                        onClick={() => handleDismiss(alertKey)}
                        title="Hide this warning"
                        aria-label={`Hide warning for project ${warning.projectId}`}
                      >
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path
                            d="M4 4L12 12M12 4L4 12"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                        <span>Hide</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="projects-alerts-panel__all-hidden">
              <span>All active warnings for these projects have been hidden.</span>
              <button
                type="button"
                className="projects-alerts-panel__reset-btn"
                onClick={handleRestore}
              >
                Restore Hidden Warnings
              </button>
            </div>
          )
        ) : null}
      </div>
    </section>
  )
}
