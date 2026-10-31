import React, { useId } from 'react'
import {
  buildVisiblePages,
  getPluralName,
  calculatePreservedPage,
} from './paginationUtils'
import './pagination.css'

export { buildVisiblePages, calculatePreservedPage, getPluralName }

/**
 * Shared, responsive Pagination component across Soft Touch Sofas.
 *
 * @param {object} props
 * @param {number} props.page - Active page (1-based)
 * @param {number} props.totalPages - Total available pages
 * @param {number} props.totalItems - Total records matching filter
 * @param {number} [props.pageSize=10] - Records per page
 * @param {number[]} [props.pageSizeOptions=[10, 20, 50]] - Available page sizes
 * @param {function} props.onPageChange - Handler for changing page
 * @param {function} [props.onPageSizeChange] - Handler for changing page size
 * @param {string} [props.itemName='record'] - Entity singular noun (e.g. 'project', 'user')
 * @param {string} [props.itemsName] - Optional custom plural noun
 * @param {boolean} [props.disabled=false] - Disable interaction while loading
 * @param {boolean} [props.showPageSize=true] - Whether to render rows-per-page selector
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {string} [props.ariaLabel='Pagination navigation'] - Accessibility label
 */
export function Pagination({
  page = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
  itemName = 'record',
  itemsName,
  disabled = false,
  showPageSize = true,
  className = '',
  ariaLabel = 'Pagination navigation',
}) {
  const selectId = useId()
  const safeTotalItems = Number.isFinite(totalItems) ? Math.max(0, totalItems) : 0
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 10
  const safeTotalPages = Math.max(
    1,
    totalPages || Math.ceil(safeTotalItems / safePageSize) || 1,
  )
  const safePage = Math.min(Math.max(1, page || 1), safeTotalPages)

  if (safeTotalItems <= 0) {
    return null
  }

  const startItem = (safePage - 1) * safePageSize + 1
  const endItem = Math.min(safeTotalItems, safePage * safePageSize)
  const entityLabel =
    safeTotalItems === 1 ? itemName : getPluralName(itemName, itemsName)
  const pageTokens = buildVisiblePages(safePage, safeTotalPages)

  return (
    <nav
      className={`sts-pagination ${className}`.trim()}
      role="navigation"
      aria-label={ariaLabel}
    >
      <div className="sts-pagination__meta">
        <p className="sts-pagination__summary">
          Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of{' '}
          <strong>{safeTotalItems}</strong> {entityLabel}
        </p>

        {showPageSize && onPageSizeChange && (
          <div className="sts-pagination__size-selector">
            <label htmlFor={selectId} className="sts-pagination__size-label">
              Rows per page
            </label>
            <select
              id={selectId}
              className="sts-pagination__size-select"
              value={safePageSize}
              onChange={(e) => {
                const nextSize = Number(e.target.value)
                if (nextSize && onPageSizeChange) {
                  onPageSizeChange(nextSize)
                }
              }}
              disabled={disabled}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="sts-pagination__controls">
        {/* First page */}
        <button
          type="button"
          className="sts-pagination__btn sts-pagination__btn--edge sts-pagination__btn--first"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          title="First page"
        >
          <span aria-hidden="true">&laquo;</span>
          <span className="sts-pagination__btn-text">First</span>
        </button>

        {/* Previous page */}
        <button
          type="button"
          className="sts-pagination__btn sts-pagination__btn--nav sts-pagination__btn--prev"
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Previous page"
          title="Previous page"
        >
          <span aria-hidden="true">&lsaquo;</span>
          <span className="sts-pagination__btn-text">Previous</span>
        </button>

        {/* Mobile Indicator (Visible on mobile <= 640px) */}
        <div className="sts-pagination__mobile-indicator" aria-live="polite">
          Page <strong>{safePage}</strong> of <strong>{safeTotalPages}</strong>
        </div>

        {/* Desktop & Tablet Page Numbers (Hidden on mobile <= 640px) */}
        <div
          className="sts-pagination__pages"
          role="group"
          aria-label="Page numbers"
        >
          {pageTokens.map((token, index) => {
            if (typeof token === 'string') {
              return (
                <span
                  key={`${token}-${index}`}
                  className="sts-pagination__ellipsis"
                  aria-hidden="true"
                >
                  &hellip;
                </span>
              )
            }
            const isCurrent = token === safePage
            return (
              <button
                key={token}
                type="button"
                className={`sts-pagination__page${
                  isCurrent ? ' sts-pagination__page--active' : ''
                }`}
                disabled={disabled}
                onClick={() => onPageChange(token)}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Page ${token}`}
              >
                {token}
              </button>
            )
          })}
        </div>

        {/* Next page */}
        <button
          type="button"
          className="sts-pagination__btn sts-pagination__btn--nav sts-pagination__btn--next"
          disabled={disabled || safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Next page"
          title="Next page"
        >
          <span className="sts-pagination__btn-text">Next</span>
          <span aria-hidden="true">&rsaquo;</span>
        </button>

        {/* Last page */}
        <button
          type="button"
          className="sts-pagination__btn sts-pagination__btn--edge sts-pagination__btn--last"
          disabled={disabled || safePage >= safeTotalPages}
          onClick={() => onPageChange(safeTotalPages)}
          aria-label="Last page"
          title="Last page"
        >
          <span className="sts-pagination__btn-text">Last</span>
          <span aria-hidden="true">&raquo;</span>
        </button>
      </div>
    </nav>
  )
}

export default Pagination
