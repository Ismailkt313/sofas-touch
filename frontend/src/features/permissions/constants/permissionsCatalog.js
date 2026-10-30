export const PERMISSION_KEYS = [
  'dashboard.view',
  'projects.view',
  'projects.create',
  'projects.edit',
  'projects.delete',
  'purchases.view',
  'purchases.create',
  'purchases.edit',
  'purchases.delete',
  'expenses.view',
  'expenses.create',
  'expenses.edit',
  'expenses.delete',
  'materials.view',
  'materials.create',
  'materials.edit',
  'materials.manageStock',
  'reports.view',
  'reports.viewProfitability',
  'users.view',
  'users.manage',
  'users.approve',
  'activity.viewOwn',
  'activity.viewAll',
  'permissions.manage',
  'settings.manage',
]

export const ALL_PERMISSION_KEYS = PERMISSION_KEYS
export const DEFAULT_ADMIN_PERMISSIONS = [...PERMISSION_KEYS]
export const ALL_PERMISSION_SET = new Set(PERMISSION_KEYS)

export const ADMIN_RESERVED_PERMISSIONS = new Set([
  'users.view',
  'users.manage',
  'users.approve',
  'permissions.manage',
  'settings.manage',
])

export const DEFAULT_DATA_ENTRY_PERMISSIONS = [
  'dashboard.view',
  'projects.view',
  'purchases.view',
  'purchases.create',
  'purchases.edit',
  'expenses.view',
  'expenses.create',
  'materials.view',
  'activity.viewOwn',
]

export const PERMISSION_DEPENDENCIES = {
  'projects.create': ['projects.view'],
  'projects.edit': ['projects.view'],
  'projects.delete': ['projects.view'],
  'purchases.create': ['purchases.view'],
  'purchases.edit': ['purchases.view'],
  'purchases.delete': ['purchases.view'],
  'expenses.create': ['expenses.view'],
  'expenses.edit': ['expenses.view'],
  'expenses.delete': ['expenses.view'],
  'materials.create': ['materials.view'],
  'materials.edit': ['materials.view'],
  'materials.manageStock': ['materials.view'],
  'reports.view': ['projects.view'],
  'reports.viewProfitability': ['reports.view', 'projects.view'],
  'users.manage': ['users.view'],
  'users.approve': ['users.view'],
  'activity.viewAll': ['activity.viewOwn'],
}

export const PERMISSION_LABELS = {
  'dashboard.view': 'View Dashboard',
  'projects.view': 'View Projects',
  'projects.create': 'Create Projects',
  'projects.edit': 'Edit Projects & Status',
  'projects.delete': 'Delete Projects',
  'purchases.view': 'View Purchase Vouchers',
  'purchases.create': 'Record Purchase Vouchers',
  'purchases.edit': 'Edit Purchase Vouchers & Bills',
  'purchases.delete': 'Void / Cancel Purchases',
  'expenses.view': 'View Expenses',
  'expenses.create': 'Record Expenses',
  'expenses.edit': 'Edit Expenses & Categories',
  'expenses.delete': 'Void / Cancel Expenses',
  'materials.view': 'View Raw Materials & Stock',
  'materials.create': 'Create Raw Materials',
  'materials.edit': 'Edit Materials & Thresholds',
  'materials.manageStock': 'Adjust Stock Manually',
  'reports.view': 'Access Project Reports',
  'reports.viewProfitability': 'View Contract Value & Profitability',
  'users.view': 'View Users',
  'users.manage': 'Create & Manage Users',
  'users.approve': 'Approve / Reject Registrations',
  'activity.viewOwn': 'View Own Activity Log',
  'activity.viewAll': 'View Platform-Wide Audit History',
  'permissions.manage': 'Manage Roles & Permissions',
  'settings.manage': 'Manage Application Settings',
}

export function normalizeRoleKey(role) {
  if (!role) return ''
  return String(role).trim().toLowerCase().replace(/\s+/g, '_')
}

export function sanitizePermissionsWithDependencies(
  keys,
  options = { allowAdminReserved: false },
) {
  const active = new Set()
  for (const raw of keys || []) {
    if (!ALL_PERMISSION_SET.has(raw)) continue
    if (!options.allowAdminReserved && ADMIN_RESERVED_PERMISSIONS.has(raw)) {
      continue
    }
    active.add(raw)
  }

  let changed = true
  while (changed) {
    changed = false
    for (const key of Array.from(active)) {
      const deps = PERMISSION_DEPENDENCIES[key]
      if (deps && deps.some((dep) => !active.has(dep))) {
        active.delete(key)
        changed = true
      }
    }
  }

  return PERMISSION_KEYS.filter((k) => active.has(k))
}

export function computeDraftEffectivePermissions({
  role,
  rolePermissions,
  overrides,
}) {
  if (normalizeRoleKey(role) === 'admin') {
    return [...PERMISSION_KEYS]
  }

  const set = new Set(
    sanitizePermissionsWithDependencies(rolePermissions || [], {
      allowAdminReserved: false,
    }),
  )

  if (Array.isArray(overrides?.grant)) {
    for (const k of overrides.grant) {
      if (ALL_PERMISSION_SET.has(k) && !ADMIN_RESERVED_PERMISSIONS.has(k)) {
        set.add(k)
      }
    }
  }

  if (Array.isArray(overrides?.revoke)) {
    for (const k of overrides.revoke) {
      set.delete(k)
    }
  }

  return sanitizePermissionsWithDependencies(Array.from(set), {
    allowAdminReserved: false,
  })
}

export function togglePermissionWithDependencies(
  currentList,
  permissionKey,
  shouldEnable,
) {
  const next = new Set(currentList || [])

  if (shouldEnable) {
    const addWithParents = (key) => {
      if (!ALL_PERMISSION_SET.has(key) || ADMIN_RESERVED_PERMISSIONS.has(key)) {
        return
      }
      next.add(key)
      const deps = PERMISSION_DEPENDENCIES[key] || []
      for (const dep of deps) {
        addWithParents(dep)
      }
    }
    addWithParents(permissionKey)
  } else {
    next.delete(permissionKey)
    let changed = true
    while (changed) {
      changed = false
      for (const candidate of Array.from(next)) {
        const deps = PERMISSION_DEPENDENCIES[candidate] || []
        if (deps.includes(permissionKey) || deps.some((d) => !next.has(d))) {
          next.delete(candidate)
          changed = true
        }
      }
    }
  }

  return PERMISSION_KEYS.filter((k) => next.has(k))
}

export function getEffectivePermissions(user) {
  if (!user || typeof user !== 'object') {
    return []
  }

  const role = normalizeRoleKey(user.role)
  if (role === 'admin') {
    return [...PERMISSION_KEYS]
  }

  if (Array.isArray(user.permissions)) {
    return user.permissions.filter((k) => ALL_PERMISSION_SET.has(k))
  }

  if (role === 'data_entry') {
    return [...DEFAULT_DATA_ENTRY_PERMISSIONS]
  }

  return []
}

export function hasPermission(user, permissionKey) {
  if (!user || !permissionKey) return false
  if (normalizeRoleKey(user.role) === 'admin') return true
  const effective = getEffectivePermissions(user)
  return effective.includes(permissionKey)
}

export function hasAnyPermission(user, permissionKeys) {
  if (!user || !Array.isArray(permissionKeys) || permissionKeys.length === 0) {
    return false
  }
  return permissionKeys.some((k) => hasPermission(user, k))
}

export function hasAllPermissions(user, permissionKeys) {
  if (!user || !Array.isArray(permissionKeys) || permissionKeys.length === 0) {
    return false
  }
  return permissionKeys.every((k) => hasPermission(user, k))
}

export function resolveFirstPermittedPath(user) {
  if (!user) return '/login'
  const candidates = [
    ['dashboard.view', '/dashboard'],
    ['purchases.view', '/purchases'],
    ['expenses.view', '/expenses'],
    ['projects.view', '/projects'],
    ['materials.view', '/raw-materials'],
    ['activity.viewOwn', '/activity'],
    ['activity.viewAll', '/activity'],
  ]
  for (const [perm, routePath] of candidates) {
    if (hasPermission(user, perm)) {
      return routePath
    }
  }
  return '/profile'
}

export function evaluateRouteAccess(pathname, user) {
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/'
  const fallbackPath = resolveFirstPermittedPath(user)

  if (normalized === '/profile') {
    return {
      allowed: Boolean(user),
      requiredKeys: [],
      moduleTitle: 'My Profile',
      reason: '',
      fallbackPath,
    }
  }

  if (normalized === '/' || normalized === '/dashboard') {
    const ok = hasPermission(user, 'dashboard.view')
    return {
      allowed: ok,
      requiredKeys: ['dashboard.view'],
      moduleTitle: 'Dashboard',
      reason: ok
        ? ''
        : 'Dashboard access has not been enabled for your account.',
      fallbackPath,
    }
  }

  if (
    normalized === '/reports' ||
    /^\/projects\/[^/]+\/report$/i.test(normalized)
  ) {
    const ok = hasPermission(user, 'reports.view')
    return {
      allowed: ok,
      requiredKeys: ['reports.view'],
      moduleTitle: 'Project Reports & Profitability',
      reason: ok
        ? ''
        : 'Confidential project financial reports and profitability breakdowns are restricted to authorized accounts.',
      fallbackPath,
    }
  }

  if (normalized === '/projects' || normalized.startsWith('/projects/')) {
    const ok = hasPermission(user, 'projects.view')
    return {
      allowed: ok,
      requiredKeys: ['projects.view'],
      moduleTitle: 'Projects',
      reason: ok
        ? ''
        : 'Your account does not currently have permission to view project records.',
      fallbackPath,
    }
  }

  if (normalized === '/purchases/new') {
    const ok = hasPermission(user, 'purchases.create')
    return {
      allowed: ok,
      requiredKeys: ['purchases.create'],
      moduleTitle: 'New Purchase Voucher',
      reason: ok
        ? ''
        : 'Recording new purchase vouchers is disabled for your account.',
      fallbackPath,
    }
  }

  if (/^\/purchases\/[^/]+\/edit$/i.test(normalized)) {
    const ok = hasPermission(user, 'purchases.edit')
    return {
      allowed: ok,
      requiredKeys: ['purchases.edit'],
      moduleTitle: 'Edit Purchase Voucher',
      reason: ok
        ? ''
        : 'Editing existing purchase vouchers is disabled for your account.',
      fallbackPath,
    }
  }

  if (normalized === '/purchases' || normalized.startsWith('/purchases/')) {
    const ok = hasPermission(user, 'purchases.view')
    return {
      allowed: ok,
      requiredKeys: ['purchases.view'],
      moduleTitle: 'Purchase Vouchers',
      reason: ok
        ? ''
        : 'Your account does not currently have permission to view purchase vouchers.',
      fallbackPath,
    }
  }

  if (normalized === '/expenses' || normalized.startsWith('/expenses/')) {
    const ok = hasPermission(user, 'expenses.view')
    return {
      allowed: ok,
      requiredKeys: ['expenses.view'],
      moduleTitle: 'Expenses',
      reason: ok
        ? ''
        : 'Your account does not currently have permission to view expense records.',
      fallbackPath,
    }
  }

  if (
    normalized === '/raw-materials' ||
    normalized.startsWith('/raw-materials/')
  ) {
    const ok = hasPermission(user, 'materials.view')
    return {
      allowed: ok,
      requiredKeys: ['materials.view'],
      moduleTitle: 'Raw Materials & Stock',
      reason: ok
        ? ''
        : 'Your account does not currently have permission to access the raw materials catalog.',
      fallbackPath,
    }
  }

  if (normalized === '/activity' || normalized.startsWith('/activity/')) {
    const ok = hasAnyPermission(user, ['activity.viewAll', 'activity.viewOwn'])
    return {
      allowed: ok,
      requiredKeys: ['activity.viewOwn'],
      moduleTitle: 'Activity History',
      reason: ok
        ? ''
        : 'Activity log access is currently disabled for your account.',
      fallbackPath,
    }
  }

  if (normalized === '/users' || normalized.startsWith('/users/')) {
    const ok = hasPermission(user, 'users.view')
    return {
      allowed: ok,
      requiredKeys: ['users.view'],
      moduleTitle: 'User Management',
      reason: ok
        ? ''
        : 'User Management is restricted to workspace Administrators.',
      fallbackPath,
    }
  }

  if (
    normalized === '/user-approvals' ||
    normalized.startsWith('/user-approvals/')
  ) {
    const ok = hasPermission(user, 'users.approve')
    return {
      allowed: ok,
      requiredKeys: ['users.approve'],
      moduleTitle: 'User Approvals',
      reason: ok
        ? ''
        : 'User registration approvals are restricted to workspace Administrators.',
      fallbackPath,
    }
  }

  if (normalized === '/permissions' || normalized.startsWith('/permissions/')) {
    const ok = hasPermission(user, 'permissions.manage')
    return {
      allowed: ok,
      requiredKeys: ['permissions.manage'],
      moduleTitle: 'Roles & Permissions',
      reason: ok
        ? ''
        : 'Role and permission configuration is restricted to workspace Administrators.',
      fallbackPath,
    }
  }

  if (normalized === '/settings' || normalized.startsWith('/settings/')) {
    const ok = hasPermission(user, 'settings.manage')
    return {
      allowed: ok,
      requiredKeys: ['settings.manage'],
      moduleTitle: 'Application Settings',
      reason: ok
        ? ''
        : 'Application settings are restricted to workspace Administrators.',
      fallbackPath,
    }
  }

  return {
    allowed: false,
    requiredKeys: [],
    moduleTitle: 'Restricted Page',
    reason: 'The requested workspace section is not available for your role.',
    fallbackPath,
  }
}
