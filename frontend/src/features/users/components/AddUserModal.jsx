import { useEffect, useRef, useState } from 'react'
import { PasswordVisibilityToggle } from '../../auth/components/PasswordVisibilityToggle'
import {
  validateEmail,
  validateFullName,
  validateSignupPassword,
} from '../../auth/utils/validation'

export function AddUserModal({ isOpen, onClose, onSubmit }) {
  const [values, setValues] = useState({
    name: '',
    email: '',
    role: 'data_entry',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nameInputRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) {
    return null
  }

  const validateFields = (nextValues) => {
    const nextErrors = {}
    const nameErr = validateFullName(nextValues.name)
    if (nameErr) {
      nextErrors.name = nameErr
    }

    const emailErr = validateEmail(nextValues.email)
    if (emailErr) {
      nextErrors.email = emailErr
    }

    if (nextValues.role !== 'admin' && nextValues.role !== 'data_entry') {
      nextErrors.role = 'Please select an approved user role.'
    }

    const passwordErr = validateSignupPassword(nextValues.password)
    if (passwordErr) {
      nextErrors.password = passwordErr
    }

    return nextErrors
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    const nextValues = {
      ...values,
      [name]: value,
    }
    setValues(nextValues)

    if (submitError) {
      setSubmitError('')
    }

    if (errors[name]) {
      const revalidated = validateFields(nextValues)
      setErrors((prev) => ({
        ...prev,
        [name]: revalidated[name] || '',
      }))
    }
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    setSubmitError('')
    const validationErrors = validateFields(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to create user right now. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose()
        }
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-modal-title"
      >
        <div className="admin-modal__header">
          <div>
            <h2 id="add-user-modal-title" className="admin-modal__title">
              Add New User
            </h2>
            <p className="admin-modal__subtitle">
              Provision a Soft Touch Sofas workspace account with approved role
              permissions.
            </p>
          </div>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close add user dialog"
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

        <form onSubmit={handleFormSubmit} noValidate>
          <div className="admin-modal__body users-modal-form">
            {submitError ? (
              <div className="users-inline-alert users-inline-alert--error" role="alert">
                {submitError}
              </div>
            ) : null}

            <div className="users-form-field">
              <label htmlFor="add-user-name" className="users-form-field__label">
                Full Name
              </label>
              <input
                ref={nameInputRef}
                id="add-user-name"
                name="name"
                type="text"
                className={`users-form-field__input${errors.name ? ' users-form-field__input--error' : ''
                  }`}
                placeholder="Enter full name"
                value={values.name}
                onChange={handleChange}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'add-user-name-err' : undefined}
                required
              />
              {errors.name ? (
                <p id="add-user-name-err" className="users-form-field__error" role="alert">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="users-form-field">
              <label htmlFor="add-user-email" className="users-form-field__label">
                Email Address
              </label>
              <input
                id="add-user-email"
                name="email"
                type="email"
                inputMode="email"
                className={`users-form-field__input${errors.email ? ' users-form-field__input--error' : ''
                  }`}
                placeholder="staff@softtouchsofas.com"
                value={values.email}
                onChange={handleChange}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'add-user-email-err' : undefined}
                required
              />
              {errors.email ? (
                <p id="add-user-email-err" className="users-form-field__error" role="alert">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="users-form-field">
              <label htmlFor="add-user-role" className="users-form-field__label">
                Assigned Role
              </label>
              <select
                id="add-user-role"
                name="role"
                className="users-form-field__select"
                value={values.role}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="data_entry">Data Entry — Operational access</option>
                <option value="admin">Admin — Full administrative access</option>
              </select>
              {errors.role ? (
                <p className="users-form-field__error" role="alert">
                  {errors.role}
                </p>
              ) : null}
            </div>

            <div className="users-form-field">
              <label htmlFor="add-user-password" className="users-form-field__label">
                Initial Password
              </label>
              <div
                className={`users-password-wrap${errors.password ? ' users-password-wrap--error' : ''
                  }`}
              >
                <input
                  id="add-user-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="users-password-wrap__input"
                  placeholder="At least 8 characters (letter & number)"
                  value={values.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={
                    errors.password ? 'add-user-password-err' : undefined
                  }
                  required
                />
                <PasswordVisibilityToggle
                  visible={showPassword}
                  onToggle={() => setShowPassword((prev) => !prev)}
                  disabled={isSubmitting}
                />
              </div>
              {errors.password ? (
                <p
                  id="add-user-password-err"
                  className="users-form-field__error"
                  role="alert"
                >
                  {errors.password}
                </p>
              ) : null}
            </div>
          </div>

          <div className="admin-modal__footer">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Creating user...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
