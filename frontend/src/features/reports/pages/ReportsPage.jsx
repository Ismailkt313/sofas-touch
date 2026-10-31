import { useListingState } from '../../../services/navigationState'
import { calculatePreservedPage } from '../../../components/common/paginationUtils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ReportsFiltersBar } from '../components/ReportsFiltersBar'
import { ReportsMobileList } from '../components/ReportsMobileList'
import { Pagination } from '../../../components/common/Pagination'
import { ReportsSummaryCards } from '../components/ReportsSummaryCards'
import { ReportsTable } from '../components/ReportsTable'
import { hasAllPermissions } from '../../permissions/constants/permissionsCatalog'
import {
  downloadProjectReportsCsv,
  fetchProjectReports,
  hasActiveAuthToken,
} from '../services/reportService'
import '../styles/reports.css'
import {
  formatPeriodRangeLabel,
  formatReportCurrency,
  validateReportDateRange,
} from '../utils/reportFormatters'

const PAGE_LIMIT = 10
const REPORTS_LISTING_SCHEMA = {
  page: { type: 'number', default: 1, min: 1 },
  limit: { type: 'number', default: 10, min: 1 },
  search: { type: 'string', default: '' },
  status: { type: 'string', default: 'all' },
  fromDate: { type: 'string', default: '' },
  toDate: { type: 'string', default: '' },
  sortBy: { type: 'string', default: 'createdAt' },
  sortOrder: { type: 'string', default: 'desc' },
}


const EMPTY_SUMMARY = {
  projectCount: 0,
  contractValue: 0,
  materialPurchaseCosts: 0,
  otherProjectExpenses: 0,
  totalProjectCosts: 0,
  estimatedProfit: 0,
  profitMargin: null,
  costPercentage: null,
  marginApplicable: false,
  lifetimeMaterialPurchaseCosts: 0,
  lifetimeOtherProjectExpenses: 0,
  lifetimeTotalProjectCosts: 0,
  lifetimeEstimatedProfit: 0,
  lifetimeProfitMargin: null,
}

export function ReportsPage({ currentUser, onNavigate }) {
  const adminAccess = hasAllPermissions(currentUser, [
    'reports.view',
    'reports.viewProfitability',
  ])
  const [authRequired, setAuthRequired] = useState(() => !hasActiveAuthToken())

  const [projects, setProjects] = useState([])
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [period, setPeriod] = useState({
    fromDate: null,
    toDate: null,
    isDateFiltered: false,
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_LIMIT,
    totalItems: 0,
    totalPages: 1,
  })

  const { values, setValue, setValues, resetAll, clampPage } = useListingState(REPORTS_LISTING_SCHEMA, {
    routeKey: 'reports',
  })

  const currentPage = values.page
  const statusFilter = values.status
  const fromDate = values.fromDate
  const toDate = values.toDate
  const sortBy = values.sortBy
  const sortOrder = values.sortOrder
  const pageSize = values.limit || PAGE_LIMIT

  const setCurrentPage = useCallback(
    (pageNumber) => setValue('page', pageNumber, { push: true }),
    [setValue],
  )

  const [searchInput, setSearchInput] = useState(values.search)
  const [appliedSearch, setAppliedSearch] = useState(values.search)

  useEffect(() => {
    setSearchInput(values.search)
    setAppliedSearch(values.search)
  }, [values.search])

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const hasLoadedOnceRef = useRef(false)

  const dateRangeError = validateReportDateRange(fromDate, toDate)

  const hasActiveFilters = Boolean(
    searchInput.trim() ||
      statusFilter !== 'all' ||
      fromDate ||
      toDate ||
      sortBy !== 'createdAt' ||
      sortOrder !== 'desc',
  )

  const handleApplySearch = useCallback(() => {
    const next = searchInput.trim()
    setAppliedSearch(next)
    setValue('search', next, { resetPage: true })
    if (hasLoadedOnceRef.current) setIsRefreshing(true)
  }, [searchInput, setValue])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      setAppliedSearch((prev) => {
        if (prev !== next) {
          setValue('search', next, { resetPage: true })
          if (hasLoadedOnceRef.current) {
            setIsRefreshing(true)
          }
        }
        return next
      })
    }, 280)

    return () => window.clearTimeout(timer)
  }, [searchInput, setValue])

  useEffect(() => {
    if (!hasActiveAuthToken() || !adminAccess || dateRangeError) {
      return undefined
    }

    let cancelled = false

    fetchProjectReports({
      page: currentPage,
      limit: pageSize,
      search: appliedSearch,
      status: statusFilter,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    })
      .then((result) => {
        if (cancelled) return
        hasLoadedOnceRef.current = true
        setAuthRequired(false)
        setProjects(result.items || result.projects || [])
        setSummary(result.summary || EMPTY_SUMMARY)
        setPeriod(
          result.period || {
            fromDate: null,
            toDate: null,
            isDateFiltered: false,
          },
        )
        setPagination({
          page: Number(result.page ?? currentPage),
          limit: Number(result.limit ?? pageSize),
          totalItems: Number(result.total ?? 0),
          totalPages: Math.max(1, Number(result.totalPages ?? 1)),
        })
        setErrorMessage('')
      })
      .catch((err) => {
        if (cancelled) return
        const status = err?.status || err?.response?.status
        if (status === 401) {
          setAuthRequired(true)
          return
        }
        const msg =
          err?.message ||
          err?.response?.data?.message ||
          'Unable to load project cost and profitability reports right now.'
        setErrorMessage(msg)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
        setIsRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    adminAccess,
    appliedSearch,
    currentPage,
    pageSize,
    dateRangeError,
    fromDate,
    reloadTick,
    sortBy,
    sortOrder,
    statusFilter,
    toDate,
  ])

  const triggerReload = useCallback(() => {
    if (hasLoadedOnceRef.current) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setReloadTick((prev) => prev + 1)
  }, [])

  const handleStatusChange = useCallback(
    (nextStatus) => {
      setValue('status', nextStatus, { resetPage: true })
      if (hasLoadedOnceRef.current) setIsRefreshing(true)
    },
    [setValue],
  )

  const handleFromDateChange = useCallback(
    (nextFrom) => {
      setValue('fromDate', nextFrom || '', { resetPage: true })
      if (hasLoadedOnceRef.current) setIsRefreshing(true)
    },
    [setValue],
  )

  const handleToDateChange = useCallback(
    (nextTo) => {
      setValue('toDate', nextTo || '', { resetPage: true })
      if (hasLoadedOnceRef.current) setIsRefreshing(true)
    },
    [setValue],
  )

  const handleSortChange = useCallback(
    (nextSortBy, nextSortOrder) => {
      setValues(
        { sortBy: nextSortBy, sortOrder: nextSortOrder },
        { resetPage: true },
      )
      if (hasLoadedOnceRef.current) setIsRefreshing(true)
    },
    [setValues],
  )

  const handlePageChange = useCallback(
    (nextPage) => {
      setCurrentPage(nextPage)
      if (hasLoadedOnceRef.current) setIsRefreshing(true)
    },
    [setCurrentPage],
  )

  const handlePageSizeChange = useCallback(
    (nextLimit) => {
      const newPage = calculatePreservedPage(
        pagination.page,
        pagination.limit || pageSize,
        nextLimit,
        pagination.totalItems,
      )
      setValues({ page: newPage, limit: nextLimit })
      if (hasLoadedOnceRef.current) setIsRefreshing(true)
    },
    [pagination.limit, pagination.page, pagination.totalItems, pageSize, setValues],
  )

  const handleResetFilters = useCallback(() => {
    setSearchInput('')
    setAppliedSearch('')
    resetAll()
    if (hasLoadedOnceRef.current) setIsRefreshing(true)
  }, [resetAll])

  const handleOpenProjectReport = useCallback(
    (projectCode) => {
      const qs = new URLSearchParams()
      if (fromDate && !dateRangeError) qs.set('fromDate', fromDate)
      if (toDate && !dateRangeError) qs.set('toDate', toDate)
      const querySuffix = qs.toString() ? `?${qs.toString()}` : ''
      const targetPath = `/projects/${encodeURIComponent(projectCode)}/report${querySuffix}`
      if (onNavigate) {
        onNavigate(targetPath)
      } else {
        window.location.assign(targetPath)
      }
    },
    [dateRangeError, fromDate, onNavigate, toDate],
  )

  const handleExportCsv = async () => {
    if (dateRangeError || isExportingCsv) return
    setIsExportingCsv(true)
    setExportMessage('')
    try {
      const filename = await downloadProjectReportsCsv({
        search: appliedSearch,
        status: statusFilter,
        fromDate,
        toDate,
        sortBy,
        sortOrder,
      })
      setExportMessage(`Exported ${filename}`)
      window.setTimeout(() => setExportMessage(''), 4000)
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message ||
          'Failed to export CSV report. Please try again.',
      )
    } finally {
      setIsExportingCsv(false)
    }
  }

  if (authRequired) {
    return (
      <div className="rep-page">
        <div className="rep-surface rep-access-card">
          <h2>Sign In Required</h2>
          <p>Please sign in to view project financial reports.</p>
          <button
            type="button"
            className="rep-btn rep-btn--primary"
            onClick={() => onNavigate?.('/login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (!adminAccess) {
    return (
      <div className="rep-page">
        <div className="rep-surface rep-access-card">
          <h2>Administrator Access Required</h2>
          <p>
            Project contract values, cost breakdowns, and profitability margins
            are restricted to Soft Touch Sofas administrators.
          </p>
          <button
            type="button"
            className="rep-btn rep-btn--secondary"
            onClick={() => onNavigate?.('/projects')}
          >
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rep-page">
      <header className="rep-header">
        <div className="rep-header__titles">
          <span className="rep-header__eyebrow">Financial Intelligence</span>
          <h1 className="rep-header__title">Project Reports</h1>
        </div>

        <div className="rep-header__actions rep-no-print">
          {exportMessage ? (
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--sts-success-text)',
                alignSelf: 'center',
              }}
            >
              {exportMessage}
            </span>
          ) : null}

          <button
            type="button"
            className="rep-btn rep-btn--secondary"
            disabled={isLoading || Boolean(dateRangeError) || isExportingCsv}
            onClick={handleExportCsv}
          >
            {isExportingCsv ? 'Exporting CSV...' : 'Export CSV'}
          </button>
        </div>
      </header>



      {period?.isDateFiltered ? (
        <section
          className="rep-period-banner"
          aria-label="Active reporting period summary"
        >
          <div className="rep-period-banner__top">
            <span className="rep-period-banner__badge">
              Reporting Period: {formatPeriodRangeLabel(period)}
            </span>
            <span className="rep-period-banner__note">
              Period costs reflect vouchers dated within the selected range and
              are kept distinct from lifetime project profitability.
            </span>
          </div>

          <div className="rep-period-banner__metrics">
            <span>
              Period Purchases:{' '}
              <strong>
                {formatReportCurrency(summary.materialPurchaseCosts)}
              </strong>
            </span>
            <span>
              Period Other Expenses:{' '}
              <strong>
                {formatReportCurrency(summary.otherProjectExpenses)}
              </strong>
            </span>
            <span>
              Combined Period Costs:{' '}
              <strong>{formatReportCurrency(summary.totalProjectCosts)}</strong>
            </span>
            <span>
              Lifetime Est. Profit (All Dates):{' '}
              <strong>
                {formatReportCurrency(summary.lifetimeEstimatedProfit)}
              </strong>
            </span>
          </div>
        </section>
      ) : null}

      <ReportsSummaryCards summary={summary} period={period} />

      <ReportsFiltersBar
        searchQuery={searchInput}
        statusFilter={statusFilter}
        fromDate={fromDate}
        toDate={toDate}
        sortBy={sortBy}
        sortOrder={sortOrder}
        dateRangeError={dateRangeError}
        hasActiveFilters={hasActiveFilters}
        totalMatching={pagination.totalItems}
        onSearchChange={setSearchInput}
        onStatusChange={handleStatusChange}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        onSortChange={handleSortChange}
        onApplySearch={handleApplySearch}
        onResetFilters={handleResetFilters}
      />

      {errorMessage ? (
        <div className="rep-error-banner" role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="rep-btn rep-btn--secondary rep-btn--sm"
            onClick={triggerReload}
          >
            Retry
          </button>
        </div>
      ) : null}

      <section
        className="rep-surface"
        style={{ opacity: isRefreshing ? 0.72 : 1, transition: 'opacity 140ms' }}
        aria-busy={isLoading || isRefreshing}
      >
        {isLoading ? (
          <div className="rep-loading">
            <div className="rep-spinner" aria-hidden="true" />
            <span>Calculating project costs and profitability...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="rep-empty">
            <h2 className="rep-empty__title">
              {hasActiveFilters
                ? 'No matching project reports found'
                : 'No projects recorded yet'}
            </h2>
            <p className="rep-empty__text">
              {hasActiveFilters
                ? period?.isDateFiltered
                  ? 'No projects have recorded active purchase or expense vouchers matching your selected date range and filters.'
                  : 'Try clearing your search query or adjusting your status filter.'
                : 'Create a project and record material purchases or project expenses to track budget utilization and estimated profitability.'}
            </p>
            {hasActiveFilters ? (
              <div style={{ marginTop: '0.9rem' }}>
                <button
                  type="button"
                  className="rep-btn rep-btn--secondary rep-btn--sm"
                  onClick={handleResetFilters}
                >
                  Clear All Filters
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <ReportsTable
              rows={projects}
              period={period}
              onOpenProjectReport={handleOpenProjectReport}
            />
            <ReportsMobileList
              rows={projects}
              period={period}
              onOpenProjectReport={handleOpenProjectReport}
            />
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.limit || pageSize}
              pageSizeOptions={[10, 20, 50]}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              itemName="project report"
              itemsName="project reports"
            />
          </>
        )}
      </section>
    </div>
  )
}
