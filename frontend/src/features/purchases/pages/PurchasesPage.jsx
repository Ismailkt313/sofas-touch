import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchProjects } from '../../projects'
import { PurchasesFiltersBar } from '../components/PurchasesFiltersBar'
import { PurchasesMobileList } from '../components/PurchasesMobileList'
import { PurchasesPagination } from '../components/PurchasesPagination'
import { PurchasesSummaryStrip } from '../components/PurchasesSummaryStrip'
import { PurchasesTable } from '../components/PurchasesTable'
import {
  fetchPurchaseVouchers,
  hasActiveAuthToken,
  isAdminUser,
} from '../services/purchaseService'
import '../styles/purchases.css'

const PAGE_LIMIT = 10

export function PurchasesPage({ currentUser, onNavigate }) {
  const adminAccess = isAdminUser(currentUser)
  const [authRequired, setAuthRequired] = useState(() => !hasActiveAuthToken())

  const [vouchers, setVouchers] = useState([])
  const [totalVouchers, setTotalVouchers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [summary, setSummary] = useState({
    activeCount: 0,
    cancelledCount: 0,
    activeTotalAmount: 0,
    withAttachmentCount: 0,
  })

  const [projects, setProjects] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch((prev) => {
        const next = searchInput.trim()
        if (prev !== next) {
          setCurrentPage(1)
        }
        return next
      })
    }, 280)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!hasActiveAuthToken()) {
      return undefined
    }
    let cancelled = false
    fetchProjects({ page: 1, limit: 100 })
      .then((res) => {
        if (!cancelled) {
          setProjects(res.projects || [])
        }
      })
      .catch(() => {
        void 0
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasActiveAuthToken()) {
      return undefined
    }

    let cancelled = false

    fetchPurchaseVouchers({
      page: currentPage,
      limit: PAGE_LIMIT,
      search: appliedSearch,
      projectId: projectFilter,
      fromDate,
      toDate,
      status: statusFilter,
    })
      .then((result) => {
        if (cancelled) return
        hasLoadedOnceRef.current = true
        setAuthRequired(false)
        setVouchers(result.vouchers)
        setTotalVouchers(result.total)
        setTotalPages(result.totalPages)
        setSummary(result.summary)
        setError('')
        setIsLoading(false)
        setIsRefreshing(false)
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.status === 401) {
          setAuthRequired(true)
        } else {
          setError(err?.message || 'Unable to load purchase vouchers.')
        }
        setIsLoading(false)
        setIsRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    currentPage,
    appliedSearch,
    projectFilter,
    fromDate,
    toDate,
    statusFilter,
    reloadTick,
  ])

  const triggerRefreshState = useCallback(() => {
    if (hasLoadedOnceRef.current) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
  }, [])

  const handleProjectFilterChange = useCallback(
    (val) => {
      triggerRefreshState()
      setProjectFilter(val)
      setCurrentPage(1)
    },
    [triggerRefreshState],
  )

  const handleFromDateChange = useCallback(
    (val) => {
      triggerRefreshState()
      setFromDate(val)
      setCurrentPage(1)
    },
    [triggerRefreshState],
  )

  const handleToDateChange = useCallback(
    (val) => {
      triggerRefreshState()
      setToDate(val)
      setCurrentPage(1)
    },
    [triggerRefreshState],
  )

  const handleStatusFilterChange = useCallback(
    (val) => {
      triggerRefreshState()
      setStatusFilter(val)
      setCurrentPage(1)
    },
    [triggerRefreshState],
  )

  const handleApplySearch = useCallback(() => {
    triggerRefreshState()
    setAppliedSearch(searchInput.trim())
    setCurrentPage(1)
  }, [searchInput, triggerRefreshState])

  const resetFilters = useCallback(() => {
    triggerRefreshState()
    setSearchInput('')
    setAppliedSearch('')
    setProjectFilter('all')
    setFromDate('')
    setToDate('')
    setStatusFilter('active')
    setCurrentPage(1)
  }, [triggerRefreshState])

  const reloadVouchers = useCallback(() => {
    triggerRefreshState()
    setError('')
    setReloadTick((prev) => prev + 1)
  }, [triggerRefreshState])

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      appliedSearch ||
        searchInput.trim() ||
        projectFilter !== 'all' ||
        fromDate ||
        toDate ||
        statusFilter !== 'active',
    )
  }, [appliedSearch, searchInput, projectFilter, fromDate, toDate, statusFilter])

  const rangeStart =
    totalVouchers === 0 ? 0 : (currentPage - 1) * PAGE_LIMIT + 1
  const rangeEnd = Math.min(totalVouchers, currentPage * PAGE_LIMIT)

  return (
    <div className="pv-page">
      <header className="pv-header">
        <div className="pv-header__text">
          <h1 className="pv-header__title">Purchases</h1>
          
        </div>

        {!authRequired ? (
          <div className="pv-header__actions">
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => onNavigate?.('/purchases/new')}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 4.5V15.5M4.5 10H15.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span>New Purchase Voucher</span>
            </button>
          </div>
        ) : null}
      </header>

      {authRequired ? (
        <section className="pv-surface">
          <div className="pv-state">
            <h2 className="pv-state__title">Sign in required</h2>
            <p className="pv-state__message">
              Please sign in with an approved Administrator or Data Entry
              account to view and record purchase vouchers.
            </p>
            <div className="pv-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => onNavigate?.('/login')}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <PurchasesSummaryStrip
            summary={summary}
            activeStatus={statusFilter}
            adminAccess={adminAccess}
            onSelectStatus={handleStatusFilterChange}
          />

          <section
            className={`pv-surface${
              isRefreshing ? ' pv-surface--refreshing' : ''
            }`}
            aria-label="Purchase vouchers directory"
          >
            <PurchasesFiltersBar
              searchQuery={searchInput}
              projectFilter={projectFilter}
              fromDate={fromDate}
              toDate={toDate}
              statusFilter={statusFilter}
              projects={projects}
              hasActiveFilters={hasActiveFilters}
              totalMatching={totalVouchers}
              onSearchChange={setSearchInput}
              onProjectFilterChange={handleProjectFilterChange}
              onFromDateChange={handleFromDateChange}
              onToDateChange={handleToDateChange}
              onStatusFilterChange={handleStatusFilterChange}
              onApplySearch={handleApplySearch}
              onResetFilters={resetFilters}
            />

            {isLoading ? (
              <div
                className="pv-loading"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                {[1, 2, 3, 4].map((idx) => (
                  <div key={idx} className="pv-skeleton-row" aria-hidden="true">
                    <div className="pv-skeleton-code" />
                    <div className="pv-skeleton-lines">
                      <div className="pv-skeleton-line pv-skeleton-line--title" />
                      <div className="pv-skeleton-line pv-skeleton-line--sub" />
                    </div>
                    <div className="pv-skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="pv-state" role="alert">
                <h2 className="pv-state__title">
                  Unable to load purchase vouchers
                </h2>
                <p className="pv-state__message">{error}</p>
                <div className="pv-state__actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    onClick={reloadVouchers}
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : vouchers.length === 0 ? (
              <div className="pv-state">
                {hasActiveFilters ? (
                  <>
                    <h2 className="pv-state__title">
                      No matching purchase vouchers
                    </h2>
                    <p className="pv-state__message">
                      No vouchers matched your search or filter criteria. Clear
                      filters to view all recorded purchases.
                    </p>
                    <div className="pv-state__actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary"
                        onClick={resetFilters}
                      >
                        Reset Filters
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="pv-state__title">
                      No purchase vouchers recorded yet
                    </h2>
                    <p className="pv-state__message">
                      Upload a supplier bill image or PDF to extract details
                      with local OCR, or enter a material purchase manually.
                    </p>
                    <div className="pv-state__actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        onClick={() => onNavigate?.('/purchases/new')}
                      >
                        New Purchase Voucher
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <PurchasesTable
                  vouchers={vouchers}
                  onViewVoucher={(id) =>
                    onNavigate?.(`/purchases/${encodeURIComponent(id)}`)
                  }
                  onEditVoucher={(id) =>
                    onNavigate?.(`/purchases/${encodeURIComponent(id)}/edit`)
                  }
                  onViewProject={(projId) =>
                    onNavigate?.(`/projects/${encodeURIComponent(projId)}`)
                  }
                />

                <PurchasesMobileList
                  vouchers={vouchers}
                  onViewVoucher={(id) =>
                    onNavigate?.(`/purchases/${encodeURIComponent(id)}`)
                  }
                  onEditVoucher={(id) =>
                    onNavigate?.(`/purchases/${encodeURIComponent(id)}/edit`)
                  }
                />

                <PurchasesPagination
                  activePage={currentPage}
                  totalPages={totalPages}
                  totalMatching={totalVouchers}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  onPageChange={(nextPage) => {
                    triggerRefreshState()
                    setCurrentPage(nextPage)
                  }}
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
