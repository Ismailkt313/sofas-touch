const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
]

export function ApprovalFiltersBar({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  counts,
  hasActiveFilters,
  onResetFilters,
}) {
  const getTabCount = (tabId) => {
    if (tabId === 'pending') return counts?.pending ?? 0
    if (tabId === 'approved') return counts?.approved ?? 0
    if (tabId === 'rejected') return counts?.rejected ?? 0
    return counts?.total ?? 0
  }

  return (
    <div className="approvals-toolbar">
      <div
        className="approvals-tabs"
        role="tablist"
        aria-label="Filter signup requests by approval status"
      >
        {STATUS_TABS.map((tab) => {
          const isSelected = statusFilter === tab.id
          const tabCount = getTabCount(tab.id)

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`approvals-tabs__btn${
                isSelected ? ' approvals-tabs__btn--active' : ''
              }`}
              onClick={() => onStatusFilterChange(tab.id)}
            >
              <span>{tab.label}</span>
              <span className="approvals-tabs__count">{tabCount}</span>
            </button>
          )
        })}
      </div>

      <div className="approvals-search-row">
        <div className="approvals-search">
          <label htmlFor="approvals-search-input" className="sr-only">
            Search signup requests by applicant name or email
          </label>
          <svg
            className="approvals-search__icon"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
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
          <input
            id="approvals-search-input"
            type="search"
            className="approvals-search__input"
            placeholder="Search by applicant name or email..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            autoComplete="off"
          />
          {searchQuery ? (
            <button
              type="button"
              className="approvals-search__clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search query"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : null}
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            className="admin-btn admin-btn--secondary approvals-toolbar__reset"
            onClick={onResetFilters}
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  )
}
