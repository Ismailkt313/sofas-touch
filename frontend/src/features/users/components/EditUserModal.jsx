import { useEffect, useRef, useState } from 'react'
import {
  validateEmail,
  validateFullName,
  validatePhone,
} from '../../auth/utils/validation'

export function EditUserModal({
  user,
  isSelf,
  dataSource,
  onClose,
  onSubmit,
}) {
  const [values, setValues] = useState(() => ({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    roleKey: user?.roleKey || 'data_entry',
  }))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => {
    if (!user) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nameRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [user, isSaving, onClose])

  if (!user) {
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

    if (nextValues.phone.trim()) {
      const phoneErr = validatePhone(nextValues.phone)
      if (phoneErr) {
        nextErrors.phone = phoneErr
      }
    }

    if (
      nextValues.roleKey !== 'admin' &&
      nextValues.roleKey !== 'data_entry'
    ) {
      nextErrors.roleKey = 'Please choose an approved workspace role.'
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
    if (isSaving) {
      return
    }

    setSubmitError('')
    const validationErrors = validateFields(values)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      return
    }

    setIsSaving(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to update user right now.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose()
        }
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-modal-title"
      >
        <div className="admin-modal__header">
          <div>
            <h2 id="edit-user-modal-title" className="admin-modal__title">
              Edit User
            </h2>
            <p className="admin-modal__subtitle">
              Update profile details and approved role assignment.
            </p>
          </div>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close edit user dialog"
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
            {dataSource === 'api' ? (
              <div className="users-inline-alert users-inline-alert--notice">
                Note: The backend user update endpoint (
                <code>PATCH /api/admin/users/:id</code>) is not yet implemented,
                so server-side edits are currently unavailable.
              </div>
            ) : null}

            {submitError ? (
              <div className="users-inline-alert users-inline-alert--error" role="alert">
                {submitError}
              </div>
            ) : null}

            <div className="users-form-field">
              <label htmlFor="edit-user-name" className="users-form-field__label">
                Full Name
              </label>
              <input
                ref={nameRef}
                id="edit-user-name"
                name="name"
                type="text"
                className={`users-form-field__input${
                  errors.name ? ' users-form-field__input--error' : ''
                }`}
                value={values.name}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={Boolean(errors.name)}
                required
              />
              {errors.name ? (
                <p className="users-form-field__error" role="alert">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="users-form-field">
              <label htmlFor="edit-user-email" className="users-form-field__label">
                Email Address
              </label>
              <input
                id="edit-user-email"
                name="email"
                type="email"
                className={`users-form-field__input${
                  errors.email ? ' users-form-field__input--error' : ''
                }`}
                value={values.email}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={Boolean(errors.email)}
                required
              />
              {errors.email ? (
                <p className="users-form-field__error" role="alert">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div className="users-form-field">
              <label htmlFor="edit-user-phone" className="users-form-field__label">
                Phone Number <span className="users-form-field__optional">(optional)</span>
              </label>
              <input
                id="edit-user-phone"
                name="phone"
                type="tel"
                className={`users-form-field__input${
                  errors.phone ? ' users-form-field__input--error' : ''
                }`}
                placeholder="+91 98765 43210"
                value={values.phone}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone ? (
                <p className="users-form-field__error" role="alert">
                  {errors.phone}
                </p>
              ) : null}
            </div>

            <div className="users-form-field">
              <label htmlFor="edit-user-role" className="users-form-field__label">
                Role
              </label>
              <select
                id="edit-user-role"
                name="roleKey"
                className="users-form-field__select"
                value={values.roleKey}
                onChange={handleChange}
                disabled={isSaving || isSelf}
              >
                <option value="data_entry">Data Entry</option>
                <option value="admin">Admin</option>
              </select>
              {isSelf ? (
                <p className="users-form-field__hint">
                  Your own Admin role cannot be modified to prevent accidental
                  lockout.
                </p>
              ) : null}
            </div>
          </div>

          <div className="admin-modal__footer">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
