import { useMemo, useState } from 'react'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'

const ROLE_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'data_entry', label: 'Data Entry' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

function getRoleDisplayLabel(value) {
  if (value === 'admin') return 'Admin'
  if (value === 'data_entry') return 'Data Entry'
  return 'All Roles'
}

function getStatusDisplayLabel(value) {
  if (value === 'active') return 'Active'
  if (value === 'inactive') return 'Inactive'
  return 'All Statuses'
}

export function UserFiltersBar({
  searchQuery,
  roleFilter,
  statusFilter,
  hasActiveFilters,
  totalFiltered = 0,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onResetFilters,
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [draftRole, setDraftRole] = useState(roleFilter)
  const [draftStatus, setDraftStatus] = useState(statusFilter)

  const activeFilterCount =
    (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)

  const draftActiveCount =
    (draftRole !== 'all' ? 1 : 0) + (draftStatus !== 'all' ? 1 : 0)

  const activeChips = useMemo(() => {
    const chips = []
    if (roleFilter !== 'all') {
      chips.push({
        key: 'role',
        label: 'Role',
        value: getRoleDisplayLabel(roleFilter),
        onRemove: () => onRoleFilterChange('all'),
      })
    }
    if (statusFilter !== 'all') {
      chips.push({
        key: 'status',
        label: 'Status',
        value: getStatusDisplayLabel(statusFilter),
        onRemove: () => onStatusFilterChange('all'),
      })
    }
    return chips
  }, [roleFilter, statusFilter, onRoleFilterChange, onStatusFilterChange])

  const openFilterSheet = () => {
    setDraftRole(roleFilter)
    setDraftStatus(statusFilter)
    setIsSheetOpen(true)
  }

  const handleApplySheet = () => {
    onRoleFilterChange(draftRole)
    onStatusFilterChange(draftStatus)
    setIsSheetOpen(false)
  }

  const handleResetSheet = () => {
    setDraftRole('all')
    setDraftStatus('all')
    onRoleFilterChange('all')
    onStatusFilterChange('all')
  }

  const handleClearChips = () => {
    onRoleFilterChange('all')
    onStatusFilterChange('all')
  }

  return (
    <>
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
            placeholder="Search name, email, or phone..."
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

        <MobileFilterButton
          activeCount={activeFilterCount}
          onClick={openFilterSheet}
          ariaLabel={
            activeFilterCount > 0
              ? `Filter users (${activeFilterCount} active)`
              : 'Filter users'
          }
        />

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
              {ROLE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
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
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
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

      <ActiveFilterChips chips={activeChips} onClearAll={handleClearChips} />

      <div className="sts-listing-meta-bar users-mobile-meta-bar" aria-live="polite">
        <span className="sts-listing-meta-bar__title">
          {hasActiveFilters ? 'Filtered Users' : 'Team Directory'}
        </span>
        <span className="sts-listing-meta-bar__count">
          {totalFiltered} {totalFiltered === 1 ? 'user' : 'users'}
        </span>
      </div>

      <MobileFilterSheet
        isOpen={isSheetOpen}
        title="Filter Users"
        activeCount={draftActiveCount}
        canReset={draftActiveCount > 0 || activeFilterCount > 0}
        onClose={() => setIsSheetOpen(false)}
        onReset={handleResetSheet}
        onApply={handleApplySheet}
      >
        <div className="sts-sheet-field">
          <span className="sts-sheet-field__label">Role</span>
          <div className="sts-sheet-options" role="radiogroup" aria-label="User Role">
            {ROLE_OPTIONS.map((item) => {
              const isSelected = draftRole === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`sts-sheet-option${
                    isSelected ? ' sts-sheet-option--selected' : ''
                  }`}
                  onClick={() => setDraftRole(item.value)}
                >
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="sts-sheet-field">
          <span className="sts-sheet-field__label">Account Status</span>
          <div className="sts-sheet-options" role="radiogroup" aria-label="User Account Status">
            {STATUS_OPTIONS.map((item) => {
              const isSelected = draftStatus === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`sts-sheet-option${
                    isSelected ? ' sts-sheet-option--selected' : ''
                  }`}
                  onClick={() => setDraftStatus(item.value)}
                >
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </MobileFilterSheet>
    </>
  )
}
