import { useMemo, useState } from 'react'
import { Dropdown, DatePicker } from '../../../components/common'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active Expenses' },
  { value: 'cancelled', label: 'Cancelled Expenses' },
  { value: 'all', label: 'All Statuses' },
]

export function ExpensesFiltersBar({
  searchQuery,
  categoryFilter,
  projectFilter,
  fromDate,
  toDate,
  statusFilter,
  categories = [],
  projects = [],
  hasActiveFilters,
  totalMatching,
  onSearchChange,
  onCategoryFilterChange,
  onProjectFilterChange,
  onFromDateChange,
  onToDateChange,
  onStatusFilterChange,
  onApplySearch,
  onResetFilters,
}) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  const categoryOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'All Categories' }]
    const mapped = categories.map((cat) => ({
      value: cat.id,
      label: cat.isActive === false ? `${cat.name} (Inactive)` : cat.name,
    }))
    return [...base, ...mapped]
  }, [categories])

  const projectOptions = useMemo(() => {
    const base = [
      { value: 'all', label: 'All Projects' },
      { value: 'unassigned', label: 'General Workshop (No Project)' },
    ]
    const mapped = projects.map((proj) => ({
      value: proj.id,
      label: `${proj.projectId} — ${proj.name}`,
    }))
    return [...base, ...mapped]
  }, [projects])

  const activeFilterChips = useMemo(() => {
    const chips = []

    if (categoryFilter && categoryFilter !== 'all') {
      const match = categoryOptions.find((o) => o.value === categoryFilter)
      chips.push({
        key: 'category',
        label: `Category: ${match ? match.label : categoryFilter}`,
        onRemove: () => onCategoryFilterChange('all'),
      })
    }

    if (projectFilter && projectFilter !== 'all') {
      const match = projectOptions.find((o) => o.value === projectFilter)
      chips.push({
        key: 'project',
        label: `Project: ${match ? match.label : projectFilter}`,
        onRemove: () => onProjectFilterChange('all'),
      })
    }

    if (fromDate) {
      chips.push({
        key: 'fromDate',
        label: `From: ${fromDate}`,
        onRemove: () => onFromDateChange(''),
      })
    }

    if (toDate) {
      chips.push({
        key: 'toDate',
        label: `To: ${toDate}`,
        onRemove: () => onToDateChange(''),
      })
    }

    if (statusFilter && statusFilter !== 'active') {
      const st = STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)
      chips.push({
        key: 'status',
        label: `Status: ${st ? st.label : statusFilter}`,
        onRemove: () => onStatusFilterChange('active'),
      })
    }

    return chips
  }, [
    categoryFilter,
    categoryOptions,
    projectFilter,
    projectOptions,
    fromDate,
    toDate,
    statusFilter,
    onCategoryFilterChange,
    onProjectFilterChange,
    onFromDateChange,
    onToDateChange,
    onStatusFilterChange,
  ])

  const handleSubmit = (event) => {
    event.preventDefault()
    onApplySearch?.()
  }

  return (
    <div className="exp-surface exp-filters-wrap">
      <form className="exp-filters" onSubmit={handleSubmit} role="search">
        <div className="exp-filters__top-row">
          <div className="exp-filters__search-box">
            <svg
              className="exp-filters__search-icon"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="9"
                cy="9"
                r="5.75"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M13.5 13.5L17 17"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              className="exp-filters__search-input"
              placeholder="Search voucher no, description, category, or project..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="Search expenses"
            />
            {searchQuery ? (
              <button
                type="button"
                className="exp-filters__clear-btn"
                onClick={() => onSearchChange('')}
                aria-label="Clear search query"
                title="Clear search"
              >
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M4 4L12 12M12 4L4 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>

          <div className="exp-filters__mobile-trigger">
            <MobileFilterButton
              activeCount={activeFilterChips.length}
              onClick={() => setIsMobileSheetOpen(true)}
            />
          </div>
        </div>

        <div className="exp-filters__desktop-grid">
          <div className="exp-filter-field">
            <span className="exp-filter-field__label">Category</span>
            <Dropdown
              value={categoryFilter}
              options={categoryOptions}
              onChange={onCategoryFilterChange}
              searchable={categoryOptions.length > 6}
              placeholder="All Categories"
              ariaLabel="Filter by expense category"
            />
          </div>

          <div className="exp-filter-field">
            <span className="exp-filter-field__label">Project</span>
            <Dropdown
              value={projectFilter}
              options={projectOptions}
              onChange={onProjectFilterChange}
              searchable={projectOptions.length > 6}
              placeholder="All Projects"
              ariaLabel="Filter by project"
            />
          </div>

          <div className="exp-filter-field">
            <span className="exp-filter-field__label">From Date</span>
            <DatePicker
              value={fromDate}
              onChange={onFromDateChange}
              maxDate={toDate || undefined}
              variant="filter"
              ariaLabel="Filter from expense date"
              placeholder="From"
            />
          </div>

          <div className="exp-filter-field">
            <span className="exp-filter-field__label">To Date</span>
            <DatePicker
              value={toDate}
              onChange={onToDateChange}
              minDate={fromDate || undefined}
              variant="filter"
              ariaLabel="Filter to expense date"
              placeholder="To"
            />
          </div>

          <div className="exp-filter-field">
            <span className="exp-filter-field__label">Status</span>
            <Dropdown
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={onStatusFilterChange}
              placeholder="Active Expenses"
              ariaLabel="Filter by expense status"
            />
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              className="exp-btn exp-btn--secondary"
              onClick={onResetFilters}
            >
              Reset
            </button>
          ) : null}
        </div>
      </form>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.6rem',
          flexWrap: 'wrap',
          fontSize: '0.8rem',
          color: 'var(--sts-charcoal-muted)',
        }}
      >
        <span>
          {totalMatching === 1
            ? '1 expense record'
            : `${totalMatching} expense records`}
        </span>
        <ActiveFilterChips
          chips={activeFilterChips}
          onClearAll={hasActiveFilters ? onResetFilters : undefined}
        />
      </div>

      <MobileFilterSheet
        isOpen={isMobileSheetOpen}
        title="Filter Expenses"
        onClose={() => setIsMobileSheetOpen(false)}
        onReset={() => {
          onResetFilters?.()
          setIsMobileSheetOpen(false)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="exp-field">
            <span className="exp-field__label">Category</span>
            <Dropdown
              variant="form"
              portal={false}
              value={categoryFilter}
              options={categoryOptions}
              onChange={onCategoryFilterChange}
              ariaLabel="Mobile category filter"
            />
          </div>

          <div className="exp-field">
            <span className="exp-field__label">Project</span>
            <Dropdown
              variant="form"
              portal={false}
              value={projectFilter}
              options={projectOptions}
              onChange={onProjectFilterChange}
              ariaLabel="Mobile project filter"
            />
          </div>

          <div className="exp-field">
            <span className="exp-field__label">From Date</span>
            <DatePicker
              variant="form"
              value={fromDate}
              onChange={onFromDateChange}
              maxDate={toDate || undefined}
              placeholder="Select from date"
            />
          </div>

          <div className="exp-field">
            <span className="exp-field__label">To Date</span>
            <DatePicker
              variant="form"
              value={toDate}
              onChange={onToDateChange}
              minDate={fromDate || undefined}
              placeholder="Select to date"
            />
          </div>

          <div className="exp-field">
            <span className="exp-field__label">Status</span>
            <Dropdown
              variant="form"
              portal={false}
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={onStatusFilterChange}
              ariaLabel="Mobile status filter"
            />
          </div>
        </div>
      </MobileFilterSheet>
    </div>
  )
}
