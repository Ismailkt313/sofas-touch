import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MENU_WIDTH = 188
const VIEWPORT_MARGIN = 10

function computeMenuCoords(triggerEl, itemCount) {
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

  const estimatedMenuHeight = Math.max(52, itemCount * 40 + 16)
  const spaceBelow = window.innerHeight - rect.bottom
  const openUpward =
    spaceBelow < estimatedMenuHeight + VIEWPORT_MARGIN &&
    rect.top > estimatedMenuHeight + VIEWPORT_MARGIN

  const top = openUpward
    ? Math.max(VIEWPORT_MARGIN, rect.top - estimatedMenuHeight - 6)
    : rect.bottom + 6
  const rawLeft = rect.right - MENU_WIDTH
  const maxLeft = Math.max(
    VIEWPORT_MARGIN,
    window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN,
  )
  const left = Math.max(VIEWPORT_MARGIN, Math.min(rawLeft, maxLeft))

  return { top: Math.round(top), left: Math.round(left) }
}

export function RawMaterialRowActionsMenu({
  material,
  adminAccess,
  onViewDetails,
  onEdit,
  onToggleStatus,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuId = useId()

  const itemCount = adminAccess ? 3 : 1

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
      const next = computeMenuCoords(triggerRef.current, itemCount)
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
  }, [isOpen, closeMenu, itemCount])

  const handleToggle = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    const nextCoords = computeMenuCoords(triggerRef.current, itemCount)
    if (nextCoords) {
      setCoords(nextCoords)
    }
    setIsOpen(true)
  }

 

  return (
    <div className="rm-row-actions">
     

      <button
        ref={triggerRef}
        type="button"
        className={`rm-row-actions__menu-btn${
          isOpen ? ' rm-row-actions__menu-btn--open' : ''
        }`}
        onClick={handleToggle}
        aria-label={`Actions for ${material.name}`}
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
              className="rm-portal-menu"
              role="menu"
              style={{
                top: `${coords.top}px`,
                left: `${coords.left}px`,
                width: `${MENU_WIDTH}px`,
              }}
            >
              <button
                type="button"
                className="rm-portal-menu__item"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false)
                  onViewDetails?.(material)
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

              {adminAccess ? (
                <>
                  <button
                    type="button"
                    className="rm-portal-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setIsOpen(false)
                      onEdit?.(material)
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
                    <span>Edit</span>
                  </button>

                  <div className="rm-portal-menu__divider" role="separator" />

                  <button
                    type="button"
                    className={`rm-portal-menu__item ${
                      material.isActive
                        ? 'rm-portal-menu__item--danger'
                        : 'rm-portal-menu__item--activate'
                    }`}
                    role="menuitem"
                    onClick={() => {
                      setIsOpen(false)
                      onToggleStatus?.(material, !material.isActive)
                    }}
                  >
                    {material.isActive ? (
                      <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                        <circle
                          cx="9"
                          cy="9"
                          r="6.25"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <path
                          d="M6.25 9H11.75"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                        <circle
                          cx="9"
                          cy="9"
                          r="6.25"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <path
                          d="M6.35 9.2L8.15 11L11.85 7.1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    <span>{material.isActive ? 'Deactivate' : 'Activate'}</span>
                  </button>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
