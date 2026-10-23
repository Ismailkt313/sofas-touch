import { useLoginForm } from '../hooks/useLoginForm'

export function LoginForm({ onLoginSuccess }) {
  const {
    values,
    fieldErrors,
    authError,
    isSubmitting,
    showPassword,
    emailInputRef,
    passwordInputRef,
    handleChange,
    handleBlur,
    togglePasswordVisibility,
    handleSubmit,
  } = useLoginForm({ onLoginSuccess })

  return (
    <div className="auth-card">
      <header className="auth-card__header">
        <h2 id="admin-login-heading" className="auth-card__heading">
          Welcome back
        </h2>
        <p className="auth-card__description">
          Sign in to manage your projects, purchases, and expenses.
        </p>
      </header>

      {authError ? (
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
          <span className="auth-alert__text">{authError}</span>
        </div>
      ) : null}

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="admin-login-heading"
      >
        <div className="auth-field">
          <label htmlFor="admin-email" className="auth-field__label">
            Email address
          </label>
          <div
            className={`auth-field__control${
              fieldErrors.email ? ' auth-field__control--error' : ''
            }`}
          >
            <span className="auth-field__icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <rect
                  x="2.5"
                  y="4.25"
                  width="15"
                  height="11.5"
                  rx="2.25"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M3.25 5.5L9.14 9.92C9.65 10.3 10.35 10.3 10.86 9.92L16.75 5.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <input
              ref={emailInputRef}
              id="admin-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@softtouchsofas.com"
              className="auth-field__input"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? 'admin-email-error' : undefined
              }
              required
            />
          </div>
          {fieldErrors.email ? (
            <p id="admin-email-error" className="auth-field__error" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="admin-password" className="auth-field__label">
            Password
          </label>
          <div
            className={`auth-field__control${
              fieldErrors.password ? ' auth-field__control--error' : ''
            }`}
          >
            <span className="auth-field__icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <rect
                  x="3.75"
                  y="8.75"
                  width="12.5"
                  height="8.25"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M6.75 8.75V6.5C6.75 4.70507 8.20507 3.25 10 3.25C11.7949 3.25 13.25 4.70507 13.25 6.5V8.75"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              ref={passwordInputRef}
              id="admin-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="auth-field__input auth-field__input--password"
              value={values.password}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? 'admin-password-error' : undefined
              }
              required
            />
            <button
              type="button"
              className="auth-field__toggle"
              onClick={togglePasswordVisibility}
              disabled={isSubmitting}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
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
          </div>
          {fieldErrors.password ? (
            <p
              id="admin-password-error"
              className="auth-field__error"
              role="alert"
            >
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <div className="auth-options">
          <label className="auth-remember" htmlFor="admin-remember-me">
            <input
              id="admin-remember-me"
              name="rememberMe"
              type="checkbox"
              className="auth-remember__input"
              checked={values.rememberMe}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            <span className="auth-remember__box" aria-hidden="true">
              <svg viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.2L4.9 8.6L9.5 3.6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="auth-remember__label">Remember me</span>
          </label>
        </div>

        <button
          type="submit"
          className="auth-submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="auth-submit__spinner" aria-hidden="true" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <svg
                className="auth-submit__arrow"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4.5 10H15.5M15.5 10L11 5.5M15.5 10L11 14.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
