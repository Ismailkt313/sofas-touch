import { useEffect, useRef } from 'react'

export function ConfirmUserStatusModal({
  target,
  errorMessage,
  isSubmitting = false,
  onConfirm,
  onCancel,
}) {
  const cancelBtnRef = useRef(null)

  useEffect(() => {
    if (!target) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelBtnRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [target, isSubmitting, onCancel])

  if (!target) {
    return null
  }

  const { user, nextIsActive } = target
  const isDeactivating = !nextIsActive

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel()
        }
      }}
    >
      <div
        className="admin-modal admin-modal--compact"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-status-title"
        aria-describedby="confirm-status-desc"
      >
        <div className="admin-modal__header">
          <div>
            <h2 id="confirm-status-title" className="admin-modal__title">
              {isDeactivating ? 'Deactivate user account?' : 'Activate user account?'}
            </h2>
          </div>
          <button
            type="button"
            className="admin-modal__close"
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

        <div className="admin-modal__body">
          <p id="confirm-status-desc" className="users-confirm-copy">
            {isDeactivating ? (
              <>
                Are you sure you want to deactivate{' '}
                <strong>{user.name}</strong> ({user.email})? Deactivated accounts
                cannot sign in to Soft Touch Sofas until reactivated by an
                Administrator.
              </>
            ) : (
              <>
                Restore active workspace access for <strong>{user.name}</strong>{' '}
                ({user.email}) as <strong>{user.roleLabel}</strong>?
              </>
            )}
          </p>

          {errorMessage ? (
            <div
              className="users-inline-alert users-inline-alert--error users-confirm-alert"
              role="alert"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="admin-modal__footer">
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
                ? 'Deactivate Account'
                : 'Activate Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
