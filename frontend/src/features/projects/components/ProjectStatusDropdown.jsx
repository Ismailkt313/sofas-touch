import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PROJECT_STATUS_OPTIONS } from '../services/projectService'

const DROPDOWN_WIDTH = 188
const VIEWPORT_MARGIN = 10

function normalizeCanonicalStatus(status) {
  const clean = String(status || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (clean === 'underreview') return 'Under Review'
  if (clean === 'completed') return 'Completed'
  return 'In Progress'
}

function getStatusToneModifier(status) {
  if (status === 'Completed') return 'completed'
  if (status === 'Under Review') return 'under-review'
  return 'in-progress'
}

function computeDropdownCoords(triggerEl) {
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

  const estimatedHeight = 142
  const spaceBelow = window.innerHeight - rect.bottom
  const openUpward =
    spaceBelow < estimatedHeight + VIEWPORT_MARGIN &&
    rect.top > estimatedHeight + VIEWPORT_MARGIN

  const top = openUpward ? rect.top - estimatedHeight - 5 : rect.bottom + 5
  const preferredLeft = rect.right - DROPDOWN_WIDTH
  const maxLeft = Math.max(
    VIEWPORT_MARGIN,
    window.innerWidth - DROPDOWN_WIDTH - VIEWPORT_MARGIN,
  )
  const left = Math.max(VIEWPORT_MARGIN, Math.min(preferredLeft, maxLeft))

  return { top: Math.round(top), left: Math.round(left) }
}

export function ProjectStatusDropdown({
  project,
  onStatusChange,
  isUpdating = false,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [pendingLocal, setPendingLocal] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const listboxId = useId()

  const currentStatus = normalizeCanonicalStatus(project?.status)
  const tone = getStatusToneModifier(currentStatus)
  const busy = isUpdating || pendingLocal
  const targetKey = String(project?.projectId || project?.id || '').trim()

  const closeDropdown = useCallback((restoreFocus = false) => {
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
      const next = computeDropdownCoords(triggerRef.current)
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
        closeDropdown(true)
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
  }, [isOpen, closeDropdown])

  const handleToggle = () => {
    if (busy || typeof onStatusChange !== 'function') {
      return
    }
    if (isOpen) {
      setIsOpen(false)
      return
    }
    const next = computeDropdownCoords(triggerRef.current)
    if (next) {
      setCoords(next)
    }
    setIsOpen(true)
  }

  const handleSelectOption = async (nextStatus) => {
    setIsOpen(false)
    if (!targetKey || nextStatus === currentStatus || busy) {
      return
    }

    setPendingLocal(true)
    try {
      await onStatusChange(targetKey, nextStatus)
    } catch {
      return
    } finally {
      setPendingLocal(false)
    }
  }

  if (typeof onStatusChange !== 'function') {
    return (
      <span
        className={`project-status-badge project-status-badge--${tone}`}
      >
        <span className="project-status-badge__dot" aria-hidden="true" />
        <span>{currentStatus}</span>
      </span>
    )
  }

  return (
    <div className="project-status-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className={`project-status-select-btn project-status-badge--${tone}${
          compact ? ' project-status-select-btn--compact' : ''
        }${isOpen ? ' project-status-select-btn--open' : ''}`}
        onClick={handleToggle}
        disabled={busy}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={`Project status: ${currentStatus}. Activate to change status for ${
          project?.projectId || project?.name || 'project'
        }`}
      >
        {busy ? (
          <span
            className="project-status-select-btn__spinner"
            aria-hidden="true"
          />
        ) : (
          <span className="project-status-badge__dot" aria-hidden="true" />
        )}
        <span className="project-status-select-btn__label">
          {currentStatus}
        </span>
        <svg
          className="project-status-select-btn__chevron"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3.75 5.25L7 8.5L10.25 5.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={listboxId}
              ref={menuRef}
              className="project-status-menu"
              role="listbox"
              aria-label={`Select status for ${project?.projectId || project?.name}`}
              style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${DROPDOWN_WIDTH}px`,
              }}
            >
              <div className="project-status-menu__heading">Set Status</div>
              {PROJECT_STATUS_OPTIONS.map((option) => {
                const isSelected = option === currentStatus
                const optionTone = getStatusToneModifier(option)

                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`project-status-menu__item${
                      isSelected ? ' project-status-menu__item--selected' : ''
                    }`}
                    onClick={() => handleSelectOption(option)}
                  >
                    <span className="project-status-menu__item-left">
                      <span
                        className={`project-status-menu__dot project-status-menu__dot--${optionTone}`}
                        aria-hidden="true"
                      />
                      <span>{option}</span>
                    </span>
                    {isSelected ? (
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
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
