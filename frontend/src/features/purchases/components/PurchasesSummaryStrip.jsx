import { formatInrCurrency } from '../services/purchaseService'

export function PurchasesSummaryStrip({
  summary,
  activeStatus,
  adminAccess,
  onSelectStatus,
}) {
  const activeCount = Number(summary?.activeCount || 0)
  const cancelledCount = Number(summary?.cancelledCount || 0)
  const activeTotalAmount = Number(summary?.activeTotalAmount || 0)
  const withAttachmentCount = Number(summary?.withAttachmentCount || 0)

  return (
    <section
      className="pv-summary-grid"
      aria-label="Purchase voucher summary metrics"
    >
      <button
        type="button"
        className={`pv-summary-card pv-summary-card--interactive${
          activeStatus === 'active' ? ' pv-summary-card--selected' : ''
        }`}
        onClick={() => onSelectStatus?.('active')}
      >
        <span className="pv-summary-card__label">Active Vouchers</span>
        <strong className="pv-summary-card__value">{activeCount}</strong>
        <span className="pv-summary-card__hint">
          Stock &amp; project costs synced
        </span>
      </button>

      <div className="pv-summary-card">
        <span className="pv-summary-card__label">Recorded Procurement</span>
        <strong className="pv-summary-card__value">
          {formatInrCurrency(activeTotalAmount)}
        </strong>
        <span className="pv-summary-card__hint">
          Cumulative active voucher value
        </span>
      </div>

      <div className="pv-summary-card">
        <span className="pv-summary-card__label">With Bill Attached</span>
        <strong className="pv-summary-card__value">{withAttachmentCount}</strong>
        <span className="pv-summary-card__hint">
          Verified image or PDF invoices
        </span>
      </div>

      {adminAccess ? (
        <button
          type="button"
          className={`pv-summary-card pv-summary-card--interactive${
            activeStatus === 'cancelled' ? ' pv-summary-card--selected' : ''
          }`}
          onClick={() =>
            onSelectStatus?.(
              activeStatus === 'cancelled' ? 'active' : 'cancelled',
            )
          }
        >
          <span className="pv-summary-card__label">Cancelled Vouchers</span>
          <strong className="pv-summary-card__value">{cancelledCount}</strong>
          <span className="pv-summary-card__hint">
            Stock &amp; project totals reversed
          </span>
        </button>
      ) : (
        <button
          type="button"
          className={`pv-summary-card pv-summary-card--interactive${
            activeStatus === 'all' ? ' pv-summary-card--selected' : ''
          }`}
          onClick={() =>
            onSelectStatus?.(activeStatus === 'all' ? 'active' : 'all')
          }
        >
          <span className="pv-summary-card__label">All Vouchers</span>
          <strong className="pv-summary-card__value">
            {activeCount + cancelledCount}
          </strong>
          <span className="pv-summary-card__hint">
            Include cancelled history
          </span>
        </button>
      )}
    </section>
  )
}
