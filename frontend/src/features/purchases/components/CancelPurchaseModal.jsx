import { useEffect, useId, useRef, useState } from 'react'
import { formatInrCurrency } from '../services/purchaseService'

export function CancelPurchaseModal({
  voucher,
  isSubmitting = false,
  errorMessage = '',
  onConfirm,
  onClose,
}) {
  const titleId = useId()
  const cancelBtnRef = useRef(null)
  const backdropMouseDownRef = useRef(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!voucher || typeof document === 'undefined') {
      return undefined
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.requestAnimationFrame(() => {
      cancelBtnRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault()
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [voucher, isSubmitting, onClose])

  if (!voucher) {
    return null
  }

  return (
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => {
        backdropMouseDownRef.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (
          backdropMouseDownRef.current &&
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose?.()
        }
        backdropMouseDownRef.current = false
      }}
    >
      <div
        className="admin-modal pv-cancel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="admin-modal__header">
          <div>
            <h2 id={titleId} className="admin-modal__title">
              Cancel Voucher {voucher.voucherNumber}?
            </h2>
            <p className="admin-modal__subtitle">
              Supplier: {voucher.supplierName} ·{' '}
              {formatInrCurrency(voucher.finalTotal)}
            </p>
          </div>
        </div>

        <div className="admin-modal__body pv-cancel-modal__body">
          <p className="pv-cancel-modal__notice">
            Cancelling this purchase voucher will reverse the recorded stock
            quantities across all {voucher.lineItems.length}{' '}
            {voucher.lineItems.length === 1 ? 'material line' : 'material lines'}
            {voucher.projectCode
              ? ` and deduct ${formatInrCurrency(voucher.finalTotal)} from project ${voucher.projectCode}.`
              : '.'}
          </p>

          {errorMessage ? (
            <div className="pv-alert pv-alert--error" role="alert">
              {errorMessage}
            </div>
          ) : null}

          <div className="pv-form-field">
            <label htmlFor="pv-cancel-reason" className="pv-form-label">
              Cancellation Reason <span className="pv-opt">(Optional)</span>
            </label>
            <textarea
              id="pv-cancel-reason"
              rows={3}
              className="pv-textarea"
              placeholder="e.g., Duplicate supplier bill or goods returned..."
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="admin-modal__footer">
          <button
            ref={cancelBtnRef}
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep Voucher
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger pv-btn-danger"
            onClick={() => onConfirm?.(reason)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  )
}
