import { formatCurrency } from '../services/projectService'
import { ProjectRowActionsMenu } from './ProjectRowActionsMenu'
import {
  ProjectCostThresholdBadge,
  ProjectInactivityBadge,
  ProjectStatusBadge,
} from './ProjectStatusBadge'
import { ProjectStatusDropdown } from './ProjectStatusDropdown'

export function ProjectsMobileList({
  projects,
  activeWarningByProjectCode,
  updatingStatusKey,
  canEditProject = true,
  canViewProfitability = true,
  onViewDetails,
  onEdit,
  onStatusChange,
}) {
  return (
    <div
      className="projects-mobile-list"
      role="list"
      aria-label="Projects list"
    >
      {projects.map((project) => {
        const targetKey = project.projectId || project.id
        const isUpdatingStatus =
          Boolean(updatingStatusKey) &&
          (String(project.projectId || '').toUpperCase() ===
            String(updatingStatusKey).toUpperCase() ||
            String(project.id || '') === String(updatingStatusKey))

        const inactivityWarning = project.projectId
          ? activeWarningByProjectCode?.get(project.projectId.toUpperCase()) ||
            null
          : null

        const isOverrun =
          canViewProfitability &&
          Boolean(project.costThresholdState?.exceededCrossed)
        const isWarning =
          canViewProfitability &&
          Boolean(project.costThresholdState?.warningCrossed)
        const hasLocation = Boolean(
          project.siteLocation && String(project.siteLocation).trim(),
        )

        let cardModifier = ''
        if (isOverrun) {
          cardModifier = ' project-mobile-card--critical'
        } else if (isWarning) {
          cardModifier = ' project-mobile-card--warning'
        }

        return (
          <article
            key={project.id || project.projectId}
            className={`project-mobile-card${cardModifier}`}
            role="listitem"
          >
            <div className="project-mobile-card__top">
              <button
                type="button"
                className="project-code-link project-code-link--compact"
                onClick={() => onViewDetails(targetKey)}
              >
                {project.projectId || '—'}
              </button>

              {canEditProject && typeof onStatusChange === 'function' ? (
                <ProjectStatusDropdown
                  project={project}
                  compact
                  isUpdating={isUpdatingStatus}
                  onStatusChange={onStatusChange}
                />
              ) : (
                <ProjectStatusBadge status={project.status} />
              )}
            </div>

            <div className="project-mobile-card__main">
              <button
                type="button"
                className="project-mobile-card__title-btn"
                onClick={() => onViewDetails(targetKey)}
              >
                {project.name}
              </button>

              <div className="project-mobile-card__subrow">
                {project.category ? (
                  <span className="project-mobile-card__category">
                    {project.category}
                  </span>
                ) : null}
                {isOverrun || isWarning ? (
                  <ProjectCostThresholdBadge
                    costThresholdState={project.costThresholdState}
                    costPercentage={project.costPercentage}
                  />
                ) : null}
                {inactivityWarning ? (
                  <ProjectInactivityBadge warning={inactivityWarning} />
                ) : null}
              </div>
            </div>

            <dl className="project-mobile-card__meta">
              <div className="project-mobile-card__meta-item">
                <dt>Client</dt>
                <dd>{project.clientName}</dd>
              </div>
              {canViewProfitability ? (
                <div className="project-mobile-card__meta-item project-mobile-card__meta-item--right">
                  <dt>Contract Value</dt>
                  <dd className="project-mobile-card__contract">
                    {formatCurrency(project.contractValue)}
                  </dd>
                </div>
              ) : null}
              {hasLocation ? (
                <div className="project-mobile-card__meta-item project-mobile-card__meta-item--full">
                  <dt>Site</dt>
                  <dd>{project.siteLocation}</dd>
                </div>
              ) : null}
            </dl>

            <div className="project-mobile-card__bottom">
              <button
                type="button"
                className="project-mobile-card__view-btn"
                onClick={() => onViewDetails(targetKey)}
              >
                <span>View Details</span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M6 3.75L10.25 8L6 12.25"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {canEditProject ? (
                <ProjectRowActionsMenu
                  project={project}
                  onViewDetails={onViewDetails}
                  onEdit={onEdit}
                  onStatusChange={onStatusChange}
                  showQuickViewButton={false}
                />
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
