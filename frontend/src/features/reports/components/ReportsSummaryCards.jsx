import {
  formatReportCurrency,
  formatSafePercentage,
} from '../utils/reportFormatters'

export function ReportsSummaryCards({ summary, period }) {
  const isPeriodFiltered = Boolean(period?.isDateFiltered)
  const projectCount = summary?.projectCount ?? 0
  const contractValue = summary?.contractValue ?? 0
  const materialPurchaseCosts = summary?.materialPurchaseCosts ?? 0
  const otherProjectExpenses = summary?.otherProjectExpenses ?? 0
  const totalProjectCosts = summary?.totalProjectCosts ?? 0
  const estimatedProfit = summary?.estimatedProfit ?? 0
  const marginApplicable = Boolean(summary?.marginApplicable)
  const profitMargin = summary?.profitMargin ?? null
  const lifetimeProfit = summary?.lifetimeEstimatedProfit ?? 0
  const lifetimeMargin = summary?.lifetimeProfitMargin ?? null

  return (
    <section
      className="rep-summary-grid"
      aria-label="Portfolio financial summary"
    >
      <article className="rep-summary-card">
        <span className="rep-summary-card__label">Contract Value</span>
        <span className="rep-summary-card__value">
          {formatReportCurrency(contractValue)}
        </span>
        <span className="rep-summary-card__meta">
          {projectCount === 1
            ? '1 matching project'
            : `${projectCount} matching projects`}
        </span>
      </article>

      <article className="rep-summary-card">
        <span className="rep-summary-card__label">
          {isPeriodFiltered ? 'Period Project Costs' : 'Total Project Costs'}
        </span>
        <span className="rep-summary-card__value">
          {formatReportCurrency(totalProjectCosts)}
        </span>
        <span className="rep-summary-card__meta">
          Purchases {formatReportCurrency(materialPurchaseCosts)} · Expenses{' '}
          {formatReportCurrency(otherProjectExpenses)}
        </span>
      </article>

      <article className="rep-summary-card">
        <span className="rep-summary-card__label">
          {isPeriodFiltered
            ? 'Contract Minus Period Costs'
            : 'Estimated Profit'}
        </span>
        <span
          className={`rep-summary-card__value ${
            estimatedProfit < 0 ? 'rep-summary-card__value--negative' : ''
          }`}
        >
          {formatReportCurrency(estimatedProfit)}
        </span>
        <span className="rep-summary-card__meta">
          {isPeriodFiltered
            ? `Lifetime Est. Profit: ${formatReportCurrency(lifetimeProfit)}`
            : 'Unaudited estimate (Contract − Costs)'}
        </span>
      </article>

      <article className="rep-summary-card">
        <span className="rep-summary-card__label">
          {isPeriodFiltered ? 'Period Net Margin' : 'Profit Margin'}
        </span>
        <span
          className={`rep-summary-card__value ${
            marginApplicable && profitMargin !== null && profitMargin < 0
              ? 'rep-summary-card__value--negative'
              : ''
          }`}
        >
          {formatSafePercentage(profitMargin, marginApplicable)}
        </span>
        <span className="rep-summary-card__meta">
          {!marginApplicable
            ? 'No positive contract value in scope'
            : isPeriodFiltered
              ? `Lifetime Margin: ${formatSafePercentage(lifetimeMargin, marginApplicable)}`
              : 'Estimated Profit ÷ Contract Value'}
        </span>
      </article>
    </section>
  )
}
