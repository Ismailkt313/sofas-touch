import { useMemo, useState } from 'react'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'
import { Dropdown } from '../../../components/common'
import { PROJECT_CATEGORY_OPTIONS, PROJECT_STATUS_OPTIONS } from '../services/projectService'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  ...PROJECT_STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  ...PROJECT_CATEGORY_OPTIONS.map((cat) => ({ value: cat, label: cat })),
]

export function ProjectsFiltersBar({
  searchQuery,
  statusFilter,
  categoryFilter,
  hasActiveFilters,
  totalMatching,
  onSearchChange,
  onStatusFilterChange,
  onCategoryFilterChange,
  onApplyFilters,
  onResetFilters,
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [draftStatus, setDraftStatus] = useState(statusFilter)
  const [draftCategory, setDraftCategory] = useState(categoryFilter)

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0)

  const draftActiveCount =
    (draftStatus !== 'all' ? 1 : 0) + (draftCategory !== 'all' ? 1 : 0)

  const activeChips = useMemo(() => {
    const chips = []
    if (statusFilter !== 'all') {
      chips.push({
        key: 'status',
        label: 'Status',
        value: statusFilter,
        onRemove: () => onStatusFilterChange('all'),
      })
    }
    if (categoryFilter !== 'all') {
      chips.push({
        key: 'category',
        label: 'Category',
        value: categoryFilter,
        onRemove: () => onCategoryFilterChange('all'),
      })
    }
    return chips
  }, [
    statusFilter,
    categoryFilter,
    onStatusFilterChange,
    onCategoryFilterChange,
  ])

  const openFilterSheet = () => {
    setDraftStatus(statusFilter)
    setDraftCategory(categoryFilter)
    setIsSheetOpen(true)
  }

  const handleApplySheet = () => {
    if (typeof onApplyFilters === 'function') {
      onApplyFilters(draftStatus, draftCategory)
    } else {
      onStatusFilterChange(draftStatus)
      onCategoryFilterChange(draftCategory)
    }
    setIsSheetOpen(false)
  }

  const handleResetSheet = () => {
    setDraftStatus('all')
    setDraftCategory('all')
    if (typeof onApplyFilters === 'function') {
      onApplyFilters('all', 'all')
    } else {
      onStatusFilterChange('all')
      onCategoryFilterChange('all')
    }
  }

  const handleClearChips = () => {
    if (typeof onApplyFilters === 'function') {
      onApplyFilters('all', 'all')
    } else {
      onStatusFilterChange('all')
      onCategoryFilterChange('all')
    }
  }

  return (
    <>
      <div
        className="projects-toolbar"
        role="search"
        aria-label="Filter projects"
      >
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
            placeholder="Search ID, project, or client..."
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

        <MobileFilterButton
          activeCount={activeFilterCount}
          onClick={openFilterSheet}
          ariaLabel={
            activeFilterCount > 0
              ? `Filter projects (${activeFilterCount} active)`
              : 'Filter projects'
          }
        />

        <div className="projects-filters">
          <div className="projects-filter-group">
            <label
              htmlFor="projects-status-filter"
              className="projects-filter-label"
            >
              Status
            </label>
            <Dropdown
              id="projects-status-filter"
              variant="filter"
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(val) => onStatusFilterChange(val)}
            />
          </div>

          <div className="projects-filter-group">
            <label
              htmlFor="projects-category-filter"
              className="projects-filter-label"
            >
              Category
            </label>
            <Dropdown
              id="projects-category-filter"
              variant="filter"
              value={categoryFilter}
              options={CATEGORY_OPTIONS}
              onChange={(val) => onCategoryFilterChange(val)}
            />
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

      <ActiveFilterChips chips={activeChips} onClearAll={handleClearChips} />

      <div className="sts-listing-meta-bar" aria-live="polite">
        <span className="sts-listing-meta-bar__title">
          {hasActiveFilters ? 'Filtered Projects' : 'All Projects'}
        </span>
        <span className="sts-listing-meta-bar__count">
          {totalMatching} {totalMatching === 1 ? 'project' : 'projects'}
        </span>
      </div>

      <MobileFilterSheet
        isOpen={isSheetOpen}
        title="Filter Projects"
        activeCount={draftActiveCount}
        canReset={draftActiveCount > 0 || activeFilterCount > 0}
        onClose={() => setIsSheetOpen(false)}
        onReset={handleResetSheet}
        onApply={handleApplySheet}
      >
        <div className="sts-sheet-field">
          <span className="sts-sheet-field__label">Project Status</span>
          <div className="sts-sheet-options" role="radiogroup" aria-label="Project Status">
            {['all', ...PROJECT_STATUS_OPTIONS].map((option) => {
              const isSelected = draftStatus === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`sts-sheet-option${
                    isSelected ? ' sts-sheet-option--selected' : ''
                  }`}
                  onClick={() => setDraftStatus(option)}
                >
                  <span>{option === 'all' ? 'All Statuses' : option}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="sts-sheet-field">
          <span className="sts-sheet-field__label">Category</span>
          <div className="sts-sheet-options" role="radiogroup" aria-label="Project Category">
            {['all', ...PROJECT_CATEGORY_OPTIONS].map((option) => {
              const isSelected = draftCategory === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`sts-sheet-option${
                    isSelected ? ' sts-sheet-option--selected' : ''
                  }`}
                  onClick={() => setDraftCategory(option)}
                >
                  <span>{option === 'all' ? 'All Categories' : option}</span>
                </button>
              )
            })}
          </div>
        </div>
      </MobileFilterSheet>
    </>
  )
}
