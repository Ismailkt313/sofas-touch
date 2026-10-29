import {
  formatDashboardCurrency,
  formatDashboardPercent,
} from '../utils/dashboardFormatters'

export function DashboardKpiGrid({ kpis, isAdmin, onNavigate }) {
  if (!kpis) return null

  const profitNegative = Number(kpis.estimatedProfit) < 0
  const costTargetRoute = isAdmin ? '/reports' : '/purchases'
  const profitTargetRoute = isAdmin ? '/reports' : '/projects'

  const handleCardLink = (event, path) => {
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
      className="sts-dash-kpi-grid"
      aria-label="Primary business summary indicators"
    >
      <a
        href="/projects"
        className="sts-dash-kpi-card"
        onClick={(e) => handleCardLink(e, '/projects')}
      >
        <div className="sts-dash-kpi-card__top">
          <span className="sts-dash-kpi-card__label">Total Projects</span>
          <span
            className="sts-dash-kpi-card__icon sts-dash-kpi-card__icon--espresso"
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M2.75 6.25C2.75 5.15 3.65 4.25 4.75 4.25H7.6L9.1 6H15.25C16.35 6 17.25 6.9 17.25 8V14.25C17.25 15.35 16.35 16.25 15.25 16.25H4.75C3.65 16.25 2.75 15.35 2.75 14.25V6.25Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <div className="sts-dash-kpi-card__value">
          {Number(kpis.totalProjects || 0).toLocaleString('en-IN')}
        </div>

        <div className="sts-dash-kpi-card__pills">
          <span className="sts-dash-pill sts-dash-pill--progress">
            {kpis.activeProjects} Active
          </span>
          <span className="sts-dash-pill sts-dash-pill--completed">
            {kpis.completedProjects} Completed
          </span>
        </div>
      </a>

      <a
        href="/projects"
        className="sts-dash-kpi-card"
        onClick={(e) => handleCardLink(e, '/projects')}
      >
        <div className="sts-dash-kpi-card__top">
          <span className="sts-dash-kpi-card__label">Total Contract Value</span>
          <span
            className="sts-dash-kpi-card__icon sts-dash-kpi-card__icon--sand"
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M5 4.5H15M5 8H15M8.5 4.5C10.8 4.5 12.25 5.8 12.25 8C12.25 10.2 10.8 11.5 8.5 11.5H5.5L12.75 16"
                stroke="currentColor"
                strokeWidth="1.55"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        <div className="sts-dash-kpi-card__value">
          {formatDashboardCurrency(kpis.totalContractValue)}
        </div>

        <p className="sts-dash-kpi-card__meta">
          Committed scope across {kpis.totalProjects}{' '}
          {kpis.totalProjects === 1 ? 'project' : 'projects'}
        </p>
      </a>

      <a
        href={costTargetRoute}
        className="sts-dash-kpi-card"
        onClick={(e) => handleCardLink(e, costTargetRoute)}
      >
        <div className="sts-dash-kpi-card__top">
          <span className="sts-dash-kpi-card__label">Total Project Costs</span>
          <span
            className="sts-dash-kpi-card__icon sts-dash-kpi-card__icon--terracotta"
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M4.25 6.5H15.75L14.95 15.4C14.86 16.31 14.1 17 13.18 17H6.82C5.9 17 5.14 16.31 5.05 15.4L4.25 6.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M7.5 9.75H12.5M7.5 12.75H10.75"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </div>

        <div className="sts-dash-kpi-card__value">
          {formatDashboardCurrency(kpis.totalProjectCosts)}
        </div>

        <p className="sts-dash-kpi-card__meta">
          Purchases {formatDashboardCurrency(kpis.materialPurchaseCosts)} &bull;{' '}
          Expenses {formatDashboardCurrency(kpis.otherProjectExpenses)}
        </p>
      </a>

      <a
        href={profitTargetRoute}
        className={`sts-dash-kpi-card${profitNegative ? ' sts-dash-kpi-card--loss' : ''}`}
        onClick={(e) => handleCardLink(e, profitTargetRoute)}
      >
        <div className="sts-dash-kpi-card__top">
          <span className="sts-dash-kpi-card__label">Estimated Profit</span>
          <span className="sts-dash-kpi-card__est-tag">Unaudited</span>
        </div>

        <div
          className={`sts-dash-kpi-card__value${profitNegative ? ' sts-dash-kpi-card__value--negative' : ' sts-dash-kpi-card__value--positive'}`}
        >
          {formatDashboardCurrency(kpis.estimatedProfit)}
        </div>

        <div className="sts-dash-kpi-card__pills">
          <span
            className={`sts-dash-pill ${profitNegative ? 'sts-dash-pill--danger' : 'sts-dash-pill--success'}`}
          >
            {kpis.marginApplicable
              ? `${formatDashboardPercent(kpis.profitMargin, true)} Margin`
              : 'Margin N/A'}
          </span>
          {kpis.overBudgetProjectsCount > 0 ? (
            <span className="sts-dash-pill sts-dash-pill--danger">
              {kpis.overBudgetProjectsCount} Over Budget
            </span>
          ) : kpis.nearLimitProjectsCount > 0 ? (
            <span className="sts-dash-pill sts-dash-pill--warning">
              {kpis.nearLimitProjectsCount} Near Limit
            </span>
          ) : null}
        </div>
      </a>
    </section>
  )
}
