import {
  formatReportCurrency,
  formatReportDate,
} from '../utils/reportFormatters'

export function ProjectDateWiseCostSection({
  dateWiseCostHistory,
  onNavigatePurchase,
  onNavigateExpense,
}) {
  const buckets = Array.isArray(dateWiseCostHistory) ? dateWiseCostHistory : []

  return (
    <section className="rep-surface rep-section">
      <div className="rep-section__header">
        <div>
          <h2 className="rep-section__title">6. Date-Wise Cost History</h2>
          <p className="rep-section__subtitle">
            Chronological log of all recorded project costs grouped by
            transaction date, distinguishing material purchases from other
            expenses.
          </p>
        </div>
        <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>
          {buckets.length} {buckets.length === 1 ? 'cost date' : 'cost dates'}
        </span>
      </div>

      {buckets.length === 0 ? (
        <div className="rep-empty" style={{ padding: '1.5rem 1rem' }}>
          <h3 className="rep-empty__title">No chronological cost entries</h3>
          <p className="rep-empty__text">
            Recorded purchases and project expenses will appear here grouped by
            transaction date.
          </p>
        </div>
      ) : (
        <div className="rep-date-buckets">
          {buckets.map((bucket) => (
            <div key={bucket.date} className="rep-date-bucket">
              <div className="rep-date-bucket__header">
                <span className="rep-date-bucket__date">
                  {formatReportDate(bucket.date)}
                </span>
                <span className="rep-date-bucket__totals">
                  Purchases: {formatReportCurrency(bucket.purchaseCosts)} ·
                  Expenses: {formatReportCurrency(bucket.otherExpenses)} ·{' '}
                  <strong>
                    Day Total: {formatReportCurrency(bucket.totalCosts)}
                  </strong>
                  {bucket.cumulativeCosts !== undefined ? (
                    <>
                      {' '}
                      · Cumulative:{' '}
                      <strong>
                        {formatReportCurrency(bucket.cumulativeCosts)}
                      </strong>
                    </>
                  ) : null}
                </span>
              </div>

              <div className="rep-date-bucket__entries">
                {bucket.entries.map((entry) => {
                  const isPurchase = entry.type === 'purchase'

                  return (
                    <div key={`${entry.type}-${entry.id}`} className="rep-date-entry">
                      <span
                        className={`rep-type-badge ${
                          isPurchase
                            ? 'rep-type-badge--purchase'
                            : 'rep-type-badge--expense'
                        }`}
                      >
                        {isPurchase ? 'Purchase' : 'Expense'}
                      </span>

                      <div className="rep-date-entry__main">
                        <div className="rep-date-entry__title">
                          <button
                            type="button"
                            className="rep-code-link"
                            style={{ marginRight: '0.45rem' }}
                            onClick={() =>
                              isPurchase
                                ? onNavigatePurchase(entry.voucherNumber)
                                : onNavigateExpense(entry.voucherNumber)
                            }
                          >
                            {entry.voucherNumber}
                          </button>
                          {entry.title}
                        </div>
                        <div className="rep-date-entry__desc">
                          {entry.subtitle || '—'}
                          {entry.hasAttachments ? ' · Attachment on file' : ''}
                        </div>
                      </div>

                      <div className="rep-date-entry__amount">
                        {formatReportCurrency(entry.amount)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
