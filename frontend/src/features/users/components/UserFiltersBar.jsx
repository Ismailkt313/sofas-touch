export function UserFiltersBar({
  searchQuery,
  roleFilter,
  statusFilter,
  hasActiveFilters,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onResetFilters,
}) {
  return (
    <div className="users-toolbar" role="search" aria-label="Filter users">
      <div className="users-search">
        <label htmlFor="users-search-input" className="sr-only">
          Search users by name, email, or phone
        </label>
        <span className="users-search__icon" aria-hidden="true">
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
          id="users-search-input"
          type="search"
          className="users-search__input"
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          autoComplete="off"
        />
        {searchQuery ? (
          <button
            type="button"
            className="users-search__clear"
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

      <div className="users-filters">
        <div className="users-filter-group">
          <label htmlFor="users-role-filter" className="users-filter-label">
            Role
          </label>
          <select
            id="users-role-filter"
            className="users-select"
            value={roleFilter}
            onChange={(event) => onRoleFilterChange(event.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="data_entry">Data Entry</option>
          </select>
        </div>

        <div className="users-filter-group">
          <label htmlFor="users-status-filter" className="users-filter-label">
            Status
          </label>
          <select
            id="users-status-filter"
            className="users-select"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <button
          type="button"
          className="users-reset-btn"
          onClick={onResetFilters}
          disabled={!hasActiveFilters}
        >
          Reset filters
        </button>
      </div>
    </div>
  )
}
