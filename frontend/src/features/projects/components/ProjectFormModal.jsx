import { useEffect, useId, useRef, useState } from 'react'
import {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '../services/projectService'
import { Dropdown } from '../../../components/common'

function buildInitialFormValues(project) {
  if (!project) {
    return {
      name: '',
      clientName: '',
      category: 'Modular Sofa',
      status: 'In Progress',
      siteLocation: '',
      contractValue: '',
      costAlertThresholdPercent: '80',
      description: '',
    }
  }

  return {
    name: project.name || '',
    clientName: project.clientName || '',
    category: PROJECT_CATEGORY_OPTIONS.includes(project.category)
      ? project.category
      : 'Modular Sofa',
    status: PROJECT_STATUS_OPTIONS.includes(project.status)
      ? project.status
      : 'In Progress',
    siteLocation: project.siteLocation || '',
    contractValue:
      project.contractValue !== undefined && project.contractValue !== null
        ? String(project.contractValue)
        : '0',
    costAlertThresholdPercent:
      project.costAlertThresholdPercent !== undefined &&
      project.costAlertThresholdPercent !== null
        ? String(project.costAlertThresholdPercent)
        : '80',
    description: project.description || '',
  }
}

function validateProjectFormValues(values) {
  const errors = {}

  const trimmedName = String(values.name || '').trim()
  if (!trimmedName) {
    errors.name = 'Project name is required.'
  } else if (trimmedName.length > 200) {
    errors.name = 'Project name cannot exceed 200 characters.'
  }

  const trimmedClient = String(values.clientName || '').trim()
  if (!trimmedClient) {
    errors.clientName = 'Client name is required.'
  } else if (trimmedClient.length > 200) {
    errors.clientName = 'Client name cannot exceed 200 characters.'
  }

  if (!PROJECT_CATEGORY_OPTIONS.includes(values.category)) {
    errors.category = 'Please select a valid project category.'
  }

  if (!PROJECT_STATUS_OPTIONS.includes(values.status)) {
    errors.status = 'Please select a valid project status.'
  }

  const rawContract = String(values.contractValue ?? '').trim()
  if (rawContract === '') {
    errors.contractValue = 'Fixed contract value is required (enter 0 or greater).'
  } else {
    const parsedContract = Number(rawContract)
    if (!Number.isFinite(parsedContract) || parsedContract < 0) {
      errors.contractValue =
        'Contract value must be a valid number greater than or equal to 0.'
    }
  }

  const rawThreshold = String(values.costAlertThresholdPercent ?? '').trim()
  if (rawThreshold !== '') {
    const parsedThreshold = Number(rawThreshold)
    if (
      !Number.isFinite(parsedThreshold) ||
      parsedThreshold <= 0 ||
      parsedThreshold >= 100
    ) {
      errors.costAlertThresholdPercent =
        'Cost warning threshold must be greater than 0 and less than 100.'
    }
  }

  if (
    typeof values.description === 'string' &&
    values.description.trim().length > 2000
  ) {
    errors.description = 'Description cannot exceed 2000 characters.'
  }

  return errors
}

export function ProjectFormModal({
  mode = 'create',
  project = null,
  isOpen,
  onClose,
  onSubmit,
}) {
  const isEditMode = mode === 'edit' && Boolean(project)
  const [values, setValues] = useState(() => buildInitialFormValues(project))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submittingLockRef = useRef(false)
  const nameInputRef = useRef(null)
  const titleId = useId()
  const subtitleId = useId()

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    nameInputRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submittingLockRef.current) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
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
      const revalidated = validateProjectFormValues(nextValues)
      setErrors((prev) => ({
        ...prev,
        [name]: revalidated[name] || '',
      }))
    }
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    if (submittingLockRef.current || isSubmitting) {
      return
    }

    setSubmitError('')
    const validationErrors = validateProjectFormValues(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      return
    }

    submittingLockRef.current = true
    setIsSubmitting(true)

    try {
      const normalizedPayload = {
        name: values.name.trim(),
        clientName: values.clientName.trim(),
        category: values.category,
        status: values.status,
        siteLocation: values.siteLocation.trim(),
        contractValue: Number(String(values.contractValue).trim()),
        costAlertThresholdPercent:
          String(values.costAlertThresholdPercent).trim() !== ''
            ? Number(String(values.costAlertThresholdPercent).trim())
            : 80,
        description: values.description.trim(),
      }

      if (isEditMode) {
        const targetId = project.projectId || project.id
        await onSubmit(targetId, normalizedPayload)
      } else {
        await onSubmit(normalizedPayload)
      }
    } catch (err) {
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        setErrors((prev) => ({
          ...prev,
          ...err.fieldErrors,
        }))
      }
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to save project right now. Please try again.',
      )
    } finally {
      submittingLockRef.current = false
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
        className="admin-modal projects-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
      >
        <div className="admin-modal__header">
          <div>
            <h2 id={titleId} className="admin-modal__title">
              {isEditMode ? 'Edit Project' : 'Add New Project'}
            </h2>
            <p id={subtitleId} className="admin-modal__subtitle">
              {isEditMode
                ? `Update manufacturing details, contract value, or status for ${project.projectId}.`
                : 'Register a new client manufacturing project. The sequential Project ID is assigned automatically.'}
            </p>
          </div>

          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleFormSubmit} noValidate>
          <div className="admin-modal__body projects-modal-body">
            {submitError ? (
              <div
                className="projects-form-alert projects-form-alert--error"
                role="alert"
              >
                {submitError}
              </div>
            ) : null}

            <div className="projects-id-readonly">
              <span className="projects-id-readonly__label">Project ID</span>
              {isEditMode ? (
                <div className="projects-id-readonly__value-row">
                  <span className="project-code-pill">{project.projectId}</span>
                  <span className="projects-id-readonly__hint">
                    Immutable system identifier
                  </span>
                </div>
              ) : (
                <span className="projects-id-readonly__auto">
                  Generated automatically by server upon save (e.g. PRJ-0001)
                </span>
              )}
            </div>

            <div className="projects-form-grid">
              <div className="projects-form-field projects-form-field--full">
                <label
                  htmlFor="project-form-name"
                  className="projects-form-field__label"
                >
                  Project Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="project-form-name"
                  ref={nameInputRef}
                  name="name"
                  type="text"
                  className={`projects-form-field__input${
                    errors.name ? ' projects-form-field__input--error' : ''
                  }`}
                  placeholder="e.g. Belgravia Residence Modular Sectional"
                  value={values.name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  required
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name ? (
                  <p className="projects-form-field__error" role="alert">
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="projects-form-field">
                <label
                  htmlFor="project-form-client"
                  className="projects-form-field__label"
                >
                  Client Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="project-form-client"
                  name="clientName"
                  type="text"
                  className={`projects-form-field__input${
                    errors.clientName
                      ? ' projects-form-field__input--error'
                      : ''
                  }`}
                  placeholder="e.g. Harrington Estates"
                  value={values.clientName}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  required
                  aria-invalid={Boolean(errors.clientName)}
                />
                {errors.clientName ? (
                  <p className="projects-form-field__error" role="alert">
                    {errors.clientName}
                  </p>
                ) : null}
              </div>

              <div className="projects-form-field">
                <label
                  htmlFor="project-form-category"
                  className="projects-form-field__label"
                >
                  Category
                </label>
                <Dropdown
                  id="project-form-category"
                  name="category"
                  variant="form"
                  value={values.category}
                  options={PROJECT_CATEGORY_OPTIONS}
                  onChange={(val) => setValues((prev) => ({ ...prev, category: val }))}
                  disabled={isSubmitting}
                  error={Boolean(errors.category)}
                />
                {errors.category ? (
                  <p className="projects-form-field__error" role="alert">
                    {errors.category}
                  </p>
                ) : null}
              </div>

              <div className="projects-form-field">
                <label
                  htmlFor="project-form-contract"
                  className="projects-form-field__label"
                >
                  Fixed Contract Value (INR) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="project-form-contract"
                  name="contractValue"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={`projects-form-field__input${
                    errors.contractValue
                      ? ' projects-form-field__input--error'
                      : ''
                  }`}
                  placeholder="0.00"
                  value={values.contractValue}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  required
                  aria-invalid={Boolean(errors.contractValue)}
                />
                {errors.contractValue ? (
                  <p className="projects-form-field__error" role="alert">
                    {errors.contractValue}
                  </p>
                ) : null}
              </div>

              <div className="projects-form-field">
                <label
                  htmlFor="project-form-status"
                  className="projects-form-field__label"
                >
                  Project Status
                </label>
                <Dropdown
                  id="project-form-status"
                  name="status"
                  variant="form"
                  value={values.status}
                  options={PROJECT_STATUS_OPTIONS}
                  onChange={(val) => setValues((prev) => ({ ...prev, status: val }))}
                  disabled={isSubmitting}
                  error={Boolean(errors.status)}
                />
                {errors.status ? (
                  <p className="projects-form-field__error" role="alert">
                    {errors.status}
                  </p>
                ) : null}
              </div>

              <div className="projects-form-field">
                <label
                  htmlFor="project-form-site-location"
                  className="projects-form-field__label"
                >
                  Site Location
                </label>
                <input
                  id="project-form-site-location"
                  name="siteLocation"
                  type="text"
                  className="projects-form-field__input"
                  placeholder="e.g. Kochi / Panampilly Nagar"
                  value={values.siteLocation}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                <p className="projects-form-field__hint">
                  Note: Dedicated siteLocation and client contact fields are not
                  yet persisted in the current backend Project schema.
                </p>
              </div>

              <div className="projects-form-field">
                <label
                  htmlFor="project-form-threshold"
                  className="projects-form-field__label"
                >
                  Cost Warning Threshold (%)
                </label>
                <input
                  id="project-form-threshold"
                  name="costAlertThresholdPercent"
                  type="number"
                  min="1"
                  max="99"
                  step="1"
                  className={`projects-form-field__input${
                    errors.costAlertThresholdPercent
                      ? ' projects-form-field__input--error'
                      : ''
                  }`}
                  placeholder="80"
                  value={values.costAlertThresholdPercent}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  aria-invalid={Boolean(errors.costAlertThresholdPercent)}
                />
                {errors.costAlertThresholdPercent ? (
                  <p className="projects-form-field__error" role="alert">
                    {errors.costAlertThresholdPercent}
                  </p>
                ) : (
                  <p className="projects-form-field__hint">
                    Alerts trigger when recorded costs cross this % (default
                    80%) and 100%.
                  </p>
                )}
              </div>

              <div className="projects-form-field projects-form-field--full">
                <label
                  htmlFor="project-form-description"
                  className="projects-form-field__label"
                >
                  Project Notes / Scope Summary
                </label>
                <textarea
                  id="project-form-description"
                  name="description"
                  rows={3}
                  className={`projects-form-field__textarea${
                    errors.description
                      ? ' projects-form-field__input--error'
                      : ''
                  }`}
                  placeholder="Optional upholstery specifications, room notes, or delivery instructions..."
                  value={values.description}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
                {errors.description ? (
                  <p className="projects-form-field__error" role="alert">
                    {errors.description}
                  </p>
                ) : null}
              </div>
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
            >
              {isSubmitting
                ? isEditMode
                  ? 'Saving Changes...'
                  : 'Creating Project...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
