import { formatCurrency } from '../services/projectService'
import { ProjectRowActionsMenu } from './ProjectRowActionsMenu'
import {
  ProjectCostThresholdBadge,
  ProjectInactivityBadge,
  ProjectStatusBadge,
} from './ProjectStatusBadge'

export function ProjectsTable({
  projects,
  activeWarningByProjectCode,
  onViewDetails,
  onEdit,
}) {
  return (
    <div className="projects-table-wrap">
      <table className="projects-table">
        <thead>
          <tr>
            <th scope="col">Project ID</th>
            <th scope="col">Project Name</th>
            <th scope="col">Client</th>
            <th scope="col">Site Location</th>
            <th scope="col" className="projects-table__col-numeric">
              Contract Value
            </th>
            <th scope="col">Status</th>
            <th scope="col" className="projects-table__col-actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const targetKey = project.projectId || project.id
            const inactivityWarning = project.projectId
              ? activeWarningByProjectCode?.get(
                  project.projectId.toUpperCase(),
                ) || null
              : null

            const isOverrun = Boolean(
              project.costThresholdState?.exceededCrossed,
            )
            const isWarning = Boolean(
              project.costThresholdState?.warningCrossed,
            )

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
                      <ProjectCostThresholdBadge
                        costThresholdState={project.costThresholdState}
                        costPercentage={project.costPercentage}
                      />
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

                <td>
                  <span
                    className={
                      project.siteLocation ? 'projects-cell-location' : 'projects-cell-muted'
                    }
                    title={
                      project.siteLocation
                        ? project.siteLocation
                        : 'Site location is not persisted in the current backend Project schema'
                    }
                  >
                    {project.siteLocation || '—'}
                  </span>
                </td>

                <td className="projects-table__col-numeric">
                  <span className="projects-cell-currency">
                    {formatCurrency(project.contractValue)}
                  </span>
                </td>

                <td>
                  <ProjectStatusBadge status={project.status} />
                </td>

                <td className="projects-table__col-actions">
                  <ProjectRowActionsMenu
                    project={project}
                    onViewDetails={onViewDetails}
                    onEdit={onEdit}
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
