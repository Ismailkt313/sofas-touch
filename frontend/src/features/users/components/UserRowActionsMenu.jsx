import { useEffect, useRef, useState } from 'react'

export function UserRowActionsMenu({
  user,
  isSelf,
  onView,
  onEdit,
  onToggleStatus,
}) {
  const [open, setOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)

  const disableDeactivate = Boolean(isSelf && user.isActive)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleToggleMenu = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpward(spaceBelow < 185)
    }
    setOpen((prev) => !prev)
  }

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

      {open ? (
        <div
          className={`user-actions__menu${
            openUpward ? ' user-actions__menu--up' : ''
          }`}
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
        </div>
      ) : null}
    </div>
  )
}
