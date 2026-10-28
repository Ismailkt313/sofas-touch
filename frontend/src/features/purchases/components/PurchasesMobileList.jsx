import {
  formatInrCurrency,
  formatPurchaseDate,
} from '../services/purchaseService'
import {
  PurchaseAttachmentIndicator,
  PurchaseStatusBadge,
} from './PurchaseStatusBadge'

export function PurchasesMobileList({
  vouchers,
  onViewVoucher,
  onEditVoucher,
}) {
  return (
    <div
      className="pv-mobile-list"
      role="list"
      aria-label="Purchase vouchers list"
    >
      {vouchers.map((voucher) => {
        const isCancelled = voucher.status === 'cancelled'
        return (
          <article
            key={voucher.id}
            className={`pv-mobile-card${
              isCancelled ? ' pv-mobile-card--cancelled' : ''
            }`}
            role="listitem"
          >
            <div className="pv-mobile-card__top">
              <div>
                <button
                  type="button"
                  className="pv-code-link"
                  onClick={() => onViewVoucher(voucher.id)}
                >
                  {voucher.voucherNumber}
                </button>
                <span className="pv-mobile-card__date">
                  {formatPurchaseDate(voucher.purchaseDate)}
                </span>
              </div>
              <PurchaseStatusBadge status={voucher.status} />
            </div>

            <div className="pv-mobile-card__supplier">
              <strong>{voucher.supplierName}</strong>
              {voucher.supplierInvoiceNumber ? (
                <span>Invoice #{voucher.supplierInvoiceNumber}</span>
              ) : null}
            </div>

            <div className="pv-mobile-card__meta-grid">
              <div>
                <span className="pv-mobile-card__meta-label">Project</span>
                <span className="pv-mobile-card__meta-val">
                  {voucher.projectCode
                    ? `${voucher.projectCode}${voucher.projectName ? ` · ${voucher.projectName}` : ''}`
                    : 'General Stock'}
                </span>
              </div>
              <div>
                <span className="pv-mobile-card__meta-label">Total Amount</span>
                <strong className="pv-mobile-card__total">
                  {formatInrCurrency(voucher.finalTotal)}
                </strong>
              </div>
            </div>

            <div className="pv-mobile-card__footer">
              <div className="pv-mobile-card__tags">
                <PurchaseAttachmentIndicator count={voucher.attachmentCount} />
                {voucher.createdByName ? (
                  <span className="pv-mobile-card__creator">
                    By {voucher.createdByName}
                  </span>
                ) : null}
              </div>

              <div className="pv-row-actions">
                <button
                  type="button"
                  className="pv-action-btn"
                  onClick={() => onViewVoucher(voucher.id)}
                >
                  View
                </button>
                {!isCancelled ? (
                  <button
                    type="button"
                    className="pv-action-btn pv-action-btn--edit"
                    onClick={() => onEditVoucher(voucher.id)}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
