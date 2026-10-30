import {
  hasPermission,
  normalizeRoleKey,
  resolveFirstPermittedPath,
} from '../../features/permissions/constants/permissionsCatalog'
import { getGroupedVisibleNavItems, isNavItemActive } from './navigationConfig'
import { BrandEmblemIcon, SidebarNavIcon } from './SidebarIcons'
import { SidebarProfile } from './SidebarProfile'

export function AdminSidebar({
  pathname,
  currentUser,
  pendingApprovalsCount = 0,
  onNavigate,
  onLogout,
  isDrawerOpen = false,
  onCloseDrawer,
  closeButtonRef,
}) {
  const roleKey = normalizeRoleKey(currentUser?.role)
  const isAdmin = roleKey === 'admin'
  const groupedItems = getGroupedVisibleNavItems(currentUser)
  const homePath = resolveFirstPermittedPath(currentUser)
  const canApproveUsers = hasPermission(currentUser, 'users.approve')

  const workspaceSubtitle = !roleKey
    ? 'Workspace'
    : isAdmin
      ? 'Admin Workspace'
      : 'Data Entry Workspace'

  const handleNavClick = (event, targetPath) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      onNavigate?.(targetPath)
      onCloseDrawer?.()
    }
  }

  return (
    <div className="admin-sidebar__inner">
      <div className="admin-sidebar__brand-row">
        <a
          href={homePath}
          className="admin-sidebar__brand"
          onClick={(event) => handleNavClick(event, homePath)}
        >
          <span className="admin-sidebar__logo" aria-hidden="true">
            <BrandEmblemIcon className="admin-sidebar__logo-svg" />
          </span>
          <span className="admin-sidebar__brand-text">
            <span className="admin-sidebar__brand-name">Soft Touch Sofas</span>
            <span className="admin-sidebar__brand-sub">{workspaceSubtitle}</span>
          </span>
        </a>

        <button
          ref={closeButtonRef}
          type="button"
          className="admin-sidebar__close"
          onClick={onCloseDrawer}
          aria-label="Close navigation menu"
          tabIndex={isDrawerOpen ? 0 : -1}
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

      <nav className="admin-sidebar__nav" aria-label="Workspace primary navigation">
        {groupedItems.map((group) => (
          <div key={group.key} className="admin-sidebar__group">
            <span className="admin-sidebar__section-label">{group.label}</span>
            <ul className="admin-sidebar__list">
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item.path)
                const showApprovalsBadge =
                  canApproveUsers &&
                  item.id === 'user-approvals' &&
                  pendingApprovalsCount > 0
                const badgeText =
                  pendingApprovalsCount > 99
                    ? '99+'
                    : String(pendingApprovalsCount)

                return (
                  <li key={item.id} className="admin-sidebar__item">
                    <a
                      href={item.path}
                      className={`admin-sidebar__link${
                        active ? ' admin-sidebar__link--active' : ''
                      }`}
                      aria-current={active ? 'page' : undefined}
                      onClick={(event) => handleNavClick(event, item.path)}
                    >
                      <SidebarNavIcon
                        id={item.id}
                        className="admin-sidebar__link-icon"
                      />
                      <span className="admin-sidebar__link-label">
                        {item.displayLabel || item.label}
                      </span>
                      {showApprovalsBadge ? (
                        <span
                          className="admin-sidebar__badge"
                          aria-label={`${pendingApprovalsCount} pending signup approval requests`}
                        >
                          {badgeText}
                        </span>
                      ) : null}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <SidebarProfile
          currentUser={currentUser}
          onLogout={onLogout}
          onNavigate={onNavigate}
          onCloseMobileDrawer={onCloseDrawer}
        />
      </div>
    </div>
  )
}
