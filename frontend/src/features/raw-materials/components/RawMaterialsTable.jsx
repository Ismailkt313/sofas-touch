import {
  formatMaterialDate,
  formatMaterialUnit,
} from '../services/rawMaterialService'
import { RawMaterialRowActionsMenu } from './RawMaterialRowActionsMenu'
import {
  RawMaterialCategoryTag,
  RawMaterialStatusBadge,
} from './RawMaterialStatusBadge'

export function RawMaterialsTable({
  materials,
  adminAccess,
  onViewDetails,
  onEdit,
  onToggleStatus,
}) {
  return (
    <div className="rm-table-wrap">
      <table className="rm-table">
        <thead>
          <tr>
            <th scope="col">Material Name</th>
            <th scope="col">Category</th>
            <th scope="col">Unit</th>
            <th scope="col">Description</th>
            <th scope="col">Status</th>
            <th scope="col">Last Updated</th>
            <th scope="col" className="rm-table__actions-col">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {materials.map((material) => {
            const formattedUnit = formatMaterialUnit(material.unit)

            return (
              <tr
                key={material.id}
                className={material.isActive ? '' : 'rm-table__row--inactive'}
              >
                <td className="rm-table__name-cell">
                  <button
                    type="button"
                    className="rm-name-btn"
                    onClick={() => onViewDetails(material)}
                  >
                    {material.name}
                  </button>
                </td>
                <td>
                  <RawMaterialCategoryTag category={material.category} />
                </td>
                <td>
                  <span
                    className="rm-unit-pill"
                    title={material.unit || undefined}
                  >
                    {formattedUnit || '—'}
                  </span>
                </td>
                <td className="rm-table__desc-cell">
                  {material.description ? (
                    <span
                      className="rm-desc-truncate"
                      title={material.description}
                    >
                      {material.description}
                    </span>
                  ) : (
                    <span className="rm-desc-empty">—</span>
                  )}
                </td>
                <td>
                  <RawMaterialStatusBadge isActive={material.isActive} />
                </td>
                <td className="rm-table__date-cell">
                  {formatMaterialDate(material.updatedAt)}
                </td>
                <td className="rm-table__actions-cell">
                  <RawMaterialRowActionsMenu
                    material={material}
                    adminAccess={adminAccess}
                    onViewDetails={onViewDetails}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
