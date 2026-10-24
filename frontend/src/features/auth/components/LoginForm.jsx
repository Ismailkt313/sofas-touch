import { useLoginForm } from '../hooks/useLoginForm'
import { AuthAlert } from './AuthAlert'
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle'

export function LoginForm({ onLoginSuccess, onNavigateToSignup }) {
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

  const handleCreateAccountClick = (event) => {
    if (
      typeof onNavigateToSignup === 'function' &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      onNavigateToSignup()
    }
  }

  return (
    <div className="auth-card">
      <header className="auth-card__header">
        <span className="auth-card__eyebrow">Admin Portal</span>
        <h2 id="admin-login-heading" className="auth-card__heading">
          Welcome back
        </h2>
        <p className="auth-card__description">
          Sign in to manage your projects, purchases, and expenses.
        </p>
      </header>

      <AuthAlert message={authError} />

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
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={togglePasswordVisibility}
              disabled={isSubmitting}
            />
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

      {onNavigateToSignup ? (
        <p className="auth-switch">
          Don&apos;t have an account?{' '}
          <a
            href="/signup"
            className="auth-switch__link"
            onClick={handleCreateAccountClick}
          >
            Create account
          </a>
        </p>
      ) : null}
    </div>
  )
}
