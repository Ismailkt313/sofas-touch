export function ExpensesPagination({
  page,
  totalPages,
  totalItems,
  limit,
  onPageChange,
}) {
  if (totalItems <= 0) {
    return null
  }

  const startItem = (page - 1) * limit + 1
  const endItem = Math.min(totalItems, page * limit)

  return (
    <div className="exp-pagination">
      <span>
        Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of{' '}
        <strong>{totalItems}</strong> expenses
      </span>

      <div className="exp-pagination__controls">
        <button
          type="button"
          className="exp-btn exp-btn--secondary exp-btn--sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span style={{ padding: '0 0.35rem', fontWeight: 600 }}>
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="exp-btn exp-btn--secondary exp-btn--sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
