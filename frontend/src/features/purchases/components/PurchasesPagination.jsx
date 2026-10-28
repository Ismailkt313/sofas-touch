export function PurchasesPagination({
  activePage,
  totalPages,
  totalMatching,
  rangeStart,
  rangeEnd,
  onPageChange,
}) {
  if (totalMatching <= 0) {
    return null
  }

  return (
    <div className="pv-pagination">
      <span className="pv-pagination__summary">
        Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of{' '}
        <strong>{totalMatching}</strong>
      </span>

      {totalPages > 1 ? (
        <div className="pv-pagination__controls">
          <button
            type="button"
            className="admin-btn admin-btn--secondary pv-pagination__btn"
            disabled={activePage <= 1}
            onClick={() => onPageChange(activePage - 1)}
          >
            Previous
          </button>
          <span className="pv-pagination__page-indicator">
            Page {activePage} of {totalPages}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn--secondary pv-pagination__btn"
            disabled={activePage >= totalPages}
            onClick={() => onPageChange(activePage + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
