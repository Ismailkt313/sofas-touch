import { useEffect, useId, useRef } from 'react'
import {
  formatMaterialDateTime,
  formatMaterialQuantityOnHand,
  formatMaterialUnit,
  formatMaterialUnitOptionLabel,
} from '../services/rawMaterialService'
import {
  RawMaterialCategoryTag,
  RawMaterialStatusBadge,
} from './RawMaterialStatusBadge'

export function RawMaterialDetailsModal({
  isOpen,
  material,
  isLoading = false,
  error = '',
  adminAccess = false,
  onClose,
  onRetry,
  onEdit,
  onToggleStatus,
}) {
  const closeBtnRef = useRef(null)
  const backdropMouseDownRef = useRef(false)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus()
    })

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.cancelAnimationFrame(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="admin-modal-backdrop rm-modal-backdrop"
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
        className="admin-modal rm-modal rm-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="admin-modal__header rm-modal__header">
          <div className="rm-modal__heading">
            <h2 id={titleId} className="admin-modal__title">
              Material Details
            </h2>
            <p className="admin-modal__subtitle">
              Saved specifications, stock on hand, and purchase unit details.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="admin-modal__close rm-modal__close"
            onClick={onClose}
            aria-label="Close material details"
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

        <div className="admin-modal__body rm-modal__body rm-details-modal__body">
          {error ? (
            <div className="rm-details-state" role="alert">
              <p className="rm-details-state__msg">{error}</p>
              {typeof onRetry === 'function' ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--secondary"
                  onClick={onRetry}
                >
                  Retry
                </button>
              ) : null}
            </div>
          ) : !material && isLoading ? (
            <div className="rm-details-loading" role="status" aria-busy="true">
              <div className="rm-skeleton-line rm-skeleton-line--title" />
              <div className="rm-skeleton-line rm-skeleton-line--sub" />
              <div className="rm-skeleton-line rm-skeleton-line--sub" />
            </div>
          ) : material ? (
            <>
              <div className="rm-details-hero">
                <h3 className="rm-details-hero__name">{material.name}</h3>
                <div className="rm-details-hero__badges">
                  <RawMaterialStatusBadge isActive={material.isActive} />
                  <RawMaterialCategoryTag category={material.category} />
                  <span
                    className="rm-unit-pill"
                    title={material.unit || undefined}
                  >
                    {formatMaterialUnit(material.unit) || '—'}
                  </span>
                  <span className="rm-qty-badge">
                    {formatMaterialQuantityOnHand(
                      material.quantityOnHand,
                      material.unit,
                    )}
                  </span>
                </div>
              </div>

              <dl className="profile-details rm-details-list">
                <div className="profile-details__row">
                  <dt>Quantity on Hand</dt>
                  <dd>
                    <strong>
                      {formatMaterialQuantityOnHand(
                        material.quantityOnHand,
                        material.unit,
                      )}
                    </strong>
                  </dd>
                </div>
                <div className="profile-details__row">
                  <dt>Minimum Stock Level</dt>
                  <dd>
                    {typeof material.minStockLevel === 'number' &&
                    Number.isFinite(material.minStockLevel)
                      ? formatMaterialQuantityOnHand(
                          material.minStockLevel,
                          material.unit,
                        )
                      : 'Not configured'}
                  </dd>
                </div>
                <div className="profile-details__row">
                  <dt>Unit</dt>
                  <dd>{formatMaterialUnitOptionLabel(material.unit) || '—'}</dd>
                </div>
                <div className="profile-details__row">
                  <dt>Category</dt>
                  <dd>{material.category || 'Uncategorized'}</dd>
                </div>
                <div className="profile-details__row">
                  <dt>Status</dt>
                  <dd>{material.isActive ? 'Active' : 'Inactive'}</dd>
                </div>
                <div className="profile-details__row">
                  <dt>Last Updated</dt>
                  <dd>{formatMaterialDateTime(material.updatedAt)}</dd>
                </div>
                <div className="profile-details__row">
                  <dt>Created</dt>
                  <dd>{formatMaterialDateTime(material.createdAt)}</dd>
                </div>
              </dl>

              <div className="rm-details-description">
                <span className="rm-details-description__label">
                  Description
                </span>
                <p className="rm-details-description__body">
                  {material.description || 'No description provided.'}
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="admin-modal__footer rm-modal__footer rm-details-modal__footer">
          {adminAccess && material && !error ? (
            <>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => {
                  const target = material
                  onClose?.()
                  onToggleStatus?.(target, !target.isActive)
                }}
              >
                {material.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => {
                  const target = material
                  onClose?.()
                  onEdit?.(target)
                }}
              >
                Edit Material
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
