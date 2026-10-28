export function RawMaterialStatusBadge({ isActive }) {
  return (
    <span
      className={`rm-status-badge ${
        isActive ? 'rm-status-badge--active' : 'rm-status-badge--inactive'
      }`}
    >
      <span className="rm-status-badge__dot" aria-hidden="true" />
      <span>{isActive ? 'Active' : 'Inactive'}</span>
    </span>
  )
}

export function RawMaterialCategoryTag({ category }) {
  if (!category) {
    return (
      <span className="rm-category-tag rm-category-tag--empty">
        Uncategorized
      </span>
    )
  }

  return <span className="rm-category-tag">{category}</span>
}
