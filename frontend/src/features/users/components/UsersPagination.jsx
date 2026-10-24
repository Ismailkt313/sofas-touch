export function UsersPagination({
  activePage,
  totalPages,
  totalFiltered,
  rangeStart,
  rangeEnd,
  onPageChange,
}) {
  if (totalFiltered === 0) {
    return null
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <div
      className="users-pagination"
      role="navigation"
      aria-label="User list pagination"
    >
      <p className="users-pagination__summary">
        Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of{' '}
        <strong>{totalFiltered}</strong>{' '}
        {totalFiltered === 1 ? 'user' : 'users'}
      </p>

      <div className="users-pagination__controls">
        <button
          type="button"
          className="users-pagination__btn"
          onClick={() => onPageChange(activePage - 1)}
          disabled={activePage <= 1}
          aria-label="Previous page"
        >
          Previous
        </button>

        <div className="users-pagination__pages">
          {pageNumbers.map((page) => {
            const isCurrent = page === activePage
            return (
              <button
                key={page}
                type="button"
                className={`users-pagination__page${
                  isCurrent ? ' users-pagination__page--active' : ''
                }`}
                onClick={() => onPageChange(page)}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Page ${page}`}
              >
                {page}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="users-pagination__btn"
          onClick={() => onPageChange(activePage + 1)}
          disabled={activePage >= totalPages}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  )
}
