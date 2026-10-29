import { useMemo, useState } from 'react'
import { Dropdown } from '../../../components/common'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'
import {
  REPORT_SORT_OPTIONS,
  REPORT_STATUS_OPTIONS,
  buildSortOptionValue,
  parseSortOptionValue,
} from '../utils/reportFormatters'

export function ReportsFiltersBar({
  searchQuery,
  statusFilter,
  fromDate,
  toDate,
  sortBy,
  sortOrder,
  dateRangeError,
  hasActiveFilters,
  totalMatching,
  onSearchChange,
  onStatusChange,
  onFromDateChange,
  onToDateChange,
  onSortChange,
  onApplySearch,
  onResetFilters,
}) {
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  const compositeSortValue = buildSortOptionValue(sortBy, sortOrder)

  const activeChips = useMemo(() => {
    const chips = []

    if (statusFilter && statusFilter !== 'all') {
      chips.push({
        key: 'status',
        label: `Status: ${statusFilter}`,
        onRemove: () => onStatusChange('all'),
      })
    }

    if (fromDate) {
      chips.push({
        key: 'fromDate',
        label: `Tx From: ${fromDate}`,
        onRemove: () => onFromDateChange(''),
      })
    }

    if (toDate) {
      chips.push({
        key: 'toDate',
        label: `Tx To: ${toDate}`,
        onRemove: () => onToDateChange(''),
      })
    }

    if (compositeSortValue !== 'createdAt:desc') {
      const sortOpt = REPORT_SORT_OPTIONS.find(
        (o) => o.value === compositeSortValue,
      )
      chips.push({
        key: 'sort',
        label: sortOpt ? sortOpt.label : 'Custom Sort',
        onRemove: () => onSortChange('createdAt', 'desc'),
      })
    }

    return chips
  }, [
    statusFilter,
    fromDate,
    toDate,
    compositeSortValue,
    onStatusChange,
    onFromDateChange,
    onToDateChange,
    onSortChange,
  ])

  const handleSortDropdownChange = (val) => {
    const next = parseSortOptionValue(val)
    onSortChange(next.sortBy, next.sortOrder)
  }

  return (
    <div className="rep-surface rep-filters-wrap rep-no-print">
      <form
        className="rep-filters"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          onApplySearch?.()
        }}
      >
        <div className="rep-filters__top-row">
          <div className="rep-filters__search-box">
            <svg
              className="rep-filters__search-icon"
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
              className="rep-filters__search-input"
              placeholder="Search by project ID, project name, or client name..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search projects in report"
            />
          </div>

          <div className="rep-filters__mobile-trigger">
            <MobileFilterButton
              activeCount={activeChips.length}
              onClick={() => setIsMobileSheetOpen(true)}
            />
          </div>
        </div>

        <div className="rep-filters__desktop-grid">
          <div className="rep-filter-field">
            <span className="rep-filter-field__label">Project Status</span>
            <Dropdown
              value={statusFilter}
              options={REPORT_STATUS_OPTIONS}
              onChange={onStatusChange}
              placeholder="All Project Statuses"
              ariaLabel="Filter by project status"
            />
          </div>

          <label className="rep-filter-field">
            <span className="rep-filter-field__label">
              Transactions From
            </span>
            <input
              type="date"
              className="rep-date-input"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              aria-label="Filter transactions from date"
            />
          </label>

          <label className="rep-filter-field">
            <span className="rep-filter-field__label">Transactions To</span>
            <input
              type="date"
              className="rep-date-input"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              aria-label="Filter transactions to date"
            />
          </label>

          <div className="rep-filter-field">
            <span className="rep-filter-field__label">Sort Projects By</span>
            <Dropdown
              value={compositeSortValue}
              options={REPORT_SORT_OPTIONS}
              onChange={handleSortDropdownChange}
              placeholder="Newest Projects First"
              ariaLabel="Sort project profitability rows"
            />
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              className="rep-btn rep-btn--secondary"
              onClick={onResetFilters}
            >
              Reset
            </button>
          ) : null}
        </div>
      </form>

      {dateRangeError ? (
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--sts-error-accent)',
          }}
          role="alert"
        >
          {dateRangeError}
        </div>
      ) : null}

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
            ? '1 project in report'
            : `${totalMatching} projects in report`}
        </span>
        <ActiveFilterChips
          chips={activeChips}
          onClearAll={hasActiveFilters ? onResetFilters : undefined}
        />
      </div>

      <MobileFilterSheet
        isOpen={isMobileSheetOpen}
        title="Filter & Sort Project Reports"
        onClose={() => setIsMobileSheetOpen(false)}
        onReset={() => {
          onResetFilters?.()
          setIsMobileSheetOpen(false)
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="rep-filter-field">
            <span className="rep-filter-field__label">Project Status</span>
            <Dropdown
              variant="form"
              portal={false}
              value={statusFilter}
              options={REPORT_STATUS_OPTIONS}
              onChange={onStatusChange}
              ariaLabel="Mobile project status filter"
            />
          </div>

          <label className="rep-filter-field">
            <span className="rep-filter-field__label">Transactions From</span>
            <input
              type="date"
              className="rep-date-input"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
            />
          </label>

          <label className="rep-filter-field">
            <span className="rep-filter-field__label">Transactions To</span>
            <input
              type="date"
              className="rep-date-input"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
            />
          </label>

          <div className="rep-filter-field">
            <span className="rep-filter-field__label">Sort By</span>
            <Dropdown
              variant="form"
              portal={false}
              value={compositeSortValue}
              options={REPORT_SORT_OPTIONS}
              onChange={handleSortDropdownChange}
              ariaLabel="Mobile sort projects"
            />
          </div>
        </div>
      </MobileFilterSheet>
    </div>
  )
}
