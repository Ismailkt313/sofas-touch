import '../../permissions/styles/permissions.css'
import { ProjectStatusBadge } from '../../projects/components/ProjectStatusBadge'
import { RecentTransactionsCard } from './RecentTransactionsCard'
import { StockAlertsCard } from './StockAlertsCard'

export function OperationalDashboardView({
  overview,
  canViewMaterials,
  canViewPurchases,
  canViewExpenses,
  onNavigate,
}) {
  const operational = overview?.operational || {}
  const quickActions = operational.quickActions || []
  const validationAlerts = operational.validationAlerts || []
  const projectSummary = operational.projectSummary || null
  const guidanceNote = operational.guidanceNote || ''

  return (
    <div className="ops-desk">
      {guidanceNote ? (
        <div className="ops-guidance" role="note">
          <strong>Daily Entry Guidance:</strong>
          <span>{guidanceNote}</span>
        </div>
      ) : null}

      {quickActions.length > 0 ? (
        <section aria-label="Permitted daily actions">
          <div className="ops-actions-grid">
            {quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="ops-action-card"
                onClick={() => onNavigate?.(action.path)}
              >
                <span className="ops-action-card__title">{action.label}</span>
                <span className="ops-action-card__desc">
                  {action.description}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {validationAlerts.length > 0 ? (
        <section
          className="rbac-surface"
          aria-label="Entry validation reminders"
        >
          <h2
            className="rbac-header__title"
            style={{ fontSize: '1.06rem', marginBottom: '12px' }}
          >
            Attention &amp; Entry Checks
          </h2>
          <div className="ops-validation-list">
            {validationAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`ops-validation-item${
                  alert.severity === 'info' ? ' ops-validation-item--info' : ''
                }`}
              >
                <div>
                  <div className="ops-validation-item__title">
                    {alert.title}
                  </div>
                  <div className="ops-validation-item__desc">
                    {alert.description}
                  </div>
                </div>
                {alert.actionPath && alert.actionLabel ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    onClick={() => onNavigate?.(alert.actionPath)}
                  >
                    {alert.actionLabel}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {projectSummary ? (
        <section className="rbac-surface" aria-label="Accessible projects">
          <div className="rbac-header" style={{ marginBottom: '14px' }}>
            <div>
              <h2
                className="rbac-header__title"
                style={{ fontSize: '1.1rem' }}
              >
                Active Projects Reference
              </h2>
              <p className="rbac-header__subtitle">
                Operational project codes for linking material purchases and
                workshop expenses.
              </p>
            </div>
            <div className="ops-stat-pills">
              <span className="ops-stat-pill">
                <strong>{projectSummary.inProgress}</strong> In Progress
              </span>
              <span className="ops-stat-pill">
                <strong>{projectSummary.underReview}</strong> Under Review
              </span>
              <span className="ops-stat-pill">
                <strong>{projectSummary.completed}</strong> Completed
              </span>
            </div>
          </div>

          {projectSummary.items.length === 0 ? (
            <p className="rbac-header__subtitle">
              No projects are currently open in your assigned workspace scope.
            </p>
          ) : (
            <div className="rbac-matrix-wrap">
              <table className="rbac-matrix-table">
                <thead>
                  <tr>
                    <th scope="col">Project Code</th>
                    <th scope="col">Project Name</th>
                    <th scope="col">Client</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projectSummary.items.map((proj) => (
                    <tr key={proj.id || proj.projectId}>
                      <td>
                        <button
                          type="button"
                          className="project-code-link"
                          onClick={() => onNavigate?.(proj.detailPath)}
                        >
                          {proj.projectId}
                        </button>
                      </td>
                      <td>{proj.name}</td>
                      <td>{proj.clientName}</td>
                      <td>{proj.category}</td>
                      <td>
                        <ProjectStatusBadge status={proj.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <div className="sts-dash-bottom-grid">
        <div className="sts-dash-bottom-grid__main">
          {canViewPurchases || canViewExpenses ? (
            <RecentTransactionsCard
              transactions={overview.recentTransactions || []}
              onNavigate={onNavigate}
            />
          ) : null}
        </div>

        <div className="sts-dash-bottom-grid__side">
          {canViewMaterials && overview.stockAlerts ? (
            <StockAlertsCard
              stockAlerts={overview.stockAlerts}
              isAdmin={false}
              onNavigate={onNavigate}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
