import { useEffect, useRef, useState } from 'react'
import { PROJECT_STATUS_OPTIONS } from '../services/projectService'
import { ProjectStatusBadge } from './ProjectStatusBadge'

const STATUS_DESCRIPTIONS = {
  'In Progress': 'Active manufacturing, material procurement, and daily operations.',
  'Under Review': 'Production complete; awaiting client sign-off or quality audit.',
  Completed: 'Project delivered and settled. Clears open inactivity warnings.',
}

function normalizeStatus(val) {
  if (!val) return 'In Progress'
  const clean = String(val).toLowerCase().replace(/[\s_-]+/g, '')
  if (clean === 'underreview') return 'Under Review'
  if (clean === 'completed') return 'Completed'
  return 'In Progress'
}

export function ProjectStatusModal({ project, isOpen, onClose, onSubmit }) {
  const currentCanonicalStatus = normalizeStatus(project?.status)
  const [selectedStatus, setSelectedStatus] = useState(currentCanonicalStatus)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const cancelBtnRef = useRef(null)

  useEffect(() => {
    if (project?.status) {
      setSelectedStatus(normalizeStatus(project.status))
      setErrorMessage('')
    }
  }, [project?.status, project?.projectId, project?.id])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelBtnRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen || !project) {
    return null
  }

  const isCurrentStatus = selectedStatus === currentCanonicalStatus
  const targetIdentifier = String(project.projectId || project.id || '').trim()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) {
      return
    }

    if (isCurrentStatus) {
      onClose()
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)
    try {
      await onSubmit(targetIdentifier, selectedStatus)
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to update project status. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose()
        }
      }}
    >
      <div
        className="admin-modal project-status-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-status-modal-title"
      >
        <div className="admin-modal__header project-status-modal__header">
          <div className="project-status-modal__header-info">
            <span className="project-status-modal__eyebrow">Project Lifecycle</span>
            <h2 id="project-status-modal-title" className="admin-modal__title">
              Edit Status
            </h2>
            <p className="project-status-modal__subtitle">
              <span className="project-code-pill">{project.projectId || 'PRJ'}</span>
              <span className="project-status-modal__project-name">
                {project.name}
              </span>
            </p>
          </div>

          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close status dialog"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5L15 15M15 5L5 15"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="project-status-modal__form">
          <div className="admin-modal__body project-status-modal__body">
            {errorMessage ? (
              <div
                className="projects-feedback projects-feedback--error project-status-modal__alert"
                role="alert"
              >
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <div className="project-status-modal__current-row">
              <span className="project-status-modal__label">Current Status:</span>
              <ProjectStatusBadge status={currentCanonicalStatus} />
            </div>

            <fieldset className="project-status-modal__options-group">
              <legend className="project-status-modal__legend">
                Select New Status
              </legend>

              <div
                className="project-status-options-list"
                role="radiogroup"
                aria-label="Project Status Selection"
              >
                {PROJECT_STATUS_OPTIONS.map((statusOption) => {
                  const isSelected = selectedStatus === statusOption
                  const isCurrent = currentCanonicalStatus === statusOption

                  return (
                    <div
                      key={statusOption}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={() => {
                        if (!isSubmitting) {
                          setSelectedStatus(statusOption)
                        }
                      }}
                      onKeyDown={(event) => {
                        if ((event.key === ' ' || event.key === 'Enter') && !isSubmitting) {
                          event.preventDefault()
                          setSelectedStatus(statusOption)
                        }
                      }}
                      className={`project-status-option${
                        isSelected ? ' project-status-option--selected' : ''
                      }${isCurrent ? ' project-status-option--current' : ''}`}
                    >
                      <input
                        type="radio"
                        name="projectStatus"
                        value={statusOption}
                        checked={isSelected}
                        onChange={() => setSelectedStatus(statusOption)}
                        disabled={isSubmitting}
                        tabIndex={-1}
                        className="project-status-option__radio"
                        aria-hidden="true"
                      />

                      <div className="project-status-option__content">
                        <div className="project-status-option__top">
                          <ProjectStatusBadge status={statusOption} />
                          {isCurrent ? (
                            <span className="project-status-option__current-tag">
                              Current
                            </span>
                          ) : null}
                          {isSelected && !isCurrent ? (
                            <span className="project-status-option__new-tag">
                              New Selection
                            </span>
                          ) : null}
                        </div>
                        <p className="project-status-option__desc">
                          {STATUS_DESCRIPTIONS[statusOption]}
                        </p>
                      </div>

                      <div
                        className="project-status-option__indicator"
                        aria-hidden="true"
                      >
                        <div className="project-status-option__indicator-dot" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </fieldset>

            {!isCurrentStatus ? (
              <div className="project-status-modal__transition-preview">
                <span className="project-status-modal__transition-label">
                  Status will change:
                </span>
                <div className="project-status-modal__transition-badges">
                  <ProjectStatusBadge status={currentCanonicalStatus} />
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    className="project-status-modal__transition-arrow"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 3L11 8L6 13"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <ProjectStatusBadge status={selectedStatus} />
                </div>
              </div>
            ) : (
              <p className="project-status-modal__hint">
                Click a different status above to update this project.
              </p>
            )}

            {selectedStatus === 'Completed' && currentCanonicalStatus !== 'Completed' ? (
              <div className="project-status-modal__note">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <circle
                    cx="10"
                    cy="10"
                    r="8.25"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M10 6.5V10.5M10 13.5H10.01"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  Marking this project as <strong>Completed</strong> will automatically
                  resolve any pending operational inactivity alerts.
                </span>
              </div>
            ) : null}
          </div>

          <div className="admin-modal__footer project-status-modal__footer">
            <button
              ref={cancelBtnRef}
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={isSubmitting || isCurrentStatus}
              title={
                isCurrentStatus
                  ? 'Select a different status option to enable update'
                  : `Save project status as ${selectedStatus}`
              }
            >
              {isSubmitting ? (
                <>
                  <span className="projects-btn-spinner" aria-hidden="true" />
                  <span>Saving...</span>
                </>
              ) : isCurrentStatus ? (
                <span>No Changes</span>
              ) : (
                <span>Update to {selectedStatus}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
