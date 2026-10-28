import {
  formatMaterialDate,
  formatMaterialUnit,
} from '../services/rawMaterialService'
import { RawMaterialRowActionsMenu } from './RawMaterialRowActionsMenu'
import {
  RawMaterialCategoryTag,
  RawMaterialStatusBadge,
} from './RawMaterialStatusBadge'

export function RawMaterialsMobileList({
  materials,
  adminAccess,
  onViewDetails,
  onEdit,
  onToggleStatus,
}) {
  return (
    <div
      className="rm-mobile-list"
      role="list"
      aria-label="Raw materials list"
    >
      {materials.map((material) => {
        const formattedUnit = formatMaterialUnit(material.unit)

        return (
          <article
            key={material.id}
            className={`rm-mobile-card${
              material.isActive ? '' : ' rm-mobile-card--inactive'
            }`}
            role="listitem"
          >
            <div className="rm-mobile-card__header">
              <button
                type="button"
                className="rm-mobile-card__title-btn"
                onClick={() => onViewDetails(material)}
              >
                {material.name}
              </button>

              <RawMaterialRowActionsMenu
                material={material}
                adminAccess={adminAccess}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
                compact
              />
            </div>

            <div className="rm-mobile-card__badges">
              <RawMaterialCategoryTag category={material.category} />
              <span
                className="rm-unit-pill"
                title={material.unit || undefined}
              >
                {formattedUnit || '—'}
              </span>
              <RawMaterialStatusBadge isActive={material.isActive} />
            </div>

            {material.description ? (
              <p className="rm-mobile-card__desc">{material.description}</p>
            ) : null}

            <div className="rm-mobile-card__footer">
              <span className="rm-mobile-card__updated">
                Updated {formatMaterialDate(material.updatedAt)}
              </span>

              <button
                type="button"
                className="rm-mobile-card__view-link"
                onClick={() => onViewDetails(material)}
              >
                <span>View Details</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M6 3.75L10.25 8L6 12.25"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
