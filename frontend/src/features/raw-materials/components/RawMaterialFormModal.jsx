import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dropdown } from '../../../components/common'
import {
  MAX_MATERIAL_DESCRIPTION_LENGTH,
  MAX_MATERIAL_NAME_LENGTH,
  RAW_MATERIAL_CATEGORIES,
  buildUnitOptions,
  normalizeWhitespace,
} from '../services/rawMaterialService'
import { RawMaterialStatusBadge } from './RawMaterialStatusBadge'

const FIELD_DOM_IDS = {
  name: 'rm-form-name',
  unit: 'rm-form-unit',
  category: 'rm-form-category',
  description: 'rm-form-description',
}

const CREATE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function buildCategoryOptions(currentCategory = '') {
  const baseOptions = [
    { value: '', label: 'None (Optional)' },
    ...RAW_MATERIAL_CATEGORIES.map((category) => ({
      value: category,
      label: category,
    })),
  ]

  const trimmed =
    typeof currentCategory === 'string' ? currentCategory.trim() : ''
  if (
    trimmed &&
    !RAW_MATERIAL_CATEGORIES.some(
      (cat) => cat.toLowerCase() === trimmed.toLowerCase(),
    )
  ) {
    return [
      baseOptions[0],
      { value: trimmed, label: trimmed },
      ...baseOptions.slice(1),
    ]
  }

  return baseOptions
}

function buildInitialValues(material, isEditMode) {
  if (!isEditMode || !material) {
    return {
      name: '',
      category: '',
      unit: '',
      description: '',
      isActive: true,
    }
  }

  return {
    name: material.name || '',
    category: material.category || '',
    unit: material.unit || '',
    description: material.description || '',
    isActive: material.isActive !== false,
  }
}

function validateFormValues(values) {
  const errors = {}

  const cleanName = normalizeWhitespace(values.name)
  if (!cleanName) {
    errors.name = 'Material name is required.'
  } else if (cleanName.length > MAX_MATERIAL_NAME_LENGTH) {
    errors.name = `Material name cannot exceed ${MAX_MATERIAL_NAME_LENGTH} characters.`
  }

  const cleanUnit = String(values.unit || '').trim()
  if (!cleanUnit) {
    errors.unit = 'Purchase unit is required.'
  }

  const cleanDescription = String(values.description || '').trim()
  if (cleanDescription.length > MAX_MATERIAL_DESCRIPTION_LENGTH) {
    errors.description = `Description cannot exceed ${MAX_MATERIAL_DESCRIPTION_LENGTH} characters.`
  }

  return errors
}

function focusFirstInvalidField(validationErrors) {
  const orderedKeys = ['name', 'unit', 'category', 'description']
  const firstKey = orderedKeys.find((key) => Boolean(validationErrors[key]))
  if (!firstKey || typeof document === 'undefined') {
    return
  }
  const targetId = FIELD_DOM_IDS[firstKey]
  window.requestAnimationFrame(() => {
    const el = document.getElementById(targetId)
    el?.focus?.()
  })
}

export function RawMaterialFormModal({
  isOpen,
  mode = 'create',
  material = null,
  isLoadingRecord = false,
  loadError = '',
  onClose,
  onSubmit,
}) {
  const isEditMode = mode === 'edit'
  const [values, setValues] = useState(() =>
    buildInitialValues(material, isEditMode),
  )
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submittingLockRef = useRef(false)
  const backdropMouseDownRef = useRef(false)
  const nameInputRef = useRef(null)

  const titleId = useId()
  const subtitleId = useId()
  const nameErrorId = useId()
  const unitErrorId = useId()
  const categoryErrorId = useId()
  const descriptionErrorId = useId()

  const categoryOptions = useMemo(
    () => buildCategoryOptions(values.category),
    [values.category],
  )

  const unitOptions = useMemo(
    () => buildUnitOptions(values.unit),
    [values.unit],
  )

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || submittingLockRef.current) {
        return
      }
      if (
        event.defaultPrevented ||
        document.querySelector('.sts-dropdown__menu')
      ) {
        return
      }
      event.preventDefault()
      onClose?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  const updateField = (fieldName, nextValue) => {
    const nextValues = {
      ...values,
      [fieldName]: nextValue,
    }
    setValues(nextValues)

    if (submitError) {
      setSubmitError('')
    }

    if (errors[fieldName]) {
      const revalidated = validateFormValues(nextValues)
      setErrors((prev) => ({
        ...prev,
        [fieldName]: revalidated[fieldName] || '',
      }))
    }
  }

  const handleInputBlur = (event) => {
    const { name } = event.target
    if (!name) {
      return
    }
    const validationErrors = validateFormValues(values)
    if (validationErrors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: validationErrors[name],
      }))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (
      submittingLockRef.current ||
      isSubmitting ||
      isLoadingRecord ||
      Boolean(loadError)
    ) {
      return
    }

    setSubmitError('')
    const validationErrors = validateFormValues(values)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      focusFirstInvalidField(validationErrors)
      return
    }

    submittingLockRef.current = true
    setIsSubmitting(true)

    try {
      await onSubmit(values)
    } catch (err) {
      if (err?.fieldErrors && typeof err.fieldErrors === 'object') {
        const mappedErrors = {}
        for (const [key, msg] of Object.entries(err.fieldErrors)) {
          if (typeof msg === 'string' && msg.trim()) {
            mappedErrors[key] = msg.trim()
          }
        }
        if (Object.keys(mappedErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...mappedErrors }))
          focusFirstInvalidField(mappedErrors)
        }
      }
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Unable to save material. Please try again.',
      )
    } finally {
      submittingLockRef.current = false
      setIsSubmitting(false)
    }
  }

  const isFormDisabled = isSubmitting || isLoadingRecord || Boolean(loadError)

  return createPortal(
    <div
      className="admin-modal-backdrop"
      onMouseDown={(event) => {
        backdropMouseDownRef.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (
          backdropMouseDownRef.current &&
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose?.()
        }
        backdropMouseDownRef.current = false
      }}
    >
      <div
        className="admin-modal rm-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
      >
        <div className="admin-modal__header">
          <div>
            <h2 id={titleId} className="admin-modal__title">
              {isEditMode ? 'Edit Material' : 'Add Material'}
            </h2>
            <p id={subtitleId} className="admin-modal__subtitle">
              {isEditMode
                ? 'Update raw material specifications used across manufacturing projects.'
                : 'Add a raw material to the catalog for sofa and curtain procurement.'}
            </p>
          </div>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close material form"
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

        <form onSubmit={handleSubmit} className="rm-form" noValidate>
          <div className="admin-modal__body rm-form__body">
            {isLoadingRecord ? (
              <div className="rm-inline-alert rm-inline-alert--info" role="status">
                Refreshing saved material details...
              </div>
            ) : null}

            {loadError ? (
              <div className="rm-inline-alert rm-inline-alert--error" role="alert">
                {loadError}
              </div>
            ) : null}

            {submitError ? (
              <div className="rm-inline-alert rm-inline-alert--error" role="alert">
                {submitError}
              </div>
            ) : null}

            <div className="rm-form__field">
              <label htmlFor={FIELD_DOM_IDS.name} className="rm-form__label">
                Material Name <span className="rm-form__req">*</span>
              </label>
              <input
                ref={nameInputRef}
                id={FIELD_DOM_IDS.name}
                name="name"
                type="text"
                className={`rm-form__input${
                  errors.name ? ' rm-form__input--error' : ''
                }`}
                placeholder="e.g., Belgian Linen Velvet, Seasoned Teak Strip"
                value={values.name}
                onChange={(event) => updateField('name', event.target.value)}
                onBlur={handleInputBlur}
                maxLength={MAX_MATERIAL_NAME_LENGTH}
                disabled={isFormDisabled}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? nameErrorId : undefined}
                autoComplete="off"
              />
              {errors.name ? (
                <p id={nameErrorId} className="rm-form__error" role="alert">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="rm-form__grid">
              <div className="rm-form__field">
                <label htmlFor={FIELD_DOM_IDS.unit} className="rm-form__label">
                  Unit <span className="rm-form__req">*</span>
                </label>
                <Dropdown
                  id={FIELD_DOM_IDS.unit}
                  name="unit"
                  variant="form"
                  value={values.unit}
                  options={unitOptions}
                  placeholder="Select purchase unit"
                  disabled={isFormDisabled}
                  error={Boolean(errors.unit)}
                  onChange={(val) => updateField('unit', val)}
                  ariaLabel="Purchase unit"
                />
                {errors.unit ? (
                  <p id={unitErrorId} className="rm-form__error" role="alert">
                    {errors.unit}
                  </p>
                ) : null}
              </div>

              <div className="rm-form__field">
                <label
                  htmlFor={FIELD_DOM_IDS.category}
                  className="rm-form__label"
                >
                  Category <span className="rm-form__opt">(Optional)</span>
                </label>
                <Dropdown
                  id={FIELD_DOM_IDS.category}
                  name="category"
                  variant="form"
                  value={values.category}
                  options={categoryOptions}
                  placeholder="None (Optional)"
                  disabled={isFormDisabled}
                  error={Boolean(errors.category)}
                  onChange={(val) => updateField('category', val)}
                  ariaLabel="Material category"
                />
                {errors.category ? (
                  <p
                    id={categoryErrorId}
                    className="rm-form__error"
                    role="alert"
                  >
                    {errors.category}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rm-form__field">
              <div className="rm-form__label-row">
                <label
                  htmlFor={FIELD_DOM_IDS.description}
                  className="rm-form__label"
                >
                  Description <span className="rm-form__opt">(Optional)</span>
                </label>
                <span className="rm-form__counter">
                  {String(values.description || '').length}/
                  {MAX_MATERIAL_DESCRIPTION_LENGTH}
                </span>
              </div>
              <textarea
                id={FIELD_DOM_IDS.description}
                name="description"
                rows={3}
                className={`rm-form__textarea${
                  errors.description ? ' rm-form__input--error' : ''
                }`}
                placeholder="Specifications, weave, thickness, grade, or width notes..."
                value={values.description}
                onChange={(event) =>
                  updateField('description', event.target.value)
                }
                onBlur={handleInputBlur}
                maxLength={MAX_MATERIAL_DESCRIPTION_LENGTH}
                disabled={isFormDisabled}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description ? descriptionErrorId : undefined
                }
              />
              {errors.description ? (
                <p
                  id={descriptionErrorId}
                  className="rm-form__error"
                  role="alert"
                >
                  {errors.description}
                </p>
              ) : null}
            </div>

            {isEditMode ? (
              <div className="rm-form__status-summary">
                <span className="rm-form__status-label">Current Status</span>
                <div className="rm-form__status-row">
                  <RawMaterialStatusBadge isActive={values.isActive} />
                  <span className="rm-form__status-note">
                    Use Activate or Deactivate in the actions menu to change
                    availability.
                  </span>
                </div>
              </div>
            ) : (
              <div className="rm-form__field">
                <label htmlFor="rm-form-status" className="rm-form__label">
                  Active Status
                </label>
                <Dropdown
                  id="rm-form-status"
                  name="isActive"
                  variant="form"
                  value={values.isActive ? 'active' : 'inactive'}
                  options={CREATE_STATUS_OPTIONS}
                  disabled={isFormDisabled}
                  onChange={(val) => updateField('isActive', val === 'active')}
                  ariaLabel="Initial active status"
                />
              </div>
            )}
          </div>

          <div className="admin-modal__footer rm-form__footer">
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
              disabled={isFormDisabled}
            >
              {isSubmitting
                ? isEditMode
                  ? 'Saving Changes...'
                  : 'Adding Material...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Add Material'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
