import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Dropdown } from '../../../components/common'
import {
  MAX_MATERIAL_DESCRIPTION_LENGTH,
  MAX_MATERIAL_NAME_LENGTH,
  RAW_MATERIAL_CATEGORIES,
  buildUnitOptions,
  formatMaterialUnit,
} from '../../raw-materials/services/rawMaterialService'
import { validateStagedNewMaterialDraft } from '../utils/purchaseMaterialCreation'

const CATEGORY_OPTIONS = [
  { value: '', label: 'None (Optional)' },
  ...RAW_MATERIAL_CATEGORIES.map((category) => ({
    value: category,
    label: category,
  })),
]

export function NewMaterialConfirmModal({
  modalState,
  existingMaterials = [],
  stagedNewMaterials = [],
  onClose,
  onConfirm,
  onSelectExistingOrStaged,
}) {
  const isEditMode = modalState?.mode === 'edit'
  const [values, setValues] = useState(() => ({
    name: modalState?.initialDraft?.name || '',
    unit: modalState?.initialDraft?.unit || '',
    category: modalState?.initialDraft?.category || '',
    description: modalState?.initialDraft?.description || '',
  }))
  const [submittedOnce, setSubmittedOnce] = useState(false)

  const backdropMouseDownRef = useRef(false)
  const nameInputRef = useRef(null)

  const titleId = useId()
  const subtitleId = useId()
  const nameInputId = useId()
  const unitInputId = useId()
  const categoryInputId = useId()
  const descInputId = useId()

  const unitOptions = useMemo(
    () => buildUnitOptions(values.unit),
    [values.unit],
  )

  const validation = useMemo(
    () =>
      validateStagedNewMaterialDraft(values, {
        existingMaterials,
        stagedNewMaterials,
        editingTempId: modalState?.editingTempId || '',
      }),
    [values, existingMaterials, stagedNewMaterials, modalState?.editingTempId],
  )

  useEffect(() => {
    if (!modalState || typeof document === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusRaf = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
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
      window.cancelAnimationFrame(focusRaf)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [modalState, onClose])

  if (!modalState) {
    return null
  }

  const updateField = (fieldKey, nextValue) => {
    setValues((prev) => ({
      ...prev,
      [fieldKey]: nextValue,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmittedOnce(true)

    if (!validation.isValid || !validation.value) {
      if (validation.errors.name) {
        nameInputRef.current?.focus()
      }
      return
    }

    onConfirm?.(validation.value, modalState)
  }

  const conflict = validation.conflict
  const showFieldError = (key) =>
    submittedOnce || Boolean(conflict) ? validation.errors[key] : ''

  const billName = String(modalState.sourceBillDescription || '').trim()
  const billUnit = String(modalState.sourceBillUnit || '').trim()

  return (
    <div
      className="admin-modal-backdrop pv-new-mat-backdrop"
      onMouseDown={(event) => {
        backdropMouseDownRef.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (
          backdropMouseDownRef.current &&
          event.target === event.currentTarget
        ) {
          onClose?.()
        }
        backdropMouseDownRef.current = false
      }}
    >
      <div
        className="admin-modal pv-new-mat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
      >
        <div className="admin-modal__header pv-new-mat-modal__header">
          <div className="pv-new-mat-modal__heading">
            <h2 id={titleId} className="admin-modal__title">
              {isEditMode
                ? 'Edit New Material Details'
                : 'Confirm New Raw Material'}
            </h2>
            <p id={subtitleId} className="admin-modal__subtitle">
              Review the material name and unit. It will be added to Raw
              Materials and stocked from this purchase when you save the
              voucher.
            </p>
          </div>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Close new material dialog"
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

        <form onSubmit={handleSubmit} className="pv-new-mat-form" noValidate>
          <div className="admin-modal__body pv-new-mat-modal__body">
            {billName || billUnit ? (
              <div className="pv-new-mat-source">
                {billName ? (
                  <span>
                    Bill item: <strong>&ldquo;{billName}&rdquo;</strong>
                  </span>
                ) : null}
                {billUnit ? (
                  <span>
                    Detected unit:{' '}
                    <strong>{formatMaterialUnit(billUnit) || billUnit}</strong>
                  </span>
                ) : (
                  <span>Unit not detected on bill — select unit below</span>
                )}
              </div>
            ) : null}

            {conflict ? (
              <div
                className={`pv-new-mat-conflict${
                  conflict.type === 'unit_conflict' ||
                  conflict.type === 'staged_unit_conflict' ||
                  conflict.type === 'inactive_existing'
                    ? ' pv-new-mat-conflict--warn'
                    : ''
                }`}
                role="alert"
              >
                <p className="pv-new-mat-conflict__msg">{conflict.message}</p>
                {(conflict.type === 'existing_compatible' ||
                  conflict.type === 'unit_conflict') &&
                conflict.material?.id ? (
                  <button
                    type="button"
                    className="pv-mini-btn pv-new-mat-conflict__btn"
                    onClick={() =>
                      onSelectExistingOrStaged?.(
                        conflict.material.id,
                        modalState,
                      )
                    }
                  >
                    Select Existing &ldquo;{conflict.material.name}&rdquo; (
                    {formatMaterialUnit(conflict.material.unit) ||
                      conflict.material.unit}
                    )
                  </button>
                ) : null}
                {(conflict.type === 'staged_compatible' ||
                  conflict.type === 'staged_unit_conflict') &&
                conflict.material?.tempId ? (
                  <button
                    type="button"
                    className="pv-mini-btn pv-new-mat-conflict__btn"
                    onClick={() =>
                      onSelectExistingOrStaged?.(
                        conflict.material.tempId,
                        modalState,
                      )
                    }
                  >
                    Use Staged &ldquo;{conflict.material.name}&rdquo; (
                    {formatMaterialUnit(conflict.material.unit) ||
                      conflict.material.unit}
                    )
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="pv-new-mat-grid">
              <div className="pv-form-field pv-new-mat-field--full">
                <label htmlFor={nameInputId} className="pv-form-label">
                  Material name <span className="pv-req">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  id={nameInputId}
                  type="text"
                  className={`pv-input${
                    showFieldError('name') ? ' pv-input--error' : ''
                  }`}
                  placeholder="e.g., Curtain, Linen Blackout Fabric"
                  value={values.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  maxLength={MAX_MATERIAL_NAME_LENGTH}
                  autoComplete="off"
                />
                {showFieldError('name') ? (
                  <p className="pv-field-error">{showFieldError('name')}</p>
                ) : null}
              </div>

              <div className="pv-form-field">
                <label htmlFor={unitInputId} className="pv-form-label">
                  Purchase unit <span className="pv-req">*</span>
                </label>
                <Dropdown
                  id={unitInputId}
                  variant="form"
                  value={values.unit}
                  options={unitOptions}
                  placeholder="Select unit..."
                  error={Boolean(showFieldError('unit'))}
                  onChange={(val) => updateField('unit', val)}
                  ariaLabel="New material purchase unit"
                />
                {showFieldError('unit') ? (
                  <p className="pv-field-error">{showFieldError('unit')}</p>
                ) : null}
              </div>

              <div className="pv-form-field">
                <label htmlFor={categoryInputId} className="pv-form-label">
                  Category <span className="pv-opt">(Optional)</span>
                </label>
                <Dropdown
                  id={categoryInputId}
                  variant="form"
                  value={values.category}
                  options={CATEGORY_OPTIONS}
                  placeholder="None (Optional)"
                  error={Boolean(showFieldError('category'))}
                  onChange={(val) => updateField('category', val)}
                  ariaLabel="New material category"
                />
                {showFieldError('category') ? (
                  <p className="pv-field-error">{showFieldError('category')}</p>
                ) : null}
              </div>

              <div className="pv-form-field pv-new-mat-field--full">
                <label htmlFor={descInputId} className="pv-form-label">
                  Description <span className="pv-opt">(Optional)</span>
                </label>
                <textarea
                  id={descInputId}
                  rows={2}
                  className="pv-textarea pv-textarea--compact"
                  placeholder="Optional weave, thickness, width, or grade notes"
                  value={values.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  maxLength={MAX_MATERIAL_DESCRIPTION_LENGTH}
                />
              </div>
            </div>

            <p className="pv-new-mat-stock-note">
              Initial stock on hand will match the purchased quantity recorded
              on this voucher (counted once).
            </p>
          </div>

          <div className="admin-modal__footer pv-new-mat-modal__footer">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="admin-btn admin-btn--primary">
              {isEditMode ? 'Update Material' : 'Confirm & Select Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
