export function AuthAlert({ message }) {
  if (!message) {
    return null
  }

  return (
    <div className="auth-alert" role="alert" aria-live="assertive">
      <svg
        className="auth-alert__icon"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="10"
          cy="10"
          r="8.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M10 6.25V10.5M10 13.5H10.0075"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="auth-alert__text">{message}</span>
    </div>
  )
}
