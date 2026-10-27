import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PROJECT_STATUS_OPTIONS } from '../services/projectService'

const MENU_WIDTH = 192
const VIEWPORT_MARGIN = 10

function normalizeStatusValue(status) {
  const clean = String(status || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (clean === 'underreview') return 'Under Review'
  if (clean === 'completed') return 'Completed'
  return 'In Progress'
}

function getDotModifier(status) {
  if (status === 'Completed') return 'completed'
  if (status === 'Under Review') return 'under-review'
  return 'in-progress'
}

function computeMenuCoords(triggerEl, includeViewItem) {
  if (!triggerEl || typeof window === 'undefined') {
    return null
  }

  const rect = triggerEl.getBoundingClientRect()
  if (
    rect.bottom < 0 ||
    rect.top > window.innerHeight ||
    rect.right < 0 ||
    rect.left > window.innerWidth
  ) {
    return null
  }

  const estimatedMenuHeight = includeViewItem ? 228 : 192
  const spaceBelow = window.innerHeight - rect.bottom
  const openUpward =
    spaceBelow < estimatedMenuHeight + VIEWPORT_MARGIN &&
    rect.top > estimatedMenuHeight + VIEWPORT_MARGIN

  const top = openUpward ? rect.top - estimatedMenuHeight - 6 : rect.bottom + 6
  const rawLeft = rect.right - MENU_WIDTH
  const maxLeft = Math.max(
    VIEWPORT_MARGIN,
    window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN,
  )
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rawLeft, maxLeft))

  return { top: Math.round(top), left: Math.round(left) }
}

export function ProjectRowActionsMenu({
  project,
  onViewDetails,
  onEdit,
  onStatusChange,
  showQuickViewButton = true,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  const currentStatus = normalizeStatusValue(project?.status)
  const targetKey = String(project?.projectId || project?.id || '').trim()

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus()
      })
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleScrollOrResize = () => {
      const next = computeMenuCoords(triggerRef.current, showQuickViewButton)
      if (!next) {
        setIsOpen(false)
      } else {
        setCoords(next)
      }
    }

    const handlePointerDown = (event) => {
      if (
        menuRef.current?.contains(event.target) ||
        triggerRef.current?.contains(event.target)
      ) {
        return
      }
      setIsOpen(false)
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu(true)
      }
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: true })
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closeMenu, showQuickViewButton])

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    const nextCoords = computeMenuCoords(
      triggerRef.current,
      showQuickViewButton,
    )
    if (nextCoords) {
      setCoords(nextCoords)
    }
    setIsOpen(true)
  }

  return (
    <div className="project-row-actions">
      {showQuickViewButton ? (
        <button
          type="button"
          className="project-row-actions__quick-btn"
          onClick={() => onViewDetails(targetKey)}
        >
          View Details
        </button>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        className={`project-row-actions__menu-btn${
          isOpen ? ' project-row-actions__menu-btn--open' : ''
        }`}
        onClick={handleToggle}
        aria-label={`More actions for ${project.projectId || project.name}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="4.5" r="1.4" fill="currentColor" />
          <circle cx="10" cy="10" r="1.4" fill="currentColor" />
          <circle cx="10" cy="15.5" r="1.4" fill="currentColor" />
        </svg>
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={menuId}
              ref={menuRef}
              className="project-portal-menu"
              role="menu"
              style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${MENU_WIDTH}px`,
              }}
            >
              {showQuickViewButton ? (
                <button
                  type="button"
                  className="project-portal-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false)
                    onViewDetails(targetKey)
                  }}
                >
                  <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path
                      d="M1.75 9C3.1 5.6 5.8 3.75 9 3.75C12.2 3.75 14.9 5.6 16.25 9C14.9 12.4 12.2 14.25 9 14.25C5.8 14.25 3.1 12.4 1.75 9Z"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <circle
                      cx="9"
                      cy="9"
                      r="2.25"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                  </svg>
                  <span>View Details</span>
                </button>
              ) : null}

              <button
                type="button"
                className="project-portal-menu__item"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false)
                  onEdit(project)
                }}
              >
                <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M12.65 3.1L14.9 5.35L6.1 14.15H3.85V11.9L12.65 3.1Z"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Edit Project</span>
              </button>

              {typeof onStatusChange === 'function' ? (
                <>
                  <div
                    className="project-portal-menu__divider"
                    role="separator"
                  />
                  <div className="project-portal-menu__section-label">
                    Status
                  </div>
                  {PROJECT_STATUS_OPTIONS.map((statusOption) => {
                    const isCurrent = statusOption === currentStatus
                    const dotTone = getDotModifier(statusOption)

                    return (
                      <button
                        key={statusOption}
                        type="button"
                        className={`project-portal-menu__item project-portal-menu__item--status${
                          isCurrent
                            ? ' project-portal-menu__item--active'
                            : ''
                        }`}
                        role="menuitemradio"
                        aria-checked={isCurrent}
                        onClick={() => {
                          setIsOpen(false)
                          if (!isCurrent && targetKey) {
                            onStatusChange(targetKey, statusOption)
                          }
                        }}
                      >
                        <span className="project-status-menu__item-left">
                          <span
                            className={`project-status-menu__dot project-status-menu__dot--${dotTone}`}
                            aria-hidden="true"
                          />
                          <span>{statusOption}</span>
                        </span>
                        {isCurrent ? (
                          <svg
                            className="project-status-menu__check"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M3.5 8.25L6.5 11.25L12.5 4.75"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </button>
                    )
                  })}
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
