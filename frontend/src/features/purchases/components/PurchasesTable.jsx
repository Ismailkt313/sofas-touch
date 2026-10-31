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
            <th scope="col" className="pv-table__th-voucher">
              Voucher No
            </th>
            <th scope="col" className="pv-table__th-date">
              Purchase Date
            </th>
            <th scope="col" className="pv-table__th-supplier">
              Supplier
            </th>
            <th scope="col" className="pv-table__th-project">
              Project
            </th>
            <th scope="col" className="pv-table__th-total">
              Total Amount
            </th>
            <th scope="col" className="pv-table__th-status">
              Status
            </th>
            <th scope="col" className="pv-table__th-actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((voucher) => {
            const isCancelled = voucher.status === 'cancelled'
            const itemCount = voucher.lineItems?.length || 0

            return (
              <tr
                key={voucher.id}
                className={isCancelled ? 'pv-table__row--cancelled' : ''}
              >
                {/* 1. Voucher No: Primary code + invoice/items subline */}
                <td className="pv-table__td-voucher">
                  <div className="pv-voucher-cell">
                    <button
                      type="button"
                      className="pv-code-link"
                      onClick={() => onViewVoucher(voucher.id)}
                      title={`View voucher ${voucher.voucherNumber}`}
                    >
                      {voucher.voucherNumber}
                    </button>
                    {voucher.supplierInvoiceNumber ? (
                      <span
                        className="pv-voucher-sub"
                        title={`Supplier Invoice #${voucher.supplierInvoiceNumber}`}
                      >
                        Inv #{voucher.supplierInvoiceNumber}
                      </span>
                    ) : (
                      <span className="pv-voucher-sub pv-voucher-sub--muted">
                        {itemCount} {itemCount === 1 ? 'material' : 'materials'}
                      </span>
                    )}
                  </div>
                </td>

                {/* 2. Purchase Date */}
                <td className="pv-table__td-date">
                  <span className="pv-date-val">
                    {formatPurchaseDate(voucher.purchaseDate)}
                  </span>
                </td>

                {/* 3. Supplier Name */}
                <td className="pv-table__td-supplier">
                  <span className="pv-supplier-name" title={voucher.supplierName}>
                    {voucher.supplierName}
                  </span>
                </td>

                {/* 4. Project or General Stock */}
                <td className="pv-table__td-project">
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

                {/* 5. Total Amount */}
                <td className="pv-table__td-total">
                  <span
                    className={`pv-total-amount${
                      isCancelled ? ' pv-total-amount--cancelled' : ''
                    }`}
                  >
                    {formatInrCurrency(voucher.finalTotal)}
                  </span>
                </td>

                {/* 6. Status & Attachments Cluster */}
                <td className="pv-table__td-status">
                  <div className="pv-status-cluster">
                    <PurchaseStatusBadge status={voucher.status} />
                    {voucher.attachmentCount > 0 ? (
                      <PurchaseAttachmentIndicator
                        count={voucher.attachmentCount}
                      />
                    ) : null}
                  </div>
                </td>

                {/* 7. Action: Compact View & optional Edit */}
                <td className="pv-table__td-actions">
                  <div className="pv-row-actions">
                    <button
                      type="button"
                      className="pv-btn-view"
                      onClick={() => onViewVoucher(voucher.id)}
                      title={`View purchase voucher ${voucher.voucherNumber}`}
                    >
                      View <span aria-hidden="true">&rarr;</span>
                    </button>
                    {!isCancelled && canEditVoucher ? (
                      <button
                        type="button"
                        className="pv-btn-edit-compact"
                        onClick={() => onEditVoucher(voucher.id)}
                        title={`Edit voucher ${voucher.voucherNumber}`}
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
