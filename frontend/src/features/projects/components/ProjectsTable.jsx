import { formatCurrency } from '../services/projectService'
import { ProjectRowActionsMenu } from './ProjectRowActionsMenu'
import {
  ProjectCostThresholdBadge,
  ProjectInactivityBadge,
  ProjectStatusBadge,
} from './ProjectStatusBadge'
import { ProjectStatusDropdown } from './ProjectStatusDropdown'

export function ProjectsTable({
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
    <div className="projects-table-wrap">
      <table className="projects-table">
        <thead>
          <tr>
            <th scope="col">Project ID</th>
            <th scope="col">Project Name</th>
            <th scope="col">Client</th>
            {canViewProfitability ? (
              <th scope="col" className="projects-table__col-numeric">
                Contract Value
              </th>
            ) : null}
            <th scope="col">Status</th>
            <th scope="col" className="projects-table__col-actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const targetKey = project.projectId || project.id
            const isUpdatingStatus =
              Boolean(updatingStatusKey) &&
              (String(project.projectId || '').toUpperCase() ===
                String(updatingStatusKey).toUpperCase() ||
                String(project.id || '') === String(updatingStatusKey))

            const inactivityWarning = project.projectId
              ? activeWarningByProjectCode?.get(
                  project.projectId.toUpperCase(),
                ) || null
              : null

            const isOverrun =
              canViewProfitability &&
              Boolean(project.costThresholdState?.exceededCrossed)
            const isWarning =
              canViewProfitability &&
              Boolean(project.costThresholdState?.warningCrossed)

            let rowClassName = ''
            if (isOverrun) {
              rowClassName = 'projects-table__row--critical'
            } else if (isWarning) {
              rowClassName = 'projects-table__row--warning'
            }

            return (
              <tr key={project.id || project.projectId} className={rowClassName}>
                <td className="projects-table__cell-code">
                  <button
                    type="button"
                    className="project-code-link"
                    onClick={() => onViewDetails(targetKey)}
                    title={`View details for ${project.projectId}`}
                  >
                    {project.projectId || '—'}
                  </button>
                </td>

                <td>
                  <div className="projects-cell-primary">
                    <button
                      type="button"
                      className="projects-cell-primary__name-btn"
                      onClick={() => onViewDetails(targetKey)}
                    >
                      {project.name}
                    </button>
                    <div className="projects-cell-primary__sub">
                      <span className="projects-cell-category">
                        {project.category}
                      </span>
                      {canViewProfitability ? (
                        <ProjectCostThresholdBadge
                          costThresholdState={project.costThresholdState}
                          costPercentage={project.costPercentage}
                        />
                      ) : null}
                      <ProjectInactivityBadge warning={inactivityWarning} />
                    </div>
                  </div>
                </td>

                <td>
                  <div className="projects-cell-client">
                    <span className="projects-cell-client__name">
                      {project.clientName}
                    </span>
                    {project.clientContact ? (
                      <span className="projects-cell-client__contact">
                        {project.clientContact}
                      </span>
                    ) : null}
                  </div>
                </td>

                {canViewProfitability ? (
                  <td className="projects-table__col-numeric">
                    <span className="projects-cell-currency">
                      {formatCurrency(project.contractValue)}
                    </span>
                  </td>
                ) : null}

                <td>
                  {canEditProject && typeof onStatusChange === 'function' ? (
                    <ProjectStatusDropdown
                      project={project}
                      isUpdating={isUpdatingStatus}
                      onStatusChange={onStatusChange}
                    />
                  ) : (
                    <ProjectStatusBadge status={project.status} />
                  )}
                </td>

                <td className="projects-table__col-actions">
                  <ProjectRowActionsMenu
                    project={project}
                    onViewDetails={onViewDetails}
                    onEdit={canEditProject ? onEdit : null}
                    onStatusChange={canEditProject ? onStatusChange : null}
                    showQuickViewButton
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
