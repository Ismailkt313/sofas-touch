import { useEffect, useId, useRef, useState } from 'react'
import { UserAvatar } from '../../users/components/UserAvatar'

export function ConfirmApprovalActionModal({
  target,
  supportsRejectionReason = false,
  isSubmitting = false,
  errorMessage = '',
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState('')
  const titleId = useId()
  const reasonId = useId()
  const confirmButtonRef = useRef(null)

  const request = target?.request || null
  const action = target?.action === 'reject' ? 'reject' : 'approve'
  const isReject = action === 'reject'

  useEffect(() => {
    if (!request) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onCancel?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [request, isSubmitting, onCancel])

  if (!request) {
    return null
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }
    onConfirm?.(supportsRejectionReason && isReject ? reason.trim() : undefined)
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel?.()
        }
      }}
    >
      <div
        className="admin-modal admin-modal--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="admin-modal__header">
          <div>
            <h2 id={titleId} className="admin-modal__title">
              {isReject ? 'Reject Signup Request' : 'Approve Signup Request'}
            </h2>
            <p className="admin-modal__subtitle">
              {isReject
                ? 'Please confirm declining this Data Entry signup application.'
                : 'Please confirm granting Data Entry workspace access.'}
            </p>
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

        <form onSubmit={handleSubmit}>
          <div className="admin-modal__body">
            {errorMessage ? (
              <div className="approvals-modal-alert" role="alert">
                {errorMessage}
              </div>
            ) : null}

            <div className="approvals-confirm-summary">
              <UserAvatar name={request.name} image={request.image} />
              <div className="approvals-confirm-summary__meta">
                <span className="approvals-confirm-summary__name">
                  {request.name}
                </span>
                <span className="approvals-confirm-summary__email">
                  {request.email}
                </span>
              </div>
            </div>

            <p className="approvals-confirm-copy">
              {isReject ? (
                <>
                  Rejecting this request will mark{' '}
                  <strong>{request.name}</strong>&apos;s signup application as{' '}
                  <strong>Rejected</strong> and prevent Data Entry sign-in.
                </>
              ) : (
                <>
                  Approving this request will activate{' '}
                  <strong>{request.name}</strong>&apos;s{' '}
                  <strong>Data Entry</strong> account so they can sign in to
                  Soft Touch Sofas.
                </>
              )}
            </p>

            {isReject && supportsRejectionReason ? (
              <div className="approvals-reason-field">
                <label
                  htmlFor={reasonId}
                  className="approvals-reason-field__label"
                >
                  Reason for rejection{' '}
                  <span className="approvals-reason-field__optional">
                    (optional)
                  </span>
                </label>
                <textarea
                  id={reasonId}
                  rows={3}
                  className="approvals-reason-field__textarea"
                  placeholder="Provide an optional note for this rejection..."
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={isSubmitting}
                  maxLength={300}
                />
              </div>
            ) : null}
          </div>

          <div className="admin-modal__footer">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              ref={confirmButtonRef}
              type="submit"
              className={`admin-btn ${isReject ? 'admin-btn--danger' : 'admin-btn--primary'
                }`}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? isReject
                  ? 'Rejecting...'
                  : 'Approving...'
                : isReject
                  ? 'Confirm Reject'
                  : 'Confirm Approve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
