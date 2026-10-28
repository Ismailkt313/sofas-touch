import { useEffect, useId, useRef } from 'react'
import { formatMaterialUnit } from '../services/rawMaterialService'

export function ConfirmMaterialStatusModal({
  target,
  errorMessage,
  isSubmitting = false,
  onConfirm,
  onCancel,
}) {
  const cancelBtnRef = useRef(null)
  const backdropMouseDownRef = useRef(false)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    if (!target || typeof document === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.requestAnimationFrame(() => {
      cancelBtnRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault()
        onCancel?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [target, isSubmitting, onCancel])

  if (!target) {
    return null
  }

  const { material, nextIsActive } = target
  const isDeactivating = !nextIsActive
  const displayUnit = formatMaterialUnit(material.unit) || material.unit

  return (
    <div
      className="admin-modal-backdrop rm-modal-backdrop"
      onMouseDown={(event) => {
        backdropMouseDownRef.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (
          backdropMouseDownRef.current &&
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onCancel?.()
        }
        backdropMouseDownRef.current = false
      }}
    >
      <div
        className="admin-modal admin-modal--compact rm-modal rm-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="admin-modal__header rm-modal__header">
          <div className="rm-modal__heading">
            <h2 id={titleId} className="admin-modal__title">
              {isDeactivating
                ? 'Deactivate raw material?'
                : 'Activate raw material?'}
            </h2>
          </div>
          <button
            type="button"
            className="admin-modal__close rm-modal__close"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close confirmation dialog"
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

        <div className="admin-modal__body rm-modal__body">
          <p id={descId} className="rm-confirm-copy">
            {isDeactivating ? (
              <>
                Deactivate <strong>{material.name}</strong>
                {displayUnit ? ` (${displayUnit})` : ''}? Inactive materials
                cannot be selected for new purchase vouchers, while existing
                voucher records remain intact.
              </>
            ) : (
              <>
                Reactivate <strong>{material.name}</strong>
                {displayUnit ? ` (${displayUnit})` : ''} so it becomes
                selectable again for purchase voucher entry?
              </>
            )}
          </p>

          {errorMessage ? (
            <div
              className="rm-inline-alert rm-inline-alert--error"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="admin-modal__footer rm-modal__footer">
          <button
            ref={cancelBtnRef}
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`admin-btn ${
              isDeactivating ? 'admin-btn--danger' : 'admin-btn--primary'
            }`}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isDeactivating
                ? 'Deactivating...'
                : 'Activating...'
              : isDeactivating
                ? 'Deactivate Material'
                : 'Activate Material'}
          </button>
        </div>
      </div>
    </div>
  )
}
