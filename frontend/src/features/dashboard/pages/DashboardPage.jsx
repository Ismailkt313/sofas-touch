import { useCallback, useEffect, useMemo, useState } from 'react'
import { ACTIVITY_UPDATED_EVENT } from '../../../services/api'
import { useApprovalsContext } from '../../approvals/context/ApprovalsContext'
import {
  hasAllPermissions,
  hasPermission,
  normalizeRoleKey,
} from '../../permissions/constants/permissionsCatalog'
import { DashboardKpiGrid } from '../components/DashboardKpiGrid'
import { MonthlyExpenseSection } from '../components/MonthlyExpenseSection'
import { OperationalDashboardView } from '../components/OperationalDashboardView'
import { PendingApprovalsCard } from '../components/PendingApprovalsCard'
import { RecentTransactionsCard } from '../components/RecentTransactionsCard'
import { StockAlertsCard } from '../components/StockAlertsCard'
import {
  fetchDashboardMonthlyExpenses,
  fetchDashboardOverview,
} from '../services/dashboardService'
import '../styles/dashboard.css'

export function DashboardPage({ currentUser, onNavigate }) {
  const isAdmin = normalizeRoleKey(currentUser?.role) === 'admin'
  const canViewProfitability = hasPermission(
    currentUser,
    'reports.viewProfitability',
  )
  const canViewReports = hasAllPermissions(currentUser, [
    'reports.view',
    'reports.viewProfitability',
  ])
  const canCreatePurchase = hasPermission(currentUser, 'purchases.create')
  const canCreateExpense = hasPermission(currentUser, 'expenses.create')
  const canViewProjects = hasPermission(currentUser, 'projects.view')
  const canViewPurchases = hasPermission(currentUser, 'purchases.view')
  const canViewExpenses = hasPermission(currentUser, 'expenses.view')
  const canViewMaterials = hasPermission(currentUser, 'materials.view')
  const canApproveUsers = hasPermission(currentUser, 'users.approve')

  const { pendingCount } = useApprovalsContext()

  const [overview, setOverview] = useState(null)
  const [monthlyOverride, setMonthlyOverride] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [monthlyLoading, setMonthlyLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [projectStatus, setProjectStatus] = useState('all')
  const [projectSortBy, setProjectSortBy] = useState('totalCost')
  const [projectSortOrder, setProjectSortOrder] = useState('desc')

  const [periodPreset, setPeriodPreset] = useState('6')
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')

  const dateRangeError = useMemo(() => {
    if (
      periodPreset === 'custom' &&
      customFromDate &&
      customToDate &&
      customFromDate > customToDate
    ) {
      return 'From date cannot be later than To date.'
    }
    return ''
  }, [periodPreset, customFromDate, customToDate])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(searchInput.trim())
    }, 260)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const buildOverviewQuery = useCallback(() => {
    const query = {
      projectStatus,
      projectSearch: appliedSearch,
      projectSortBy,
      projectSortOrder,
      recentLimit: 6,
    }
    if (periodPreset === 'custom') {
      if (customFromDate) query.expenseFromDate = customFromDate
      if (customToDate) query.expenseToDate = customToDate
    } else {
      query.expenseMonths = Number(periodPreset) || 6
    }
    return query
  }, [
    projectStatus,
    appliedSearch,
    projectSortBy,
    projectSortOrder,
    periodPreset,
    customFromDate,
    customToDate,
  ])

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (dateRangeError) return

      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setErrorMessage('')

      try {
        const data = await fetchDashboardOverview(buildOverviewQuery())
        setOverview(data)
        setMonthlyOverride(null)
      } catch (error) {
        const msg =
          error?.response?.data?.message ||
          'Unable to load dashboard metrics. Please verify your connection and retry.'
        setErrorMessage(msg)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [buildOverviewQuery, dateRangeError],
  )

  useEffect(() => {
    let active = true
    if (dateRangeError) {
      return undefined
    }

    fetchDashboardOverview(buildOverviewQuery())
      .then((data) => {
        if (!active) return
        setOverview(data)
        setMonthlyOverride(null)
        setErrorMessage('')
        setLoading(false)
      })
      .catch((error) => {
        if (!active) return
        setErrorMessage(
          error?.response?.data?.message ||
            'Unable to load dashboard metrics. Please verify your connection and retry.',
        )
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [buildOverviewQuery, dateRangeError, canViewProfitability])

  useEffect(() => {
    const handleActivityUpdate = () => {
      loadDashboard({ silent: true })
    }
    window.addEventListener(ACTIVITY_UPDATED_EVENT, handleActivityUpdate)
    return () => {
      window.removeEventListener(ACTIVITY_UPDATED_EVENT, handleActivityUpdate)
    }
  }, [loadDashboard])

  const handlePeriodPresetChange = useCallback(
    async (nextPreset) => {
      setPeriodPreset(nextPreset)
      if (nextPreset === 'custom' || !canViewProfitability) {
        return
      }
      setCustomFromDate('')
      setCustomToDate('')
      setMonthlyLoading(true)
      try {
        const nextMonthly = await fetchDashboardMonthlyExpenses({
          months: Number(nextPreset) || 6,
        })
        if (nextMonthly) {
          setMonthlyOverride(nextMonthly)
        }
      } catch {
        setMonthlyOverride(null)
      } finally {
        setMonthlyLoading(false)
      }
    },
    [canViewProfitability],
  )

  const handleResetProjectFilters = useCallback(() => {
    setSearchInput('')
    setAppliedSearch('')
    setProjectStatus('all')
    setProjectSortBy('totalCost')
    setProjectSortOrder('desc')
  }, [])

  const isOperationalView =
    !canViewProfitability || overview?.mode === 'operational'
  const effectiveMonthly = monthlyOverride || overview?.monthlyExpenses || null

  return (
    <div className="sts-dash-page">
      <header className="sts-dash-hero">
        <div className="sts-dash-hero__copy">
          <span className="sts-dash-hero__eyebrow">
            {isOperationalView
              ? 'Soft Touch Sofas \u2022 Data Entry Workspace'
              : 'Soft Touch Sofas \u2022 Executive Overview'}
          </span>
          <div className="sts-dash-hero__title-row">
            <h1 className="sts-dash-hero__title">
              {isOperationalView ? 'Operations Desk' : 'Business Dashboard'}
            </h1>
            <button
              type="button"
              className={`sts-dash-refresh-btn${refreshing ? ' sts-dash-refresh-btn--spinning' : ''}`}
              onClick={() => loadDashboard({ silent: Boolean(overview) })}
              disabled={loading || refreshing}
              aria-label="Refresh dashboard data"
              title="Refresh dashboard"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24l-2.24 2.24H16V0l-2.35 2.35z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {loading && !overview ? (
        <div
          className="sts-dash-loading-layout"
          role="status"
          aria-label="Loading dashboard metrics"
        >
          <div className="sts-dash-kpi-grid">
            <div className="sts-dash-skeleton sts-dash-skeleton--kpi sts-dash-kpi-card--projects" />
            <div className="sts-dash-skeleton sts-dash-skeleton--kpi" />
            <div className="sts-dash-skeleton sts-dash-skeleton--kpi" />
            <div className="sts-dash-skeleton sts-dash-skeleton--kpi" />
          </div>
          <div className="sts-dash-skeleton sts-dash-skeleton--panel" />
          <div className="sts-dash-skeleton sts-dash-skeleton--panel" />
        </div>
      ) : errorMessage && !overview ? (
        <section className="sts-dash-error-card" role="alert">
          <div className="sts-dash-error-card__body">
            <h2 className="sts-dash-error-card__title">
              Dashboard data could not be loaded
            </h2>
            <p className="sts-dash-error-card__desc">{errorMessage}</p>
            <p className="sts-dash-error-card__hint">
              Figures are hidden rather than displaying misleading zero balances
              when the server cannot be reached.
            </p>
          </div>
          <button
            type="button"
            className="sts-dash-btn sts-dash-btn--primary"
            onClick={() => loadDashboard({ silent: false })}
          >
            Retry Loading Dashboard
          </button>
        </section>
      ) : overview ? (
        <>
          {errorMessage ? (
            <div className="sts-dash-inline-error" role="alert">
              <span>{errorMessage}</span>
              <button
                type="button"
                className="sts-dash-text-reset"
                onClick={() => loadDashboard({ silent: true })}
              >
                Retry
              </button>
            </div>
          ) : null}

          {isOperationalView ? (
            <OperationalDashboardView
              overview={overview}
              canViewMaterials={canViewMaterials}
              canViewPurchases={canViewPurchases}
              canViewExpenses={canViewExpenses}
              onNavigate={onNavigate}
            />
          ) : (
            <>
              <DashboardKpiGrid
                kpis={overview.kpis}
                isAdmin={canViewReports}
                onNavigate={onNavigate}
              />

  

              <MonthlyExpenseSection
                monthlyExpenses={effectiveMonthly}
                periodPreset={periodPreset}
                customFromDate={customFromDate}
                customToDate={customToDate}
                dateRangeError={dateRangeError}
                monthlyLoading={monthlyLoading}
                isAdmin={canViewReports}
                onPeriodPresetChange={handlePeriodPresetChange}
                onCustomFromChange={setCustomFromDate}
                onCustomToChange={setCustomToDate}
                onNavigate={onNavigate}
              />

              <div className="sts-dash-bottom-grid">
                <div className="sts-dash-bottom-grid__main">
                  <RecentTransactionsCard
                    transactions={overview.recentTransactions || []}
                    onNavigate={onNavigate}
                  />
                </div>

                <div className="sts-dash-bottom-grid__side">
                  {canApproveUsers && overview.pendingApprovals ? (
                    <PendingApprovalsCard
                      pendingApprovals={overview.pendingApprovals}
                      contextPendingCount={pendingCount}
                      onNavigate={onNavigate}
                    />
                  ) : null}

                  {canViewMaterials && overview.stockAlerts ? (
                    <StockAlertsCard
                      stockAlerts={overview.stockAlerts}
                      isAdmin={isAdmin}
                      onNavigate={onNavigate}
                    />
                  ) : null}
                </div>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
