import { formatReportCurrency } from '../utils/reportFormatters'

function getStatusPillClass(status) {
  const norm = String(status || '').toLowerCase()
  if (norm === 'completed') return 'rep-status-pill rep-status-pill--completed'
  if (norm.includes('progress')) return 'rep-status-pill rep-status-pill--progress'
  if (norm.includes('review')) return 'rep-status-pill rep-status-pill--review'
  if (norm === 'upcoming') return 'rep-status-pill rep-status-pill--upcoming'
  return 'rep-status-pill'
}

function getProfitClass(estimatedProfit, contractValue) {
  const numProfit = Number(estimatedProfit || 0)
  const numContract = Number(contractValue || 0)
  if (numContract === 0 && numProfit === 0) return 'rep-profit-val--neutral'
  if (numProfit > 0) return 'rep-profit-val--positive'
  if (numProfit < 0) return 'rep-profit-val--loss'
  return 'rep-profit-val--neutral'
}

export function ReportsMobileList({ rows, onOpenProjectReport }) {
  return (
    <div className="rep-mobile-list">
      {rows.map((row) => {
        const numContract = Number(row.contractValue || 0)
        const numCosts = Number(row.totalProjectCosts || 0)
        const isOverBudget = numContract > 0 && numCosts > numContract
        const profitClass = getProfitClass(row.estimatedProfit, row.contractValue)

        return (
          <article key={row.id || row.projectId} className="rep-mobile-card">
            <div className="rep-mobile-card__top">
              <div className="rep-mobile-card__titles">
                <button
                  type="button"
                  className="rep-project-title-btn"
                  onClick={() => onOpenProjectReport(row.projectId)}
                >
                  {row.name}
                </button>
                {row.projectId ? (
                  <span className="rep-project-code-tag">{row.projectId}</span>
                ) : null}
              </div>

              <span className={getStatusPillClass(row.status)}>
                {row.status || 'Active'}
              </span>
            </div>

            <div className="rep-mobile-card__metrics">
              <div>
                <span className="rep-mobile-metric__label">Contract Value</span>
                <span className="rep-mobile-metric__val">
                  {formatReportCurrency(row.contractValue)}
                </span>
              </div>

              <div>
                <span className="rep-mobile-metric__label">Total Costs</span>
                <span className="rep-mobile-metric__val">
                  {formatReportCurrency(row.totalProjectCosts)}
                </span>
              </div>

              <div>
                <span className="rep-mobile-metric__label">Estimated Profit</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                  <span className={`rep-mobile-metric__val ${profitClass}`}>
                    {formatReportCurrency(row.estimatedProfit)}
                  </span>
                  {isOverBudget ? (
                    <span className="rep-overbudget-badge">Over budget</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rep-mobile-card__actions">
              <button
                type="button"
                className="rep-btn-view rep-btn-view--mobile"
                onClick={() => onOpenProjectReport(row.projectId)}
              >
                <span>View Detailed Report</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 8H12.5M12.5 8L8.75 4.25M12.5 8L8.75 11.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
