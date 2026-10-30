import { navigateBackOrFallback } from '../../../services/navigationState'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DatePicker } from '../../../components/common'
import { ProjectCostBreakdown } from '../components/ProjectCostBreakdown'
import { ProjectDateWiseCostSection } from '../components/ProjectDateWiseCostSection'
import { ProjectExpenseHistorySection } from '../components/ProjectExpenseHistorySection'
import { ProjectPurchaseHistorySection } from '../components/ProjectPurchaseHistorySection'
import { hasAllPermissions } from '../../permissions/constants/permissionsCatalog'
import {
  downloadIndividualProjectReportPdf,
  fetchIndividualProjectReport,
  hasActiveAuthToken,
} from '../services/reportService'
import '../styles/reports.css'
import {
  formatPeriodRangeLabel,
  formatReportCurrency,
  formatReportDate,
  formatSafePercentage,
  getHealthIndicatorMeta,
  validateReportDateRange,
} from '../utils/reportFormatters'

function readInitialUrlDates() {
  if (typeof window === 'undefined') {
    return { fromDate: '', toDate: '' }
  }
  const params = new URLSearchParams(window.location.search)
  return {
    fromDate: params.get('fromDate') || '',
    toDate: params.get('toDate') || '',
  }
}

export function ProjectReportPage({ projectId, currentUser, onNavigate }) {
  const adminAccess = hasAllPermissions(currentUser, [
    'reports.view',
    'reports.viewProfitability',
  ])
  const [authRequired, setAuthRequired] = useState(() => !hasActiveAuthToken())

  const [fromDate, setFromDate] = useState(() => readInitialUrlDates().fromDate)
  const [toDate, setToDate] = useState(() => readInitialUrlDates().toDate)

  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [exportMessage, setExportMessage] = useState('')
  const [reloadTick, setReloadTick] = useState(0)
  const hasLoadedOnceRef = useRef(false)

  const dateRangeError = validateReportDateRange(fromDate, toDate)

  useEffect(() => {
    if (!hasActiveAuthToken() || !adminAccess || !projectId || dateRangeError) {
      return undefined
    }

    let cancelled = false

    fetchIndividualProjectReport(projectId, { fromDate, toDate })
      .then((data) => {
        if (cancelled) return
        hasLoadedOnceRef.current = true
        setAuthRequired(false)
        setReport(data)
        setErrorMessage('')
      })
      .catch((err) => {
        if (cancelled) return
        const status = err?.status || err?.response?.status
        if (status === 401) {
          setAuthRequired(true)
          return
        }
        setErrorMessage(
          err?.message ||
            err?.response?.data?.message ||
            'Unable to load individual project financial report.',
        )
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
        setIsRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [adminAccess, dateRangeError, fromDate, projectId, reloadTick, toDate])

  const handleFromChange = useCallback((nextVal) => {
    setFromDate(nextVal)
    if (hasLoadedOnceRef.current) setIsRefreshing(true)
  }, [])

  const handleToChange = useCallback((nextVal) => {
    setToDate(nextVal)
    if (hasLoadedOnceRef.current) setIsRefreshing(true)
  }, [])

  const handleClearDates = useCallback(() => {
    setFromDate('')
    setToDate('')
    if (hasLoadedOnceRef.current) setIsRefreshing(true)
  }, [])

  const handleRetry = useCallback(() => {
    if (hasLoadedOnceRef.current) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setReloadTick((prev) => prev + 1)
  }, [])

  const handleDownloadPdf = async () => {
    if (!projectId || dateRangeError || isDownloadingPdf) return
    setIsDownloadingPdf(true)
    setExportMessage('')
    try {
      const filename = await downloadIndividualProjectReportPdf(projectId, {
        fromDate,
        toDate,
      })
      setExportMessage(`Downloaded ${filename}`)
      window.setTimeout(() => setExportMessage(''), 4000)
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.message ||
          'Failed to generate PDF report. Please try again.',
      )
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const handleNavigatePurchase = useCallback(
    (voucherNumber) => {
      const target = `/purchases/${encodeURIComponent(voucherNumber)}`
      if (onNavigate) {
        onNavigate(target)
      } else {
        window.location.assign(target)
      }
    },
    [onNavigate],
  )

  const handleNavigateExpense = useCallback(
    (voucherNumber) => {
      const target = `/expenses?view=${encodeURIComponent(voucherNumber)}`
      if (onNavigate) {
        onNavigate(target)
      } else {
        window.location.assign(target)
      }
    },
    [onNavigate],
  )

  if (authRequired) {
    return (
      <div className="rep-page">
        <div className="rep-surface rep-access-card">
          <h2>Sign In Required</h2>
          <p>Please sign in to inspect individual project reports.</p>
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
            Individual project financial reports are restricted to Soft Touch
            Sofas administrators.
          </p>
          <button
            type="button"
            className="rep-btn rep-btn--secondary"
            onClick={() => navigateBackOrFallback(onNavigate, '/projects')}
          >
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  const project = report?.project
  const period = report?.period
  const financialOverview = report?.financialOverview
  const lifetime = financialOverview?.lifetime
  const selectedPeriod = financialOverview?.selectedPeriod
  const activeMetrics = period?.isDateFiltered ? selectedPeriod : lifetime
  const health = getHealthIndicatorMeta(lifetime?.healthStatus)

  return (
    <div
      className="rep-page"
      style={{ opacity: isRefreshing ? 0.76 : 1, transition: 'opacity 140ms' }}
    >
      <div className="rep-no-print" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="rep-btn rep-btn--secondary rep-btn--sm"
          onClick={() => navigateBackOrFallback(onNavigate, '/reports')}
        >
          ← Back to Project Reports
        </button>

        {project?.projectId ? (
          <button
            type="button"
            className="rep-btn rep-btn--secondary rep-btn--sm"
            onClick={() =>
              onNavigate?.(`/projects/${encodeURIComponent(project.projectId)}`)
            }
          >
            Open Project Workspace
          </button>
        ) : null}
      </div>

      <header className="rep-header">
        <div className="rep-header__titles">
          <span className="rep-header__eyebrow">
            Individual Project Financial Report
          </span>
          <h1 className="rep-header__title">
            {project
              ? `${project.projectId} — ${project.name}`
              : `Project Report (${projectId})`}
          </h1>

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
            disabled={!report}
            onClick={() => window.print()}
          >
            Print View
          </button>

          <button
            type="button"
            className="rep-btn rep-btn--primary"
            disabled={!report || Boolean(dateRangeError) || isDownloadingPdf}
            onClick={handleDownloadPdf}
          >
            {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </header>

      <section
        className="rep-surface rep-section rep-no-print"
        aria-label="Report period filter"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '0.85rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="rep-filter-field">
              <span className="rep-filter-field__label">
                Transactions From Date
              </span>
              <DatePicker
                value={fromDate}
                onChange={handleFromChange}
                maxDate={toDate || undefined}
                variant="filter"
                ariaLabel="Transactions from date"
                placeholder="From date"
              />
            </div>

            <div className="rep-filter-field">
              <span className="rep-filter-field__label">
                Transactions To Date
              </span>
              <DatePicker
                value={toDate}
                onChange={handleToChange}
                minDate={fromDate || undefined}
                variant="filter"
                ariaLabel="Transactions to date"
                placeholder="To date"
              />
            </div>

            {fromDate || toDate ? (
              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  type="button"
                  className="rep-btn rep-btn--secondary"
                  onClick={handleClearDates}
                >
                  Show All Dates
                </button>
              </div>
            ) : null}
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--sts-charcoal-muted)' }}>
            Active Scope: <strong>{formatPeriodRangeLabel(period)}</strong>
          </span>
        </div>

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
      </section>

      {errorMessage ? (
        <div className="rep-error-banner" role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="rep-btn rep-btn--secondary rep-btn--sm"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rep-surface rep-loading">
          <div className="rep-spinner" aria-hidden="true" />
          <span>Loading individual project financial report...</span>
        </div>
      ) : report && project && financialOverview ? (
        <>


          {period?.isDateFiltered ? (
            <section className="rep-period-banner">
              <div className="rep-period-banner__top">
                <span className="rep-period-banner__badge">
                  Filtered Period: {formatPeriodRangeLabel(period)}
                </span>
                <span className="rep-period-banner__note">
                  Tables and cost breakdown below show transactions within this
                  period. Lifetime profitability is shown alongside period costs
                  in Financial Overview so period figures are never mistaken for
                  lifetime totals.
                </span>
              </div>
            </section>
          ) : null}

          <section className="rep-surface rep-section">
            <div className="rep-section__header">
              <div>
                <h2 className="rep-section__title">1. Project Overview</h2>
                <p className="rep-section__subtitle">
                  Core project metadata, client details, site information, and contract value.
                </p>
              </div>
              <span className="rep-status-pill">{project.status || 'Active'}</span>
            </div>

            <div className="rep-info-grid">
              <div>
                <span className="rep-info-item__label">Project ID</span>
                <div className="rep-info-item__val rep-project-code-tag">{project.projectId}</div>
              </div>

              <div>
                <span className="rep-info-item__label">Project Name</span>
                <div className="rep-info-item__val">{project.name}</div>
              </div>

              <div>
                <span className="rep-info-item__label">Client Details</span>
                <div className="rep-info-item__val">
                  {project.clientName || '—'}
                  {project.clientContact ? (
                    <span className="rep-sub-line">{project.clientContact}</span>
                  ) : null}
                </div>
              </div>

              <div>
                <span className="rep-info-item__label">Site Location</span>
                <div className="rep-info-item__val">
                  {project.siteLocation || '—'}
                </div>
              </div>

              <div>
                <span className="rep-info-item__label">Created / Start Date</span>
                <div className="rep-info-item__val">
                  {formatReportDate(project.createdAt)}
                </div>
              </div>

              <div>
                <span className="rep-info-item__label">Contract Value</span>
                <div className="rep-info-item__val rep-info-item__val--accent">
                  {formatReportCurrency(lifetime?.contractValue ?? project?.contractValue)}
                </div>
              </div>
            </div>

            {project.description ? (
              <div
                style={{
                  borderTop: '1px solid var(--sts-border-subtle)',
                  paddingTop: '0.75rem',
                }}
              >
                <span className="rep-info-item__label">
                  Description / Scope Summary
                </span>
                <p
                  style={{
                    margin: '0.2rem 0 0',
                    fontSize: '0.86rem',
                    color: 'var(--sts-charcoal-soft)',
                    lineHeight: 1.5,
                  }}
                >
                  {project.description}
                </p>
              </div>
            ) : null}
          </section>

          <section className="rep-surface rep-section">
            <div className="rep-section__header">
              <div>
                <h2 className="rep-section__title">2. Financial Summary</h2>
                <p className="rep-section__subtitle">
                  {period?.isDateFiltered
                    ? 'Comparison of contract value, selected reporting period costs, and cumulative lifetime profitability.'
                    : 'Lifetime contract value, recorded project costs, budget utilization, and estimated profitability.'}
                </p>
              </div>
              <span className={`rep-health ${health.className}`}>
                <span className="rep-health__dot" aria-hidden="true" />
                {health.label}
              </span>
            </div>

            {/* B. Four Summary Cards */}
            <div className="rep-summary-grid rep-summary-grid--four">
              {/* 1. Contract Value */}
              <div className="rep-summary-card">
                <span className="rep-summary-card__label">Contract Value</span>
                <span className="rep-summary-card__val">
                  {formatReportCurrency(lifetime?.contractValue ?? project?.contractValue)}
                </span>
                <span className="rep-summary-card__meta">
                  Committed project scope
                </span>
              </div>

              {/* 2. Material Purchase Costs */}
              <div className="rep-summary-card">
                <span className="rep-summary-card__label">
                  {period?.isDateFiltered ? 'Period Material Purchases' : 'Material Purchase Costs'}
                </span>
                <span className="rep-summary-card__val">
                  {formatReportCurrency(activeMetrics?.materialPurchaseCosts)}
                </span>
                <span className="rep-summary-card__meta">
                  {period?.isDateFiltered
                    ? `Lifetime: ${formatReportCurrency(lifetime?.materialPurchaseCosts)}`
                    : 'Active procurement vouchers'}
                </span>
              </div>

              {/* 3. Other Project Expenses */}
              <div className="rep-summary-card">
                <span className="rep-summary-card__label">
                  {period?.isDateFiltered ? 'Period Other Expenses' : 'Other Project Expenses'}
                </span>
                <span className="rep-summary-card__val">
                  {formatReportCurrency(activeMetrics?.otherProjectExpenses)}
                </span>
                <span className="rep-summary-card__meta">
                  {period?.isDateFiltered
                    ? `Lifetime: ${formatReportCurrency(lifetime?.otherProjectExpenses)}`
                    : 'Site support, labor & transport'}
                </span>
              </div>

              {/* 4. Total Project Costs */}
              <div className="rep-summary-card rep-summary-card--highlight">
                <span className="rep-summary-card__label">
                  {period?.isDateFiltered ? 'Combined Period Costs' : 'Total Project Costs'}
                </span>
                <span className="rep-summary-card__val">
                  {formatReportCurrency(activeMetrics?.totalProjectCosts)}
                </span>
                <span className="rep-summary-card__meta">
                  {period?.isDateFiltered
                    ? `Lifetime: ${formatReportCurrency(lifetime?.totalProjectCosts)}`
                    : 'Purchases + Other Expenses'}
                </span>
              </div>
            </div>

            {/* B. Visually Prominent Estimated Profit Section */}
            {(() => {
              const estProfit = lifetime?.estimatedProfit ?? 0
              const isProfitPositive = estProfit > 0
              const isProfitNegative = estProfit < 0
              const numContract = Number(lifetime?.contractValue ?? 0)
              const numCosts = Number(lifetime?.totalProjectCosts ?? 0)
              const isOverBudget = numContract > 0 && numCosts > numContract
              const overBudgetAmt = isOverBudget ? numCosts - numContract : 0

              return (
                <div className={`rep-profit-hero ${isProfitNegative ? 'rep-profit-hero--loss' : ''}`}>
                  <div className="rep-profit-hero__main">
                    <div className="rep-profit-hero__eyebrow">
                      <span>Estimated Profit</span>
                      <span className="rep-profit-hero__badge">Unaudited</span>
                    </div>
                    <div className={`rep-profit-hero__amount ${isProfitNegative ? 'rep-profit-hero__amount--loss' : 'rep-profit-hero__amount--positive'}`}>
                      {formatReportCurrency(estProfit)}
                    </div>
                  </div>

                  <div className="rep-profit-hero__meta">
                    <div className="rep-profit-hero__stat">
                      <span className="rep-profit-hero__stat-label">Profit Margin</span>
                      <span className="rep-profit-hero__stat-val">
                        {formatSafePercentage(lifetime?.profitMargin, lifetime?.marginApplicable)}
                      </span>
                    </div>

                    <div className="rep-profit-hero__stat">
                      <span className="rep-profit-hero__stat-label">Budget Status</span>
                      <span className={`rep-health ${health.className}`}>
                        <span className="rep-health__dot" aria-hidden="true" />
                        {health.label}
                      </span>
                    </div>

                    {isOverBudget ? (
                      <div className="rep-profit-hero__alert">
                        <span className="rep-overbudget-badge">
                          Over budget by {formatReportCurrency(overBudgetAmt)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })()}
          </section>

          <ProjectCostBreakdown
            financialOverview={financialOverview}
            period={period}
          />

          <ProjectPurchaseHistorySection
            purchaseHistory={report.purchaseHistory}
            onNavigatePurchase={handleNavigatePurchase}
          />

          <ProjectExpenseHistorySection
            expenseHistory={report.expenseHistory}
            onNavigateExpense={handleNavigateExpense}
          />

          <ProjectDateWiseCostSection
            dateWiseCostHistory={report.dateWiseCostHistory}
            onNavigatePurchase={handleNavigatePurchase}
            onNavigateExpense={handleNavigateExpense}
          />
        </>
      ) : null}
    </div>
  )
}
