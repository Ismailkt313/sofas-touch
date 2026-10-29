export const ADMIN_NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    description: 'Overview of business activity and key operational summaries.',
  },
  {
    id: 'users',
    label: 'Users',
    path: '/users',
    adminOnly: true,
    description: 'Manage user accounts, roles, and access.',
  },
  {
    id: 'user-approvals',
    label: 'User Approvals',
    path: '/user-approvals',
    adminOnly: true,
    description: 'Review and manage Data Entry account signup requests.',
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    description: 'Track custom sofa and curtain client projects.',
  },
  {
    id: 'raw-materials',
    label: 'Raw Materials',
    path: '/raw-materials',
    description: 'Manage upholstery fabrics, timber, foam, and drapery stock.',
  },
  {
    id: 'purchases',
    label: 'Purchases',
    path: '/purchases',
    description: 'Record supplier invoices and material procurement.',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    path: '/expenses',
    description: 'Track daily workshop, delivery, and overhead expenses.',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    adminOnly: true,
    description: 'Review project profitability, purchase, and expense reports.',
  },
  {
    id: 'activity',
    label: 'Activity Log',
    path: '/activity',
    description: 'Review platform-wide operational activity history.',
  },
]

export function getVisibleNavItems(role) {
  if (role === 'data_entry') {
    return ADMIN_NAV_ITEMS.filter((item) => !item.adminOnly)
  }
  return ADMIN_NAV_ITEMS
}

const PROJECT_REPORT_SUBROUTE_RE = /^\/projects\/[^/]+\/report$/

export function isNavItemActive(pathname, itemPath) {
  const cleanPath = (pathname || '').replace(/\/+$/, '') || '/'
  if (PROJECT_REPORT_SUBROUTE_RE.test(cleanPath)) {
    return itemPath === '/reports'
  }
  return cleanPath === itemPath || cleanPath.startsWith(`${itemPath}/`)
}

export function findNavItemByPath(pathname) {
  return ADMIN_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.path))
}
