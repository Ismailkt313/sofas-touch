import {
  formatExpenseCurrency,
  formatExpenseDate,
} from '../utils/expenseValidation'

export function ExpensesMobileList({
  expenses,
  onViewExpense,
  onViewProject,
}) {
  return (
    <div className="exp-mobile-list">
      {expenses.map((expense) => {
        const isCancelled = expense.status === 'cancelled'

        return (
          <article
            key={expense.id}
            className={`exp-mobile-card ${
              isCancelled ? 'exp-mobile-card--cancelled' : ''
            }`}
          >
            {/* Top row: Voucher number, Date, Compact status */}
            <div className="exp-mobile-card__top">
              <button
                type="button"
                className="exp-code-btn"
                onClick={() => onViewExpense(expense)}
              >
                {expense.voucherNumber}
              </button>
              <div className="exp-mobile-card__top-right">
                <span className="exp-mobile-card__date">
                  {formatExpenseDate(expense.expenseDate)}
                </span>
                {isCancelled ? (
                  <span className="exp-status-badge exp-status-badge--cancelled">
                    Cancelled
                  </span>
                ) : null}
              </div>
            </div>

            {/* Main content: Description, Category badge, Project name */}
            <div className="exp-mobile-card__body">
              {expense.description ? (
                <p className="exp-mobile-card__desc" title={expense.description}>
                  {expense.description}
                </p>
              ) : null}

              <div className="exp-mobile-card__tags">
                <span className="exp-category-pill">
                  {expense.categoryName || 'General'}
                </span>

                {expense.projectRecordId ? (
                  <button
                    type="button"
                    className="exp-project-link"
                    onClick={() => onViewProject?.(expense.projectRecordId)}
                  >
                    {expense.projectCode
                      ? `${expense.projectCode} • ${expense.projectName || ''}`
                      : expense.projectName || 'Linked Project'}
                  </button>
                ) : (
                  <span className="exp-project-general">General Workshop</span>
                )}
              </div>
            </div>

            {/* Bottom row: Amount prominently displayed, Compact View action */}
            <div className="exp-mobile-card__bottom">
              <span
                className={`exp-mobile-card__amount ${
                  isCancelled ? 'exp-amount--cancelled' : ''
                }`}
              >
                {formatExpenseCurrency(expense.amount)}
              </span>

              <button
                type="button"
                className="exp-btn-view exp-btn-view--mobile-compact"
                onClick={() => onViewExpense(expense)}
                aria-label={`View details for expense ${expense.voucherNumber}`}
              >
                <span>View</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 8H12.5M12.5 8L8.75 4.25M12.5 8L8.75 11.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
