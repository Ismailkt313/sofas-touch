import {
  formatReportCurrency,
  formatReportDate,
} from '../utils/reportFormatters'

export function ProjectPurchaseHistorySection({
  purchaseHistory,
  onNavigatePurchase,
}) {
  const rows = Array.isArray(purchaseHistory) ? purchaseHistory : []
  const sectionTotal = rows.reduce(
    (acc, row) => acc + (Number(row.finalTotal) || 0),
    0,
  )

  return (
    <section className="rep-surface rep-section">
      <div className="rep-section__header">
        <div>
          <h2 className="rep-section__title">4. Purchase History</h2>
          <p className="rep-section__subtitle">
            Active material purchase vouchers allocated to this project.
          </p>
        </div>
        <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>
          {rows.length} {rows.length === 1 ? 'voucher' : 'vouchers'} ·{' '}
          {formatReportCurrency(sectionTotal)}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rep-empty" style={{ padding: '1.5rem 1rem' }}>
          <h3 className="rep-empty__title">No purchase vouchers recorded</h3>
          <p className="rep-empty__text">
            No active material purchase vouchers match this project and reporting
            period.
          </p>
        </div>
      ) : (
        <div className="rep-table-wrap">
          <table className="rep-history-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Voucher No.</th>
                <th scope="col">Supplier Name</th>
                <th scope="col">Material Details</th>
                <th scope="col" className="rep-table__num">
                  Total Purchase Amount
                </th>
                <th scope="col">Bill Attachment</th>
                <th scope="col" className="rep-table__actions rep-no-print">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const lineCount = Array.isArray(item.lineItems)
                  ? item.lineItems.length
                  : 0
                return (
                  <tr key={item.id || item.voucherNumber}>
                    <td>{formatReportDate(item.purchaseDate)}</td>
                    <td>
                      <button
                        type="button"
                        className="rep-code-link"
                        onClick={() => onNavigatePurchase(item.voucherNumber)}
                      >
                        {item.voucherNumber}
                      </button>
                      {item.supplierInvoiceNumber ? (
                        <span className="rep-sub-line">
                          Inv: {item.supplierInvoiceNumber}
                        </span>
                      ) : null}
                    </td>
                    <td>{item.supplierName || '—'}</td>
                    <td style={{ maxWidth: '320px' }}>
                      <span>{item.materialsSummary || '—'}</span>
                      <span className="rep-sub-line">
                        {lineCount} {lineCount === 1 ? 'line item' : 'line items'}
                      </span>
                    </td>
                    <td className="rep-table__num">
                      <strong>{formatReportCurrency(item.finalTotal)}</strong>
                    </td>
                    <td>
                      {item.hasAttachments ? (
                        <span className="rep-attachment rep-attachment--yes">
                          Attached ({item.attachmentCount || 1})
                        </span>
                      ) : (
                        <span className="rep-attachment">None</span>
                      )}
                    </td>
                    <td className="rep-table__actions rep-no-print">
                      <button
                        type="button"
                        className="rep-btn rep-btn--secondary rep-btn--sm"
                        onClick={() => onNavigatePurchase(item.voucherNumber)}
                      >
                        Open Purchase
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
