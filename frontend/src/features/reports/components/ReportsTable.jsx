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

export function ReportsTable({ rows, onOpenProjectReport }) {
  return (
    <div className="rep-table-wrap">
      <table className="rep-table">
        <thead>
          <tr>
            <th scope="col" className="rep-table__th-project">
              Project Name
            </th>
            <th scope="col" className="rep-table__th-status">
              Project Status
            </th>
            <th scope="col" className="rep-table__th-num">
              Contract Value
            </th>
            <th scope="col" className="rep-table__th-num">
              Total Project Costs
            </th>
            <th scope="col" className="rep-table__th-num">
              Estimated Profit
            </th>
            <th scope="col" className="rep-table__th-action">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const numContract = Number(row.contractValue || 0)
            const numCosts = Number(row.totalProjectCosts || 0)
            const isOverBudget = numContract > 0 && numCosts > numContract
            const profitClass = getProfitClass(row.estimatedProfit, row.contractValue)

            return (
              <tr key={row.id || row.projectId}>
                {/* 1. Project Name */}
                <td className="rep-table__td-project">
                  <div className="rep-project-cell">
                    <button
                      type="button"
                      className="rep-project-title-btn"
                      onClick={() => onOpenProjectReport(row.projectId)}
                      title={`View financial report for ${row.name}`}
                    >
                      {row.name}
                    </button>
                    {row.projectId ? (
                      <span className="rep-project-code-tag">{row.projectId}</span>
                    ) : null}
                  </div>
                </td>

                {/* 2. Project Status */}
                <td className="rep-table__td-status">
                  <span className={getStatusPillClass(row.status)}>
                    {row.status || 'Active'}
                  </span>
                </td>

                {/* 3. Contract Value */}
                <td className="rep-table__td-num">
                  <span className="rep-num-val">
                    {formatReportCurrency(row.contractValue)}
                  </span>
                </td>

                {/* 4. Total Project Costs */}
                <td className="rep-table__td-num">
                  <span className="rep-num-val rep-num-val--costs">
                    {formatReportCurrency(row.totalProjectCosts)}
                  </span>
                </td>

                {/* 5. Estimated Profit */}
                <td className="rep-table__td-num">
                  <div className="rep-profit-wrap">
                    <span className={`rep-profit-val ${profitClass}`}>
                      {formatReportCurrency(row.estimatedProfit)}
                    </span>
                    {isOverBudget ? (
                      <span
                        className="rep-overbudget-badge"
                        title="Project costs exceed contract value"
                      >
                        Over budget
                      </span>
                    ) : null}
                  </div>
                </td>

                {/* 6. Action */}
                <td className="rep-table__td-action">
                  <button
                    type="button"
                    className="rep-btn-view"
                    onClick={() => onOpenProjectReport(row.projectId)}
                    aria-label={`View detailed report for ${row.name}`}
                  >
                    <span>View</span>
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
