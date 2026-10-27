import { formatJoinedDate } from '../services/userManagementService'
import { UserAvatar } from './UserAvatar'
import { RoleBadge, StatusBadge } from './UserBadges'
import { UserRowActionsMenu } from './UserRowActionsMenu'

export function UsersMobileList({
  users,
  isSelfUser,
  onView,
  onEdit,
  onToggleStatus,
}) {
  return (
    <div className="users-mobile-list" role="list" aria-label="Users list">
      {users.map((user) => {
        const isSelf = isSelfUser(user)
        const hasPhone = Boolean(user.phone && String(user.phone).trim())
        const joinedLabel = formatJoinedDate(user.createdAt)

        return (
          <article
            key={user.id || user.email}
            className="user-mobile-card"
            role="listitem"
          >
            <div className="user-mobile-card__top">
              <div className="user-mobile-card__identity">
                <UserAvatar
                  name={user.name}
                  image={user.image}
                  isAdmin={user.roleKey === 'admin'}
                />
                <div className="user-mobile-card__titles">
                  <div className="user-mobile-card__name-row">
                    <button
                      type="button"
                      className="user-mobile-card__name-btn"
                      onClick={() => onView(user)}
                    >
                      {user.name}
                    </button>
                    {isSelf ? (
                      <span className="user-self-pill">You</span>
                    ) : null}
                  </div>
                  <span className="user-mobile-card__email">{user.email}</span>
                </div>
              </div>

              <UserRowActionsMenu
                user={user}
                isSelf={isSelf}
                onView={onView}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
              />
            </div>

            <div className="user-mobile-card__footer">
              <div className="user-mobile-card__badges">
                <RoleBadge roleKey={user.roleKey} roleLabel={user.roleLabel} />
                <StatusBadge
                  isActive={user.isActive}
                  statusLabel={user.statusLabel}
                />
              </div>

              <div className="user-mobile-card__secondary">
                {hasPhone ? (
                  <span className="user-mobile-card__phone">{user.phone}</span>
                ) : null}
                {joinedLabel && joinedLabel !== '—' ? (
                  <span className="user-mobile-card__joined">
                    Joined {joinedLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
