import { ProjectAutomationBanners } from '../components/ProjectAutomationBanners'
import { ProjectFormModal } from '../components/ProjectFormModal'
import { ProjectsFiltersBar } from '../components/ProjectsFiltersBar'
import { ProjectsMobileList } from '../components/ProjectsMobileList'
import { ProjectsPagination } from '../components/ProjectsPagination'
import { ProjectsSummaryStrip } from '../components/ProjectsSummaryStrip'
import { ProjectsTable } from '../components/ProjectsTable'
import { useProjectsList } from '../hooks/useProjectsList'
import '../styles/projects.css'

export function ProjectsPage({ currentUser, onNavigate }) {
  const {
    projects,
    totalProjects,
    totalPages,
    currentPage,
    rangeStart,
    rangeEnd,
    setCurrentPage,

    statusCounts,
    adminAccess,

    searchInput,
    statusFilter,
    categoryFilter,
    hasActiveFilters,
    handleSearchChange,
    handleStatusFilterChange,
    handleCategoryFilterChange,
    handleApplyFilters,
    resetFilters,

    isLoading,
    isRefreshing,
    authRequired,
    error,
    reloadProjects,

    automationState,
    activeWarningByProjectCode,
    isEvaluatingInactivity,
    handleRunInactivityEvaluation,

    feedbackBanner,
    clearFeedbackBanner,

    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    handleCreateSubmit,

    editingProject,
    openEditModal,
    closeEditModal,
    handleEditSubmit,

    updatingStatusKey,
    handleStatusSubmit,
  } = useProjectsList({ currentUser })

  const handleViewProject = (projectIdentifier) => {
    if (!projectIdentifier) {
      return
    }
    onNavigate?.(`/projects/${encodeURIComponent(projectIdentifier)}`)
  }

  return (
    <div className="projects-page">
      <header className="projects-header">
        <div className="projects-header__text">
          <h1 className="projects-header__title">Projects</h1>
          <p className="projects-header__subtitle">
            Manage manufacturing projects, contract values, and project costs.
          </p>
        </div>

        {!authRequired ? (
          <div className="projects-header__actions">
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={openCreateModal}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 4.25V15.75M4.25 10H15.75"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
              <span>Add Project</span>
            </button>
          </div>
        ) : null}
      </header>

      {feedbackBanner ? (
        <div
          className={`projects-feedback projects-feedback--${feedbackBanner.tone}`}
          role="status"
        >
          <div className="projects-feedback__content">
            <span>{feedbackBanner.text}</span>
            {feedbackBanner.projectId ? (
              <button
                type="button"
                className="projects-feedback__link"
                onClick={() => handleViewProject(feedbackBanner.projectId)}
              >
                Open project details
              </button>
            ) : null}
          </div>
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

      {authRequired ? (
        <section className="projects-surface">
          <div className="projects-state">
            <div className="projects-state__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect
                  x="4"
                  y="11"
                  width="16"
                  height="9"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M8 11V7.5C8 5.29 9.79 3.5 12 3.5C14.21 3.5 16 5.29 16 7.5V11"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="projects-state__title">Sign in required</h2>
            <p className="projects-state__message">
              Please sign in with an approved Data Entry or Administrator
              account to view and manage manufacturing projects.
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
      ) : (
        <>
          <ProjectsSummaryStrip
            statusCounts={statusCounts}
            activeStatus={statusFilter}
            onSelectStatus={handleStatusFilterChange}
            adminAccess={adminAccess}
            automationState={automationState}
          />

          <ProjectAutomationBanners
            adminAccess={adminAccess}
            automationState={automationState}
            onViewProject={handleViewProject}
            onRunInactivityCheck={handleRunInactivityEvaluation}
            isEvaluatingInactivity={isEvaluatingInactivity}
          />

          <section
            className={`projects-surface${
              isRefreshing ? ' projects-surface--refreshing' : ''
            }`}
            aria-label="Projects directory"
          >
            <ProjectsFiltersBar
              searchQuery={searchInput}
              statusFilter={statusFilter}
              categoryFilter={categoryFilter}
              hasActiveFilters={hasActiveFilters}
              totalMatching={totalProjects}
              onSearchChange={handleSearchChange}
              onStatusFilterChange={handleStatusFilterChange}
              onCategoryFilterChange={handleCategoryFilterChange}
              onApplyFilters={handleApplyFilters}
              onResetFilters={resetFilters}
            />

            {isLoading ? (
              <div
                className="projects-loading"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <span className="sr-only">Loading manufacturing projects...</span>
                {[1, 2, 3, 4].map((row) => (
                  <div
                    key={row}
                    className="projects-skeleton-row"
                    aria-hidden="true"
                  >
                    <div className="projects-skeleton-code" />
                    <div className="projects-skeleton-lines">
                      <div className="projects-skeleton-line projects-skeleton-line--title" />
                      <div className="projects-skeleton-line projects-skeleton-line--sub" />
                    </div>
                    <div className="projects-skeleton-pill" />
                    <div className="projects-skeleton-pill" />
                  </div>
                ))}
              </div>
            ) : error ? (
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
                  Unable to load projects
                </h2>
                <p className="projects-state__message">{error}</p>
                <div className="projects-state__actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    onClick={reloadProjects}
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div className="projects-state">
                <div className="projects-state__icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 6.5C4 5.4 4.9 4.5 6 4.5H10L12 6.5H18C19.1 6.5 20 7.4 20 8.5V17.5C20 18.6 19.1 19.5 18 19.5H6C4.9 19.5 4 18.6 4 17.5V6.5Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                {hasActiveFilters ? (
                  <>
                    <h2 className="projects-state__title">
                      No matching projects
                    </h2>
                    <p className="projects-state__message">
                      No projects matched your current search or filter
                      selection. Clear the active filters to view all projects.
                    </p>
                    <div className="projects-state__actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary"
                        onClick={resetFilters}
                      >
                        Reset filters
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="projects-state__title">
                      No projects registered yet
                    </h2>
                    <p className="projects-state__message">
                      Create your first bespoke sofa, curtain, or interior
                      manufacturing project to start tracking contract value and
                      costs.
                    </p>
                    <div className="projects-state__actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--primary"
                        onClick={openCreateModal}
                      >
                        Add Project
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <ProjectsTable
                  projects={projects}
                  activeWarningByProjectCode={activeWarningByProjectCode}
                  updatingStatusKey={updatingStatusKey}
                  onViewDetails={handleViewProject}
                  onEdit={openEditModal}
                  onStatusChange={handleStatusSubmit}
                />

                <ProjectsMobileList
                  projects={projects}
                  activeWarningByProjectCode={activeWarningByProjectCode}
                  updatingStatusKey={updatingStatusKey}
                  onViewDetails={handleViewProject}
                  onEdit={openEditModal}
                  onStatusChange={handleStatusSubmit}
                />

                <ProjectsPagination
                  activePage={currentPage}
                  totalPages={totalPages}
                  totalMatching={totalProjects}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </section>
        </>
      )}

      {isCreateModalOpen ? (
        <ProjectFormModal
          key="create-project-modal"
          mode="create"
          isOpen
          onClose={closeCreateModal}
          onSubmit={handleCreateSubmit}
        />
      ) : null}

      {editingProject ? (
        <ProjectFormModal
          key={`edit-project-${editingProject.id || editingProject.projectId}`}
          mode="edit"
          project={editingProject}
          isOpen
          onClose={closeEditModal}
          onSubmit={handleEditSubmit}
        />
      ) : null}
    </div>
  )
}
