import {
  formatReportCurrency,
  formatSafePercentage,
  getHealthIndicatorMeta,
} from '../utils/reportFormatters'

function getStatusPillClass(status) {
  if (status === 'Completed') return 'rep-status-pill rep-status-pill--completed'
  if (status === 'Under Review') return 'rep-status-pill rep-status-pill--review'
  return 'rep-status-pill'
}

export function ReportsTable({ rows, period, onOpenProjectReport }) {
  const isPeriodFiltered = Boolean(period?.isDateFiltered)

  return (
    <div className="rep-table-wrap rep-table-wrap--main">
      <table className="rep-table">
        <thead>
          <tr>
            <th scope="col">Project ID</th>
            <th scope="col">Project Name</th>
            <th scope="col">Client Name</th>
            <th scope="col">Site Location</th>
            <th scope="col">Project Status</th>
            <th scope="col" className="rep-table__num">
              Contract Value
            </th>
            <th scope="col" className="rep-table__num">
              Material Purchase Costs
            </th>
            <th scope="col" className="rep-table__num">
              Other Project Expenses
            </th>
            <th scope="col" className="rep-table__num">
              Total Project Costs
            </th>
            <th scope="col" className="rep-table__num">
              {isPeriodFiltered ? 'Contract − Period Costs' : 'Estimated Profit'}
            </th>
            <th scope="col" className="rep-table__num">
              {isPeriodFiltered ? 'Period Margin' : 'Profit Margin'}
            </th>
            <th scope="col" className="rep-table__actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const health = getHealthIndicatorMeta(row.healthStatus)
            const isNegativeProfit = row.estimatedProfit < 0

            return (
              <tr key={row.id || row.projectId}>
                <td>
                  <button
                    type="button"
                    className="rep-code-link"
                    onClick={() => onOpenProjectReport(row.projectId)}
                  >
                    {row.projectId}
                  </button>
                </td>

                <td>
                  <button
                    type="button"
                    className="rep-name-btn"
                    onClick={() => onOpenProjectReport(row.projectId)}
                  >
                    {row.name}
                  </button>
                  <span className="rep-sub-line">{row.category}</span>
                </td>

                <td>{row.clientName || '—'}</td>

                <td>
                  <span
                    className={row.siteLocation ? '' : 'rep-muted'}
                    title={
                      row.siteLocation ||
                      'Site location is not persisted in the current Project schema'
                    }
                  >
                    {row.siteLocation || '—'}
                  </span>
                </td>

                <td>
                  <span className={getStatusPillClass(row.status)}>
                    {row.status}
                  </span>
                </td>

                <td className="rep-table__num">
                  {formatReportCurrency(row.contractValue)}
                </td>

                <td className="rep-table__num">
                  {formatReportCurrency(row.materialPurchaseCosts)}
                </td>

                <td className="rep-table__num">
                  {formatReportCurrency(row.otherProjectExpenses)}
                </td>

                <td className="rep-table__num">
                  <strong>{formatReportCurrency(row.totalProjectCosts)}</strong>
                  {isPeriodFiltered ? (
                    <span className="rep-sub-line">
                      Lifetime:{' '}
                      {formatReportCurrency(row.lifetimeTotalProjectCosts)}
                    </span>
                  ) : null}
                </td>

                <td className="rep-table__num">
                  <span
                    className={`rep-profit-val ${
                      isNegativeProfit ? 'rep-profit-val--loss' : ''
                    }`}
                  >
                    {formatReportCurrency(row.estimatedProfit)}
                  </span>
                  <div>
                    <span className={`rep-health ${health.className}`}>
                      <span className="rep-health__dot" aria-hidden="true" />
                      {health.label}
                    </span>
                  </div>
                </td>

                <td className="rep-table__num">
                  <span
                    className={
                      row.marginApplicable &&
                      row.profitMargin !== null &&
                      row.profitMargin < 0
                        ? 'rep-profit-val--loss'
                        : ''
                    }
                  >
                    {formatSafePercentage(row.profitMargin, row.marginApplicable)}
                  </span>
                </td>

                <td className="rep-table__actions">
                  <button
                    type="button"
                    className="rep-btn rep-btn--secondary rep-btn--sm"
                    onClick={() => onOpenProjectReport(row.projectId)}
                  >
                    View Report
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
