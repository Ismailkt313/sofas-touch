import { useMemo, useState } from 'react'
import { Dropdown, DatePicker } from '../../../components/common'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'

const STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active Vouchers' },
  { value: 'cancelled', label: 'Cancelled Vouchers' },
  { value: 'all', label: 'All Statuses' },
]

export function PurchasesFiltersBar({
  searchQuery,
  projectFilter,
  fromDate,
  toDate,
  statusFilter,
  projects = [],
  hasActiveFilters,
  totalMatching,
  onSearchChange,
  onProjectFilterChange,
  onFromDateChange,
  onToDateChange,
  onStatusFilterChange,
  onApplySearch,
  onResetFilters,
}) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  const projectOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Projects' },
      { value: 'none', label: 'General Procurement (No Project)' },
      ...projects.map((p) => ({
        value: p.id,
        label: `${p.projectId} \u2014 ${p.projectName}`,
      })),
    ]
  }, [projects])

  const handleFormSubmit = (e) => {
    e.preventDefault()
    onApplySearch?.()
  }

  const chips = useMemo(() => {
    const list = []
    if (searchQuery) {
      list.push({
        key: 'search',
        label: 'Search',
        value: `"${searchQuery}"`,
        onRemove: () => onSearchChange(''),
      })
    }
    if (projectFilter && projectFilter !== 'all') {
      const match = projectOptions.find((opt) => opt.value === projectFilter)
      list.push({
        key: 'project',
        label: 'Project',
        value: match ? match.label : projectFilter,
        onRemove: () => onProjectFilterChange('all'),
      })
    }
    if (fromDate) {
      list.push({
        key: 'fromDate',
        label: 'From',
        value: fromDate,
        onRemove: () => onFromDateChange(''),
      })
    }
    if (toDate) {
      list.push({
        key: 'toDate',
        label: 'To',
        value: toDate,
        onRemove: () => onToDateChange(''),
      })
    }
    if (statusFilter && statusFilter !== 'active') {
      const match = STATUS_FILTER_OPTIONS.find((s) => s.value === statusFilter)
      list.push({
        key: 'status',
        label: 'Status',
        value: match ? match.label : statusFilter,
        onRemove: () => onStatusFilterChange('active'),
      })
    }
    return list
  }, [
    searchQuery,
    projectFilter,
    fromDate,
    toDate,
    statusFilter,
    projectOptions,
    onSearchChange,
    onProjectFilterChange,
    onFromDateChange,
    onToDateChange,
    onStatusFilterChange,
  ])

  const activeCount = chips.length

  return (
    <div className="pv-filters-wrap">
      <form className="pv-filters" onSubmit={handleFormSubmit} role="search">
        <div className="pv-filters__search-row">
          <div className="pv-filters__search-box">
            <svg
              className="pv-filters__search-icon"
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
              className="pv-filters__search-input"
              placeholder="Search voucher #, supplier, invoice #, materials, notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search purchase vouchers"
            />
            {searchQuery ? (
              <button
                type="button"
                className="pv-filters__clear-btn"
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

          <MobileFilterButton
            activeCount={activeCount}
            onClick={() => setMobileSheetOpen(true)}
            className="pv-filters__mobile-btn"
          />
        </div>

        <div className="pv-filters__desktop-controls">
          <div className="pv-filters__control pv-filters__control--project">
            <Dropdown
              value={projectFilter}
              options={projectOptions}
              onChange={(val) => onProjectFilterChange(val)}
              placeholder="All Projects"
              ariaLabel="Filter by project"
            />
          </div>

          <div className="pv-filters__date-pair">
            <DatePicker
              prefix="From"
              value={fromDate}
              onChange={onFromDateChange}
              maxDate={toDate || undefined}
              variant="filter"
              ariaLabel="Filter from purchase date"
              placeholder="From"
            />
            <DatePicker
              prefix="To"
              value={toDate}
              onChange={onToDateChange}
              minDate={fromDate || undefined}
              variant="filter"
              ariaLabel="Filter to purchase date"
              placeholder="To"
            />
          </div>

          <div className="pv-filters__control pv-filters__control--status">
            <Dropdown
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={(val) => onStatusFilterChange(val)}
              placeholder="Active Vouchers"
              ariaLabel="Filter by voucher status"
            />
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              className="admin-btn admin-btn--secondary pv-filters__reset-btn"
              onClick={onResetFilters}
            >
              Reset
            </button>
          ) : null}
        </div>
      </form>

      <div className="pv-filters__meta-row">
        <span className="pv-filters__count">
          {totalMatching === 1
            ? '1 purchase voucher'
            : `${totalMatching} purchase vouchers`}
        </span>
        <ActiveFilterChips
          chips={chips}
          onClearAll={hasActiveFilters ? onResetFilters : undefined}
        />
      </div>

      <MobileFilterSheet
        isOpen={mobileSheetOpen}
        onClose={() => setMobileSheetOpen(false)}
        title="Filter Purchase Vouchers"
        activeCount={activeCount}
        onReset={onResetFilters}
        onApply={() => setMobileSheetOpen(false)}
      >
        <div className="pv-mobile-filters-form">
          <div className="pv-form-field">
            <label className="pv-form-label">Project Allocation</label>
            <Dropdown
              variant="form"
              portal={false}
              value={projectFilter}
              options={projectOptions}
              onChange={(val) => onProjectFilterChange(val)}
              placeholder="All Projects"
            />
          </div>

          <div className="pv-form-field">
            <label className="pv-form-label">From Date</label>
            <DatePicker
              variant="form"
              value={fromDate}
              onChange={onFromDateChange}
              maxDate={toDate || undefined}
              placeholder="Select from date"
            />
          </div>

          <div className="pv-form-field">
            <label className="pv-form-label">To Date</label>
            <DatePicker
              variant="form"
              value={toDate}
              onChange={onToDateChange}
              minDate={fromDate || undefined}
              placeholder="Select to date"
            />
          </div>

          <div className="pv-form-field">
            <label className="pv-form-label">Voucher Status</label>
            <Dropdown
              variant="form"
              portal={false}
              value={statusFilter}
              options={STATUS_FILTER_OPTIONS}
              onChange={(val) => onStatusFilterChange(val)}
              placeholder="Active Vouchers"
            />
          </div>
        </div>
      </MobileFilterSheet>
    </div>
  )
}
