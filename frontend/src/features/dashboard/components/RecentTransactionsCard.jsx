import {
  formatDashboardCurrency,
  formatDashboardDate,
} from '../utils/dashboardFormatters'

export function RecentTransactionsCard({ transactions = [], onNavigate }) {
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
      className="sts-dash-card sts-dash-recent-card"
      aria-labelledby="sts-dash-recent-heading"
    >
      <header className="sts-dash-card__header">
        <div>
          <span className="sts-dash-card__eyebrow">Latest Vouchers</span>
          <h2 id="sts-dash-recent-heading" className="sts-dash-card__title">
            Recent Purchases &amp; Expenses
          </h2>
        </div>

        <div className="sts-dash-card__header-links">
          <a
            href="/purchases"
            className="sts-dash-link-btn sts-dash-link-btn--subtle"
            onClick={(e) => handleLinkClick(e, '/purchases')}
          >
            Purchases
          </a>
          <a
            href="/expenses"
            className="sts-dash-link-btn sts-dash-link-btn--subtle"
            onClick={(e) => handleLinkClick(e, '/expenses')}
          >
            Expenses
          </a>
        </div>
      </header>

      {transactions.length === 0 ? (
        <div className="sts-dash-empty-box">
          <p className="sts-dash-empty-box__title">
            No purchases or expenses recorded yet
          </p>
          <p className="sts-dash-empty-box__sub">
            Recently saved supplier purchase vouchers and operational expenses
            will appear here chronologically.
          </p>
          <div className="sts-dash-empty-box__actions">
            <a
              href="/purchases/new"
              className="sts-dash-link-btn"
              onClick={(e) => handleLinkClick(e, '/purchases/new')}
            >
              Record Purchase
            </a>
            <a
              href="/expenses"
              className="sts-dash-link-btn sts-dash-link-btn--subtle"
              onClick={(e) => handleLinkClick(e, '/expenses')}
            >
              Record Expense
            </a>
          </div>
        </div>
      ) : (
        <ul
          className="sts-dash-tx-list"
          aria-label="Recent purchases and expenses"
        >
          {transactions.map((tx) => {
            const isPurchase = tx.type === 'purchase'
            const isCancelled = tx.status === 'cancelled'

            return (
              <li key={`${tx.type}-${tx.id}`} className="sts-dash-tx-item">
                <a
                  href={tx.detailPath}
                  className={`sts-dash-tx-row${isCancelled ? ' sts-dash-tx-row--cancelled' : ''}`}
                  onClick={(e) => handleLinkClick(e, tx.detailPath)}
                >
                  <div className="sts-dash-tx-row__left">
                    <div className="sts-dash-tx-row__badges">
                      <span
                        className={`sts-dash-tx-type ${isPurchase ? 'sts-dash-tx-type--purchase' : 'sts-dash-tx-type--expense'}`}
                      >
                        {isPurchase ? 'Purchase' : 'Expense'}
                      </span>
                      <span className="sts-dash-code-tag">
                        {tx.voucherNumber}
                      </span>
                      <span
                        className={`sts-dash-pill ${isCancelled ? 'sts-dash-pill--danger' : 'sts-dash-pill--success'}`}
                      >
                        {isCancelled ? 'Cancelled' : 'Active'}
                      </span>
                    </div>

                    <p className="sts-dash-tx-row__title">
                      {tx.partyOrCategory}
                    </p>

                    <span className="sts-dash-tx-row__sub">
                      {tx.projectCode
                        ? `${tx.projectCode}${tx.projectName ? ` · ${tx.projectName}` : ''}`
                        : 'General Workshop Overhead'}{' '}
                      &bull; {formatDashboardDate(tx.transactionDate)}
                    </span>
                  </div>

                  <div className="sts-dash-tx-row__right">
                    <strong className="sts-dash-tx-row__amount">
                      {formatDashboardCurrency(tx.amount)}
                    </strong>
                    <span className="sts-dash-tx-row__open">Open &rarr;</span>
                  </div>
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
