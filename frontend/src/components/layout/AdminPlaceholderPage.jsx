import { findNavItemByPath } from './navigationConfig'
import { SidebarNavIcon } from './SidebarIcons'

export function AdminPlaceholderPage({ pathname, onNavigate }) {
  const navItem = findNavItemByPath(pathname)
  const title = navItem?.label || 'Module'
  const description =
    navItem?.description ||
    'This workspace section will be connected in an upcoming milestone.'

  const handleGoToUsers = (event) => {
    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault()
      onNavigate?.('/users')
    }
  }

  return (
    <div className="admin-placeholder">
      <div className="admin-placeholder__card">
        <div className="admin-placeholder__icon" aria-hidden="true">
          <SidebarNavIcon id={navItem?.id || 'dashboard'} />
        </div>
        <h1 className="admin-placeholder__title">{title}</h1>
        <p className="admin-placeholder__description">{description}</p>
        <p className="admin-placeholder__note">
          This destination is a navigation placeholder inside the shared Admin
          layout. User Management is currently available at{' '}
          <code>/users</code>.
        </p>
        <a
          href="/users"
          className="admin-btn admin-btn--primary"
          onClick={handleGoToUsers}
        >
          Go to User Management
        </a>
      </div>
    </div>
  )
}
