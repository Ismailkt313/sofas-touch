import { useCallback, useEffect, useMemo, useState } from 'react'
import { DatePicker, Dropdown, Pagination, calculatePreservedPage } from '../../../components/common'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'
import api, { ACTIVITY_UPDATED_EVENT } from '../../../services/api'
import {
  navigateBackOrFallback,
  useListingState,
} from '../../../services/navigationState'
import { hasPermission } from '../../permissions/constants/permissionsCatalog'
import { ActivityDetailsDrawer } from '../components/ActivityDetailsDrawer'
import { ActivityFeedItem } from '../components/ActivityFeedItem'
import { fetchActivityHistory } from '../services/activityService'
import {
  getActivityActionOptions,
  getActivityEntityOptions,
  groupActivitiesByDate,
} from '../utils/activityFormatters'
import '../styles/activity-page.css'

const PAGE_SIZE = 10

const ACTIVITY_LISTING_SCHEMA = {
  page: { type: 'number', default: 1, min: 1 },
  limit: { type: 'number', default: 10, min: 1 },
  search: { type: 'string', default: '' },
  entity: { type: 'string', default: 'all' },
  action: { type: 'string', default: 'all' },
  project: { type: 'string', default: 'all' },
  actor: { type: 'string', default: 'all' },
  fromDate: { type: 'string', default: '' },
  toDate: { type: 'string', default: '' },
}

export function ActivityHistoryPage({ currentUser, onNavigate }) {
  const canViewAll = hasPermission(currentUser, 'activity.viewAll')
  const canViewProjects = hasPermission(currentUser, 'projects.view')
  const canViewUsers = hasPermission(currentUser, 'users.view')
  const userRole = canViewAll ? 'admin' : 'data_entry'
  const isAdmin = canViewAll

  const { values, setValue, setValues, resetAll, clampPage } = useListingState(
    ACTIVITY_LISTING_SCHEMA,
    { routeKey: 'activity' },
  )

  const page = Math.max(1, parseInt(values.page, 10) || 1)
  const entityType = values.entity || 'all'
  const actionType = values.action || 'all'
  const projectId = values.project || 'all'
  const actorId = values.actor || 'all'
  const fromDate = values.fromDate || ''
  const toDate = values.toDate || ''
  const pageSize = parseInt(values.limit, 10) || PAGE_SIZE

  const [searchInput, setSearchInput] = useState(values.search || '')
  const [appliedSearch, setAppliedSearch] = useState(values.search || '')

  useEffect(() => {
    setSearchInput(values.search || '')
    setAppliedSearch(values.search || '')
  }, [values.search])

  const setPage = useCallback(
    (p) => {
      const targetPage = typeof p === 'function' ? p(page) : p
      setValue('page', Math.max(1, targetPage), { push: true })
    },
    [page, setValue],
  )

  const setEntityType = useCallback(
    (val) => {
      setValue('entity', val, { resetPage: true })
    },
    [setValue],
  )

  const setActionType = useCallback(
    (val) => {
      setValue('action', val, { resetPage: true })
    },
    [setValue],
  )

  const setProjectId = useCallback(
    (val) => {
      setValue('project', val, { resetPage: true })
    },
    [setValue],
  )

  const setActorId = useCallback(
    (val) => {
      setValue('actor', val, { resetPage: true })
    },
    [setValue],
  )

  const setFromDate = useCallback(
    (val) => {
      setValue('fromDate', val, { resetPage: true })
    },
    [setValue],
  )

  const setToDate = useCallback(
    (val) => {
      setValue('toDate', val, { resetPage: true })
    },
    [setValue],
  )

  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null)

  const [projectOptions, setProjectOptions] = useState([
    { value: 'all', label: 'All Projects' },
  ])
  const [actorOptions, setActorOptions] = useState([
    { value: 'all', label: 'All Employees' },
  ])

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [summaryMetrics, setSummaryMetrics] = useState({
    total: 0,
    today: 0,
    projects: 0,
    financial: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const entityOptions = useMemo(
    () => getActivityEntityOptions(userRole),
    [userRole],
  )
  const actionOptions = useMemo(
    () => getActivityActionOptions(userRole),
    [userRole],
  )

  const dateRangeError = useMemo(() => {
    if (fromDate && toDate && fromDate > toDate) {
      return 'From date cannot be later than To date.'
    }
    return ''
  }, [fromDate, toDate])

  // Fetch project options for filters
  useEffect(() => {
    let active = true
    if (canViewProjects) {
      api
        .get('/api/projects', { params: { page: 1, limit: 100 } })
        .then((res) => {
          if (!active) return
          const rows = Array.isArray(res?.data?.projects)
            ? res.data.projects
            : Array.isArray(res?.data?.items)
              ? res.data.items
              : []
          const mapped = rows.map((p) => ({
            value: String(p.projectId || p.id),
            label: `${p.projectId} — ${p.name}`,
          }))
          setProjectOptions([{ value: 'all', label: 'All Projects' }, ...mapped])
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [canViewProjects])

  // Fetch actor options for filters
  useEffect(() => {
    let active = true
    if (isAdmin && canViewUsers) {
      api
        .get('/api/users', { params: { page: 1, limit: 100 } })
        .then((res) => {
          if (!active) return
          const users = Array.isArray(res?.data?.users) ? res.data.users : []
          const mapped = users.map((u) => ({
            value: String(u.id || u._id),
            label: `${u.name} (${u.role === 'admin' ? 'Admin' : 'Data Entry'})`,
          }))
          setActorOptions([{ value: 'all', label: 'All Employees' }, ...mapped])
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [isAdmin, canViewUsers])

  // Debounced Search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const clean = searchInput.trim()
      if (clean !== appliedSearch) {
        setAppliedSearch(clean)
        setValue('search', clean, { resetPage: true })
      }
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchInput, appliedSearch, setValue])

  // Core Data Fetcher
  const loadActivities = useCallback(
    async (isManualRefresh = false) => {
      if (dateRangeError) return

      if (isManualRefresh) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      setErrorMessage('')

      try {
        const result = await fetchActivityHistory({
          page,
          limit: pageSize,
          entityType,
          actionType,
          projectId,
          actorId,
          fromDate,
          toDate,
          search: appliedSearch,
        })

        setItems(result.items)
        setTotal(result.total)
        setTotalPages(result.totalPages)
        if (result.summary) {
          setSummaryMetrics(result.summary)
        }
        clampPage(result.totalPages)
      } catch (error) {
        setErrorMessage(
          error?.response?.data?.message ||
            error?.message ||
            'Unable to load activity history. Please try again.',
        )
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [
      dateRangeError,
      page,
      pageSize,
      entityType,
      actionType,
      projectId,
      actorId,
      fromDate,
      toDate,
      appliedSearch,
      clampPage,
    ],
  )

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  // Listen for broadcasted activity updates from other tabs / actions
  useEffect(() => {
    const handleBroadcast = () => {
      loadActivities()
    }
    window.addEventListener(ACTIVITY_UPDATED_EVENT, handleBroadcast)
    return () => {
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, handleBroadcast)
    }
  }, [loadActivities])

  const handleResetFilters = useCallback(() => {
    setSearchInput('')
    setAppliedSearch('')
    resetAll()
  }, [resetAll])

  const hasAnyFilter = useMemo(() => {
    return (
      Boolean(appliedSearch) ||
      entityType !== 'all' ||
      actionType !== 'all' ||
      projectId !== 'all' ||
      actorId !== 'all' ||
      Boolean(fromDate) ||
      Boolean(toDate)
    )
  }, [
    appliedSearch,
    entityType,
    actionType,
    projectId,
    actorId,
    fromDate,
    toDate,
  ])

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips = []
    if (appliedSearch) {
      chips.push({
        id: 'search',
        label: `Search: "${appliedSearch}"`,
        onRemove: () => {
          setSearchInput('')
          setAppliedSearch('')
          setValue('search', '', { resetPage: true })
        },
      })
    }
    if (entityType !== 'all') {
      const match = entityOptions.find((o) => o.value === entityType)
      chips.push({
        id: 'entity',
        label: `Module: ${match?.label || entityType}`,
        onRemove: () => setEntityType('all'),
      })
    }
    if (actionType !== 'all') {
      const match = actionOptions.find((o) => o.value === actionType)
      chips.push({
        id: 'action',
        label: `Action: ${match?.label || actionType}`,
        onRemove: () => setActionType('all'),
      })
    }
    if (projectId !== 'all') {
      const match = projectOptions.find((o) => o.value === projectId)
      chips.push({
        id: 'project',
        label: `Project: ${match?.label || projectId}`,
        onRemove: () => setProjectId('all'),
      })
    }
    if (actorId !== 'all') {
      const match = actorOptions.find((o) => o.value === actorId)
      chips.push({
        id: 'actor',
        label: `Employee: ${match?.label || actorId}`,
        onRemove: () => setActorId('all'),
      })
    }
    if (fromDate) {
      chips.push({
        id: 'fromDate',
        label: `From: ${fromDate}`,
        onRemove: () => setFromDate(''),
      })
    }
    if (toDate) {
      chips.push({
        id: 'toDate',
        label: `To: ${toDate}`,
        onRemove: () => setToDate(''),
      })
    }
    return chips
  }, [
    appliedSearch,
    entityType,
    actionType,
    projectId,
    actorId,
    fromDate,
    toDate,
    entityOptions,
    actionOptions,
    projectOptions,
    actorOptions,
    setValue,
    setEntityType,
    setActionType,
    setProjectId,
    setActorId,
    setFromDate,
    setToDate,
  ])

  // Group items by date (Today, Yesterday, 30 Oct 2026, etc.)
  const groupedItems = useMemo(() => {
    return groupActivitiesByDate(items)
  }, [items])

  const renderFilterFields = () => (
    <>
      <div className="sts-act-filter-field">
        <label className="sts-act-filter-label" htmlFor="sts-act-module-filter">
          Module
        </label>
        <Dropdown
          id="sts-act-module-filter"
          value={entityType}
          onChange={setEntityType}
          options={entityOptions}
          variant="filter"
          ariaLabel="Filter by module"
        />
      </div>

      <div className="sts-act-filter-field">
        <label className="sts-act-filter-label" htmlFor="sts-act-action-filter">
          Activity Type
        </label>
        <Dropdown
          id="sts-act-action-filter"
          value={actionType}
          onChange={setActionType}
          options={actionOptions}
          variant="filter"
          ariaLabel="Filter by activity type"
        />
      </div>

      {isAdmin ? (
        <div className="sts-act-filter-field">
          <label className="sts-act-filter-label" htmlFor="sts-act-actor-filter">
            Employee
          </label>
          <Dropdown
            id="sts-act-actor-filter"
            value={actorId}
            onChange={setActorId}
            options={actorOptions}
            variant="filter"
            ariaLabel="Filter by employee"
          />
        </div>
      ) : null}

      {canViewProjects ? (
        <div className="sts-act-filter-field">
          <label className="sts-act-filter-label" htmlFor="sts-act-project-filter">
            Project
          </label>
          <Dropdown
            id="sts-act-project-filter"
            value={projectId}
            onChange={setProjectId}
            options={projectOptions}
            variant="filter"
            ariaLabel="Filter by project"
          />
        </div>
      ) : null}

      <div className="sts-act-filter-field">
        <label className="sts-act-filter-label">From Date</label>
        <DatePicker
          value={fromDate}
          onChange={setFromDate}
          variant="filter"
          ariaLabel="Filter from activity date"
          placeholder="From"
        />
      </div>

      <div className="sts-act-filter-field">
        <label className="sts-act-filter-label">To Date</label>
        <DatePicker
          value={toDate}
          onChange={setToDate}
          variant="filter"
          ariaLabel="Filter to activity date"
          placeholder="To"
        />
      </div>
    </>
  )

  const startRecordNum = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecordNum = Math.min(total, page * pageSize)

  const handlePageSizeChange = (nextLimit) => {
    const newPage = calculatePreservedPage(page, pageSize, nextLimit, total)
    setValues({ page: newPage, limit: nextLimit })
  }

  return (
    <section className="sts-act-page" aria-labelledby="sts-act-page-heading">
      {/* 1. Header */}
      <header className="sts-act-page__header">
        <div>
          <h1 id="sts-act-page-heading" className="sts-act-page__title">
            {isAdmin ? 'Activity History' : 'My Activity History'}
          </h1>
          <p className="sts-act-page__desc">
            Track important changes and actions performed across your workspace.
          </p>
        </div>

        <div className="sts-act-page__header-actions">
          <button
            type="button"
            className="sts-act-page__btn sts-act-page__btn--ghost"
            onClick={() => navigateBackOrFallback(onNavigate, '/dashboard')}
          >
            Back to Dashboard
          </button>
          <button
            type="button"
            className="sts-act-page__btn sts-act-page__btn--primary sts-act-refresh-btn"
            onClick={() => loadActivities(true)}
            disabled={loading || isRefreshing}
            aria-label="Refresh activity history"
          >
            <svg
              className={`sts-act-refresh-icon${
                isRefreshing || loading ? ' sts-act-refresh-icon--spinning' : ''
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                clipRule="evenodd"
              />
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </header>

      {/* 2. Summary Cards */}
      <section
        className="sts-act-summary-grid"
        aria-label="Activity statistics summary"
      >
        <div className="sts-act-summary-card">
          <div className="sts-act-summary-card__top">
            <span className="sts-act-summary-card__label">Total Activities</span>
            <span className="sts-act-summary-card__icon sts-act-summary-card__icon--neutral">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path
                  fillRule="evenodd"
                  d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
          <div className="sts-act-summary-card__value">
            {summaryMetrics.total.toLocaleString('en-IN')}
          </div>
          <span className="sts-act-summary-card__hint">
            All-time workspace audit records
          </span>
        </div>

        <div className="sts-act-summary-card">
          <div className="sts-act-summary-card__top">
            <span className="sts-act-summary-card__label">Today's Actions</span>
            <span className="sts-act-summary-card__icon sts-act-summary-card__icon--success">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
          <div className="sts-act-summary-card__value">
            {summaryMetrics.today.toLocaleString('en-IN')}
          </div>
          <span className="sts-act-summary-card__hint">
            Actions logged since midnight
          </span>
        </div>

        <div className="sts-act-summary-card">
          <div className="sts-act-summary-card__top">
            <span className="sts-act-summary-card__label">Project Activities</span>
            <span className="sts-act-summary-card__icon sts-act-summary-card__icon--info">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            </span>
          </div>
          <div className="sts-act-summary-card__value">
            {summaryMetrics.projects.toLocaleString('en-IN')}
          </div>
          <span className="sts-act-summary-card__hint">
            Project setups &amp; milestones
          </span>
        </div>

        <div className="sts-act-summary-card">
          <div className="sts-act-summary-card__top">
            <span className="sts-act-summary-card__label">
              Procurement &amp; Expenses
            </span>
            <span className="sts-act-summary-card__icon sts-act-summary-card__icon--warning">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
          <div className="sts-act-summary-card__value">
            {summaryMetrics.financial.toLocaleString('en-IN')}
          </div>
          <span className="sts-act-summary-card__hint">
            Purchases, bills &amp; expense vouchers
          </span>
        </div>
      </section>

      {/* 3. Search and Filters */}
      <div className="sts-act-surface sts-act-filters">
        <div className="sts-act-filters__top">
          <div className="sts-act-search">
            <svg
              className="sts-act-search__icon"
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
              className="sts-act-search__input"
              placeholder="Search by activity, employee, voucher or project..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search activity history"
            />
          </div>

          <div className="sts-act-filters__mobile-btn">
            <MobileFilterButton
              activeCount={activeChips.length}
              onClick={() => setIsMobileSheetOpen(true)}
            />
          </div>
        </div>

        <div className="sts-act-filters__desktop-grid">
          {renderFilterFields()}
        </div>

        {dateRangeError ? (
          <p className="sts-act-filters__error" role="alert">
            {dateRangeError}
          </p>
        ) : null}

        {activeChips.length > 0 ? (
          <div className="sts-act-filters__chips">
            <ActiveFilterChips
              chips={activeChips}
              onClearAll={handleResetFilters}
            />
          </div>
        ) : null}
      </div>

      {/* Mobile Filter Sheet */}
      <MobileFilterSheet
        isOpen={isMobileSheetOpen}
        title="Filter Activity History"
        activeCount={activeChips.length}
        canReset={activeChips.length > 0}
        onClose={() => setIsMobileSheetOpen(false)}
        onReset={handleResetFilters}
        onApply={() => setIsMobileSheetOpen(false)}
      >
        <div className="sts-act-mobile-sheet-grid">{renderFilterFields()}</div>
      </MobileFilterSheet>

      {/* 4. Activity Timeline Feed */}
      <div className="sts-act-surface sts-act-feed-card">
        <div className="sts-act-feed-card__meta">
          <span className="sts-act-feed-card__count">
            {loading ? (
              'Loading activity records...'
            ) : total > 0 ? (
              <>
                Showing <strong>{startRecordNum}</strong>&ndash;
                <strong>{endRecordNum}</strong> of{' '}
                <strong>{total.toLocaleString('en-IN')}</strong> matching{' '}
                {total === 1 ? 'event' : 'events'}
              </>
            ) : (
              '0 matching events'
            )}
          </span>

          {hasAnyFilter ? (
            <button
              type="button"
              className="sts-act-feed-card__clear"
              onClick={handleResetFilters}
            >
              Reset all filters
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="sts-act-feed-card__state" role="status">
            <div className="sts-act-skeleton-row" />
            <div className="sts-act-skeleton-row" />
            <div className="sts-act-skeleton-row" />
            <div className="sts-act-skeleton-row" />
          </div>
        ) : errorMessage ? (
          <div className="sts-act-feed-card__state" role="alert">
            <p className="sts-act-feed-card__state-title">
              Could not load activity history
            </p>
            <p className="sts-act-feed-card__state-sub">{errorMessage}</p>
            <button
              type="button"
              className="sts-act-page__btn sts-act-page__btn--primary"
              onClick={() => loadActivities()}
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="sts-act-feed-card__state">
            <p className="sts-act-feed-card__state-title">
              {hasAnyFilter
                ? 'No matching activity records'
                : 'No activity recorded yet'}
            </p>
            <p className="sts-act-feed-card__state-sub">
              {hasAnyFilter
                ? 'Try broadening your search terms, employee, project, or date range filters.'
                : 'Completed operations across projects, purchases, expenses, and materials will be logged here.'}
            </p>
          </div>
        ) : (
          <div className="sts-act-timeline">
            {groupedItems.map((group) => (
              <div key={group.label} className="sts-act-date-group">
                <div className="sts-act-date-group__header">
                  <span className="sts-act-date-group__label">
                    {group.label}
                  </span>
                  <span className="sts-act-date-group__line" aria-hidden="true" />
                </div>

                <ul
                  className="sts-act-feed-list"
                  aria-label={`Activities for ${group.label}`}
                >
                  {group.items.map((item) => (
                    <ActivityFeedItem
                      key={item.id}
                      item={item}
                      userRole={userRole}
                      onNavigate={onNavigate}
                      onSelect={(selected) => setSelectedActivity(selected)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* 5. Pagination */}
        {!loading && !errorMessage && total > 0 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            pageSizeOptions={[10, 20, 50]}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            itemName="activity"
            itemsName="activities"
          />
        ) : null}
      </div>

      {/* 6. Activity Details Drawer */}
      <ActivityDetailsDrawer
        item={selectedActivity}
        userRole={userRole}
        onClose={() => setSelectedActivity(null)}
        onNavigate={onNavigate}
      />
    </section>
  )
}

export default ActivityHistoryPage
