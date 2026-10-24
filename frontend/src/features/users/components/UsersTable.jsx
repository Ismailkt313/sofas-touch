import { formatJoinedDate } from '../services/userManagementService'
import { UserAvatar } from './UserAvatar'
import { RoleBadge, StatusBadge } from './UserBadges'
import { UserRowActionsMenu } from './UserRowActionsMenu'

export function UsersTable({
  users,
  isSelfUser,
  onView,
  onEdit,
  onToggleStatus,
}) {
  return (
    <div className="users-table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            <th scope="col">User</th>
            <th scope="col">Email</th>
            <th scope="col" className="users-table__col-phone">
              Phone
            </th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col" className="users-table__col-joined">
              Joined Date
            </th>
            <th scope="col" className="users-table__col-actions">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isSelf = isSelfUser(user)
            return (
              <tr key={user.id || user.email}>
                <td>
                  <div className="users-cell-identity">
                    <UserAvatar
                      name={user.name}
                      image={user.image}
                      isAdmin={user.roleKey === 'admin'}
                    />
                    <div className="users-cell-identity__meta">
                      <div className="users-cell-identity__name-row">
                        <span className="users-cell-identity__name">
                          {user.name}
                        </span>
                        {isSelf ? (
                          <span className="user-self-pill">You</span>
                        ) : null}
                      </div>
                      <span className="users-cell-identity__sub-tablet">
                        {user.phone || 'No phone listed'}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="users-cell-email">{user.email}</span>
                </td>
                <td className="users-table__col-phone">
                  <span className={user.phone ? '' : 'users-cell-muted'}>
                    {user.phone || '—'}
                  </span>
                </td>
                <td>
                  <RoleBadge
                    roleKey={user.roleKey}
                    roleLabel={user.roleLabel}
                  />
                </td>
                <td>
                  <StatusBadge
                    isActive={user.isActive}
                    statusLabel={user.statusLabel}
                  />
                </td>
                <td className="users-table__col-joined">
                  <span className="users-cell-date">
                    {formatJoinedDate(user.createdAt)}
                  </span>
                </td>
                <td className="users-table__col-actions">
                  <UserRowActionsMenu
                    user={user}
                    isSelf={isSelf}
                    onView={onView}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
