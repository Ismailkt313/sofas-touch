import { useMemo, useState } from 'react'
import { Dropdown } from '../../../components/common'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'
import { RAW_MATERIAL_CATEGORIES } from '../services/rawMaterialService'

const ADMIN_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const OPERATOR_STATUS_OPTIONS = [{ value: 'active', label: 'Active' }]

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  ...RAW_MATERIAL_CATEGORIES.map((category) => ({
    value: category,
    label: category,
  })),
]

function formatStatusLabel(statusValue) {
  if (statusValue === 'active') return 'Active'
  if (statusValue === 'inactive') return 'Inactive'
  return 'All'
}

export function RawMaterialsFiltersBar({
  adminAccess,
  searchQuery,
  categoryFilter,
  statusFilter,
  hasActiveFilters,
  totalMatching,
  onSearchChange,
  onCategoryFilterChange,
  onStatusFilterChange,
  onApplyFilters,
  onResetFilters,
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [draftStatus, setDraftStatus] = useState(statusFilter)
  const [draftCategory, setDraftCategory] = useState(categoryFilter)

  const statusOptions = adminAccess
    ? ADMIN_STATUS_OPTIONS
    : OPERATOR_STATUS_OPTIONS

  const activeDropdownCount =
    (categoryFilter !== 'all' ? 1 : 0) +
    (adminAccess && statusFilter !== 'all' ? 1 : 0)

  const draftActiveCount =
    (draftCategory !== 'all' ? 1 : 0) +
    (adminAccess && draftStatus !== 'all' ? 1 : 0)

  const activeChips = useMemo(() => {
    const chips = []
    if (categoryFilter !== 'all') {
      chips.push({
        key: 'category',
        label: 'Category',
        value: categoryFilter,
        onRemove: () => onCategoryFilterChange('all'),
      })
    }
    if (adminAccess && statusFilter !== 'all') {
      chips.push({
        key: 'status',
        label: 'Status',
        value: formatStatusLabel(statusFilter),
        onRemove: () => onStatusFilterChange('all'),
      })
    }
    return chips
  }, [
    adminAccess,
    categoryFilter,
    statusFilter,
    onCategoryFilterChange,
    onStatusFilterChange,
  ])

  const openFilterSheet = () => {
    setDraftStatus(adminAccess ? statusFilter : 'active')
    setDraftCategory(categoryFilter)
    setIsSheetOpen(true)
  }

  const handleApplySheet = () => {
    onApplyFilters?.(adminAccess ? draftStatus : 'active', draftCategory)
    setIsSheetOpen(false)
  }

  const handleResetSheet = () => {
    setDraftStatus(adminAccess ? 'all' : 'active')
    setDraftCategory('all')
    onApplyFilters?.(adminAccess ? 'all' : 'active', 'all')
  }

  const handleClearChips = () => {
    onApplyFilters?.(adminAccess ? 'all' : 'active', 'all')
  }

  return (
    <>
      <div
        className="rm-toolbar"
        role="search"
        aria-label="Search and filter raw materials"
      >
        <div className="rm-search">
          <label htmlFor="rm-search-input" className="sr-only">
            Search raw materials by name
          </label>
          <span className="rm-search__icon" aria-hidden="true">
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
            id="rm-search-input"
            type="search"
            className="rm-search__input"
            placeholder="Search material name..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            autoComplete="off"
          />
          {searchQuery ? (
            <button
              type="button"
              className="rm-search__clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear material search"
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
          activeCount={activeDropdownCount}
          onClick={openFilterSheet}
          ariaLabel={
            activeDropdownCount > 0
              ? `Filter raw materials (${activeDropdownCount} active)`
              : 'Filter raw materials'
          }
        />

        <div className="rm-filters">
          <div className="rm-filter-group">
            <label htmlFor="rm-category-filter" className="rm-filter-label">
              Category
            </label>
            <Dropdown
              id="rm-category-filter"
              variant="filter"
              value={categoryFilter}
              options={CATEGORY_FILTER_OPTIONS}
              onChange={(val) => onCategoryFilterChange(val)}
            />
          </div>

          <div className="rm-filter-group">
            <label htmlFor="rm-status-filter" className="rm-filter-label">
              Status
            </label>
            <Dropdown
              id="rm-status-filter"
              variant="filter"
              value={adminAccess ? statusFilter : 'active'}
              options={statusOptions}
              disabled={!adminAccess}
              onChange={(val) => onStatusFilterChange(val)}
              ariaLabel={
                adminAccess
                  ? 'Filter by material status'
                  : 'Status filter locked to Active for Data Entry accounts'
              }
            />
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              className="rm-reset-btn"
              onClick={onResetFilters}
            >
              Reset Filters
            </button>
          ) : null}
        </div>
      </div>

      <ActiveFilterChips chips={activeChips} onClearAll={handleClearChips} />

      <div className="sts-listing-meta-bar">
        <span className="sts-listing-meta-bar__title">Catalog</span>
        <span className="sts-listing-meta-bar__count">
          {totalMatching} {totalMatching === 1 ? 'material' : 'materials'}
        </span>
      </div>

      <MobileFilterSheet
        isOpen={isSheetOpen}
        title="Filter Materials"
        activeCount={draftActiveCount}
        onClose={() => setIsSheetOpen(false)}
        onReset={handleResetSheet}
        onApply={handleApplySheet}
        canReset={draftActiveCount > 0}
      >
        <div className="sts-filter-sheet__field">
          <label
            htmlFor="rm-mobile-category-filter"
            className="sts-filter-sheet__label"
          >
            Category
          </label>
          <Dropdown
            id="rm-mobile-category-filter"
            variant="form"
            value={draftCategory}
            options={CATEGORY_FILTER_OPTIONS}
            onChange={(val) => setDraftCategory(val)}
            portal={false}
          />
        </div>

        <div className="sts-filter-sheet__field">
          <label
            htmlFor="rm-mobile-status-filter"
            className="sts-filter-sheet__label"
          >
            Status
          </label>
          <Dropdown
            id="rm-mobile-status-filter"
            variant="form"
            value={adminAccess ? draftStatus : 'active'}
            options={statusOptions}
            disabled={!adminAccess}
            onChange={(val) => setDraftStatus(val)}
            portal={false}
          />
        </div>
      </MobileFilterSheet>
    </>
  )
}
