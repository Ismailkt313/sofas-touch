import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatExpenseCurrency } from '../utils/expenseValidation'

export function CancelExpenseModal({
  expense,
  isSubmitting = false,
  error = '',
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isSubmitting])

  if (!expense) {
    return null
  }

  return createPortal(
    <div
      className="exp-modal-backdrop admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Void Expense Voucher"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose?.()
        }
      }}
    >
      <div className="exp-modal exp-modal--compact admin-modal admin-modal--compact">
        <div className="exp-modal__header">
          <div>
            <h2 className="exp-modal__title">
              Void {expense.voucherNumber}?
            </h2>
            <p className="exp-modal__subtitle">
              {expense.categoryName} · {formatExpenseCurrency(expense.amount)}
            </p>
          </div>
          <button
            type="button"
            className="exp-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close confirmation"
          >
            ×
          </button>
        </div>

        <div className="exp-modal__body">
          {error ? (
            <div className="exp-banner exp-banner--error" role="alert">
              <span>{error}</span>
            </div>
          ) : null}

          <p style={{ margin: 0, fontSize: '0.87rem', color: 'var(--sts-charcoal)' }}>
            {expense.projectRecordId
              ? `Voiding this voucher will immediately deduct ${formatExpenseCurrency(expense.amount)} from project ${expense.projectCode || expense.projectName}’s Total Other Expenses and recalculate estimated profit.`
              : 'This General Workshop expense will be marked cancelled and excluded from active expense totals.'}
          </p>

          <label className="exp-field">
            <span className="exp-field__label">Reason (Optional)</span>
            <input
              type="text"
              className="exp-input"
              placeholder="e.g., Duplicate entry or revised invoice..."
              maxLength={240}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </div>

        <div className="exp-modal__footer">
          <button
            type="button"
            className="exp-btn exp-btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep Active
          </button>
          <button
            type="button"
            className="exp-btn exp-btn--danger"
            disabled={isSubmitting}
            onClick={() => onConfirm?.(reason)}
          >
            {isSubmitting ? 'Voiding…' : 'Void Expense'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
