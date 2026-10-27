import { useMemo, useState } from 'react'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'

const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All Requests' },
]

function getStatusTabLabel(id) {
  if (id === 'approved') return 'Approved'
  if (id === 'rejected') return 'Rejected'
  if (id === 'all') return 'All Requests'
  return 'Pending'
}

export function ApprovalFiltersBar({
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  counts,
  filteredCount = 0,
  hasActiveFilters,
  onResetFilters,
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [draftStatus, setDraftStatus] = useState(statusFilter)

  const getTabCount = (tabId) => {
    if (tabId === 'pending') return counts?.pending ?? 0
    if (tabId === 'approved') return counts?.approved ?? 0
    if (tabId === 'rejected') return counts?.rejected ?? 0
    return counts?.total ?? 0
  }

  const activeFilterCount = statusFilter !== 'pending' ? 1 : 0
  const draftActiveCount = draftStatus !== 'pending' ? 1 : 0

  const activeChips = useMemo(() => {
    if (statusFilter === 'pending') {
      return []
    }
    return [
      {
        key: 'status',
        label: 'View',
        value: getStatusTabLabel(statusFilter),
        onRemove: () => onStatusFilterChange('pending'),
      },
    ]
  }, [statusFilter, onStatusFilterChange])

  const openFilterSheet = () => {
    setDraftStatus(statusFilter)
    setIsSheetOpen(true)
  }

  const handleApplySheet = () => {
    onStatusFilterChange(draftStatus)
    setIsSheetOpen(false)
  }

  const handleResetSheet = () => {
    setDraftStatus('pending')
    onStatusFilterChange('pending')
  }

  return (
    <>
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
                <span>{tab.id === 'all' ? 'All' : tab.label}</span>
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
              placeholder="Search applicant name or email..."
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

          <MobileFilterButton
            activeCount={activeFilterCount}
            onClick={openFilterSheet}
            ariaLabel={
              activeFilterCount > 0
                ? `Filter signup requests (${getStatusTabLabel(statusFilter)})`
                : 'Filter signup requests'
            }
          />

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

      <ActiveFilterChips chips={activeChips} />

      <div
        className="sts-listing-meta-bar approvals-mobile-meta-bar"
        aria-live="polite"
      >
        <span className="sts-listing-meta-bar__title">
          {getStatusTabLabel(statusFilter)}
        </span>
        <span className="sts-listing-meta-bar__count">
          {filteredCount} {filteredCount === 1 ? 'request' : 'requests'}
        </span>
      </div>

      <MobileFilterSheet
        isOpen={isSheetOpen}
        title="Filter Signup Requests"
        activeCount={draftActiveCount}
        canReset={draftActiveCount > 0 || activeFilterCount > 0}
        onClose={() => setIsSheetOpen(false)}
        onReset={handleResetSheet}
        onApply={handleApplySheet}
      >
        <div className="sts-sheet-field">
          <span className="sts-sheet-field__label">Approval Status</span>
          <div
            className="sts-sheet-options"
            role="radiogroup"
            aria-label="Approval Status"
          >
            {STATUS_TABS.map((tab) => {
              const isSelected = draftStatus === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`sts-sheet-option${
                    isSelected ? ' sts-sheet-option--selected' : ''
                  }`}
                  onClick={() => setDraftStatus(tab.id)}
                >
                  <span>{tab.label}</span>
                  <span className="sts-sheet-option__count">
                    {getTabCount(tab.id)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </MobileFilterSheet>
    </>
  )
}
