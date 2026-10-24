import { useEffect, useRef } from 'react'
import { formatJoinedDate } from '../services/userManagementService'
import { UserAvatar } from './UserAvatar'
import { RoleBadge, StatusBadge } from './UserBadges'

export function UserDetailsModal({ user, isSelf, onClose, onEdit }) {
  const closeBtnRef = useRef(null)

  useEffect(() => {
    if (!user) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [user, onClose])

  if (!user) {
    return null
  }

  return (
    <div
      className="admin-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-details-modal-title"
      >
        <div className="admin-modal__header">
          <div>
            <h2 id="user-details-modal-title" className="admin-modal__title">
              User Details
            </h2>
            <p className="admin-modal__subtitle">
              Account overview, role assignment, and status.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            aria-label="Close user details dialog"
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

        <div className="admin-modal__body">
          <div className="user-detail-hero">
            <UserAvatar
              name={user.name}
              image={user.image}
              size="lg"
              isAdmin={user.roleKey === 'admin'}
            />
            <div className="user-detail-hero__info">
              <div className="user-detail-hero__name-row">
                <span className="user-detail-hero__name">{user.name}</span>
                {isSelf ? <span className="user-self-pill">You</span> : null}
              </div>
              <div className="user-detail-hero__badges">
                <RoleBadge roleKey={user.roleKey} roleLabel={user.roleLabel} />
                <StatusBadge
                  isActive={user.isActive}
                  statusLabel={user.statusLabel}
                />
              </div>
            </div>
          </div>

          <dl className="profile-details">
            <div className="profile-details__row">
              <dt>Email Address</dt>
              <dd>{user.email || '—'}</dd>
            </div>
            <div className="profile-details__row">
              <dt>Phone Number</dt>
              <dd>{user.phone || 'Not provided'}</dd>
            </div>
            <div className="profile-details__row">
              <dt>Joined Date</dt>
              <dd>{formatJoinedDate(user.createdAt)}</dd>
            </div>
            <div className="profile-details__row">
              <dt>Account ID</dt>
              <dd className="users-mono-text">{user.id || '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="admin-modal__footer">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => {
              const target = user
              onClose()
              onEdit(target)
            }}
          >
            Edit User
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
