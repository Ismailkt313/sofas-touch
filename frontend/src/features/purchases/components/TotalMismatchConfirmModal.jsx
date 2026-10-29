import { useEffect, useRef } from 'react'
import { formatInrCurrency } from '../services/purchaseService'

export function TotalMismatchConfirmModal({
  isOpen,
  printedBillTotal,
  calculatedVoucherTotal,
  difference,
  isSaving = false,
  onReview,
  onSaveAnyway,
}) {
  const reviewBtnRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusId = window.requestAnimationFrame(() => {
      reviewBtnRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) {
        onReview?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusId)
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSaving, onReview])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onReview?.()
        }
      }}
    >
      <div
        className="admin-modal pv-mismatch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pv-total-mismatch-title"
        aria-describedby="pv-total-mismatch-desc"
      >
        <div className="admin-modal__header pv-mismatch-modal__header">
          <div className="pv-mismatch-modal__heading">
            <h2 id="pv-total-mismatch-title" className="admin-modal__title">
              Bill Total Differs from Voucher Total
            </h2>
            <p id="pv-total-mismatch-desc" className="admin-modal__subtitle">
              The voucher total does not match the attached bill&apos;s printed
              final total. Please verify quantities, unit prices, discounts,
              and GST/taxes before saving.
            </p>
          </div>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onReview}
            disabled={isSaving}
            aria-label="Close dialog and review voucher"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5L15 15M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="admin-modal__body pv-mismatch-modal__body">
          <div className="pv-mismatch-summary-card">
            <div className="pv-mismatch-summary-row">
              <span>Printed bill total</span>
              <strong>{formatInrCurrency(printedBillTotal)}</strong>
            </div>
            <div className="pv-mismatch-summary-row">
              <span>Calculated voucher total</span>
              <strong>{formatInrCurrency(calculatedVoucherTotal)}</strong>
            </div>
            <div className="pv-mismatch-summary-row pv-mismatch-summary-row--diff">
              <span>Absolute difference</span>
              <strong>{formatInrCurrency(difference)}</strong>
            </div>
          </div>
        </div>

        <div className="admin-modal__footer pv-mismatch-modal__footer">
          <button
            ref={reviewBtnRef}
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onReview}
            disabled={isSaving}
          >
            Review Voucher
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={onSaveAnyway}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Anyway'}
          </button>
        </div>
      </div>
    </div>
  )
}
