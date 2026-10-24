export function PasswordVisibilityToggle({
  visible,
  onToggle,
  disabled = false,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
}) {
  const label = visible ? hideLabel : showLabel

  return (
    <button
      type="button"
      className="auth-field__toggle"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={visible}
      title={label}
    >
      {visible ? (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M3 3L17 17"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M8.58 8.59C8.21 8.95 8 9.45 8 10C8 11.1 8.9 12 10 12C10.55 12 11.05 11.79 11.41 11.42"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M5.36 5.38C3.78 6.46 2.57 8.03 2 10C3.27 14.06 6.36 16 10 16C11.55 16 13.02 15.65 14.31 14.95M9.01 4.07C9.34 4.02 9.67 4 10 4C13.64 4 16.73 5.94 18 10C17.56 11.42 16.84 12.61 15.91 13.56"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M2 10C3.27 5.94 6.36 4 10 4C13.64 4 16.73 5.94 18 10C16.73 14.06 13.64 16 10 16C6.36 16 3.27 14.06 2 10Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="10"
            cy="10"
            r="2.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      )}
    </button>
  )
}
