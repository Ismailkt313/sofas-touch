import { useListingState } from '../../../services/navigationState'
import { calculatePreservedPage } from '../../../components/common/paginationUtils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hasPermission } from '../../permissions/constants/permissionsCatalog'
import { fetchProjects } from '../../projects'
import { PurchasesFiltersBar } from '../components/PurchasesFiltersBar'
import { PurchasesMobileList } from '../components/PurchasesMobileList'
import { Pagination } from '../../../components/common/Pagination'
import { PurchasesSummaryStrip } from '../components/PurchasesSummaryStrip'
import { PurchasesTable } from '../components/PurchasesTable'
import {
  fetchPurchaseVouchers,
  hasActiveAuthToken,
} from '../services/purchaseService'
import '../styles/purchases.css'

const DEFAULT_PAGE_SIZE = 10
const PURCHASES_LISTING_SCHEMA = {
  page: { type: 'number', default: 1, min: 1 },
  limit: { type: 'number', default: 10, min: 1 },
  search: { type: 'string', default: '' },
  project: { type: 'string', default: 'all' },
  fromDate: { type: 'string', default: '' },
  toDate: { type: 'string', default: '' },
  status: { type: 'string', default: 'active' },
}


export function PurchasesPage({ currentUser, onNavigate }) {
  const canCreateVoucher = hasPermission(currentUser, 'purchases.create')
  const canEditVoucher = hasPermission(currentUser, 'purchases.edit')
  const canDeleteVoucher = hasPermission(currentUser, 'purchases.delete')
  const canViewProjects = hasPermission(currentUser, 'projects.view')
  const [authRequired, setAuthRequired] = useState(() => !hasActiveAuthToken())

  const { values, setValue, setValues, resetAll, clampPage } = useListingState(PURCHASES_LISTING_SCHEMA, {
    routeKey: 'purchases',
  })

  const [vouchers, setVouchers] = useState([])
  const [totalVouchers, setTotalVouchers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const currentPage = values.page
  const projectFilter = values.project
  const fromDate = values.fromDate
  const toDate = values.toDate
  const statusFilter = values.status
  const pageSize = values.limit || DEFAULT_PAGE_SIZE

  const setCurrentPage = useCallback(
    (pageNumber) => setValue('page', pageNumber, { push: true }),
    [setValue],
  )

  const [summary, setSummary] = useState({
    activeCount: 0,
    cancelledCount: 0,
    activeTotalAmount: 0,
    withAttachmentCount: 0,
  })

  const [projects, setProjects] = useState([])
  const [searchInput, setSearchInput] = useState(values.search)
  const [appliedSearch, setAppliedSearch] = useState(values.search)

  useEffect(() => {
    setSearchInput(values.search)
    setAppliedSearch(values.search)
  }, [values.search])

  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim()
      setAppliedSearch(next)
      if (next !== values.search) {
        setValue('search', next, { resetPage: true })
      }
    }, 280)

    return () => window.clearTimeout(timer)
  }, [searchInput, values.search, setValue])

  useEffect(() => {
    if (!hasActiveAuthToken() || !canViewProjects) {
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
  }, [canViewProjects])

  useEffect(() => {
    if (!hasActiveAuthToken()) {
      return undefined
    }

    let cancelled = false

    fetchPurchaseVouchers({
      page: currentPage,
      limit: pageSize,
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
        if (result.totalPages >= 1 && currentPage > result.totalPages) {
          clampPage(result.totalPages)
        }
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
    pageSize,
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
      setValue('project', val, { resetPage: true })
    },
    [triggerRefreshState, setValue],
  )

  const handleFromDateChange = useCallback(
    (val) => {
      triggerRefreshState()
      setValue('fromDate', val, { resetPage: true })
    },
    [triggerRefreshState, setValue],
  )

  const handleToDateChange = useCallback(
    (val) => {
      triggerRefreshState()
      setValue('toDate', val, { resetPage: true })
    },
    [triggerRefreshState, setValue],
  )

  const handleStatusFilterChange = useCallback(
    (val) => {
      triggerRefreshState()
      setValue('status', val, { resetPage: true })
    },
    [triggerRefreshState, setValue],
  )

  const handleApplySearch = useCallback(() => {
    triggerRefreshState()
    const clean = searchInput.trim()
    setAppliedSearch(clean)
    setValue('search', clean, { resetPage: true })
  }, [searchInput, triggerRefreshState, setValue])

  const resetFilters = useCallback(() => {
    triggerRefreshState()
    setSearchInput('')
    setAppliedSearch('')
    resetAll()
  }, [triggerRefreshState, resetAll])

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
    totalVouchers === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(totalVouchers, currentPage * pageSize)

  const handlePageSizeChange = (nextLimit) => {
    const newPage = calculatePreservedPage(
      currentPage,
      pageSize,
      nextLimit,
      totalVouchers,
    )
    triggerRefreshState()
    setValues({ page: newPage, limit: nextLimit })
  }

  return (
    <div className="pv-page">
      <header className="pv-header">
        <div className="pv-header__text">
          <h1 className="pv-header__title">Purchases</h1>
          
        </div>

        {!authRequired && canCreateVoucher ? (
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
              <span className="pv-header__btn-label pv-header__btn-label--full">New Purchase Voucher</span>
              <span className="pv-header__btn-label pv-header__btn-label--short">New Voucher</span>
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
            adminAccess={canDeleteVoucher}
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
                    {canCreateVoucher ? (
                      <div className="pv-state__actions">
                        <button
                          type="button"
                          className="admin-btn admin-btn--primary"
                          onClick={() => onNavigate?.('/purchases/new')}
                        >
                          New Purchase Voucher
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <>
                <PurchasesTable
                  vouchers={vouchers}
                  canEditVoucher={canEditVoucher}
                  onViewVoucher={(id) =>
                    onNavigate?.(`/purchases/${encodeURIComponent(id)}`)
                  }
                  onEditVoucher={(id) =>
                    onNavigate?.(`/purchases/${encodeURIComponent(id)}/edit`)
                  }
                  onViewProject={
                    canViewProjects
                      ? (projId) =>
                          onNavigate?.(
                            `/projects/${encodeURIComponent(projId)}`,
                          )
                      : null
                  }
                />

                <PurchasesMobileList
                  vouchers={vouchers}
                  canEditVoucher={canEditVoucher}
                  onViewVoucher={(id) =>
                    onNavigate?.(`/purchases/${encodeURIComponent(id)}`)
                  }
                  onEditVoucher={(id) =>
                    onNavigate?.(`/purchases/${encodeURIComponent(id)}/edit`)
                  }
                />

                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  totalItems={totalVouchers}
                  pageSize={pageSize}
                  pageSizeOptions={[10, 20, 50]}
                  onPageChange={(nextPage) => {
                    triggerRefreshState()
                    setCurrentPage(nextPage)
                  }}
                  onPageSizeChange={handlePageSizeChange}
                  itemName="purchase voucher"
                  itemsName="purchase vouchers"
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
