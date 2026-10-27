import { useEffect, useId, useRef, useState } from 'react'
import { Dropdown } from '../../../components/common'
import {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '../services/projectService'

const MAX_NAME_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 2000

function buildInitialFormValues(project, isEditMode) {
  if (!isEditMode || !project) {
    return {
      name: '',
      clientName: '',
      category: PROJECT_CATEGORY_OPTIONS[0],
      contractValue: '',
      description: '',
    }
  }

  return {
    name: project.name || '',
    clientName: project.clientName || '',
    category: PROJECT_CATEGORY_OPTIONS.includes(project.category)
      ? project.category
      : PROJECT_CATEGORY_OPTIONS[0],
    status: PROJECT_STATUS_OPTIONS.includes(project.status)
      ? project.status
      : PROJECT_STATUS_OPTIONS[0],
    contractValue:
      project.contractValue !== undefined && project.contractValue !== null
        ? String(project.contractValue)
        : '0',
    costAlertThresholdPercent:
      project.costAlertThresholdPercent !== undefined &&
      project.costAlertThresholdPercent !== null
        ? String(project.costAlertThresholdPercent)
        : '',
    description: project.description || '',
  }
}

function validateProjectFormValues(values, isEditMode) {
  const errors = {}

  const trimmedName = String(values.name || '').trim()
  if (!trimmedName) {
    errors.name = 'Project name is required.'
  } else if (trimmedName.length > MAX_NAME_LENGTH) {
    errors.name = `Project name cannot exceed ${MAX_NAME_LENGTH} characters.`
  }

  const trimmedClient = String(values.clientName || '').trim()
  if (!trimmedClient) {
    errors.clientName = 'Client name is required.'
  } else if (trimmedClient.length > MAX_NAME_LENGTH) {
    errors.clientName = `Client name cannot exceed ${MAX_NAME_LENGTH} characters.`
  }

  if (!PROJECT_CATEGORY_OPTIONS.includes(values.category)) {
    errors.category = 'Please select a valid project category.'
  }

  if (isEditMode && !PROJECT_STATUS_OPTIONS.includes(values.status)) {
    errors.status = 'Please select a valid project status.'
  }

  const rawContract = String(values.contractValue ?? '').trim()
  if (rawContract === '') {
    errors.contractValue = 'Fixed contract value is required.'
  } else {
    const parsedContract = Number(rawContract)
    if (!Number.isFinite(parsedContract) || parsedContract < 0) {
      errors.contractValue =
        'Enter a valid amount greater than or equal to 0.'
    }
  }

  if (isEditMode) {
    const rawThreshold = String(values.costAlertThresholdPercent ?? '').trim()
    if (rawThreshold !== '') {
      const parsedThreshold = Number(rawThreshold)
      if (
        !Number.isFinite(parsedThreshold) ||
        parsedThreshold <= 0 ||
        parsedThreshold >= 100
      ) {
        errors.costAlertThresholdPercent =
          'Threshold must be greater than 0 and less than 100.'
      }
    }
  }

  if (
    typeof values.description === 'string' &&
    values.description.trim().length > MAX_DESCRIPTION_LENGTH
  ) {
    errors.description = `Notes cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`
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
  const [values, setValues] = useState(() =>
    buildInitialFormValues(project, isEditMode),
  )
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false)

  const submittingLockRef = useRef(false)
  const nameInputRef = useRef(null)
  const titleId = useId()
  const subtitleId = useId()
  const additionalPanelId = useId()

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

  const updateFieldValue = (fieldName, nextValue) => {
    const nextValues = {
      ...values,
      [fieldName]: nextValue,
    }
    setValues(nextValues)

    if (submitError) {
      setSubmitError('')
    }

    if (errors[fieldName]) {
      const revalidated = validateProjectFormValues(nextValues, isEditMode)
      setErrors((prev) => ({
        ...prev,
        [fieldName]: revalidated[fieldName] || '',
      }))
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    updateFieldValue(name, value)
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault()
    if (submittingLockRef.current || isSubmitting) {
      return
    }

    setSubmitError('')
    const validationErrors = validateProjectFormValues(values, isEditMode)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      if (
        validationErrors.description ||
        validationErrors.costAlertThresholdPercent
      ) {
        setIsAdditionalOpen(true)
      }
      return
    }

    submittingLockRef.current = true
    setIsSubmitting(true)

    try {
      const payload = {
        name: values.name.trim(),
        clientName: values.clientName.trim(),
        category: values.category,
        contractValue: Number(String(values.contractValue).trim()),
        description: values.description.trim(),
      }

      if (isEditMode) {
        payload.status = values.status
        const trimmedThreshold = String(
          values.costAlertThresholdPercent ?? '',
        ).trim()
        if (trimmedThreshold !== '') {
          payload.costAlertThresholdPercent = Number(trimmedThreshold)
        }
        const targetId = project.projectId || project.id
        await onSubmit(targetId, payload)
      } else {
        await onSubmit(payload)
      }
    } catch (err) {
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        setErrors((prev) => ({
          ...prev,
          ...err.fieldErrors,
        }))
        if (
          err.fieldErrors.description ||
          err.fieldErrors.costAlertThresholdPercent
        ) {
          setIsAdditionalOpen(true)
        }
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

  const hasNotesValue = Boolean(values.description.trim())
  const hasAdditionalError = Boolean(
    errors.description || errors.costAlertThresholdPercent,
  )
  const descriptionLength = values.description.length

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
        <div className="admin-modal__header projects-form-modal__header">
          <div className="projects-form-modal__heading">
            <h2 id={titleId} className="admin-modal__title">
              {isEditMode ? 'Edit Project' : 'Add New Project'}
            </h2>
            <p id={subtitleId} className="admin-modal__subtitle">
              {isEditMode
                ? `Update core details or scope notes for ${project.projectId}.`
                : 'Enter essential details to register a new manufacturing project.'}
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

        <form
          className="projects-form-modal__form"
          onSubmit={handleFormSubmit}
          noValidate
        >
          <div className="admin-modal__body projects-modal-body">
            {submitError ? (
              <div
                className="projects-form-alert projects-form-alert--error"
                role="alert"
              >
                {submitError}
              </div>
            ) : null}

            <div className="projects-id-info" aria-label="Project ID information">
              <span className="projects-id-info__label">Project ID</span>
              {isEditMode ? (
                <span className="projects-id-info__value">
                  <span className="project-code-pill">{project.projectId}</span>
                  <span className="projects-id-info__note">Immutable</span>
                </span>
              ) : (
                <span className="projects-id-info__note">
                  Auto-generated on save (e.g. PRJ-0001)
                </span>
              )}
            </div>

            <div className="projects-form-grid">
              <div
                className={`projects-form-field${
                  isEditMode ? ' projects-form-field--full' : ''
                }`}
              >
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
                  maxLength={MAX_NAME_LENGTH}
                  className={`projects-form-field__input${
                    errors.name ? ' projects-form-field__input--error' : ''
                  }`}
                  placeholder="e.g. Belgravia Modular Sectional"
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
                  maxLength={MAX_NAME_LENGTH}
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
                  onChange={(val) => updateFieldValue('category', val)}
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

              {isEditMode ? (
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
                    onChange={(val) => updateFieldValue('status', val)}
                    disabled={isSubmitting}
                    error={Boolean(errors.status)}
                  />
                  {errors.status ? (
                    <p className="projects-form-field__error" role="alert">
                      {errors.status}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="projects-additional-section">
              <button
                type="button"
                className={`projects-additional-toggle${
                  isAdditionalOpen ? ' projects-additional-toggle--open' : ''
                }${
                  hasAdditionalError ? ' projects-additional-toggle--error' : ''
                }`}
                onClick={() => setIsAdditionalOpen((prev) => !prev)}
                aria-expanded={isAdditionalOpen}
                aria-controls={additionalPanelId}
              >
                <span className="projects-additional-toggle__left">
                  <span className="projects-additional-toggle__title">
                    Additional Details
                  </span>
                  <span className="projects-additional-toggle__meta">
                    {hasNotesValue ? 'Notes added' : 'Optional'}
                  </span>
                </span>
                <svg
                  className="projects-additional-toggle__chevron"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isAdditionalOpen ? (
                <div
                  id={additionalPanelId}
                  className="projects-additional-panel"
                >
                  <div className="projects-form-field">
                    <div className="projects-form-field__label-row">
                      <label
                        htmlFor="project-form-description"
                        className="projects-form-field__label"
                      >
                        Project Notes / Scope Summary
                      </label>
                      <span className="projects-form-field__counter">
                        {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
                      </span>
                    </div>
                    <textarea
                      id="project-form-description"
                      name="description"
                      rows={3}
                      maxLength={MAX_DESCRIPTION_LENGTH}
                      className={`projects-form-field__textarea${
                        errors.description
                          ? ' projects-form-field__input--error'
                          : ''
                      }`}
                      placeholder="Scope summary, upholstery specifications, delivery instructions, or site notes..."
                      value={values.description}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(errors.description)}
                    />
                    {errors.description ? (
                      <p className="projects-form-field__error" role="alert">
                        {errors.description}
                      </p>
                    ) : null}
                  </div>

                  {isEditMode ? (
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
                          Per-project warning threshold override (critical alert
                          remains at 100%).
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="admin-modal__footer projects-form-modal__footer">
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
