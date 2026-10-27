import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

export function MobileFilterSheet({
  isOpen,
  title = 'Filters',
  activeCount = 0,
  onClose,
  onReset,
  onApply,
  canReset = true,
  children,
}) {
  const titleId = useId()
  const closeBtnRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined
    }

    previousFocusRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === 'function'
      ) {
        window.requestAnimationFrame(() => {
          previousFocusRef.current?.focus()
        })
      }
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onApply?.()
  }

  return createPortal(
    <div
      className="sts-filter-sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div
        className="sts-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="sts-filter-sheet__handle" aria-hidden="true" />

        <div className="sts-filter-sheet__header">
          <div className="sts-filter-sheet__title-group">
            <h2 id={titleId} className="sts-filter-sheet__title">
              {title}
            </h2>
            {activeCount > 0 ? (
              <span className="sts-filter-sheet__count-pill">
                {activeCount} active
              </span>
            ) : null}
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            className="sts-filter-sheet__close"
            onClick={onClose}
            aria-label="Close filters"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="sts-filter-sheet__form">
          <div className="sts-filter-sheet__body">{children}</div>

          <div className="sts-filter-sheet__footer">
            <button
              type="button"
              className="admin-btn admin-btn--secondary sts-filter-sheet__btn"
              onClick={onReset}
              disabled={!canReset}
            >
              Reset
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary sts-filter-sheet__btn"
            >
              Apply
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
