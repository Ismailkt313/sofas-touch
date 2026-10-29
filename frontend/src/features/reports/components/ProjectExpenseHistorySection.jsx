import {
  formatReportCurrency,
  formatReportDate,
} from '../utils/reportFormatters'

export function ProjectExpenseHistorySection({
  expenseHistory,
  onNavigateExpense,
}) {
  const rows = Array.isArray(expenseHistory) ? expenseHistory : []
  const sectionTotal = rows.reduce(
    (acc, row) => acc + (Number(row.amount) || 0),
    0,
  )

  return (
    <section className="rep-surface rep-section">
      <div className="rep-section__header">
        <div>
          <h2 className="rep-section__title">5. Expense History</h2>
          <p className="rep-section__subtitle">
            Active non-material project expenses (transport, labor, site support,
            and miscellaneous costs).
          </p>
        </div>
        <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>
          {rows.length} {rows.length === 1 ? 'voucher' : 'vouchers'} ·{' '}
          {formatReportCurrency(sectionTotal)}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rep-empty" style={{ padding: '1.5rem 1rem' }}>
          <h3 className="rep-empty__title">No project expenses recorded</h3>
          <p className="rep-empty__text">
            No active project expense vouchers match this project and reporting
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
                <th scope="col">Expense Category</th>
                <th scope="col">Description</th>
                <th scope="col" className="rep-table__num">
                  Amount
                </th>
                <th scope="col">Receipt</th>
                <th scope="col" className="rep-table__actions rep-no-print">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id || item.voucherNumber}>
                  <td>{formatReportDate(item.expenseDate)}</td>
                  <td>
                    <button
                      type="button"
                      className="rep-code-link"
                      onClick={() => onNavigateExpense(item.voucherNumber)}
                    >
                      {item.voucherNumber}
                    </button>
                  </td>
                  <td>
                    <strong>{item.categoryName || 'Uncategorized'}</strong>
                  </td>
                  <td style={{ maxWidth: '320px' }}>
                    <span>{item.description || '—'}</span>
                  </td>
                  <td className="rep-table__num">
                    <strong>{formatReportCurrency(item.amount)}</strong>
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
                      onClick={() => onNavigateExpense(item.voucherNumber)}
                    >
                      Open Expense
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
