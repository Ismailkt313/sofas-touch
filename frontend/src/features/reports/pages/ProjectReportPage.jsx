import { useCallback, useEffect, useRef, useState } from 'react'
import { ProjectCostBreakdown } from '../components/ProjectCostBreakdown'
import { ProjectDateWiseCostSection } from '../components/ProjectDateWiseCostSection'
import { ProjectExpenseHistorySection } from '../components/ProjectExpenseHistorySection'
import { ProjectPurchaseHistorySection } from '../components/ProjectPurchaseHistorySection'
import {
  downloadIndividualProjectReportPdf,
  fetchIndividualProjectReport,
  hasActiveAuthToken,
  isAdminUser,
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
  const adminAccess = isAdminUser(currentUser)
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
            onClick={() => onNavigate?.('/projects')}
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
          onClick={() => onNavigate?.('/reports')}
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
          <p className="rep-header__subtitle">
            Detailed cost breakdown, purchase vouchers, project expenses, and
            chronological cost audit.
          </p>
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
            <label className="rep-filter-field">
              <span className="rep-filter-field__label">
                Transactions From Date
              </span>
              <input
                type="date"
                className="rep-date-input"
                value={fromDate}
                onChange={(e) => handleFromChange(e.target.value)}
              />
            </label>

            <label className="rep-filter-field">
              <span className="rep-filter-field__label">
                Transactions To Date
              </span>
              <input
                type="date"
                className="rep-date-input"
                value={toDate}
                onChange={(e) => handleToChange(e.target.value)}
              />
            </label>

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
          <div className="rep-disclaimer">
            <strong>Estimated Operational Report:</strong> Calculated from saved
            active project purchase vouchers and project expenses. Cancelled
            vouchers and general workshop expenses are excluded.
          </div>

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
                <h2 className="rep-section__title">1. Project Information</h2>
                <p className="rep-section__subtitle">
                  Core project metadata and scope summary from saved project
                  records.
                </p>
              </div>
              <span className="rep-status-pill">{project.status}</span>
            </div>

            <div className="rep-info-grid">
              <div>
                <span className="rep-info-item__label">Project ID</span>
                <div className="rep-info-item__val">{project.projectId}</div>
              </div>

              <div>
                <span className="rep-info-item__label">Project Name</span>
                <div className="rep-info-item__val">{project.name}</div>
              </div>

              <div>
                <span className="rep-info-item__label">Client Name</span>
                <div className="rep-info-item__val">
                  {project.clientName || '—'}
                </div>
              </div>

              <div>
                <span className="rep-info-item__label">Category</span>
                <div className="rep-info-item__val">
                  {project.category || '—'}
                </div>
              </div>

              <div>
                <span className="rep-info-item__label">Created Date</span>
                <div className="rep-info-item__val">
                  {formatReportDate(project.createdAt)}
                </div>
              </div>

              <div>
                <span className="rep-info-item__label">
                  Site Location / Client Contact
                </span>
                <div className="rep-info-item__val rep-muted">
                  {project.siteLocation ||
                    project.clientContact ||
                    'Not recorded in project schema'}
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
                <h2 className="rep-section__title">2. Financial Overview</h2>
                <p className="rep-section__subtitle">
                  {period?.isDateFiltered
                    ? 'Comparison of selected reporting period costs and cumulative lifetime profitability.'
                    : 'Lifetime contract value, recorded project costs, budget utilization, and estimated profitability.'}
                </p>
              </div>
              <span className={`rep-health ${health.className}`}>
                <span className="rep-health__dot" aria-hidden="true" />
                Lifetime: {health.label}
              </span>
            </div>

            <div className="rep-overview-grid">
              <div className="rep-overview-tile">
                <span className="rep-overview-tile__label">Contract Value</span>
                <span className="rep-overview-tile__val">
                  {formatReportCurrency(
                    lifetime?.contractValue ?? project?.contractValue,
                  )}
                </span>
                <span className="rep-summary-card__meta">
                  Saved project contract value
                </span>
              </div>

              <div className="rep-overview-tile">
                <span className="rep-overview-tile__label">
                  {period?.isDateFiltered
                    ? 'Period Material Purchases'
                    : 'Total Material Purchases'}
                </span>
                <span className="rep-overview-tile__val">
                  {formatReportCurrency(activeMetrics?.materialPurchaseCosts)}
                </span>
                {period?.isDateFiltered ? (
                  <span className="rep-summary-card__meta">
                    Lifetime:{' '}
                    {formatReportCurrency(lifetime?.materialPurchaseCosts)}
                  </span>
                ) : null}
              </div>

              <div className="rep-overview-tile">
                <span className="rep-overview-tile__label">
                  {period?.isDateFiltered
                    ? 'Period Other Expenses'
                    : 'Total Other Project Expenses'}
                </span>
                <span className="rep-overview-tile__val">
                  {formatReportCurrency(activeMetrics?.otherProjectExpenses)}
                </span>
                {period?.isDateFiltered ? (
                  <span className="rep-summary-card__meta">
                    Lifetime:{' '}
                    {formatReportCurrency(lifetime?.otherProjectExpenses)}
                  </span>
                ) : null}
              </div>

              <div className="rep-overview-tile">
                <span className="rep-overview-tile__label">
                  {period?.isDateFiltered
                    ? 'Combined Period Costs'
                    : 'Total Project Costs'}
                </span>
                <span className="rep-overview-tile__val">
                  {formatReportCurrency(activeMetrics?.totalProjectCosts)}
                </span>
                {period?.isDateFiltered ? (
                  <span className="rep-summary-card__meta">
                    Lifetime:{' '}
                    {formatReportCurrency(lifetime?.totalProjectCosts)}
                  </span>
                ) : null}
              </div>

              <div className="rep-overview-tile">
                <span className="rep-overview-tile__label">
                  Lifetime Estimated Profit
                </span>
                <span
                  className={`rep-overview-tile__val ${
                    (lifetime?.estimatedProfit ?? 0) < 0
                      ? 'rep-profit-val--loss'
                      : ''
                  }`}
                >
                  {formatReportCurrency(lifetime?.estimatedProfit)}
                </span>
                <span className="rep-summary-card__meta">
                  Contract Value − Lifetime Costs
                </span>
              </div>

              <div className="rep-overview-tile">
                <span className="rep-overview-tile__label">
                  Lifetime Profit Margin
                </span>
                <span
                  className={`rep-overview-tile__val ${
                    lifetime?.marginApplicable &&
                    lifetime?.profitMargin !== null &&
                    lifetime.profitMargin < 0
                      ? 'rep-profit-val--loss'
                      : ''
                  }`}
                >
                  {formatSafePercentage(
                    lifetime?.profitMargin,
                    lifetime?.marginApplicable,
                  )}
                </span>
                <span className="rep-summary-card__meta">
                  {lifetime?.marginApplicable
                    ? 'Est. Profit ÷ Contract Value'
                    : 'Contract value is zero'}
                </span>
              </div>

              <div className="rep-overview-tile">
                <span className="rep-overview-tile__label">
                  {period?.isDateFiltered
                    ? 'Period Cost % of Contract'
                    : 'Cost Percentage'}
                </span>
                <span className="rep-overview-tile__val">
                  {formatSafePercentage(
                    period?.isDateFiltered
                      ? selectedPeriod?.costPercentageOfContract
                      : lifetime?.costPercentage,
                    activeMetrics?.marginApplicable,
                  )}
                </span>
                <span className="rep-summary-card__meta">
                  {period?.isDateFiltered
                    ? `Lifetime Cost %: ${formatSafePercentage(
                        lifetime?.costPercentage,
                        lifetime?.marginApplicable,
                      )}`
                    : 'Total Project Costs ÷ Contract Value'}
                </span>
              </div>
            </div>
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
