import { useListingState } from '../../../services/navigationState'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dropdown, DatePicker } from '../../../components/common'
import {
  ActiveFilterChips,
  MobileFilterButton,
  MobileFilterSheet,
} from '../../../components/responsive'
import api, { ACTIVITY_UPDATED_EVENT } from '../../../services/api'
import { hasPermission } from '../../permissions/constants/permissionsCatalog'
import { ActivityFeedItem } from '../components/ActivityFeedItem'
import { fetchActivityHistory } from '../services/activityService'
import {
  getActivityActionOptions,
  getActivityEntityOptions,
} from '../utils/activityFormatters'
import '../styles/activity-page.css'

const PAGE_SIZE = 20
const ACTIVITY_LISTING_SCHEMA = {
  page: { type: 'number', default: 1, min: 1 },
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

  const { values, setValue, resetAll, clampPage } = useListingState(ACTIVITY_LISTING_SCHEMA, {
    routeKey: 'activity',
  })

  const page = values.page
  const entityType = values.entity
  const actionType = values.action
  const projectId = values.project
  const actorId = values.actor
  const fromDate = values.fromDate
  const toDate = values.toDate

  const [searchInput, setSearchInput] = useState(values.search)
  const [appliedSearch, setAppliedSearch] = useState(values.search)

  useEffect(() => {
    setSearchInput(values.search)
    setAppliedSearch(values.search)
  }, [values.search])

  const setPage = useCallback((p) => {
    setValue('page', p, { push: true })
  }, [setValue])

  const setEntityType = useCallback((val) => {
    setValue('entity', val, { resetPage: true })
  }, [setValue])

  const setActionType = useCallback((val) => {
    setValue('action', val, { resetPage: true })
  }, [setValue])

  const setProjectId = useCallback((val) => {
    setValue('project', val, { resetPage: true })
  }, [setValue])

  const setActorId = useCallback((val) => {
    setValue('actor', val, { resetPage: true })
  }, [setValue])

  const setFromDate = useCallback((val) => {
    setValue('fromDate', val, { resetPage: true })
  }, [setValue])

  const setToDate = useCallback((val) => {
    setValue('toDate', val, { resetPage: true })
  }, [setValue])
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)

  const [projectOptions, setProjectOptions] = useState([
    { value: 'all', label: 'All Projects' },
  ])
  const [actorOptions, setActorOptions] = useState([
    { value: 'all', label: 'All Actors' },
  ])

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
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
          setActorOptions([{ value: 'all', label: 'All Actors' }, ...mapped])
        })
        .catch(() => {})
    }

    return () => {
      active = false
    }
  }, [isAdmin, canViewProjects, canViewUsers])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchInput.trim())
      setPage(1)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadActivities = useCallback(async () => {
    if (dateRangeError) return

    setLoading(true)
    setErrorMessage('')

    try {
      const result = await fetchActivityHistory({
        page,
        limit: PAGE_SIZE,
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
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message ||
          'Unable to load activity history. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }, [
    dateRangeError,
    page,
    entityType,
    actionType,
    projectId,
    actorId,
    fromDate,
    toDate,
    appliedSearch,
  ])

  useEffect(() => {
    let active = true
    if (dateRangeError) {
      return undefined
    }

    fetchActivityHistory({
      page,
      limit: PAGE_SIZE,
      entityType,
      actionType,
      projectId,
      actorId,
      fromDate,
      toDate,
      search: appliedSearch,
    })
      .then((result) => {
        if (!active) return
        setItems(result.items)
        setTotal(result.total)
        setTotalPages(result.totalPages)
        setErrorMessage('')
        setLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setErrorMessage(
          error?.response?.data?.message ||
            'Unable to load activity history. Please try again.',
        )
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [
    dateRangeError,
    page,
    entityType,
    actionType,
    projectId,
    actorId,
    fromDate,
    toDate,
    appliedSearch,
  ])

  useEffect(() => {
    const handleBroadcast = () => {
      loadActivities()
    }
    window.addEventListener(ACTIVITY_UPDATED_EVENT, handleBroadcast)
    return () =>
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, handleBroadcast)
  }, [loadActivities])

  const handleResetFilters = useCallback(() => {
    setSearchInput('')
    setAppliedSearch('')
    setEntityType('all')
    setActionType('all')
    setProjectId('all')
    setActorId('all')
    setFromDate('')
    setToDate('')
    setPage(1)
  }, [])

  const activeChips = useMemo(() => {
    const chips = []

    if (entityType !== 'all') {
      const opt = entityOptions.find((o) => o.value === entityType)
      chips.push({
        key: 'entityType',
        label: `Module: ${opt?.label || entityType}`,
        onRemove: () => {
          setEntityType('all')
          setPage(1)
        },
      })
    }

    if (actionType !== 'all') {
      const opt = actionOptions.find((o) => o.value === actionType)
      chips.push({
        key: 'actionType',
        label: `Action: ${opt?.label || actionType}`,
        onRemove: () => {
          setActionType('all')
          setPage(1)
        },
      })
    }

    if (projectId !== 'all') {
      chips.push({
        key: 'projectId',
        label: `Project: ${projectId}`,
        onRemove: () => {
          setProjectId('all')
          setPage(1)
        },
      })
    }

    if (actorId !== 'all') {
      const opt = actorOptions.find((o) => o.value === actorId)
      chips.push({
        key: 'actorId',
        label: `Actor: ${opt?.label || 'Selected User'}`,
        onRemove: () => {
          setActorId('all')
          setPage(1)
        },
      })
    }

    if (fromDate) {
      chips.push({
        key: 'fromDate',
        label: `From: ${fromDate}`,
        onRemove: () => {
          setFromDate('')
          setPage(1)
        },
      })
    }

    if (toDate) {
      chips.push({
        key: 'toDate',
        label: `To: ${toDate}`,
        onRemove: () => {
          setToDate('')
          setPage(1)
        },
      })
    }

    return chips
  }, [
    entityType,
    entityOptions,
    actionType,
    actionOptions,
    projectId,
    actorId,
    actorOptions,
    fromDate,
    toDate,
  ])

  const hasAnyFilter = Boolean(appliedSearch || activeChips.length > 0)

  const renderFilterFields = () => (
    <>
      <div className="sts-act-field">
        <span className="sts-act-field__label">Module</span>
        <Dropdown
          value={entityType}
          options={entityOptions}
          onChange={(val) => {
            setEntityType(val)
            setPage(1)
          }}
          placeholder="All Modules"
          ariaLabel="Filter by module"
        />
      </div>

      <div className="sts-act-field">
        <span className="sts-act-field__label">Action Type</span>
        <Dropdown
          value={actionType}
          options={actionOptions}
          onChange={(val) => {
            setActionType(val)
            setPage(1)
          }}
          placeholder="All Actions"
          ariaLabel="Filter by action type"
        />
      </div>

      <div className="sts-act-field">
        <span className="sts-act-field__label">Project</span>
        <Dropdown
          value={projectId}
          options={projectOptions}
          onChange={(val) => {
            setProjectId(val)
            setPage(1)
          }}
          placeholder="All Projects"
          ariaLabel="Filter by project"
        />
      </div>

      {isAdmin ? (
        <div className="sts-act-field">
          <span className="sts-act-field__label">Actor</span>
          <Dropdown
            value={actorId}
            options={actorOptions}
            onChange={(val) => {
              setActorId(val)
              setPage(1)
            }}
            placeholder="All Actors"
            ariaLabel="Filter by actor"
          />
        </div>
      ) : null}

      <div className="sts-act-field">
        <span className="sts-act-field__label">From Date</span>
        <DatePicker
          value={fromDate}
          onChange={(val) => {
            setFromDate(val)
            setPage(1)
          }}
          maxDate={toDate || undefined}
          variant="filter"
          ariaLabel="Filter from activity date"
          placeholder="From"
        />
      </div>

      <div className="sts-act-field">
        <span className="sts-act-field__label">To Date</span>
        <DatePicker
          value={toDate}
          onChange={(val) => {
            setToDate(val)
            setPage(1)
          }}
          minDate={fromDate || undefined}
          variant="filter"
          ariaLabel="Filter to activity date"
          placeholder="To"
        />
      </div>
    </>
  )

  return (
    <section className="sts-act-page" aria-labelledby="sts-act-page-heading">
      <header className="sts-act-page__header">
        <div>
          <span className="sts-act-page__eyebrow">
            {isAdmin ? 'Operational Audit Trail' : 'Personal Entry Log'}
          </span>
          <h1 id="sts-act-page-heading" className="sts-act-page__title">
            {isAdmin ? 'Activity History' : 'My Activity History'}
          </h1>
          <p className="sts-act-page__desc">
            {isAdmin
              ? 'Chronological log of verified actions across projects, purchases, expenses, raw materials, permissions, and user accounts.'
              : 'Chronological log of verified vouchers and updates recorded under your operator account.'}
          </p>
        </div>

        <div className="sts-act-page__header-actions">
          <button
            type="button"
            className="sts-act-page__btn sts-act-page__btn--ghost"
            onClick={() => onNavigate?.('/dashboard')}
          >
            Back to Dashboard
          </button>
          <button
            type="button"
            className="sts-act-page__btn sts-act-page__btn--primary"
            onClick={loadActivities}
            disabled={loading}
          >
            Refresh Log
          </button>
        </div>
      </header>

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
              placeholder="Search by description, actor name, voucher, or project..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setLoading(true)
              }}
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

      <div className="sts-act-surface sts-act-feed-card">
        <div className="sts-act-feed-card__meta">
          <span>
            {loading
              ? 'Loading activity records...'
              : `${total.toLocaleString('en-IN')} recorded ${total === 1 ? 'event' : 'events'}`}
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
            <div className="sts-activity-dock__skeleton" />
            <div className="sts-activity-dock__skeleton" />
            <div className="sts-activity-dock__skeleton" />
            <div className="sts-activity-dock__skeleton" />
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
              onClick={loadActivities}
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
                ? 'Try broadening your search terms, actor, project, or date range filters.'
                : 'Completed operations across projects, purchases, expenses, and materials will be logged here.'}
            </p>
          </div>
        ) : (
          <ul className="sts-act-feed-list" aria-label="Activity history list">
            {items.map((item) => (
              <ActivityFeedItem
                key={item.id}
                item={item}
                userRole={currentUser || userRole}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}

        {!loading && !errorMessage && totalPages > 1 ? (
          <nav
            className="sts-act-pagination"
            aria-label="Activity history pagination"
          >
            <button
              type="button"
              className="sts-act-page__btn sts-act-page__btn--ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="sts-act-pagination__info">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              type="button"
              className="sts-act-page__btn sts-act-page__btn--ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>
    </section>
  )
}
