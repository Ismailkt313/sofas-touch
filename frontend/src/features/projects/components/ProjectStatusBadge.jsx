import { formatPercentage } from '../services/projectService'

export function ProjectStatusBadge({ status }) {
  const normalized = String(status || 'In Progress').trim()

  let modifier = 'in-progress'
  if (normalized === 'Completed') {
    modifier = 'completed'
  } else if (normalized === 'Under Review') {
    modifier = 'under-review'
  }

  return (
    <span className={`project-status-badge project-status-badge--${modifier}`}>
      <span className="project-status-badge__dot" aria-hidden="true" />
      <span>{normalized}</span>
    </span>
  )
}

export function ProjectCostThresholdBadge({ costThresholdState, costPercentage }) {
  if (!costThresholdState) {
    return null
  }

  if (costThresholdState.exceededCrossed) {
    return (
      <span
        className="project-alert-pill project-alert-pill--critical"
        title="Recorded project costs have reached or exceeded 100% of the contract value"
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 2.25L14.25 13.25H1.75L8 2.25Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M8 6.5V9.5M8 11.4H8.007"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>
          Cost &ge; 100%
          {Number.isFinite(Number(costPercentage)) && Number(costPercentage) > 0
            ? ` (${formatPercentage(costPercentage)})`
            : ''}
        </span>
      </span>
    )
  }

  if (costThresholdState.warningCrossed) {
    const threshold = costThresholdState.warningThresholdPercent || 80
    return (
      <span
        className="project-alert-pill project-alert-pill--warning"
        title={`Recorded project costs have reached the ${threshold}% warning threshold`}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M8 5V8.5M8 10.75H8.007"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span>
          Cost &ge; {formatPercentage(threshold)}
          {Number.isFinite(Number(costPercentage)) && Number(costPercentage) > 0
            ? ` (${formatPercentage(costPercentage)})`
            : ''}
        </span>
      </span>
    )
  }

  return null
}

export function ProjectInactivityBadge({ warning }) {
  if (!warning) {
    return null
  }

  const days = Math.max(1, Math.floor(Number(warning.inactiveDays) || 0))
  return (
    <span
      className="project-alert-pill project-alert-pill--inactive"
      title={warning.message || `No activity recorded for ${days} day(s)`}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 4.75V8.25L10.25 9.75"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Inactive ({days}d)</span>
    </span>
  )
}
