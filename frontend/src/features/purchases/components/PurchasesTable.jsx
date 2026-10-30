import {
  formatInrCurrency,
  formatPurchaseDate,
} from '../services/purchaseService'
import {
  PurchaseAttachmentIndicator,
  PurchaseStatusBadge,
} from './PurchaseStatusBadge'

export function PurchasesTable({
  vouchers,
  canEditVoucher = true,
  onViewVoucher,
  onEditVoucher,
  onViewProject,
}) {
  return (
    <div className="pv-table-wrap">
      <table className="pv-table">
        <thead>
          <tr>
            <th scope="col">Voucher No</th>
            <th scope="col">Purchase Date</th>
            <th scope="col">Supplier</th>
            <th scope="col">Project</th>
            <th scope="col" className="pv-table__num-col">
              Total Amount
            </th>
            <th scope="col">Bill</th>
            <th scope="col">Created By</th>
            <th scope="col">Status</th>
            <th scope="col" className="pv-table__actions-col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((voucher) => {
            const isCancelled = voucher.status === 'cancelled'
            return (
              <tr
                key={voucher.id}
                className={isCancelled ? 'pv-table__row--cancelled' : ''}
              >
                <td className="pv-table__code-cell">
                  <button
                    type="button"
                    className="pv-code-link"
                    onClick={() => onViewVoucher(voucher.id)}
                  >
                    {voucher.voucherNumber}
                  </button>
                </td>
                <td className="pv-table__date-cell">
                  {formatPurchaseDate(voucher.purchaseDate)}
                </td>
                <td>
                  <div className="pv-supplier-cell">
                    <span className="pv-supplier-cell__name">
                      {voucher.supplierName}
                    </span>
                    {voucher.supplierInvoiceNumber ? (
                      <span className="pv-supplier-cell__inv">
                        Inv #{voucher.supplierInvoiceNumber}
                      </span>
                    ) : (
                      <span className="pv-supplier-cell__inv pv-supplier-cell__inv--muted">
                        {voucher.lineItems.length}{' '}
                        {voucher.lineItems.length === 1 ? 'material' : 'materials'}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {voucher.projectCode ? (
                    <button
                      type="button"
                      className="pv-project-chip"
                      onClick={() =>
                        onViewProject?.(
                          voucher.projectCode || voucher.projectRecordId,
                        )
                      }
                      title={voucher.projectName || voucher.projectCode}
                    >
                      <span className="pv-project-chip__code">
                        {voucher.projectCode}
                      </span>
                      {voucher.projectName ? (
                        <span className="pv-project-chip__name">
                          {voucher.projectName}
                        </span>
                      ) : null}
                    </button>
                  ) : (
                    <span className="pv-unassigned-label">General Stock</span>
                  )}
                </td>
                <td className="pv-table__num-col pv-table__total-cell">
                  {formatInrCurrency(voucher.finalTotal)}
                </td>
                <td>
                  <PurchaseAttachmentIndicator
                    count={voucher.attachmentCount}
                  />
                </td>
                <td>
                  <span className="pv-creator-name">
                    {voucher.createdByName || '—'}
                  </span>
                </td>
                <td>
                  <PurchaseStatusBadge status={voucher.status} />
                </td>
                <td className="pv-table__actions-cell">
                  <div className="pv-row-actions">
                    <button
                      type="button"
                      className="pv-action-btn"
                      onClick={() => onViewVoucher(voucher.id)}
                    >
                      View
                    </button>
                    {!isCancelled && canEditVoucher ? (
                      <button
                        type="button"
                        className="pv-action-btn pv-action-btn--edit"
                        onClick={() => onEditVoucher(voucher.id)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
