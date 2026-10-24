import { useSignupForm } from '../hooks/useSignupForm'
import { AuthAlert } from './AuthAlert'
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle'

export function SignupForm({ onSignupSuccess, onNavigateToLogin }) {
  const {
    values,
    fieldErrors,
    authError,
    isSubmitting,
    showPassword,
    showConfirmPassword,
    fullNameInputRef,
    emailInputRef,
    phoneInputRef,
    passwordInputRef,
    confirmPasswordInputRef,
    handleChange,
    handleBlur,
    togglePasswordVisibility,
    toggleConfirmPasswordVisibility,
    handleSubmit,
  } = useSignupForm({ onSignupSuccess })

  const handleSignInClick = (event) => {
    if (
      typeof onNavigateToLogin === 'function' &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      onNavigateToLogin()
    }
  }

  return (
    <div className="auth-card auth-card--signup">
      <header className="auth-card__header">
        <span className="auth-card__eyebrow">Account Registration</span>
        <h2 id="signup-heading" className="auth-card__heading">
          Create your account
        </h2>
        <p className="auth-card__description">
          Enter your details to get started with Soft Touch Sofas.
        </p>
      </header>

      <AuthAlert message={authError} />

      <form
        className="auth-form"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="signup-heading"
      >
        <div className="auth-field">
          <label htmlFor="signup-full-name" className="auth-field__label">
            Full Name
          </label>
          <div
            className={`auth-field__control${
              fieldErrors.fullName ? ' auth-field__control--error' : ''
            }`}
          >
            <span className="auth-field__icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <circle
                  cx="10"
                  cy="6.75"
                  r="3.25"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M4 16.5C4.55 13.75 6.95 12 10 12C13.05 12 15.45 13.75 16 16.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <input
              ref={fullNameInputRef}
              id="signup-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Enter your full name"
              className="auth-field__input"
              value={values.fullName}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={
                fieldErrors.fullName ? 'signup-full-name-error' : undefined
              }
              required
            />
          </div>
          {fieldErrors.fullName ? (
            <p
              id="signup-full-name-error"
              className="auth-field__error"
              role="alert"
            >
              {fieldErrors.fullName}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-email" className="auth-field__label">
            Email Address
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
              id="signup-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@example.com"
              className="auth-field__input"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? 'signup-email-error' : undefined
              }
              required
            />
          </div>
          {fieldErrors.email ? (
            <p
              id="signup-email-error"
              className="auth-field__error"
              role="alert"
            >
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-phone" className="auth-field__label">
            Phone Number
          </label>
          <div
            className={`auth-field__control${
              fieldErrors.phone ? ' auth-field__control--error' : ''
            }`}
          >
            <span className="auth-field__icon" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <path
                  d="M5.65 3.5H7.82C8.26 3.5 8.63 3.81 8.73 4.24L9.22 6.36C9.3 6.72 9.15 7.09 8.85 7.3L7.56 8.21C8.39 9.94 9.81 11.36 11.54 12.19L12.45 10.9C12.66 10.6 13.03 10.45 13.39 10.53L15.51 11.02C15.94 11.12 16.25 11.49 16.25 11.93V14.1C16.25 14.95 15.52 15.63 14.67 15.54C9.04 14.97 4.78 10.71 4.21 5.08C4.12 4.23 4.8 3.5 5.65 3.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <input
              ref={phoneInputRef}
              id="signup-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              className="auth-field__input"
              value={values.phone}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={
                fieldErrors.phone ? 'signup-phone-error' : undefined
              }
              required
            />
          </div>
          {fieldErrors.phone ? (
            <p
              id="signup-phone-error"
              className="auth-field__error"
              role="alert"
            >
              {fieldErrors.phone}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label htmlFor="signup-password" className="auth-field__label">
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
              id="signup-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="auth-field__input auth-field__input--password"
              value={values.password}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? 'signup-password-error' : undefined
              }
              required
            />
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={togglePasswordVisibility}
              disabled={isSubmitting}
              showLabel="Show password"
              hideLabel="Hide password"
            />
          </div>
          {fieldErrors.password ? (
            <p
              id="signup-password-error"
              className="auth-field__error"
              role="alert"
            >
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <div className="auth-field">
          <label
            htmlFor="signup-confirm-password"
            className="auth-field__label"
          >
            Confirm Password
          </label>
          <div
            className={`auth-field__control${
              fieldErrors.confirmPassword ? ' auth-field__control--error' : ''
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
                <path
                  d="M8.15 12.95L9.45 14.2L12.05 11.65"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <input
              ref={confirmPasswordInputRef}
              id="signup-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="auth-field__input auth-field__input--password"
              value={values.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              aria-describedby={
                fieldErrors.confirmPassword
                  ? 'signup-confirm-password-error'
                  : undefined
              }
              required
            />
            <PasswordVisibilityToggle
              visible={showConfirmPassword}
              onToggle={toggleConfirmPasswordVisibility}
              disabled={isSubmitting}
              showLabel="Show confirm password"
              hideLabel="Hide confirm password"
            />
          </div>
          {fieldErrors.confirmPassword ? (
            <p
              id="signup-confirm-password-error"
              className="auth-field__error"
              role="alert"
            >
              {fieldErrors.confirmPassword}
            </p>
          ) : null}
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
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Create Account</span>
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

      <p className="auth-switch">
        Already have an account?{' '}
        <a
          href="/login"
          className="auth-switch__link"
          onClick={handleSignInClick}
        >
          Sign in
        </a>
      </p>
    </div>
  )
}
