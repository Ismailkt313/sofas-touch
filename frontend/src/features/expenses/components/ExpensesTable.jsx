import {
  formatExpenseCurrency,
  formatExpenseDate,
} from '../utils/expenseValidation'

export function ExpensesTable({
  expenses,
  onViewExpense,
  onViewProject,
}) {
  return (
    <div className="exp-table-wrap">
      <table className="exp-table">
        <thead>
          <tr>
            <th scope="col" className="exp-table__th-expense">
              Expense
            </th>
            <th scope="col" className="exp-table__th-category">
              Category
            </th>
            <th scope="col" className="exp-table__th-project">
              Project
            </th>
            <th scope="col" className="exp-table__th-amount">
              Amount
            </th>
            <th scope="col" className="exp-table__th-date">
              Date
            </th>
            <th scope="col" className="exp-table__th-action">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => {
            const isCancelled = expense.status === 'cancelled'

            return (
              <tr
                key={expense.id}
                className={isCancelled ? 'exp-table__row--cancelled' : ''}
              >
                {/* 1. Expense: Voucher number + short description underneath */}
                <td className="exp-table__td-expense">
                  <div className="exp-expense-cell">
                    <button
                      type="button"
                      className="exp-code-btn"
                      onClick={() => onViewExpense(expense)}
                      title={`View details for expense ${expense.voucherNumber}`}
                    >
                      {expense.voucherNumber}
                    </button>
                    {expense.description ? (
                      <span
                        className="exp-expense-cell__desc"
                        title={expense.description}
                      >
                        {expense.description}
                      </span>
                    ) : null}
                  </div>
                </td>

                {/* 2. Category badge */}
                <td className="exp-table__td-category">
                  <span className="exp-category-pill">
                    {expense.categoryName || 'General'}
                  </span>
                </td>

                {/* 3. Project name / identifier or General Workshop */}
                <td className="exp-table__td-project">
                  {expense.projectRecordId ? (
                    <button
                      type="button"
                      className="exp-project-link"
                      onClick={() => onViewProject?.(expense.projectRecordId)}
                      title={`View project ${expense.projectName || ''}`}
                    >
                      {expense.projectCode
                        ? `${expense.projectCode} • ${expense.projectName || ''}`
                        : expense.projectName || 'Linked Project'}
                    </button>
                  ) : (
                    <span className="exp-project-general">
                      General Workshop
                    </span>
                  )}
                </td>

                {/* 4. Amount right-aligned */}
                <td className="exp-table__td-amount">
                  <span
                    className={`exp-amount ${
                      isCancelled ? 'exp-amount--cancelled' : ''
                    }`}
                  >
                    {formatExpenseCurrency(expense.amount)}
                  </span>
                </td>

                {/* 5. Date */}
                <td className="exp-table__td-date">
                  <span className="exp-date-val">
                    {formatExpenseDate(expense.expenseDate)}
                  </span>
                </td>

                {/* 6. Action: single compact View button */}
                <td className="exp-table__td-action">
                  <button
                    type="button"
                    className="exp-btn-view"
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
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
