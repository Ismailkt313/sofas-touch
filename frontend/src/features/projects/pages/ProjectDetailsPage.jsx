import { ProjectFormModal } from '../components/ProjectFormModal'
import {
  ProjectCostThresholdBadge,
  ProjectStatusBadge,
} from '../components/ProjectStatusBadge'
import { ProjectStatusDropdown } from '../components/ProjectStatusDropdown'
import { useProjectDetails } from '../hooks/useProjectDetails'
import {
  formatActivityTypeLabel,
  formatCurrency,
  formatPercentage,
  formatProjectDate,
  formatProjectDateTime,
} from '../services/projectService'
import '../styles/projects.css'

export function ProjectDetailsPage({
  projectIdentifier,
  currentUser,
  onNavigate,
}) {
  const {
    project,
    financialSummary,
    summaryUnavailableMessage,
    automationFeed,
    canEditProject,
    canViewProfitability,

    isLoading,
    isRefreshing,
    isRecalculating,
    authRequired,
    notFound,
    error,
    reloadProjectDetails,
    handleRecalculateFinancials,

    isEditModalOpen,
    openEditModal,
    closeEditModal,
    handleEditSubmit,

    isUpdatingStatus,
    handleStatusSubmit,

    feedbackBanner,
    clearFeedbackBanner,
  } = useProjectDetails({ projectIdentifier, currentUser })

  const handleBackToList = () => {
    onNavigate?.('/projects')
  }

  if (authRequired) {
    return (
      <div className="projects-page">
        <div className="project-detail-nav">
          <button
            type="button"
            className="project-back-btn"
            onClick={handleBackToList}
          >
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M11 4L6 9L11 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Back to Projects</span>
          </button>
        </div>
        <section className="projects-surface">
          <div className="projects-state">
            <h2 className="projects-state__title">Sign in required</h2>
            <p className="projects-state__message">
              Please sign in with an approved account to view project details
              and financial summaries.
            </p>
            <div className="projects-state__actions">
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
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className="projects-page"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="project-detail-nav">
          <button
            type="button"
            className="project-back-btn"
            onClick={handleBackToList}
          >
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M11 4L6 9L11 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Back to Projects</span>
          </button>
        </div>

        <section className="projects-surface project-detail-skeleton-wrap">
          <div className="projects-skeleton-line projects-skeleton-line--title" />
          <div className="projects-skeleton-line projects-skeleton-line--sub" />
          <div className="project-financial-grid">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="project-financial-skeleton-card" />
            ))}
          </div>
        </section>
      </div>
    )
  }

  if (notFound || error || !project) {
    return (
      <div className="projects-page">
        <div className="project-detail-nav">
          <button
            type="button"
            className="project-back-btn"
            onClick={handleBackToList}
          >
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M11 4L6 9L11 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Back to Projects</span>
          </button>
        </div>

        <section className="projects-surface">
          <div className="projects-state" role="alert">
            <div
              className="projects-state__icon projects-state__icon--error"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M12 7.5V12.5M12 16H12.01"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="projects-state__title">
              {notFound ? 'Project not found' : 'Unable to load project'}
            </h2>
            <p className="projects-state__message">
              {notFound
                ? `No project matching "${projectIdentifier}" exists in the directory.`
                : error}
            </p>
            <div className="projects-state__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={handleBackToList}
              >
                Return to Projects
              </button>
              {!notFound ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={reloadProjectDetails}
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    )
  }

  const authoritativeThresholdState =
    financialSummary?.costThresholdState || project.costThresholdState
  const isCriticalOverrun = Boolean(
    authoritativeThresholdState?.exceededCrossed,
  )
  const isWarningThreshold = Boolean(
    authoritativeThresholdState?.warningCrossed,
  )
  const warningThresholdPercent =
    authoritativeThresholdState?.warningThresholdPercent ||
    project.costAlertThresholdPercent ||
    80

  const activeInactivityWarnings = (
    automationFeed.activityWarnings || []
  ).filter((item) => item.status === 'active')

  const clampedProgressWidth = financialSummary
    ? Math.max(0, Math.min(100, Number(financialSummary.costPercentage) || 0))
    : 0

  return (
    <div
      className={`projects-page${
        isRefreshing ? ' projects-page--refreshing' : ''
      }`}
    >
      <div className="project-detail-nav">
        <button
          type="button"
          className="project-back-btn"
          onClick={handleBackToList}
        >
          <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M11 4L6 9L11 14"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Back to Projects</span>
        </button>
      </div>

      <header className="project-detail-header">
        <div className="project-detail-header__main">
          <div className="project-detail-header__badges">
            <span className="project-code-pill project-code-pill--lg">
              {project.projectId}
            </span>
            {canEditProject ? (
              <ProjectStatusDropdown
                project={project}
                isUpdating={isUpdatingStatus}
                onStatusChange={handleStatusSubmit}
              />
            ) : (
              <ProjectStatusBadge status={project.status} />
            )}
            <span className="project-category-pill">{project.category}</span>
            {canViewProfitability ? (
              <ProjectCostThresholdBadge
                costThresholdState={authoritativeThresholdState}
                costPercentage={financialSummary?.costPercentage}
              />
            ) : null}
          </div>

          <h1 className="project-detail-header__title">{project.name}</h1>
          <p className="project-detail-header__client">
            Client: <strong>{project.clientName}</strong>
            {project.siteLocation ? (
              <>
                {' '}
                &bull; Site: <strong>{project.siteLocation}</strong>
              </>
            ) : null}
          </p>
        </div>

        <div className="project-detail-header__actions">
          {canViewProfitability ? (
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={handleRecalculateFinancials}
              disabled={isRecalculating}
            >
              {isRecalculating ? 'Recalculating...' : 'Recalculate Summary'}
            </button>
          ) : null}

          {canEditProject ? (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={openEditModal}
            >
              Edit Project
            </button>
          ) : null}
        </div>
      </header>

      {feedbackBanner ? (
        <div
          className={`projects-feedback projects-feedback--${feedbackBanner.tone}`}
          role="status"
        >
          <span>{feedbackBanner.text}</span>
          <button
            type="button"
            className="projects-feedback__dismiss"
            onClick={clearFeedbackBanner}
            aria-label="Dismiss notification"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ) : null}

      {canViewProfitability && isCriticalOverrun ? (
        <div
          className="project-detail-banner project-detail-banner--critical"
          role="alert"
        >
          <div className="project-detail-banner__title">
            Contract Value Reached or Exceeded
          </div>
          <p className="project-detail-banner__desc">
            Total recorded project costs (
            {formatCurrency(
              financialSummary ? financialSummary.totalCost : project.totalCost,
            )}
            ) have reached or exceeded the fixed contract value (
            {formatCurrency(
              financialSummary
                ? financialSummary.contractValue
                : project.contractValue,
            )}
            ). Review purchases and expenses immediately.
          </p>
        </div>
      ) : canViewProfitability && isWarningThreshold ? (
        <div
          className="project-detail-banner project-detail-banner--warning"
          role="status"
        >
          <div className="project-detail-banner__title">
            Cost Warning Threshold Reached ({formatPercentage(warningThresholdPercent)})
          </div>
          <p className="project-detail-banner__desc">
            Total recorded project costs have reached{' '}
            {formatPercentage(
              financialSummary
                ? financialSummary.costPercentage
                : project.costPercentage,
            )}{' '}
            of the fixed contract value (configured warning threshold:{' '}
            {formatPercentage(warningThresholdPercent)}).
          </p>
        </div>
      ) : null}

      {activeInactivityWarnings.map((warning) => (
        <div
          key={warning.id || 'active-inactivity-warning'}
          className="project-detail-banner project-detail-banner--inactive"
          role="status"
        >
          <div className="project-detail-banner__title">
            Project Inactivity Warning
          </div>
          <p className="project-detail-banner__desc">
            {warning.message ||
              `No project updates or voucher entries recorded for ${Math.floor(
                warning.inactiveDays,
              )} day(s) (threshold: ${warning.inactivityThresholdDays} days).`}
          </p>
        </div>
      ))}

      {canViewProfitability ? (
        <section
          className="projects-surface project-detail-section"
          aria-labelledby="project-financial-heading"
        >
        <div className="project-section-header">
          <div>
            <div className="project-section-header__title-row">
              <h2
                id="project-financial-heading"
                className="project-section-header__title"
              >
                Financial Summary
              </h2>
            </div>
            
          </div>

          {financialSummary?.financialSummaryUpdatedAt ? (
            <span className="project-section-header__timestamp">
              Updated{' '}
              {formatProjectDateTime(financialSummary.financialSummaryUpdatedAt)}
            </span>
          ) : null}
        </div>

        {summaryUnavailableMessage || !financialSummary ? (
          <div
            className="project-detail-banner project-detail-banner--unavailable"
            role="status"
          >
            <div className="project-detail-banner__title">
              Financial Summary Unavailable
            </div>
            <p className="project-detail-banner__desc">
              {summaryUnavailableMessage ||
                'The backend financial summary API did not return summary data for this project.'}
            </p>
          </div>
        ) : (
          <>
            <div className="project-financial-grid">
              <article className="project-fin-card">
                <span className="project-fin-card__label">
                  Fixed Contract Value
                </span>
                <span className="project-fin-card__value">
                  {formatCurrency(financialSummary.contractValue)}
                </span>
                <span className="project-fin-card__note">
                  Agreed project contract baseline
                </span>
              </article>

              <article className="project-fin-card">
                <span className="project-fin-card__label">Total Purchases</span>
                <span className="project-fin-card__value">
                  {formatCurrency(financialSummary.totalPurchases)}
                </span>
                <span className="project-fin-card__note">
                  Aggregated purchase vouchers
                </span>
              </article>

              <article className="project-fin-card">
                <span className="project-fin-card__label">
                  Total Other Expenses
                </span>
                <span className="project-fin-card__value">
                  {formatCurrency(financialSummary.totalOtherExpenses)}
                </span>
                <span className="project-fin-card__note">
                  Aggregated workshop &amp; site expenses
                </span>
              </article>

              <article
                className={`project-fin-card${
                  isCriticalOverrun
                    ? ' project-fin-card--critical'
                    : isWarningThreshold
                      ? ' project-fin-card--warning'
                      : ''
                }`}
              >
                <span className="project-fin-card__label">Total Cost</span>
                <span className="project-fin-card__value">
                  {formatCurrency(financialSummary.totalCost)}
                </span>
                <span className="project-fin-card__note">
                  Purchases + other expenses
                </span>
              </article>

              <article
                className={`project-fin-card project-fin-card--highlight${
                  financialSummary.estimatedProfit < 0
                    ? ' project-fin-card--negative'
                    : ''
                }`}
              >
                <div className="project-fin-card__label-row">
                  <span className="project-fin-card__label">
                    Estimated Profit
                  </span>
                  <span className="project-fin-card__est-pill">Estimate</span>
                </div>
                <span className="project-fin-card__value">
                  {formatCurrency(financialSummary.estimatedProfit)}
                </span>
                <span className="project-fin-card__note">
                  Contract value minus recorded cost (unaudited)
                </span>
              </article>

              <article className="project-fin-card">
                <div className="project-fin-card__label-row">
                  <span className="project-fin-card__label">
                    Cost % &amp; Est. Profit Margin
                  </span>
                  <span className="project-fin-card__est-pill">Estimate</span>
                </div>
                <div className="project-fin-card__dual">
                  <div>
                    <span className="project-fin-card__sub-caption">
                      Cost %
                    </span>
                    <strong className="project-fin-card__dual-val">
                      {formatPercentage(financialSummary.costPercentage)}
                    </strong>
                  </div>
                  <div className="project-fin-card__divider" aria-hidden="true" />
                  <div>
                    <span className="project-fin-card__sub-caption">
                      Est. Margin
                    </span>
                    <strong
                      className={`project-fin-card__dual-val${
                        financialSummary.estimatedProfitMargin < 0
                          ? ' project-fin-card__dual-val--negative'
                          : ''
                      }`}
                    >
                      {formatPercentage(financialSummary.estimatedProfitMargin)}
                    </strong>
                  </div>
                </div>
                <span className="project-fin-card__note">
                  {financialSummary.contractValue === 0
                    ? 'Zero contract baseline (0% safe ratio)'
                    : `Warning threshold set at ${formatPercentage(
                        warningThresholdPercent,
                      )}`}
                </span>
              </article>
            </div>

            {financialSummary.contractValue > 0 ? (
              <div className="project-cost-meter">
                <div className="project-cost-meter__labels">
                  <span>
                    Contract Cost Utilization:{' '}
                    <strong>
                      {formatPercentage(financialSummary.costPercentage)}
                    </strong>
                  </span>
                  <span>
                    Warning Threshold:{' '}
                    <strong>{formatPercentage(warningThresholdPercent)}</strong>
                  </span>
                </div>
                <div className="project-cost-meter__track">
                  <div
                    className={`project-cost-meter__fill${
                      isCriticalOverrun
                        ? ' project-cost-meter__fill--critical'
                        : isWarningThreshold
                          ? ' project-cost-meter__fill--warning'
                          : ''
                    }`}
                    style={{ width: `${clampedProgressWidth}%` }}
                  />
                  <span
                    className="project-cost-meter__marker"
                    style={{
                      left: `${Math.min(99, Math.max(1, warningThresholdPercent))}%`,
                    }}
                    title={`${warningThresholdPercent}% warning threshold`}
                  />
                </div>
              </div>
            ) : null}

            {!financialSummary.integrations.purchaseModuleIntegrated ||
            !financialSummary.integrations.expenseModuleIntegrated ? (
              <p className="project-integration-note">
                Voucher Module Status: Purchase voucher integration is{' '}
                <strong>
                  {financialSummary.integrations.purchaseModuleIntegrated
                    ? 'connected'
                    : 'pending implementation'}
                </strong>{' '}
                and Expense voucher integration is{' '}
                <strong>
                  {financialSummary.integrations.expenseModuleIntegrated
                    ? 'connected'
                    : 'pending implementation'}
                </strong>
                . Totals update automatically once voucher records are linked.
              </p>
            ) : null}
          </>
        )}
      </section>
      ) : null}

      <div className="project-detail-columns">
        <section
          className="projects-surface project-detail-section"
          aria-labelledby="project-overview-heading"
        >
          <div className="project-section-header">
            <h2
              id="project-overview-heading"
              className="project-section-header__title"
            >
              Project &amp; Client Overview
            </h2>
          </div>

          <dl className="project-specs-list">
            <div className="project-specs-list__item">
              <dt>Project ID</dt>
              <dd>{project.projectId}</dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Project Name</dt>
              <dd>{project.name}</dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Category</dt>
              <dd>{project.category}</dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Status</dt>
              <dd>
                <ProjectStatusBadge status={project.status} />
              </dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Client Name</dt>
              <dd>{project.clientName}</dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Client Contact</dt>
              <dd
                className={
                  project.clientContact ? '' : 'projects-cell-muted'
                }
              >
                {project.clientContact ||
                  'Not supported in current Project model'}
              </dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Site Location</dt>
              <dd
                className={project.siteLocation ? '' : 'projects-cell-muted'}
              >
                {project.siteLocation ||
                  'Not persisted in current Project schema'}
              </dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Last Recorded Activity</dt>
              <dd>
                {formatProjectDateTime(project.lastActivityAt)} (
                {formatActivityTypeLabel(project.lastActivityType)})
              </dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Created By</dt>
              <dd>{project.createdBy || '—'}</dd>
            </div>
            <div className="project-specs-list__item">
              <dt>Created On</dt>
              <dd>{formatProjectDate(project.createdAt)}</dd>
            </div>
          </dl>

          <div className="project-notes-block">
            <h3 className="project-notes-block__title">
              Project Notes &amp; Scope
            </h3>
            <p className="project-notes-block__text">
              {project.description ||
                'No additional scope notes recorded for this project.'}
            </p>
          </div>
        </section>

        <section
          className="projects-surface project-detail-section"
          aria-labelledby="project-automation-heading"
        >
          <div className="project-section-header">
            <div>
              <h2
                id="project-automation-heading"
                className="project-section-header__title"
              >
                Automation &amp; Alert Activity
              </h2>
              <p className="project-section-header__subtitle">
                Threshold crossings and inactivity evaluations recorded for{' '}
                {project.projectId}.
              </p>
            </div>
          </div>

          {automationFeed.status === 'loading' ? (
            <div className="projects-alerts-skeleton" aria-busy="true" />
          ) : automationFeed.status === 'admin_only' ? (
            <div className="project-automation-empty">
              <p className="project-automation-empty__title">
                Threshold State:{' '}
                {isCriticalOverrun
                  ? 'Critical (100%+ of contract)'
                  : isWarningThreshold
                    ? `Warning (${formatPercentage(warningThresholdPercent)}+ of contract)`
                    : `Within budget (< ${formatPercentage(warningThresholdPercent)})`}
              </p>
              <p className="project-automation-empty__desc">
                Detailed alert history and project inactivity logs are
                restricted to Administrator accounts.
              </p>
            </div>
          ) : automationFeed.status === 'unavailable' ? (
            <div className="project-automation-empty">
              <p className="project-automation-empty__title">
                Alert Log Unavailable
              </p>
              <p className="project-automation-empty__desc">
                {automationFeed.errorMessage ||
                  'Unable to retrieve alert and inactivity records right now.'}
              </p>
            </div>
          ) : automationFeed.costAlerts.length === 0 &&
            automationFeed.activityWarnings.length === 0 ? (
            <div className="project-automation-empty">
              <p className="project-automation-empty__title">
                No alerts or inactivity warnings recorded
              </p>
              <p className="project-automation-empty__desc">
                Costs are currently below the{' '}
                {formatPercentage(warningThresholdPercent)} warning threshold
                and activity is up to date (inactivity window:{' '}
                {automationFeed.inactivityThresholdDays} days).
              </p>
            </div>
          ) : (
            <ul className="project-history-list">
              {automationFeed.costAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`project-history-item project-history-item--${alert.status}`}
                >
                  <div className="project-history-item__top">
                    <span
                      className={`projects-alert-item__tag projects-alert-item__tag--${alert.thresholdType}`}
                    >
                      {alert.thresholdType === 'critical'
                        ? '100% Contract Threshold'
                        : `${formatPercentage(alert.thresholdPercent)} Warning`}
                    </span>
                    <span className="project-history-item__status">
                      {alert.status === 'active' ? 'Active' : 'Resolved'}
                    </span>
                  </div>
                  <p className="project-history-item__msg">{alert.message}</p>
                  <span className="project-history-item__meta">
                    Triggered {formatProjectDateTime(alert.triggeredAt)}
                    {alert.resolvedAt
                      ? ` • Resolved ${formatProjectDateTime(alert.resolvedAt)}`
                      : ''}
                  </span>
                </li>
              ))}

              {automationFeed.activityWarnings.map((warning) => (
                <li
                  key={warning.id}
                  className={`project-history-item project-history-item--${warning.status}`}
                >
                  <div className="project-history-item__top">
                    <span className="projects-alert-item__tag projects-alert-item__tag--inactive">
                      Inactivity Warning
                    </span>
                    <span className="project-history-item__status">
                      {warning.status === 'active' ? 'Active' : 'Resolved'}
                    </span>
                  </div>
                  <p className="project-history-item__msg">{warning.message}</p>
                  <span className="project-history-item__meta">
                    Triggered {formatProjectDateTime(warning.triggeredAt)}
                    {warning.resolvedAt
                      ? ` • Resolved ${formatProjectDateTime(warning.resolvedAt)}`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isEditModalOpen ? (
        <ProjectFormModal
          key={`detail-edit-${project.id || project.projectId}`}
          mode="edit"
          project={project}
          isOpen
          onClose={closeEditModal}
          onSubmit={handleEditSubmit}
        />
      ) : null}
    </div>
  )
}
