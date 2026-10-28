import { useMemo, useState } from 'react'
import { Dropdown } from '../../../components/common'
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
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  const projectOptions = useMemo(() => {
    const base = [
      { value: 'all', label: 'All Projects' },
      { value: 'unassigned', label: 'General Workshop Stock (No Project)' },
    ]
    const mapped = projects.map((proj) => ({
      value: proj.id,
      label: `${proj.projectId} — ${proj.name}`,
    }))
    return [...base, ...mapped]
  }, [projects])

  const activeFilterChips = useMemo(() => {
    const chips = []
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
    projectFilter,
    projectOptions,
    fromDate,
    toDate,
    statusFilter,
    onProjectFilterChange,
    onFromDateChange,
    onToDateChange,
    onStatusFilterChange,
  ])

  const handleFormSubmit = (event) => {
    event.preventDefault()
    onApplySearch?.()
  }

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
              placeholder="Search voucher no, supplier, invoice #, project, or material..."
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              aria-label="Search purchase vouchers"
            />
          </div>

          <MobileFilterButton
            activeCount={activeFilterChips.length}
            onClick={() => setIsMobileSheetOpen(true)}
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
            <label className="pv-filters__date-field">
              <span className="pv-filters__date-prefix">From</span>
              <input
                type="date"
                className="pv-filters__date-input"
                value={fromDate}
                onChange={(event) => onFromDateChange(event.target.value)}
                aria-label="Filter from purchase date"
              />
            </label>

            <label className="pv-filters__date-field">
              <span className="pv-filters__date-prefix">To</span>
              <input
                type="date"
                className="pv-filters__date-input"
                value={toDate}
                onChange={(event) => onToDateChange(event.target.value)}
                aria-label="Filter to purchase date"
              />
            </label>
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
          chips={activeFilterChips}
          onClearAll={hasActiveFilters ? onResetFilters : undefined}
        />
      </div>

      <MobileFilterSheet
        isOpen={isMobileSheetOpen}
        title="Filter Purchase Vouchers"
        onClose={() => setIsMobileSheetOpen(false)}
        onReset={() => {
          onResetFilters?.()
          setIsMobileSheetOpen(false)
        }}
      >
        <div className="pv-mobile-sheet-fields">
          <div className="pv-form-field">
            <label className="pv-form-label">Project</label>
            <Dropdown
              variant="form"
              portal={false}
              value={projectFilter}
              options={projectOptions}
              onChange={(val) => onProjectFilterChange(val)}
              ariaLabel="Mobile project filter"
            />
          </div>

          <div className="pv-form-field">
            <label className="pv-form-label">From Date</label>
            <input
              type="date"
              className="pv-input"
              value={fromDate}
              onChange={(event) => onFromDateChange(event.target.value)}
            />
          </div>

          <div className="pv-form-field">
            <label className="pv-form-label">To Date</label>
            <input
              type="date"
              className="pv-input"
              value={toDate}
              onChange={(event) => onToDateChange(event.target.value)}
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
              ariaLabel="Mobile status filter"
            />
          </div>
        </div>
      </MobileFilterSheet>
    </div>
  )
}
