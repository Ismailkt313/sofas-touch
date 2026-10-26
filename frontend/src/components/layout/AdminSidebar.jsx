import { ADMIN_NAV_ITEMS, isNavItemActive } from './navigationConfig'
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
          href="/users"
          className="admin-sidebar__brand"
          onClick={(event) => handleNavClick(event, '/users')}
        >
          <span className="admin-sidebar__logo" aria-hidden="true">
            <BrandEmblemIcon className="admin-sidebar__logo-svg" />
          </span>
          <span className="admin-sidebar__brand-text">
            <span className="admin-sidebar__brand-name">Soft Touch Sofas</span>
            <span className="admin-sidebar__brand-sub">Admin Workspace</span>
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

      <nav className="admin-sidebar__nav" aria-label="Admin primary navigation">
        <span className="admin-sidebar__section-label">Management</span>
        <ul className="admin-sidebar__list">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.path)
            const showApprovalsBadge =
              item.id === 'user-approvals' && pendingApprovalsCount > 0
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
                  <span className="admin-sidebar__link-label">{item.label}</span>
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
