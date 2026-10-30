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

    </section>
  )
}
