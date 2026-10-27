export function ProjectsSummaryStrip({
  statusCounts,
  activeStatus,
  onSelectStatus,
  adminAccess,
  automationState,
}) {
  const total = statusCounts?.all ?? 0
  const inProgress = statusCounts?.inProgress ?? 0
  const underReview = statusCounts?.underReview ?? 0
  const completed = statusCounts?.completed ?? 0

  const activeAlertsCount = automationState?.costAlerts?.length ?? 0
  const activeWarningsCount = automationState?.activityWarnings?.length ?? 0

  const cards = [
    {
      key: 'all',
      label: 'Total Projects',
      value: total,
      caption: 'All manufacturing projects',
      pill: null,
    },
    {
      key: 'In Progress',
      label: 'In Progress',
      value: inProgress,
      caption: 'Active workshop & site orders',
      pill: null,
    },
    {
      key: 'Under Review',
      label: 'Under Review',
      value: underReview,
      caption: 'Pending inspection or sign-off',
      pill: null,
    },
    {
      key: 'Completed',
      label: 'Completed',
      value: completed,
      caption: 'Delivered & closed projects',
      pill: null,
    },
  ]

  return (
    <section
      className="projects-summary-section"
      aria-label="Projects overview summary"
    >
      <div className="projects-summary-grid">
        {cards.map((card) => {
          const isSelected = activeStatus === card.key
          return (
            <button
              key={card.key}
              type="button"
              className={`projects-summary-card${
                isSelected ? ' projects-summary-card--selected' : ''
              }`}
              onClick={() => onSelectStatus(card.key)}
              aria-pressed={isSelected}
            >
              <span className="projects-summary-card__label">{card.label}</span>
              <span className="projects-summary-card__value">{card.value}</span>
              <span className="projects-summary-card__caption">
                {card.caption}
              </span>
            </button>
          )
        })}
      </div>

      {adminAccess && automationState?.status === 'ready' ? (
        <div
          className="projects-automation-bar"
          role="region"
          aria-label="Automation monitoring summary"
        >
          <div className="projects-automation-bar__metrics">
            <span
              className={`projects-automation-chip${
                activeAlertsCount > 0
                  ? ' projects-automation-chip--alert'
                  : ' projects-automation-chip--calm'
              }`}
            >
              <strong>{activeAlertsCount}</strong> active cost threshold{' '}
              {activeAlertsCount === 1 ? 'alert' : 'alerts'}
            </span>
            <span
              className={`projects-automation-chip${
                activeWarningsCount > 0
                  ? ' projects-automation-chip--warning'
                  : ' projects-automation-chip--calm'
              }`}
            >
              <strong>{activeWarningsCount}</strong> inactive project{' '}
              {activeWarningsCount === 1 ? 'warning' : 'warnings'} (
              {automationState.inactivityThresholdDays}d window)
            </span>
          </div>
          {!automationState.schedulerConfigured ? (
            <span className="projects-automation-bar__note">
              Inactivity checks run automatically on Admin view load (background
              scheduler not yet configured).
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
