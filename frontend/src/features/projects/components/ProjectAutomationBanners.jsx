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

  const criticalAlerts = activeCostAlerts.filter(
    (item) => item.thresholdType === 'critical',
  )
  const warningAlerts = activeCostAlerts.filter(
    (item) => item.thresholdType === 'warning',
  )

  const hasAnyActive = activeCostAlerts.length > 0 || activeWarnings.length > 0
  const hasCritical = criticalAlerts.length > 0

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
                activeCostAlerts.length > 0
                  ? hasCritical
                    ? ' projects-mobile-alert-pill--critical'
                    : ' projects-mobile-alert-pill--warning'
                  : ''
              }`}
            >
              <strong>{activeCostAlerts.length}</strong> cost{' '}
              {activeCostAlerts.length === 1 ? 'alert' : 'alerts'}
            </span>
            <span
              className={`projects-mobile-alert-pill${
                activeWarnings.length > 0
                  ? ' projects-mobile-alert-pill--inactive'
                  : ''
              }`}
            >
              <strong>{activeWarnings.length}</strong> inactivity
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
            <span className="projects-mobile-critical-callout__dot" aria-hidden="true" />
            <span className="projects-mobile-critical-callout__text">
              Critical:{' '}
              <strong>
                {criticalAlerts
                  .slice(0, 2)
                  .map((item) => item.projectId)
                  .join(', ')}
                {criticalAlerts.length > 2
                  ? ` +${criticalAlerts.length - 2}`
                  : ''}
              </strong>{' '}
              at &ge;100% contract cost
            </span>
            {onViewProject && criticalAlerts[0]?.projectId ? (
              <button
                type="button"
                className="projects-mobile-critical-callout__link"
                onClick={() => onViewProject(criticalAlerts[0].projectId)}
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
              {hasAnyActive
                ? 'Live threshold and inactivity notifications generated by the backend automation service.'
                : `No active cost alerts or inactivity warnings (${automationState.inactivityThresholdDays}d window).`}
            </p>
          </div>

          {onRunInactivityCheck ? (
            <button
              type="button"
              className="admin-btn admin-btn--secondary projects-alerts-panel__btn"
              onClick={onRunInactivityCheck}
              disabled={isEvaluatingInactivity}
            >
              {isEvaluatingInactivity ? 'Checking...' : 'Re-check Inactivity'}
            </button>
          ) : null}
        </div>

        {hasAnyActive ? (
          <div className="projects-alerts-list">
            {criticalAlerts.map((alert) => (
              <div
                key={alert.id || `${alert.projectId}-critical`}
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

                {onViewProject && alert.projectId ? (
                  <button
                    type="button"
                    className="projects-alert-item__action"
                    onClick={() => onViewProject(alert.projectId)}
                  >
                    View Project
                  </button>
                ) : null}
              </div>
            ))}

            {warningAlerts.map((alert) => (
              <div
                key={alert.id || `${alert.projectId}-warning`}
                className="projects-alert-item projects-alert-item--warning"
                role="status"
              >
                <div className="projects-alert-item__body">
                  <div className="projects-alert-item__badges">
                    <span className="projects-alert-item__tag projects-alert-item__tag--warning">
                      {formatPercentage(alert.thresholdPercent)} Cost Threshold
                      Warning
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
                    {formatPercentage(alert.costPercentage)}) &bull; Triggered{' '}
                    {formatProjectDate(alert.triggeredAt)}
                  </span>
                </div>

                {onViewProject && alert.projectId ? (
                  <button
                    type="button"
                    className="projects-alert-item__action"
                    onClick={() => onViewProject(alert.projectId)}
                  >
                    View Project
                  </button>
                ) : null}
              </div>
            ))}

            {activeWarnings.map((warning) => (
              <div
                key={warning.id || `${warning.projectId}-inactive`}
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

                {onViewProject && warning.projectId ? (
                  <button
                    type="button"
                    className="projects-alert-item__action"
                    onClick={() => onViewProject(warning.projectId)}
                  >
                    View Project
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : !automationState.schedulerConfigured ? (
          <p className="projects-alerts-panel__calm-note">
            Inactivity checks evaluate automatically on Admin view load
            (background scheduler not yet configured).
          </p>
        ) : null}
      </div>
    </section>
  )
}
