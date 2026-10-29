import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ADMIN_NAV_ITEMS,
  getVisibleNavItems,
  isNavItemActive,
} from '../../../components/layout/navigationConfig.js'
import {
  formatActivityTimestamp,
  getActivityActionOptions,
  getActivityEntityOptions,
  getActivityVisualMeta,
  resolvePermittedActivityPath,
} from '../../activity/utils/activityFormatters.js'
import {
  buildMonthlyChartScale,
  buildProjectChartBars,
  formatCompactCurrency,
  formatDashboardCurrency,
  formatDashboardPercent,
  getProjectHealthBadgeMeta,
  getStockAlertBadgeMeta,
  parseDashboardSort,
} from '../utils/dashboardFormatters.js'

test('dashboardFormatters formats currency, compact axes, and safe percentages', () => {
  assert.equal(formatDashboardCurrency(0), '₹0.00')
  assert.equal(formatDashboardCurrency(-0), '₹0.00')
  assert.ok(formatDashboardCurrency(250000).includes('2,50,000.00'))
  assert.ok(formatDashboardCurrency(-14500).startsWith('−₹'))

  assert.equal(formatCompactCurrency(0), '₹0')
  assert.equal(formatCompactCurrency(45000), '₹45k')
  assert.equal(formatCompactCurrency(250000), '₹2.5L')
  assert.equal(formatCompactCurrency(12500000), '₹1.25Cr')

  assert.equal(formatDashboardPercent(null, false), 'N/A')
  assert.equal(formatDashboardPercent(35.678, true), '35.68%')
  assert.equal(formatDashboardPercent(-12.4, true), '−12.40%')
})

test('dashboardFormatters builds project and monthly chart geometries safely', () => {
  const emptyProj = buildProjectChartBars([])
  assert.equal(emptyProj.maxAmount, 0)
  assert.deepEqual(emptyProj.items, [])

  const projChart = buildProjectChartBars([
    { id: '1', contractValue: 200000, totalProjectCosts: 100000 },
    { id: '2', contractValue: 50000, totalProjectCosts: 60000 },
  ])
  assert.equal(projChart.maxAmount, 200000)
  assert.equal(projChart.items[0].contractRatio, 100)
  assert.equal(projChart.items[0].costRatio, 50)
  assert.equal(projChart.items[1].costRatio, 30)

  const emptyMonthly = buildMonthlyChartScale([
    { monthKey: '2026-09', purchaseCosts: 0, otherExpenses: 0 },
  ])
  assert.equal(emptyMonthly.hasData, false)

  const activeMonthly = buildMonthlyChartScale([
    { monthKey: '2026-09', purchaseCosts: 42000, otherExpenses: 10000 },
    { monthKey: '2026-10', purchaseCosts: 18000, otherExpenses: 8500 },
  ])
  assert.equal(activeMonthly.hasData, true)
  assert.equal(activeMonthly.maxScaleValue, 50000)
  assert.equal(activeMonthly.ticks.length, 5)
  assert.equal(activeMonthly.bars[0].purchaseRatio, 84)
  assert.equal(activeMonthly.bars[0].expenseRatio, 20)
})

test('dashboardFormatters parses sort options and status badges accurately', () => {
  assert.deepEqual(parseDashboardSort('estimatedProfit:asc'), {
    sortBy: 'estimatedProfit',
    sortOrder: 'asc',
  })
  assert.deepEqual(parseDashboardSort('invalid:bad'), {
    sortBy: 'totalCost',
    sortOrder: 'desc',
  })
  assert.equal(getProjectHealthBadgeMeta('loss').label, 'Over Budget')
  assert.equal(getProjectHealthBadgeMeta('near_limit').label, 'Near Limit')
  assert.equal(getStockAlertBadgeMeta('out_of_stock').tone, 'danger')
  assert.equal(getStockAlertBadgeMeta('low_stock').tone, 'warning')
})

test('activityFormatters enforces RBAC options and targetPath guards', () => {
  const adminEntities = getActivityEntityOptions('admin')
  const operatorEntities = getActivityEntityOptions('data_entry')
  assert.ok(adminEntities.some((o) => o.value === 'user'))
  assert.ok(operatorEntities.every((o) => o.value !== 'user'))

  const adminActions = getActivityActionOptions('admin')
  const operatorActions = getActivityActionOptions('data_entry')
  assert.ok(adminActions.some((o) => o.value === 'user.approved'))
  assert.ok(operatorActions.every((o) => !o.value.startsWith('user.')))

  assert.equal(
    resolvePermittedActivityPath({ targetPath: '/users' }, 'admin'),
    '/users',
  )
  assert.equal(
    resolvePermittedActivityPath({ targetPath: '/users' }, 'data_entry'),
    null,
  )
  assert.equal(
    resolvePermittedActivityPath(
      { targetPath: '/user-approvals' },
      'data_entry',
    ),
    null,
  )
  assert.equal(
    resolvePermittedActivityPath(
      { targetPath: '/projects/PRJ-2026-0001/report' },
      'data_entry',
    ),
    null,
  )
  assert.equal(
    resolvePermittedActivityPath(
      { targetPath: '/purchases/PV-2026-0001' },
      'data_entry',
    ),
    '/purchases/PV-2026-0001',
  )

  assert.equal(
    getActivityVisualMeta('purchase.cancelled', 'purchase').tone,
    'danger',
  )
  assert.equal(
    getActivityVisualMeta('project.created', 'project').tone,
    'success',
  )

  const now = Date.UTC(2026, 9, 29, 12, 0, 0)
  const twoMinAgo = new Date(now - 120 * 1000).toISOString()
  assert.equal(formatActivityTimestamp(twoMinAgo, now).relative, '2m ago')
})

test('navigationConfig exposes dashboard and activity routes with RBAC visibility', () => {
  const adminNav = getVisibleNavItems('admin')
  const operatorNav = getVisibleNavItems('data_entry')

  assert.equal(adminNav.length, ADMIN_NAV_ITEMS.length)
  assert.ok(operatorNav.some((i) => i.path === '/dashboard'))
  assert.ok(operatorNav.some((i) => i.path === '/activity'))
  assert.ok(operatorNav.every((i) => i.path !== '/users'))
  assert.ok(operatorNav.every((i) => i.path !== '/user-approvals'))
  assert.ok(operatorNav.every((i) => i.path !== '/reports'))
  assert.equal(isNavItemActive('/activity', '/activity'), true)
})
