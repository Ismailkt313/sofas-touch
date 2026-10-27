import { formatCurrency } from '../services/projectService'
import {
  ProjectCostThresholdBadge,
  ProjectInactivityBadge,
  ProjectStatusBadge,
} from './ProjectStatusBadge'

export function ProjectsMobileList({
  projects,
  activeWarningByProjectCode,
  onViewDetails,
  onEdit,
}) {
  return (
    <div
      className="projects-mobile-list"
      role="list"
      aria-label="Projects list"
    >
      {projects.map((project) => {
        const targetKey = project.projectId || project.id
        const inactivityWarning = project.projectId
          ? activeWarningByProjectCode?.get(project.projectId.toUpperCase()) ||
            null
          : null

        const isOverrun = Boolean(project.costThresholdState?.exceededCrossed)
        const isWarning = Boolean(project.costThresholdState?.warningCrossed)

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
              <span className="project-code-pill">
                {project.projectId || '—'}
              </span>
              <ProjectStatusBadge status={project.status} />
            </div>

            <h3 className="project-mobile-card__title">{project.name}</h3>
            <p className="project-mobile-card__category">{project.category}</p>

            {isOverrun || isWarning || inactivityWarning ? (
              <div className="project-mobile-card__alerts">
                <ProjectCostThresholdBadge
                  costThresholdState={project.costThresholdState}
                  costPercentage={project.costPercentage}
                />
                <ProjectInactivityBadge warning={inactivityWarning} />
              </div>
            ) : null}

            <dl className="project-mobile-card__meta">
              <div className="project-mobile-card__meta-item">
                <dt>Client</dt>
                <dd>{project.clientName}</dd>
              </div>
              <div className="project-mobile-card__meta-item">
                <dt>Site Location</dt>
                <dd>{project.siteLocation || '—'}</dd>
              </div>
              <div className="project-mobile-card__meta-item project-mobile-card__meta-item--full">
                <dt>Contract Value</dt>
                <dd className="project-mobile-card__contract">
                  {formatCurrency(project.contractValue)}
                </dd>
              </div>
            </dl>

            <div className="project-mobile-card__actions">
              <button
                type="button"
                className="admin-btn admin-btn--secondary project-mobile-card__btn"
                onClick={() => onEdit(project)}
              >
                Edit
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--primary project-mobile-card__btn"
                onClick={() => onViewDetails(targetKey)}
              >
                View Details
              </button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
