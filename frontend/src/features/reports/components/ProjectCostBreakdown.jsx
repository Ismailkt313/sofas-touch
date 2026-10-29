import {
  clampProgressWidth,
  formatReportCurrency,
  formatSafePercentage,
} from '../utils/reportFormatters'

export function ProjectCostBreakdown({ financialOverview, period }) {
  const isPeriodFiltered = Boolean(period?.isDateFiltered)
  const lifetime = financialOverview?.lifetime
  const selectedPeriod = financialOverview?.selectedPeriod
  const breakdown = financialOverview?.costBreakdown

  const materialAmount = breakdown?.materialPurchaseCosts ?? 0
  const materialShare = breakdown?.materialShareOfCostPercent ?? 0
  const expenseAmount = breakdown?.otherProjectExpenses ?? 0
  const expenseShare = breakdown?.expenseShareOfCostPercent ?? 0
  const totalCost = breakdown?.totalProjectCosts ?? 0

  const contractValue = lifetime?.contractValue ?? 0
  const marginApplicable = Boolean(lifetime?.marginApplicable)
  const costPercentage = isPeriodFiltered
    ? selectedPeriod?.costPercentageOfContract ?? null
    : lifetime?.costPercentage ?? null
  const isOverBudget =
    marginApplicable && costPercentage !== null && costPercentage > 100

  return (
    <section className="rep-surface rep-section">
      <div className="rep-section__header">
        <div>
          <h2 className="rep-section__title">3. Cost Breakdown</h2>
          <p className="rep-section__subtitle">
            {isPeriodFiltered
              ? 'Proportion of recorded material purchases and other project expenses in the selected reporting period.'
              : 'Proportion of recorded material purchases and other project expenses across the project lifetime.'}
          </p>
        </div>
        <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>
          Total Recorded: {formatReportCurrency(totalCost)}
        </span>
      </div>

      <div className="rep-breakdown-grid">
        <div className="rep-breakdown-item">
          <div className="rep-breakdown-item__header">
            <span className="rep-breakdown-item__title">
              Material Purchase Costs
            </span>
            <span className="rep-breakdown-item__amount">
              {formatReportCurrency(materialAmount)}
            </span>
          </div>
          <div className="rep-progress-track" aria-hidden="true">
            <div
              className="rep-progress-fill rep-progress-fill--purchase"
              style={{ width: `${clampProgressWidth(materialShare)}%` }}
            />
          </div>
          <div className="rep-breakdown-item__meta">
            <span>
              {breakdown?.materialPercentOfContract !== null &&
              breakdown?.materialPercentOfContract !== undefined
                ? `${breakdown.materialPercentOfContract.toFixed(2)}% of contract value`
                : 'Active purchase vouchers'}
            </span>
            <span>{Number(materialShare).toFixed(2)}% of project costs</span>
          </div>
        </div>

        <div className="rep-breakdown-item">
          <div className="rep-breakdown-item__header">
            <span className="rep-breakdown-item__title">
              Other Project Expenses
            </span>
            <span className="rep-breakdown-item__amount">
              {formatReportCurrency(expenseAmount)}
            </span>
          </div>
          <div className="rep-progress-track" aria-hidden="true">
            <div
              className="rep-progress-fill rep-progress-fill--expense"
              style={{ width: `${clampProgressWidth(expenseShare)}%` }}
            />
          </div>
          <div className="rep-breakdown-item__meta">
            <span>
              {breakdown?.expensePercentOfContract !== null &&
              breakdown?.expensePercentOfContract !== undefined
                ? `${breakdown.expensePercentOfContract.toFixed(2)}% of contract value`
                : 'Active expense vouchers'}
            </span>
            <span>{Number(expenseShare).toFixed(2)}% of project costs</span>
          </div>
        </div>
      </div>

      {marginApplicable && contractValue > 0 ? (
        <div
          className="rep-breakdown-item"
          style={{ marginTop: '0.15rem', backgroundColor: '#ffffff' }}
        >
          <div className="rep-breakdown-item__header">
            <span className="rep-breakdown-item__title">
              Contract Budget Utilization
            </span>
            <span className="rep-breakdown-item__amount">
              {formatSafePercentage(costPercentage, marginApplicable)} of{' '}
              {formatReportCurrency(contractValue)}
            </span>
          </div>
          <div className="rep-progress-track" aria-hidden="true">
            <div
              className={`rep-progress-fill ${
                isOverBudget
                  ? 'rep-progress-fill--over'
                  : 'rep-progress-fill--purchase'
              }`}
              style={{ width: `${clampProgressWidth(costPercentage)}%` }}
            />
          </div>
          <div className="rep-breakdown-item__meta">
            <span>
              {isPeriodFiltered
                ? 'Selected period costs relative to total contract value'
                : 'Cumulative lifetime costs relative to total contract value'}
            </span>
            <span>
              {isOverBudget ? 'Exceeds contract value' : 'Within contract value'}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
