import {
  formatExpenseCurrency,
  formatExpenseDate,
} from '../utils/expenseValidation'

export function ExpensesTable({
  expenses,
  isAdmin,
  canEdit,
  canCancel,
  onViewExpense,
  onEditExpense,
  onCancelExpense,
  onPreviewReceipt,
  onViewProject,
}) {
  const allowEdit = canEdit ?? isAdmin
  const allowCancel = canCancel ?? isAdmin
  return (
    <div className="exp-table-wrap">
      <table className="exp-table">
        <thead>
          <tr>
            <th scope="col">Voucher</th>
            <th scope="col">Date</th>
            <th scope="col">Category</th>
            <th scope="col">Description</th>
            <th scope="col">Project</th>
            <th scope="col" className="exp-table__num-col">
              Amount
            </th>
            <th scope="col">Receipt</th>
            <th scope="col">Status</th>
            <th scope="col" className="exp-table__actions-col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => {
            const isCancelled = expense.status === 'cancelled'
            const primaryReceipt = expense.attachments?.[0] || null

            return (
              <tr
                key={expense.id}
                className={isCancelled ? 'exp-table__row--cancelled' : ''}
              >
                <td>
                  <button
                    type="button"
                    className="exp-code-btn"
                    onClick={() => onViewExpense(expense)}
                  >
                    {expense.voucherNumber}
                  </button>
                </td>

                <td style={{ whiteSpace: 'nowrap' }}>
                  {formatExpenseDate(expense.expenseDate)}
                </td>

                <td>
                  <span className="exp-category-pill">
                    {expense.categoryName}
                  </span>
                </td>

                <td>
                  <div className="exp-desc-cell">
                    <span className="exp-desc-cell__text">
                      {expense.description}
                    </span>
                    <span className="exp-desc-cell__sub">
                      By {expense.createdByName || 'Staff'}
                    </span>
                  </div>
                </td>

                <td>
                  {expense.projectRecordId ? (
                    <button
                      type="button"
                      className="exp-project-link"
                      onClick={() => onViewProject(expense.projectRecordId)}
                    >
                      {expense.projectCode
                        ? `${expense.projectCode} — ${expense.projectName || ''}`
                        : expense.projectName || 'Linked Project'}
                    </button>
                  ) : (
                    <span className="exp-project-general">
                      General Workshop
                    </span>
                  )}
                </td>

                <td className="exp-table__num-col">
                  <span
                    className={`exp-amount ${
                      isCancelled ? 'exp-amount--cancelled' : ''
                    }`}
                  >
                    {formatExpenseCurrency(expense.amount)}
                  </span>
                </td>

                <td>
                  {primaryReceipt ? (
                    <button
                      type="button"
                      className="exp-receipt-chip"
                      onClick={() => onPreviewReceipt(expense, 0)}
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="M6.5 10.5L11.8 5.2a2.5 2.5 0 113.54 3.54l-6.72 6.72a4 4 0 01-5.66-5.66l6.36-6.36"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {expense.attachmentCount > 1
                        ? `Preview (${expense.attachmentCount})`
                        : 'Preview'}
                    </button>
                  ) : (
                    <span className="exp-receipt-none">None</span>
                  )}
                </td>

                <td>
                  <span
                    className={`exp-status-badge ${
                      isCancelled
                        ? 'exp-status-badge--cancelled'
                        : 'exp-status-badge--active'
                    }`}
                  >
                    {isCancelled ? 'Cancelled' : 'Active'}
                  </span>
                </td>

                <td className="exp-table__actions-col">
                  <div className="exp-row-actions">
                    <button
                      type="button"
                      className="exp-btn exp-btn--ghost exp-btn--sm"
                      onClick={() => onViewExpense(expense)}
                    >
                      View
                    </button>
                    {!isCancelled && allowEdit ? (
                      <button
                        type="button"
                        className="exp-btn exp-btn--secondary exp-btn--sm"
                        onClick={() => onEditExpense(expense)}
                      >
                        Edit
                      </button>
                    ) : null}
                    {!isCancelled && allowCancel ? (
                      <button
                        type="button"
                        className="exp-btn exp-btn--ghost exp-btn--sm"
                        style={{ color: '#9e3324' }}
                        onClick={() => onCancelExpense(expense)}
                      >
                        Void
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
