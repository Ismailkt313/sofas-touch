import {
  formatExpenseCurrency,
  formatExpenseDate,
} from '../utils/expenseValidation'

export function ExpensesMobileList({
  expenses,
  isAdmin,
  onViewExpense,
  onEditExpense,
  onCancelExpense,
  onPreviewReceipt,
  onViewProject,
}) {
  return (
    <div className="exp-mobile-list">
      {expenses.map((expense) => {
        const isCancelled = expense.status === 'cancelled'
        const hasReceipt = expense.attachmentCount > 0

        return (
          <article
            key={expense.id}
            className={`exp-mobile-card ${
              isCancelled ? 'exp-mobile-card--cancelled' : ''
            }`}
          >
            <div className="exp-mobile-card__top">
              <button
                type="button"
                className="exp-code-btn"
                onClick={() => onViewExpense(expense)}
              >
                {expense.voucherNumber}
              </button>
              <span
                className={`exp-status-badge ${
                  isCancelled
                    ? 'exp-status-badge--cancelled'
                    : 'exp-status-badge--active'
                }`}
              >
                {isCancelled ? 'Cancelled' : 'Active'}
              </span>
            </div>

            <div className="exp-mobile-card__amount-row">
              <span className="exp-category-pill">{expense.categoryName}</span>
              <span
                className={`exp-mobile-card__amount ${
                  isCancelled ? 'exp-amount--cancelled' : ''
                }`}
              >
                {formatExpenseCurrency(expense.amount)}
              </span>
            </div>

            <p className="exp-mobile-card__desc">{expense.description}</p>

            <div className="exp-mobile-card__meta">
              <span>{formatExpenseDate(expense.expenseDate)}</span>
              <span>·</span>
              {expense.projectRecordId ? (
                <button
                  type="button"
                  className="exp-project-link"
                  onClick={() => onViewProject(expense.projectRecordId)}
                >
                  {expense.projectCode || expense.projectName}
                </button>
              ) : (
                <span className="exp-project-general">General Workshop</span>
              )}
              {hasReceipt ? (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    className="exp-receipt-chip"
                    onClick={() => onPreviewReceipt(expense, 0)}
                  >
                    Receipt ({expense.attachmentCount})
                  </button>
                </>
              ) : null}
            </div>

            <div className="exp-mobile-card__actions">
              <button
                type="button"
                className="exp-btn exp-btn--ghost exp-btn--sm"
                onClick={() => onViewExpense(expense)}
              >
                Details
              </button>
              {isAdmin && !isCancelled ? (
                <>
                  <button
                    type="button"
                    className="exp-btn exp-btn--secondary exp-btn--sm"
                    onClick={() => onEditExpense(expense)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="exp-btn exp-btn--ghost exp-btn--sm"
                    style={{ color: '#9e3324' }}
                    onClick={() => onCancelExpense(expense)}
                  >
                    Void
                  </button>
                </>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
