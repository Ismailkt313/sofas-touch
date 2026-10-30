import { useCallback, useEffect, useRef, useState } from 'react'
import { RecentActivityDock } from '../../features/activity'
import { useApprovalsContext } from '../../features/approvals/context/ApprovalsContext'
import {
  hasAnyPermission,
  hasPermission,
  normalizeRoleKey,
} from '../../features/permissions/constants/permissionsCatalog'
import { AdminSidebar } from './AdminSidebar'
import { HeaderNotificationsMenu } from './HeaderNotificationsMenu'
import { findNavItemByPath } from './navigationConfig'
import { BrandEmblemIcon } from './SidebarIcons'
import './admin-layout.css'

export function AdminLayout({
  pathname,
  currentUser,
  onNavigate,
  onLogout,
  children,
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const closeButtonRef = useRef(null)
  const { pendingCount } = useApprovalsContext()

  const roleKey = normalizeRoleKey(currentUser?.role)
  const isAdmin = roleKey === 'admin'
  const canApproveUsers = hasPermission(currentUser, 'users.approve')
  const canViewActivityDock = hasAnyPermission(currentUser, [
    'activity.viewAll',
    'activity.viewOwn',
  ])

  const activeNavItem = findNavItemByPath(pathname, currentUser)
  const sectionLabel =
    activeNavItem?.displayLabel || activeNavItem?.label || 'Workspace'
  const workspaceRootCrumb = !roleKey
    ? 'Workspace'
    : isAdmin
      ? 'Admin'
      : 'Operations'
  const topbarRoleTag = !roleKey
    ? 'Soft Touch Sofas'
    : isAdmin
      ? 'Soft Touch Sofas \u2022 Admin'
      : 'Soft Touch Sofas \u2022 Data Entry'

  const closeDrawer = useCallback((restoreFocus = false) => {
    setIsDrawerOpen(false)
    if (restoreFocus) {
      requestAnimationFrame(() => {
        menuButtonRef.current?.focus()
      })
    }
  }, [])

  useEffect(() => {
    if (!isDrawerOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeDrawer(true)
      }
    }

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsDrawerOpen(false)
      }
    }

    const handlePopState = () => {
      setIsDrawerOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)
    window.addEventListener('popstate', handlePopState)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isDrawerOpen, closeDrawer])

  return (
    <div className="admin-shell">
      {isDrawerOpen ? (
        <div
          className="admin-drawer-overlay"
          onClick={() => closeDrawer(true)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="admin-navigation-drawer"
        className={`admin-sidebar${
          isDrawerOpen ? ' admin-sidebar--open' : ''
        }`}
        aria-label="Sidebar"
      >
        <AdminSidebar
          pathname={pathname}
          currentUser={currentUser}
          pendingApprovalsCount={canApproveUsers ? pendingCount : 0}
          onNavigate={onNavigate}
          onLogout={onLogout}
          isDrawerOpen={isDrawerOpen}
          onCloseDrawer={() => closeDrawer(false)}
          closeButtonRef={closeButtonRef}
        />
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="admin-topbar__left">
            <button
              ref={menuButtonRef}
              type="button"
              className="admin-topbar__menu-btn"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={isDrawerOpen}
              aria-controls="admin-navigation-drawer"
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M3 5.25H17M3 10H17M3 14.75H17"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="admin-topbar__mobile-brand" aria-hidden="true">
              <BrandEmblemIcon className="admin-topbar__mobile-emblem" />
              <span>Soft Touch Sofas</span>
            </div>

            <nav className="admin-topbar__breadcrumb" aria-label="Breadcrumb">
              <span className="admin-topbar__crumb-root">
                {workspaceRootCrumb}
              </span>
              <span className="admin-topbar__crumb-sep" aria-hidden="true">
                /
              </span>
              <span className="admin-topbar__crumb-current">{sectionLabel}</span>
            </nav>
          </div>

          <div className="admin-topbar__right">
            <span className="admin-topbar__brand-tag">{topbarRoleTag}</span>
            {canApproveUsers ? (
              <HeaderNotificationsMenu
                key={`${pathname}-${isDrawerOpen ? 'drawer' : 'main'}`}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ) : null}
          </div>
        </header>

        <main className="admin-main">{children}</main>
      </div>

      {currentUser && canViewActivityDock ? (
        <RecentActivityDock
          pathname={pathname}
          currentUser={currentUser}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  )
}
