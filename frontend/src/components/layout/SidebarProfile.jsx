import { useEffect, useRef, useState } from 'react'

function formatRoleLabel(role) {
  if (!role || typeof role !== 'string') {
    return 'Admin'
  }
  const normalized = role.trim().toLowerCase().replace(/\s+/g, '_')
  if (normalized === 'admin') {
    return 'Admin'
  }
  if (normalized === 'data_entry') {
    return 'Data Entry'
  }
  return role
}

function getInitials(name) {
  const cleaned = (name || '').trim()
  if (!cleaned) {
    return 'AA'
  }
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function SidebarProfile({
  currentUser,
  onLogout,
  onNavigate,
  onCloseMobileDrawer,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState('')
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const closeModalButtonRef = useRef(null)

  const hasAuthenticatedUser = Boolean(currentUser && (currentUser.email || currentUser.name))
  const displayName = hasAuthenticatedUser
    ? currentUser.name || 'Authenticated User'
    : 'Admin Account'
  const displayRole = hasAuthenticatedUser
    ? formatRoleLabel(currentUser.role)
    : 'Admin'
  const imageUrl =
    hasAuthenticatedUser && typeof currentUser.image === 'string'
      ? currentUser.image.trim()
      : ''
  const showImage = Boolean(imageUrl && imageUrl !== failedImageUrl)
  const initials = getInitials(displayName)

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!profileModalOpen) {
      return undefined
    }

    closeModalButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileModalOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileModalOpen])

  const handleOpenProfile = () => {
    setMenuOpen(false)
    onCloseMobileDrawer?.()
    setProfileModalOpen(true)
  }

  const handleLogoutClick = () => {
    setMenuOpen(false)
    onCloseMobileDrawer?.()
    if (typeof onLogout === 'function') {
      onLogout()
    }
  }

  const handleGoToLogin = () => {
    setProfileModalOpen(false)
    if (typeof onNavigate === 'function') {
      onNavigate('/login')
    }
  }

  return (
    <>
      <div className="sidebar-profile" ref={containerRef}>
        {menuOpen ? (
          <div
            className="sidebar-profile__menu"
            role="menu"
            aria-label="Account options"
          >
            <button
              type="button"
              role="menuitem"
              className="sidebar-profile__menu-item"
              onClick={handleOpenProfile}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="6.75" r="3.25" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 16.5C4.55 13.75 6.95 12 10 12C13.05 12 15.45 13.75 16 16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>Profile</span>
            </button>
            <div className="sidebar-profile__menu-divider" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="sidebar-profile__menu-item sidebar-profile__menu-item--danger"
              onClick={handleLogoutClick}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7.5 16.75H4.75C3.92157 16.75 3.25 16.0784 3.25 15.25V4.75C3.25 3.92157 3.92157 3.25 4.75 3.25H7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M13 13.5L16.5 10L13 6.5M16.25 10H7.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{hasAuthenticatedUser ? 'Logout' : 'Sign in'}</span>
            </button>
          </div>
        ) : null}

        <button
          ref={triggerRef}
          type="button"
          className="sidebar-profile__trigger"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Account menu for ${displayName}`}
        >
          <span className="sidebar-profile__avatar" aria-hidden="true">
            {showImage ? (
              <img
                src={imageUrl}
                alt=""
                onError={() => setFailedImageUrl(imageUrl)}
              />
            ) : (
              <span>{initials}</span>
            )}
          </span>
          <span className="sidebar-profile__info">
            <span className="sidebar-profile__name">{displayName}</span>
            <span className="sidebar-profile__role">{displayRole}</span>
          </span>
          <svg
            className={`sidebar-profile__chevron${menuOpen ? ' sidebar-profile__chevron--open' : ''
              }`}
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 12L10 8L14 12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {profileModalOpen ? (
        <div
          className="admin-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setProfileModalOpen(false)
            }
          }}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-profile-modal-title"
          >
            <div className="admin-modal__header">
              <div>
                <h2 id="sidebar-profile-modal-title" className="admin-modal__title">
                  Account Profile
                </h2>
                <p className="admin-modal__subtitle">
                  Current session identity and workspace access level.
                </p>
              </div>
              <button
                ref={closeModalButtonRef}
                type="button"
                className="admin-modal__close"
                onClick={() => setProfileModalOpen(false)}
                aria-label="Close profile dialog"
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="admin-modal__body">
              <div className="profile-summary">
                <div className="profile-summary__avatar" aria-hidden="true">
                  {showImage ? (
                    <img
                      src={imageUrl}
                      alt=""
                      onError={() => setFailedImageUrl(imageUrl)}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div>
                  <div className="profile-summary__name">{displayName}</div>
                  <div className="profile-summary__role">{displayRole}</div>
                </div>
              </div>

              {hasAuthenticatedUser ? (
                <dl className="profile-details">
                  <div className="profile-details__row">
                    <dt>Email Address</dt>
                    <dd>{currentUser.email || '—'}</dd>
                  </div>
                  <div className="profile-details__row">
                    <dt>Phone Number</dt>
                    <dd>{currentUser.phone || 'Not provided'}</dd>
                  </div>
                  <div className="profile-details__row">
                    <dt>Account Status</dt>
                    <dd>{currentUser.isActive === false ? 'Inactive' : 'Active'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="profile-unauth-note">
                  No authenticated session is currently stored. Neutral placeholder
                  profile details are shown until you sign in through the Admin
                  Login page.
                </p>
              )}
            </div>

            <div className="admin-modal__footer">
              {!hasAuthenticatedUser ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={handleGoToLogin}
                >
                  Go to Sign In
                </button>
              ) : null}
              <button
                type="button"
                className="admin-btn admin-btn--secondary"
                onClick={() => setProfileModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
