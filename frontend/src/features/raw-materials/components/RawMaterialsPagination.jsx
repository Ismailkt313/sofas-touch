function buildVisiblePages(activePage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = [1]
  const start = Math.max(2, activePage - 1)
  const end = Math.min(totalPages - 1, activePage + 1)

  if (start > 2) {
    pages.push('ellipsis-start')
  }
  for (let p = start; p <= end; p += 1) {
    pages.push(p)
  }
  if (end < totalPages - 1) {
    pages.push('ellipsis-end')
  }
  pages.push(totalPages)
  return pages
}

export function RawMaterialsPagination({
  activePage,
  totalPages,
  totalMatching,
  rangeStart,
  rangeEnd,
  onPageChange,
}) {
  if (totalMatching === 0) {
    return null
  }

  const pageTokens = buildVisiblePages(activePage, totalPages)

  return (
    <div
      className="rm-pagination"
      role="navigation"
      aria-label="Raw materials pagination"
    >
      <p className="rm-pagination__summary">
        Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of{' '}
        <strong>{totalMatching}</strong>{' '}
        {totalMatching === 1 ? 'material' : 'materials'}
      </p>

      <div className="rm-pagination__controls">
        <button
          type="button"
          className="rm-pagination__btn"
          onClick={() => onPageChange(activePage - 1)}
          disabled={activePage <= 1}
          aria-label="Previous page"
        >
          Previous
        </button>

        <div className="rm-pagination__pages">
          {pageTokens.map((token) => {
            if (typeof token === 'string') {
              return (
                <span
                  key={token}
                  className="rm-pagination__ellipsis"
                  aria-hidden="true"
                >
                  &hellip;
                </span>
              )
            }

            const isCurrent = token === activePage
            return (
              <button
                key={token}
                type="button"
                className={`rm-pagination__page${
                  isCurrent ? ' rm-pagination__page--active' : ''
                }`}
                onClick={() => onPageChange(token)}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Page ${token}`}
              >
                {token}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="rm-pagination__btn"
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
