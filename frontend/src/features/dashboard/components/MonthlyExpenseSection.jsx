import { Dropdown, DatePicker } from '../../../components/common'
import {
  DASHBOARD_EXPENSE_PERIOD_OPTIONS,
  formatDashboardCurrency,
  formatDashboardDate,
} from '../utils/dashboardFormatters'
import { MonthlyExpenseChart } from './MonthlyExpenseChart'

export function MonthlyExpenseSection({
  monthlyExpenses,
  periodPreset,
  customFromDate,
  customToDate,
  dateRangeError,
  monthlyLoading,
  isAdmin,
  onPeriodPresetChange,
  onCustomFromChange,
  onCustomToChange,
  onNavigate,
}) {
  const totals = monthlyExpenses?.totals || {
    purchaseCosts: 0,
    otherExpenses: 0,
    totalExpenses: 0,
    purchaseCount: 0,
    expenseCount: 0,
  }

  const handleLinkClick = (event, path) => {
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
      className="sts-dash-card sts-dash-monthly-section"
      aria-labelledby="sts-dash-monthly-heading"
    >
      <header className="sts-dash-card__header">
        <div>
          <span className="sts-dash-card__eyebrow">Cash Outflow Trend</span>
          <h2 id="sts-dash-monthly-heading" className="sts-dash-card__title">
            Monthly Expense Overview
          </h2>
          <p className="sts-dash-card__subtitle">
            Active supplier purchases and operational expenses grouped by
            transaction date{' '}
            {monthlyExpenses?.fromDate && monthlyExpenses?.toDate
              ? `(${formatDashboardDate(monthlyExpenses.fromDate)} – ${formatDashboardDate(monthlyExpenses.toDate)})`
              : ''}
            .
          </p>
        </div>

        <div className="sts-dash-monthly-filter">
          <Dropdown
            value={periodPreset}
            options={DASHBOARD_EXPENSE_PERIOD_OPTIONS}
            onChange={onPeriodPresetChange}
            placeholder="Last 6 Months"
            ariaLabel="Select monthly expense period"
          />
        </div>
      </header>

      {periodPreset === 'custom' ? (
        <div className="sts-dash-custom-dates">
          <div className="sts-dash-date-field">
            <span>From Date</span>
            <DatePicker
              value={customFromDate}
              onChange={onCustomFromChange}
              placeholder="From date"
              maxDate={customToDate || undefined}
              variant="filter"
              ariaLabel="Select from date"
            />
          </div>
          <div className="sts-dash-date-field">
            <span>To Date</span>
            <DatePicker
              value={customToDate}
              onChange={onCustomToChange}
              placeholder="To date"
              minDate={customFromDate || undefined}
              variant="filter"
              ariaLabel="Select to date"
            />
          </div>
          {dateRangeError ? (
            <p className="sts-dash-date-error" role="alert">
              {dateRangeError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="sts-dash-monthly-summary">
        <div className="sts-dash-mini-stat">
          <span className="sts-dash-mini-stat__label">Material Purchases</span>
          <strong className="sts-dash-mini-stat__val">
            {formatDashboardCurrency(totals.purchaseCosts)}
          </strong>
          <span className="sts-dash-mini-stat__sub">
            {totals.purchaseCount}{' '}
            {totals.purchaseCount === 1 ? 'voucher' : 'vouchers'}
          </span>
        </div>

        <div className="sts-dash-mini-stat">
          <span className="sts-dash-mini-stat__label">Other Expenses</span>
          <strong className="sts-dash-mini-stat__val">
            {formatDashboardCurrency(totals.otherExpenses)}
          </strong>
          <span className="sts-dash-mini-stat__sub">
            {totals.expenseCount}{' '}
            {totals.expenseCount === 1 ? 'voucher' : 'vouchers'}
          </span>
        </div>

        <div className="sts-dash-mini-stat sts-dash-mini-stat--total">
          <span className="sts-dash-mini-stat__label">Total Period Spend</span>
          <strong className="sts-dash-mini-stat__val">
            {formatDashboardCurrency(totals.totalExpenses)}
          </strong>
          <span className="sts-dash-mini-stat__sub">
            Excludes cancelled records
          </span>
        </div>
      </div>

      <div
        className={`sts-dash-monthly-body${monthlyLoading ? ' sts-dash-monthly-body--loading' : ''}`}
      >
        <MonthlyExpenseChart buckets={monthlyExpenses?.buckets || []} />
      </div>

      <footer className="sts-dash-card__footer-links">
        <a
          href="/purchases"
          className="sts-dash-inline-link"
          onClick={(e) => handleLinkClick(e, '/purchases')}
        >
          View Purchases &rarr;
        </a>
        <a
          href="/expenses"
          className="sts-dash-inline-link"
          onClick={(e) => handleLinkClick(e, '/expenses')}
        >
          View Expenses &rarr;
        </a>
        {isAdmin ? (
          <a
            href="/reports"
            className="sts-dash-inline-link"
            onClick={(e) => handleLinkClick(e, '/reports')}
          >
            Cost Reports &rarr;
          </a>
        ) : null}
      </footer>
    </section>
  )
}
