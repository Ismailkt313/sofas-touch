import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_NAV_ITEMS,
  getGroupedVisibleNavItems,
  getVisibleNavItems,
} from '../../../components/layout/navigationConfig.js'
import {
  ADMIN_RESERVED_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  computeDraftEffectivePermissions,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_DATA_ENTRY_PERMISSIONS,
  evaluateRouteAccess,
  getEffectivePermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  resolveFirstPermittedPath,
  togglePermissionWithDependencies,
} from '../constants/permissionsCatalog.js'

test('permissionsCatalog defines all 25 canonical keys and safe role defaults', () => {
  assert.equal(ALL_PERMISSION_KEYS.length, 25)
  assert.equal(DEFAULT_ADMIN_PERMISSIONS.length, 25)

  for (const reserved of ADMIN_RESERVED_PERMISSIONS) {
    assert.equal(
      DEFAULT_DATA_ENTRY_PERMISSIONS.includes(reserved),
      false,
      `Data entry default must not include reserved key ${reserved}`,
    )
  }

  assert.equal(
    DEFAULT_DATA_ENTRY_PERMISSIONS.includes('reports.viewProfitability'),
    false,
  )
  assert.equal(
    DEFAULT_DATA_ENTRY_PERMISSIONS.includes('projects.delete'),
    false,
  )
  assert.equal(
    DEFAULT_DATA_ENTRY_PERMISSIONS.includes('purchases.view'),
    true,
  )
  assert.equal(
    DEFAULT_DATA_ENTRY_PERMISSIONS.includes('expenses.create'),
    true,
  )
})

test('togglePermissionWithDependencies enforces parent and child permission rules', () => {
  const fromEmptyEnableCreate = togglePermissionWithDependencies(
    [],
    'purchases.create',
    true,
  )
  assert.ok(fromEmptyEnableCreate.includes('purchases.create'))
  assert.ok(fromEmptyEnableCreate.includes('purchases.view'))

  const withAllPurchases = [
    'purchases.view',
    'purchases.create',
    'purchases.edit',
    'purchases.delete',
  ]
  const afterDisableView = togglePermissionWithDependencies(
    withAllPurchases,
    'purchases.view',
    false,
  )
  assert.deepEqual(afterDisableView, [])

  const enableProfitability = togglePermissionWithDependencies(
    [],
    'reports.viewProfitability',
    true,
  )
  assert.ok(enableProfitability.includes('reports.viewProfitability'))
  assert.ok(enableProfitability.includes('reports.view'))
})

test('computeDraftEffectivePermissions honors role baseline, grants, and strict revocations', () => {
  const effective = computeDraftEffectivePermissions({
    role: 'data_entry',
    rolePermissions: DEFAULT_DATA_ENTRY_PERMISSIONS,
    overrides: {
      grant: ['projects.edit', 'permissions.manage', 'purchases.create'],
      revoke: ['purchases.create', 'expenses.view'],
    },
  })

  assert.equal(effective.includes('projects.edit'), true)
  assert.equal(effective.includes('permissions.manage'), false)
  assert.equal(effective.includes('purchases.create'), false)
  assert.equal(effective.includes('expenses.view'), false)
  assert.equal(effective.includes('expenses.create'), false)
  assert.equal(effective.includes('expenses.edit'), false)
})

test('navigationConfig prevents flash before load and separates Admin vs Data Entry menus', () => {
  assert.deepEqual(getVisibleNavItems(null), [])
  assert.deepEqual(getVisibleNavItems(undefined), [])

  const adminUser = {
    role: 'admin',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
  }
  const operatorUser = {
    role: 'data_entry',
    permissions: DEFAULT_DATA_ENTRY_PERMISSIONS,
  }

  const adminItems = getVisibleNavItems(adminUser)
  assert.equal(adminItems.length, ADMIN_NAV_ITEMS.length)
  assert.ok(adminItems.some((item) => item.path === '/permissions'))
  assert.ok(adminItems.some((item) => item.path === '/users'))
  // /user-approvals is accessed via header notifications/dashboard, not in sidebar nav
  assert.ok(adminItems.some((item) => item.path === '/reports'))

  const adminGroups = getGroupedVisibleNavItems(adminUser)
  assert.equal(adminGroups.length, 3)

  const operatorItems = getVisibleNavItems(operatorUser)
  assert.ok(operatorItems.some((i) => i.path === '/dashboard'))
  assert.ok(operatorItems.some((i) => i.path === '/activity'))
  assert.ok(operatorItems.some((i) => i.path === '/projects'))
  assert.ok(operatorItems.some((i) => i.path === '/purchases'))
  assert.ok(operatorItems.some((i) => i.path === '/expenses'))
  assert.ok(operatorItems.some((i) => i.path === '/raw-materials'))
  assert.ok(operatorItems.every((i) => i.path !== '/users'))
  assert.ok(operatorItems.every((i) => i.path !== '/user-approvals'))
  assert.ok(operatorItems.every((i) => i.path !== '/reports'))
  assert.ok(operatorItems.every((i) => i.path !== '/permissions'))
  assert.ok(operatorItems.every((i) => i.path !== '/settings'))

  const restrictedOperator = {
    role: 'data_entry',
    permissions: ['projects.view', 'purchases.view'],
  }
  assert.equal(resolveFirstPermittedPath(restrictedOperator), '/purchases')
})

test('evaluateRouteAccess blocks unauthorized routes for 403 rendering and allows permitted routes', () => {
  const operatorUser = {
    role: 'data_entry',
    permissions: DEFAULT_DATA_ENTRY_PERMISSIONS,
  }
  const adminUser = {
    role: 'admin',
    permissions: DEFAULT_ADMIN_PERMISSIONS,
  }

  assert.equal(evaluateRouteAccess('/dashboard', operatorUser).allowed, true)
  assert.equal(evaluateRouteAccess('/projects', operatorUser).allowed, true)
  assert.equal(
    evaluateRouteAccess('/purchases/new', operatorUser).allowed,
    true,
  )
  assert.equal(evaluateRouteAccess('/profile', operatorUser).allowed, true)
  assert.equal(evaluateRouteAccess('/settings', operatorUser).allowed, false)
  assert.equal(evaluateRouteAccess('/settings', adminUser).allowed, false)

  for (const restrictedPath of [
    '/users',
    '/user-approvals',
    '/permissions',
    '/reports',
    '/projects/PRJ-2026-0001/report',
  ]) {
    const decision = evaluateRouteAccess(restrictedPath, operatorUser)
    assert.equal(
      decision.allowed,
      false,
      `Expected ${restrictedPath} to be forbidden for default data_entry`,
    )
    assert.equal(evaluateRouteAccess(restrictedPath, adminUser).allowed, true)
  }

  const noPurchaseEditOperator = {
    role: 'data_entry',
    permissions: DEFAULT_DATA_ENTRY_PERMISSIONS.filter(
      (key) => key !== 'purchases.edit',
    ),
  }
  assert.equal(
    evaluateRouteAccess('/purchases/PV-2026-0001/edit', noPurchaseEditOperator)
      .allowed,
    false,
  )

  assert.equal(hasPermission(operatorUser, 'purchases.create'), true)
  assert.equal(hasPermission(operatorUser, 'permissions.manage'), false)
  assert.equal(
    hasAnyPermission(operatorUser, ['users.manage', 'materials.view']),
    true,
  )
  assert.equal(
    hasAllPermissions(operatorUser, ['purchases.view', 'projects.delete']),
    false,
  )
  assert.deepEqual(
    getEffectivePermissions(operatorUser),
    DEFAULT_DATA_ENTRY_PERMISSIONS,
  )
})
