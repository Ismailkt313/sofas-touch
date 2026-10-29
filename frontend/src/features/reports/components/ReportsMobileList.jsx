import {
  formatReportCurrency,
  formatSafePercentage,
  getHealthIndicatorMeta,
} from '../utils/reportFormatters'

export function ReportsMobileList({ rows, period, onOpenProjectReport }) {
  const isPeriodFiltered = Boolean(period?.isDateFiltered)

  return (
    <div className="rep-mobile-list">
      {rows.map((row) => {
        const health = getHealthIndicatorMeta(row.healthStatus)
        const isNegativeProfit = row.estimatedProfit < 0

        return (
          <article key={row.id || row.projectId} className="rep-mobile-card">
            <div className="rep-mobile-card__top">
              <div style={{ minWidth: 0 }}>
                <button
                  type="button"
                  className="rep-code-link"
                  onClick={() => onOpenProjectReport(row.projectId)}
                >
                  {row.projectId}
                </button>
                <div style={{ marginTop: '0.12rem' }}>
                  <button
                    type="button"
                    className="rep-name-btn"
                    onClick={() => onOpenProjectReport(row.projectId)}
                  >
                    {row.name}
                  </button>
                </div>
              </div>

              <span className="rep-status-pill">{row.status}</span>
            </div>

            <div className="rep-mobile-card__metrics">
              <div>
                <span className="rep-mobile-metric__label">Contract</span>
                <span className="rep-mobile-metric__val">
                  {formatReportCurrency(row.contractValue)}
                </span>
              </div>

              <div>
                <span className="rep-mobile-metric__label">
                  {isPeriodFiltered ? 'Period Costs' : 'Total Costs'}
                </span>
                <span className="rep-mobile-metric__val">
                  {formatReportCurrency(row.totalProjectCosts)}
                </span>
              </div>

              <div>
                <span className="rep-mobile-metric__label">
                  {isPeriodFiltered ? 'Net Balance' : 'Est. Profit'}
                </span>
                <span
                  className={`rep-mobile-metric__val ${
                    isNegativeProfit ? 'rep-profit-val--loss' : ''
                  }`}
                >
                  {formatReportCurrency(row.estimatedProfit)}
                </span>
              </div>
            </div>

            <details className="rep-mobile-details">
              <summary>More details (Client, Breakdown &amp; Margin)</summary>
              <div className="rep-mobile-details__grid">
                <div>
                  <span className="rep-muted">Client: </span>
                  <strong>{row.clientName || '—'}</strong>
                </div>
                <div>
                  <span className="rep-muted">Site Location: </span>
                  <span>{row.siteLocation || '—'}</span>
                </div>
                <div>
                  <span className="rep-muted">Material Purchases: </span>
                  <strong>
                    {formatReportCurrency(row.materialPurchaseCosts)}
                  </strong>
                </div>
                <div>
                  <span className="rep-muted">Other Expenses: </span>
                  <strong>
                    {formatReportCurrency(row.otherProjectExpenses)}
                  </strong>
                </div>
                <div>
                  <span className="rep-muted">Profit Margin: </span>
                  <strong>
                    {formatSafePercentage(
                      row.profitMargin,
                      row.marginApplicable,
                    )}
                  </strong>
                </div>
                {isPeriodFiltered ? (
                  <div>
                    <span className="rep-muted">Lifetime Profit: </span>
                    <strong>
                      {formatReportCurrency(row.lifetimeEstimatedProfit)}
                    </strong>
                  </div>
                ) : null}
              </div>
            </details>

            <div className="rep-mobile-card__actions">
              <span className={`rep-health ${health.className}`}>
                <span className="rep-health__dot" aria-hidden="true" />
                {health.label}
              </span>
              <button
                type="button"
                className="rep-btn rep-btn--secondary rep-btn--sm"
                onClick={() => onOpenProjectReport(row.projectId)}
              >
                View Report
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
