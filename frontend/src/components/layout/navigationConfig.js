import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  normalizeRoleKey,
} from '../../features/permissions/constants/permissionsCatalog.js'

export const NAV_GROUPS = [
  { key: 'operations', label: 'Operations' },
  { key: 'oversight', label: 'Reports & Activity' },
  { key: 'administration', label: 'Administration' },
]

export const WORKSPACE_NAV_ITEMS = [
  {
    id: 'dashboard',
    key: 'dashboard',
    label: 'Dashboard',
    operatorLabel: 'Operations Desk',
    path: '/dashboard',
    group: 'operations',
    requiredPermissions: ['dashboard.view'],
    mode: 'all',
  },
  {
    id: 'projects',
    key: 'projects',
    label: 'Projects',
    path: '/projects',
    group: 'operations',
    requiredPermissions: ['projects.view'],
    mode: 'all',
  },
  {
    id: 'purchases',
    key: 'purchases',
    label: 'Purchases',
    operatorLabel: 'Purchase Vouchers',
    path: '/purchases',
    group: 'operations',
    requiredPermissions: ['purchases.view'],
    mode: 'all',
  },
  {
    id: 'expenses',
    key: 'expenses',
    label: 'Expenses',
    path: '/expenses',
    group: 'operations',
    requiredPermissions: ['expenses.view'],
    mode: 'all',
  },
  {
    id: 'raw-materials',
    key: 'raw-materials',
    label: 'Raw Materials',
    path: '/raw-materials',
    group: 'operations',
    requiredPermissions: ['materials.view'],
    mode: 'all',
  },
  {
    id: 'reports',
    key: 'reports',
    label: 'Project Reports',
    path: '/reports',
    group: 'oversight',
    requiredPermissions: ['reports.view', 'reports.viewProfitability'],
    mode: 'all',
  },
  {
    id: 'activity',
    key: 'activity',
    label: 'Activity History',
    operatorLabel: 'My Activity',
    path: '/activity',
    group: 'oversight',
    requiredPermissions: ['activity.viewAll', 'activity.viewOwn'],
    mode: 'any',
  },
  {
    id: 'users',
    key: 'users',
    label: 'User Management',
    path: '/users',
    group: 'administration',
    requiredPermissions: ['users.view'],
    mode: 'all',
  },
  {
    id: 'user-approvals',
    key: 'user-approvals',
    label: 'User Approvals',
    path: '/user-approvals',
    group: 'administration',
    requiredPermissions: ['users.approve'],
    mode: 'all',
  },
  {
    id: 'permissions',
    key: 'permissions',
    label: 'Roles & Permissions',
    path: '/permissions',
    group: 'administration',
    requiredPermissions: ['permissions.manage'],
    mode: 'all',
  },
  {
    id: 'settings',
    key: 'settings',
    label: 'Settings',
    path: '/settings',
    group: 'administration',
    requiredPermissions: ['settings.manage'],
    mode: 'all',
  },
]

export const ADMIN_NAV_ITEMS = WORKSPACE_NAV_ITEMS

export function isNavItemPermitted(item, user) {
  if (!user || !item) return false
  if (item.mode === 'any') {
    return hasAnyPermission(user, item.requiredPermissions)
  }
  return hasAllPermissions(user, item.requiredPermissions)
}

export function getVisibleNavItems(userOrRole) {
  if (!userOrRole) {
    return []
  }

  const resolvedUser =
    typeof userOrRole === 'string'
      ? { role: normalizeRoleKey(userOrRole) }
      : userOrRole

  const roleKey = normalizeRoleKey(resolvedUser.role)
  if (!roleKey) {
    return []
  }

  const isOperator = roleKey !== 'admin'

  return WORKSPACE_NAV_ITEMS.filter((item) =>
    isNavItemPermitted(item, resolvedUser),
  ).map((item) => {
    let displayLabel = item.label
    if (isOperator && item.operatorLabel) {
      if (
        item.key === 'activity' &&
        hasPermission(resolvedUser, 'activity.viewAll')
      ) {
        displayLabel = item.label
      } else if (
        item.key === 'dashboard' &&
        hasPermission(resolvedUser, 'reports.viewProfitability')
      ) {
        displayLabel = item.label
      } else {
        displayLabel = item.operatorLabel
      }
    }
    return {
      ...item,
      label: displayLabel,
      displayLabel,
    }
  })
}

export function getGroupedVisibleNavItems(user) {
  const visible = getVisibleNavItems(user)
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: visible.filter((item) => item.group === group.key),
  })).filter((group) => group.items.length > 0)
}

export function isNavItemActive(pathname = '/', itemPath = '/') {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/'
  const normalizedItem = itemPath.replace(/\/+$/, '') || '/'

  if (normalizedItem === '/dashboard') {
    return normalizedPath === '/' || normalizedPath === '/dashboard'
  }

  if (normalizedItem === '/projects') {
    if (/^\/projects\/[^/]+\/report$/i.test(normalizedPath)) {
      return false
    }
    return (
      normalizedPath === '/projects' || normalizedPath.startsWith('/projects/')
    )
  }

  if (normalizedItem === '/reports') {
    return (
      normalizedPath === '/reports' ||
      normalizedPath.startsWith('/reports/') ||
      /^\/projects\/[^/]+\/report$/i.test(normalizedPath)
    )
  }

  return (
    normalizedPath === normalizedItem ||
    normalizedPath.startsWith(`${normalizedItem}/`)
  )
}

export function findNavItemByPath(pathname = '/', user = null) {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized === '/profile') {
    return {
      id: 'profile',
      key: 'profile',
      label: 'My Profile',
      path: '/profile',
    }
  }

  const pool = user ? getVisibleNavItems(user) : WORKSPACE_NAV_ITEMS
  const hit =
    pool.find((item) => isNavItemActive(normalized, item.path)) ||
    WORKSPACE_NAV_ITEMS.find((item) => isNavItemActive(normalized, item.path))
  return hit || null
}

export function resolveActiveNavKey(pathname = '/') {
  const hit = findNavItemByPath(pathname)
  return hit ? hit.key : ''
}
