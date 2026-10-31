import { useEffect, useRef, useState, useCallback } from 'react'
import './toast.css'

function ToastIcon({ tone }) {
  if (tone === 'error') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (tone === 'warning') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (tone === 'info') {
    return (
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.247.25v3.5a.75.75 0 001.5 0v-3.5A1.75 1.75 0 009.253 9H9z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  // Default: success
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function Toast({
  message,
  tone = 'success',
  duration = 4000,
  onClose,
  title,
  action,
}) {
  const [isPaused, setIsPaused] = useState(false)
  const [isDismissing, setIsDismissing] = useState(false)
  const timerRef = useRef(null)
  const startTimeRef = useRef(Date.now())
  const remainingRef = useRef(duration)

  const handleDismiss = useCallback(() => {
    setIsDismissing(true)
    setTimeout(() => {
      onClose?.()
    }, 200)
  }, [onClose])

  useEffect(() => {
    if (!duration || duration <= 0) return

    if (!isPaused) {
      startTimeRef.current = Date.now()
      timerRef.current = setTimeout(() => {
        handleDismiss()
      }, remainingRef.current)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [isPaused, duration, handleDismiss])

  const handlePause = () => {
    if (!duration) return
    const elapsed = Date.now() - startTimeRef.current
    remainingRef.current = Math.max(400, remainingRef.current - elapsed)
    setIsPaused(true)
  }

  const handleResume = () => {
    if (!duration) return
    setIsPaused(false)
  }

  if (!message) return null

  return (
    <div
      className="sts-toast-portal"
      role="region"
      aria-label="Notifications"
    >
      <div
        className={`sts-toast sts-toast--${tone} ${
          isDismissing ? 'sts-toast--exit' : 'sts-toast--enter'
        }`}
        role="status"
        aria-live="polite"
        onMouseEnter={handlePause}
        onMouseLeave={handleResume}
        onTouchStart={handlePause}
        onTouchEnd={handleResume}
      >
        <div className="sts-toast__icon-wrap">
          <ToastIcon tone={tone} />
        </div>

        <div className="sts-toast__content">
          {title ? <h4 className="sts-toast__title">{title}</h4> : null}
          <p className="sts-toast__message">{message}</p>
          {action ? (
            <button
              type="button"
              className="sts-toast__action"
              onClick={() => {
                action.onClick?.()
                handleDismiss()
              }}
            >
              {action.label}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="sts-toast__close"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          title="Dismiss"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {duration > 0 ? (
          <div
            className={`sts-toast__progress-bar ${
              isPaused ? 'sts-toast__progress-bar--paused' : ''
            }`}
            style={{ animationDuration: `${duration}ms` }}
          />
        ) : null}
      </div>
    </div>
  )
}
