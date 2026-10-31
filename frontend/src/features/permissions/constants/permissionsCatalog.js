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
]

export const ALL_PERMISSION_KEYS = PERMISSION_KEYS
export const DEFAULT_ADMIN_PERMISSIONS = [...PERMISSION_KEYS]
export const ALL_PERMISSION_SET = new Set(PERMISSION_KEYS)

export const ADMIN_RESERVED_PERMISSIONS = new Set([
  'users.view',
  'users.manage',
  'users.approve',
  'permissions.manage',
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
  'dashboard.view': 'Open Dashboard',
  'projects.view': 'View Projects',
  'projects.create': 'Add Projects',
  'projects.edit': 'Edit Projects',
  'projects.delete': 'Delete Projects',
  'purchases.view': 'View Purchases',
  'purchases.create': 'Add Purchases',
  'purchases.edit': 'Edit Purchases',
  'purchases.delete': 'Delete Purchases',
  'expenses.view': 'View Expenses',
  'expenses.create': 'Add Expenses',
  'expenses.edit': 'Edit Expenses',
  'expenses.delete': 'Delete Expenses',
  'materials.view': 'View Materials and Stock',
  'materials.create': 'Add Materials',
  'materials.edit': 'Edit Materials',
  'materials.manageStock': 'Update Stock',
  'reports.view': 'View Project Reports',
  'reports.viewProfitability': 'View Project Profit',
  'users.view': 'View Employees',
  'users.manage': 'Manage Employees',
  'users.approve': 'Approve Registrations',
  'activity.viewOwn': 'View My Activity',
  'activity.viewAll': 'View All Activity',
  'permissions.manage': 'Manage Access',
}

export const PERMISSION_MODULE_DEFINITIONS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Workspace summary, daily metrics, and operational alerts.',
    permissions: [
      {
        key: 'dashboard.view',
        label: 'Open Dashboard',
        description: 'View the operational home dashboard.',
      },
    ],
  },
  {
    id: 'projects',
    label: 'Projects',
    description: 'Sofa and curtain manufacturing projects and custom client orders.',
    permissions: [
      {
        key: 'projects.view',
        label: 'View Projects',
        description: 'Browse client sofa and curtain project lists.',
      },
      {
        key: 'projects.create',
        label: 'Add Projects',
        description: 'Create new manufacturing projects and orders.',
      },
      {
        key: 'projects.edit',
        label: 'Edit Projects',
        description: 'Update project stages, dimensions, and specifications.',
      },
      {
        key: 'projects.delete',
        label: 'Delete Projects',
        description: 'Delete empty projects without linked vouchers.',
      },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    description: 'Raw material procurement vouchers and supplier invoices.',
    permissions: [
      {
        key: 'purchases.view',
        label: 'View Purchases',
        description: 'Look up purchase vouchers and attached bills.',
      },
      {
        key: 'purchases.create',
        label: 'Add Purchases',
        description: 'Record new material procurement and supplier bills.',
      },
      {
        key: 'purchases.edit',
        label: 'Edit Purchases',
        description: 'Modify purchase vouchers and update bill documents.',
      },
      {
        key: 'purchases.delete',
        label: 'Delete Purchases',
        description: 'Void or cancel recorded purchase vouchers.',
      },
    ],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    description: 'Daily workshop overhead, transport, labour, and project expenses.',
    permissions: [
      {
        key: 'expenses.view',
        label: 'View Expenses',
        description: 'Browse daily expenses and payment receipts.',
      },
      {
        key: 'expenses.create',
        label: 'Add Expenses',
        description: 'Record new operational, transport, or labour expenses.',
      },
      {
        key: 'expenses.edit',
        label: 'Edit Expenses',
        description: 'Update expense descriptions, amounts, and categories.',
      },
      {
        key: 'expenses.delete',
        label: 'Delete Expenses',
        description: 'Void or cancel incorrect expense entries.',
      },
    ],
  },
  {
    id: 'materials',
    label: 'Materials and Stock',
    description: 'Fabrics, foam, timber inventory, and stock on hand.',
    permissions: [
      {
        key: 'materials.view',
        label: 'View Materials and Stock',
        description: 'Inspect catalog items, current stock, and unit prices.',
      },
      {
        key: 'materials.create',
        label: 'Add Materials',
        description: 'Register new fabric, foam, or timber items in catalog.',
      },
      {
        key: 'materials.edit',
        label: 'Edit Materials',
        description: 'Update material specifications and minimum stock thresholds.',
      },
      {
        key: 'materials.manageStock',
        label: 'Update Stock',
        description: 'Make manual physical inventory count adjustments.',
      },
    ],
  },
  {
    id: 'reports',
    label: 'Project Reports',
    description: 'Project financial statements, material costs, and margin analysis.',
    permissions: [
      {
        key: 'reports.view',
        label: 'View Project Reports',
        description: 'Access project financial summaries and cost reports.',
      },
      {
        key: 'reports.viewProfitability',
        label: 'View Project Profit',
        description: 'View confidential contract values and profit margins.',
      },
    ],
  },
  {
    id: 'users',
    label: 'Employee Management',
    description: 'Employee accounts, roles, and signup requests.',
    permissions: [
      {
        key: 'users.view',
        label: 'View Employees',
        description: 'View employee accounts and status.',
        adminOnly: true,
      },
      {
        key: 'users.manage',
        label: 'Manage Employees',
        description: 'Create, edit, or deactivate employee accounts.',
        adminOnly: true,
      },
      {
        key: 'users.approve',
        label: 'Approve Registrations',
        description: 'Approve or reject pending registration requests.',
        adminOnly: true,
      },
    ],
  },
  {
    id: 'activity',
    label: 'Activity History',
    description: 'Operational audit trail and recent action logs.',
    permissions: [
      {
        key: 'activity.viewOwn',
        label: 'View My Activity',
        description: 'Review logs of actions taken by the logged-in user.',
      },
      {
        key: 'activity.viewAll',
        label: 'View All Activity',
        description: 'Inspect platform-wide audit log across all staff members.',
      },
    ],
  },
  {
    id: 'permissions',
    label: 'Access Control',
    description: 'Role access management and individual employee permissions.',
    permissions: [
      {
        key: 'permissions.manage',
        label: 'Manage Access',
        description: 'Configure default roles and individual operator overrides.',
        adminOnly: true,
      },
    ],
  },
]

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

  return {
    allowed: false,
    requiredKeys: [],
    moduleTitle: 'Restricted Page',
    reason: 'The requested workspace section is not available for your role.',
    fallbackPath,
  }
}
