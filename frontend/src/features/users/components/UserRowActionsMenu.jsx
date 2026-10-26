import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function UserRowActionsMenu({
  user,
  isSelf,
  onView,
  onEdit,
  onToggleStatus,
}) {
  const [open, setOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [menuCoords, setMenuCoords] = useState({
    top: 0,
    left: 0,
    maxHeight: undefined,
  })

  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const disableDeactivate = Boolean(isSelf && user.isActive)

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) {
      return null
    }

    const triggerRect = triggerRef.current.getBoundingClientRect()

    // If trigger has scrolled completely off-screen, request menu close
    if (
      triggerRect.bottom < 0 ||
      triggerRect.top > window.innerHeight ||
      triggerRect.right < 0 ||
      triggerRect.left > window.innerWidth
    ) {
      return { shouldClose: true }
    }

    // If trigger has scrolled horizontally outside its scrollable table container, close
    const tableWrap = triggerRef.current.closest('.users-table-wrap')
    if (tableWrap) {
      const wrapRect = tableWrap.getBoundingClientRect()
      if (triggerRect.right < wrapRect.left || triggerRect.left > wrapRect.right) {
        return { shouldClose: true }
      }
    }

    const VIEW_PADDING = 8
    const OFFSET = 6

    const menuEl = menuRef.current
    const menuWidth = menuEl ? menuEl.offsetWidth : 184
    const menuHeight = menuEl ? menuEl.offsetHeight : 160

    // Available vertical space in viewport
    const spaceBelow = window.innerHeight - triggerRect.bottom - VIEW_PADDING
    const spaceAbove = triggerRect.top - VIEW_PADDING

    // Open upward when there is insufficient space below and more space above
    const shouldOpenUp =
      spaceBelow < menuHeight + OFFSET && spaceAbove > spaceBelow

    let top
    let maxHeight
    if (shouldOpenUp) {
      top = triggerRect.top - OFFSET - menuHeight
      if (top < VIEW_PADDING) {
        top = VIEW_PADDING
        maxHeight = Math.max(120, triggerRect.top - OFFSET - VIEW_PADDING)
      }
    } else {
      top = triggerRect.bottom + OFFSET
      if (top + menuHeight > window.innerHeight - VIEW_PADDING) {
        maxHeight = Math.max(120, window.innerHeight - VIEW_PADDING - top)
      }
    }

    // Align right edge of menu with right edge of trigger button
    let left = triggerRect.right - menuWidth

    // Prevent overflowing viewport horizontally
    const maxLeft = window.innerWidth - VIEW_PADDING - menuWidth
    const minLeft = VIEW_PADDING

    if (left > maxLeft) {
      left = maxLeft
    }
    if (left < minLeft) {
      left = minLeft
    }

    return {
      top: Math.round(top),
      left: Math.round(left),
      maxHeight: maxHeight ? Math.round(maxHeight) : undefined,
      isUpward: shouldOpenUp,
      shouldClose: false,
    }
  }, [])

  const updatePosition = useCallback(() => {
    const pos = calculatePosition()
    if (!pos) {
      return
    }

    if (pos.shouldClose) {
      setOpen(false)
      return
    }

    setOpenUpward(pos.isUpward)
    setMenuCoords({
      top: pos.top,
      left: pos.left,
      maxHeight: pos.maxHeight,
    })

    if (menuRef.current) {
      menuRef.current.style.top = `${pos.top}px`
      menuRef.current.style.left = `${pos.left}px`
      if (pos.maxHeight) {
        menuRef.current.style.maxHeight = `${pos.maxHeight}px`
        menuRef.current.style.overflowY = 'auto'
      } else {
        menuRef.current.style.maxHeight = ''
        menuRef.current.style.overflowY = ''
      }
    }
  }, [calculatePosition])

  // Align immediately after rendering into the portal
  useLayoutEffect(() => {
    if (open) {
      updatePosition()
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      const isClickInsideTrigger =
        triggerRef.current && triggerRef.current.contains(event.target)
      const isClickInsideMenu =
        menuRef.current && menuRef.current.contains(event.target)

      if (!isClickInsideTrigger && !isClickInsideMenu) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    const handleScrollOrResize = () => {
      updatePosition()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown, { passive: true })
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [open, updatePosition])

  const handleToggleMenu = () => {
    if (!open) {
      const pos = calculatePosition()
      if (pos && !pos.shouldClose) {
        setOpenUpward(pos.isUpward)
        setMenuCoords({
          top: pos.top,
          left: pos.left,
          maxHeight: pos.maxHeight,
        })
      }
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  const menuElement =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className={`user-actions__menu${
              openUpward ? ' user-actions__menu--up' : ''
            }`}
            style={{
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
              ...(menuCoords.maxHeight
                ? {
                    maxHeight: `${menuCoords.maxHeight}px`,
                    overflowY: 'auto',
                  }
                : {}),
            }}
            role="menu"
            aria-label={`Manage ${user.name}`}
          >
            <button
              type="button"
              role="menuitem"
              className="user-actions__item"
              onClick={() => {
                setOpen(false)
                onView(user)
              }}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M2.25 10C3.45 6.3 6.35 4.25 10 4.25C13.65 4.25 16.55 6.3 17.75 10C16.55 13.7 13.65 15.75 10 15.75C6.35 15.75 3.45 13.7 2.25 10Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="10" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <span>View details</span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="user-actions__item"
              onClick={() => {
                setOpen(false)
                onEdit(user)
              }}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M12.9 4.35L15.65 7.1M4 16L4.65 12.8L13.55 3.9C14.1 3.35 14.98 3.35 15.53 3.9L16.1 4.47C16.65 5.02 16.65 5.9 16.1 6.45L7.2 15.35L4 16Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Edit user</span>
            </button>

            <div className="user-actions__divider" role="separator" />

            <button
              type="button"
              role="menuitem"
              className={`user-actions__item ${
                user.isActive
                  ? 'user-actions__item--danger'
                  : 'user-actions__item--success'
              }`}
              disabled={disableDeactivate}
              title={
                disableDeactivate
                  ? 'You cannot deactivate your own account'
                  : undefined
              }
              onClick={() => {
                if (disableDeactivate) {
                  return
                }
                setOpen(false)
                onToggleStatus(user)
              }}
            >
              {user.isActive ? (
                <>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5.1 5.1L14.9 14.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>
                    {disableDeactivate ? 'Deactivate (own account)' : 'Deactivate'}
                  </span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M6.8 10.2L9.05 12.45L13.4 7.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Activate</span>
                </>
              )}
            </button>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="user-actions" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-actions__trigger"
        onClick={handleToggleMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${user.name}`}
        title="Actions"
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="4.5" r="1.4" fill="currentColor" />
          <circle cx="10" cy="10" r="1.4" fill="currentColor" />
          <circle cx="10" cy="15.5" r="1.4" fill="currentColor" />
        </svg>
      </button>

      {menuElement}
    </div>
  )
}
