import { Dropdown } from '../../../components/common'
import {
  DASHBOARD_PROJECT_SORT_OPTIONS,
  DASHBOARD_PROJECT_STATUS_OPTIONS,
  formatDashboardCurrency,
  formatDashboardPercent,
  getProjectHealthBadgeMeta,
  getProjectStatusBadgeTone,
  parseDashboardSort,
} from '../utils/dashboardFormatters'
import { ProjectPerformanceChart } from './ProjectPerformanceChart'

export function ProjectProfitabilitySection({
  items = [],
  totalMatching = 0,
  searchInput,
  projectStatus,
  projectSortBy,
  projectSortOrder,
  isAdmin,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onResetFilters,
  onNavigate,
}) {
  const compositeSort = `${projectSortBy}:${projectSortOrder}`
  const hasFilters = Boolean(searchInput.trim() || projectStatus !== 'all')

  const handleLinkClick = (event, path) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      onNavigate?.(path)
    }
  }

  return (
    <section
      className="sts-dash-card sts-dash-profit-section"
      aria-labelledby="sts-dash-profit-heading"
    >
      <header className="sts-dash-card__header">
        <div>
          <span className="sts-dash-card__eyebrow">Portfolio Performance</span>
          <h2 id="sts-dash-profit-heading" className="sts-dash-card__title">
            Project Cost &amp; Profitability
          </h2>
          <p className="sts-dash-card__subtitle">
            Contract value versus active material purchases and project expenses.
          </p>
        </div>

        <div className="sts-dash-card__header-links">
          {isAdmin ? (
            <a
              href="/reports"
              className="sts-dash-link-btn"
              onClick={(e) => handleLinkClick(e, '/reports')}
            >
              Full Reports
            </a>
          ) : null}
          <a
            href="/projects"
            className="sts-dash-link-btn sts-dash-link-btn--subtle"
            onClick={(e) => handleLinkClick(e, '/projects')}
          >
            All Projects
          </a>
        </div>
      </header>

      <div className="sts-dash-profit-controls">
        <div className="sts-dash-search">
          <svg
            className="sts-dash-search__icon"
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
            className="sts-dash-search__input"
            placeholder="Search project ID, project name, or client..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Filter project profitability list"
          />
        </div>

        <div className="sts-dash-profit-controls__selects">
          <div className="sts-dash-control-item">
            <Dropdown
              value={projectStatus}
              options={DASHBOARD_PROJECT_STATUS_OPTIONS}
              onChange={onStatusChange}
              placeholder="All Statuses"
              ariaLabel="Filter projects by status"
            />
          </div>

          <div className="sts-dash-control-item">
            <Dropdown
              value={compositeSort}
              options={DASHBOARD_PROJECT_SORT_OPTIONS}
              onChange={(val) => {
                const parsed = parseDashboardSort(val)
                onSortChange(parsed.sortBy, parsed.sortOrder)
              }}
              placeholder="Sort projects"
              ariaLabel="Sort project profitability"
            />
          </div>
        </div>
      </div>

      <ProjectPerformanceChart items={items} onNavigate={onNavigate} />

      <div className="sts-dash-profit-list-head">
        <span>
          Showing <strong>{items.length}</strong> of{' '}
          <strong>{totalMatching}</strong>{' '}
          {totalMatching === 1 ? 'project' : 'projects'}
        </span>
        {hasFilters ? (
          <button
            type="button"
            className="sts-dash-text-reset"
            onClick={onResetFilters}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="sts-dash-empty-box">
          <p className="sts-dash-empty-box__title">
            {hasFilters
              ? 'No projects match your current filters'
              : 'No projects recorded yet'}
          </p>
          <p className="sts-dash-empty-box__sub">
            {hasFilters
              ? 'Clear the search or status filter to inspect all projects.'
              : 'Create your first client sofa or curtain project to track contract profitability.'}
          </p>
        </div>
      ) : (
        <>
          <div className="sts-dash-table-wrap">
            <table className="sts-dash-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Status &amp; Budget</th>
                  <th className="sts-dash-table__num">Contract Value</th>
                  <th className="sts-dash-table__num">Total Costs</th>
                  <th className="sts-dash-table__num">Est. Profit</th>
                  <th className="sts-dash-table__num">Margin</th>
                  <th className="sts-dash-table__act">Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const healthMeta = getProjectHealthBadgeMeta(row.healthStatus)
                  const statusTone = getProjectStatusBadgeTone(row.status)
                  const negProfit = row.estimatedProfit < 0

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="sts-dash-proj-cell">
                          <div className="sts-dash-proj-cell__top">
                            <span className="sts-dash-code-tag">
                              {row.projectId}
                            </span>
                            <span className="sts-dash-proj-cell__cat">
                              {row.category}
                            </span>
                          </div>
                          <strong className="sts-dash-proj-cell__name">
                            {row.name}
                          </strong>
                          <span className="sts-dash-proj-cell__client">
                            {row.clientName}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="sts-dash-badge-stack">
                          <span
                            className={`sts-dash-pill sts-dash-pill--${statusTone}`}
                          >
                            {row.status}
                          </span>
                          <span
                            className={`sts-dash-pill sts-dash-pill--${healthMeta.tone}`}
                          >
                            {healthMeta.label}
                          </span>
                        </div>
                      </td>

                      <td className="sts-dash-table__num">
                        {formatDashboardCurrency(row.contractValue)}
                      </td>

                      <td className="sts-dash-table__num">
                        <div className="sts-dash-cost-cell">
                          <strong>
                            {formatDashboardCurrency(row.totalProjectCosts)}
                          </strong>
                          <span>
                            P: {formatDashboardCurrency(row.materialPurchaseCosts)}{' '}
                            &middot; E:{' '}
                            {formatDashboardCurrency(row.otherProjectExpenses)}
                          </span>
                        </div>
                      </td>

                      <td
                        className={`sts-dash-table__num ${negProfit ? 'sts-dash-num--neg' : 'sts-dash-num--pos'}`}
                      >
                        <strong>
                          {formatDashboardCurrency(row.estimatedProfit)}
                        </strong>
                      </td>

                      <td
                        className={`sts-dash-table__num ${negProfit ? 'sts-dash-num--neg' : ''}`}
                      >
                        {formatDashboardPercent(
                          row.profitMargin,
                          row.marginApplicable,
                        )}
                      </td>

                      <td className="sts-dash-table__act">
                        <a
                          href={row.detailPath}
                          className="sts-dash-row-link"
                          onClick={(e) => handleLinkClick(e, row.detailPath)}
                        >
                          {isAdmin ? 'Report' : 'View'}
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="sts-dash-mobile-cards" role="list">
            {items.map((row) => {
              const healthMeta = getProjectHealthBadgeMeta(row.healthStatus)
              const statusTone = getProjectStatusBadgeTone(row.status)
              const negProfit = row.estimatedProfit < 0

              return (
                <article
                  key={row.id}
                  role="listitem"
                  className="sts-dash-proj-mcard"
                >
                  <div className="sts-dash-proj-mcard__top">
                    <div>
                      <span className="sts-dash-code-tag">{row.projectId}</span>
                      <h3 className="sts-dash-proj-mcard__name">{row.name}</h3>
                      <span className="sts-dash-proj-mcard__client">
                        {row.clientName} &bull; {row.category}
                      </span>
                    </div>
                    <div className="sts-dash-badge-stack sts-dash-badge-stack--end">
                      <span
                        className={`sts-dash-pill sts-dash-pill--${statusTone}`}
                      >
                        {row.status}
                      </span>
                      <span
                        className={`sts-dash-pill sts-dash-pill--${healthMeta.tone}`}
                      >
                        {healthMeta.label}
                      </span>
                    </div>
                  </div>

                  <div className="sts-dash-proj-mcard__grid">
                    <div>
                      <span>Contract Value</span>
                      <strong>
                        {formatDashboardCurrency(row.contractValue)}
                      </strong>
                    </div>
                    <div>
                      <span>Total Costs</span>
                      <strong>
                        {formatDashboardCurrency(row.totalProjectCosts)}
                      </strong>
                    </div>
                    <div>
                      <span>Est. Profit</span>
                      <strong
                        className={
                          negProfit ? 'sts-dash-num--neg' : 'sts-dash-num--pos'
                        }
                      >
                        {formatDashboardCurrency(row.estimatedProfit)}
                      </strong>
                    </div>
                    <div>
                      <span>Profit Margin</span>
                      <strong>
                        {formatDashboardPercent(
                          row.profitMargin,
                          row.marginApplicable,
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="sts-dash-proj-mcard__foot">
                    <span className="sts-dash-proj-mcard__sub">
                      Purchases{' '}
                      {formatDashboardCurrency(row.materialPurchaseCosts)}{' '}
                      &middot; Expenses{' '}
                      {formatDashboardCurrency(row.otherProjectExpenses)}
                    </span>
                    <a
                      href={row.detailPath}
                      className="sts-dash-row-link"
                      onClick={(e) => handleLinkClick(e, row.detailPath)}
                    >
                      {isAdmin ? 'Open Report' : 'Open Project'}
                    </a>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
