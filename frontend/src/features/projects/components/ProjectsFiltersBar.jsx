import {
  PROJECT_CATEGORY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '../services/projectService'

export function ProjectsFiltersBar({
  searchQuery,
  statusFilter,
  categoryFilter,
  hasActiveFilters,
  totalMatching,
  onSearchChange,
  onStatusFilterChange,
  onCategoryFilterChange,
  onResetFilters,
}) {
  return (
    <div className="projects-toolbar" role="search" aria-label="Filter projects">
      <div className="projects-search">
        <label htmlFor="projects-search-input" className="sr-only">
          Search projects by project ID, project name, or client name
        </label>
        <span className="projects-search__icon" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="none">
            <circle
              cx="9"
              cy="9"
              r="5.75"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M13.25 13.25L17 17"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <input
          id="projects-search-input"
          type="search"
          className="projects-search__input"
          placeholder="Search by project ID (e.g. PRJ-0001), name, or client..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          autoComplete="off"
        />
        {searchQuery ? (
          <button
            type="button"
            className="projects-search__clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear search query"
            title="Clear search"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M6 6L14 14M14 6L6 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="projects-filters">
        <div className="projects-filter-group">
          <label
            htmlFor="projects-status-filter"
            className="projects-filter-label"
          >
            Status
          </label>
          <select
            id="projects-status-filter"
            className="projects-select"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
          >
            <option value="all">All Statuses</option>
            {PROJECT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="projects-filter-group">
          <label
            htmlFor="projects-category-filter"
            className="projects-filter-label"
          >
            Category
          </label>
          <select
            id="projects-category-filter"
            className="projects-select"
            value={categoryFilter}
            onChange={(event) => onCategoryFilterChange(event.target.value)}
          >
            <option value="all">All Categories</option>
            {PROJECT_CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="projects-reset-btn"
          onClick={onResetFilters}
          disabled={!hasActiveFilters}
        >
          Reset filters
        </button>

        <span className="projects-count-tag" aria-live="polite">
          {totalMatching} {totalMatching === 1 ? 'project' : 'projects'}
        </span>
      </div>
    </div>
  )
}
