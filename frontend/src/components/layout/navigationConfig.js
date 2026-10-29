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
    description: 'Manage user accounts, roles, and access.',
  },
  {
    id: 'user-approvals',
    label: 'User Approvals',
    path: '/user-approvals',
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
    description: 'Review project profitability, purchase, and expense reports.',
  },
]

export function isNavItemActive(pathname, itemPath) {
  const cleanPath = (pathname || '').replace(/\/+$/, '') || '/'
  return cleanPath === itemPath || cleanPath.startsWith(`${itemPath}/`)
}

export function findNavItemByPath(pathname) {
  return ADMIN_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.path))
}
