import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApprovalsContext } from '../../approvals/context/ApprovalsContext'
import { ACTIVITY_UPDATED_EVENT } from '../../../services/api'
import { DashboardKpiGrid } from '../components/DashboardKpiGrid'
import { MonthlyExpenseSection } from '../components/MonthlyExpenseSection'
import { PendingApprovalsCard } from '../components/PendingApprovalsCard'
import { ProjectProfitabilitySection } from '../components/ProjectProfitabilitySection'
import { RecentTransactionsCard } from '../components/RecentTransactionsCard'
import { StockAlertsCard } from '../components/StockAlertsCard'
import {
  fetchDashboardMonthlyExpenses,
  fetchDashboardOverview,
} from '../services/dashboardService'
import '../styles/dashboard.css'

export function DashboardPage({ currentUser, onNavigate }) {
  const isAdmin = currentUser?.role === 'admin'
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
      recentLimit: 8,
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
  }, [buildOverviewQuery, dateRangeError])

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
      if (nextPreset === 'custom') {
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
    [],
  )

  const handleResetProjectFilters = useCallback(() => {
    setSearchInput('')
    setAppliedSearch('')
    setProjectStatus('all')
    setProjectSortBy('totalCost')
    setProjectSortOrder('desc')
  }, [])

  const effectiveMonthly = monthlyOverride || overview?.monthlyExpenses || null

  return (
    <div className="sts-dash-page">
      <header className="sts-dash-hero">
        <div className="sts-dash-hero__copy">
          <span className="sts-dash-hero__eyebrow">
            Soft Touch Sofas &bull; Operations Overview
          </span>
          <h1 className="sts-dash-hero__title">Business Dashboard</h1>
          <p className="sts-dash-hero__sub">
            Real-time project contract performance, monthly procurement &amp;
            expense trends, raw material stock alerts, and recent vouchers.
          </p>
        </div>

        <div className="sts-dash-hero__actions">
          <button
            type="button"
            className="sts-dash-btn sts-dash-btn--ghost"
            onClick={() => loadDashboard({ silent: Boolean(overview) })}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            className="sts-dash-btn sts-dash-btn--secondary"
            onClick={() => onNavigate?.('/purchases/new')}
          >
            + Purchase Voucher
          </button>
          <button
            type="button"
            className="sts-dash-btn sts-dash-btn--primary"
            onClick={() => onNavigate?.('/projects')}
          >
            View Projects
          </button>
        </div>
      </header>

      {loading && !overview ? (
        <div
          className="sts-dash-loading-layout"
          role="status"
          aria-label="Loading dashboard metrics"
        >
          <div className="sts-dash-kpi-grid">
            <div className="sts-dash-skeleton sts-dash-skeleton--kpi" />
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
              Financial figures are hidden rather than displaying misleading zero
              balances when the server cannot be reached.
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

          <DashboardKpiGrid
            kpis={overview.kpis}
            isAdmin={isAdmin}
            onNavigate={onNavigate}
          />

          <ProjectProfitabilitySection
            items={overview.projectPerformance?.items || []}
            totalMatching={overview.projectPerformance?.totalMatching || 0}
            searchInput={searchInput}
            projectStatus={projectStatus}
            projectSortBy={projectSortBy}
            projectSortOrder={projectSortOrder}
            isAdmin={isAdmin}
            onSearchChange={setSearchInput}
            onStatusChange={setProjectStatus}
            onSortChange={(nextField, nextOrd) => {
              setProjectSortBy(nextField)
              setProjectSortOrder(nextOrd)
            }}
            onResetFilters={handleResetProjectFilters}
            onNavigate={onNavigate}
          />

          <MonthlyExpenseSection
            monthlyExpenses={effectiveMonthly}
            periodPreset={periodPreset}
            customFromDate={customFromDate}
            customToDate={customToDate}
            dateRangeError={dateRangeError}
            monthlyLoading={monthlyLoading}
            isAdmin={isAdmin}
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
              {isAdmin && overview.pendingApprovals ? (
                <PendingApprovalsCard
                  pendingApprovals={overview.pendingApprovals}
                  contextPendingCount={pendingCount}
                  onNavigate={onNavigate}
                />
              ) : null}

              <StockAlertsCard
                stockAlerts={overview.stockAlerts}
                isAdmin={isAdmin}
                onNavigate={onNavigate}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
