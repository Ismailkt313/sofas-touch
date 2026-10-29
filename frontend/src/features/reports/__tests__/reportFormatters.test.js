import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findNavItemByPath,
  isNavItemActive,
} from '../../../components/layout/navigationConfig.js'
import {
  buildSortOptionValue,
  clampProgressWidth,
  formatPeriodRangeLabel,
  formatReportCurrency,
  formatReportDate,
  formatSafePercentage,
  getHealthIndicatorMeta,
  parseSortOptionValue,
  validateReportDateRange,
} from '../utils/reportFormatters.js'

test('formatReportCurrency formats INR cleanly and guards non-finite values', () => {
  assert.equal(formatReportCurrency(125000), '₹1,25,000.00')
  assert.equal(formatReportCurrency(0), '₹0.00')
  assert.equal(formatReportCurrency(-5000), '−₹5,000.00')
  assert.equal(formatReportCurrency(null), '₹0.00')
  assert.equal(formatReportCurrency(undefined), '₹0.00')
  assert.equal(formatReportCurrency(Number.NaN), '₹0.00')
  assert.equal(formatReportCurrency(Number.POSITIVE_INFINITY), '₹0.00')
})

test('formatSafePercentage handles zero-contract-value and non-finite inputs safely', () => {
  assert.equal(formatSafePercentage(null, false), '—')
  assert.equal(formatSafePercentage(0, false), '—')
  assert.equal(formatSafePercentage(Number.NaN, true), '—')
  assert.equal(formatSafePercentage(Number.POSITIVE_INFINITY, true), '—')
  assert.equal(formatSafePercentage(34.5, true), '34.50%')
  assert.equal(formatSafePercentage(-12.75, true), '−12.75%')
})

test('validateReportDateRange validates YYYY-MM-DD and inverted ranges', () => {
  assert.equal(validateReportDateRange('', ''), '')
  assert.equal(validateReportDateRange('2026-10-01', '2026-10-29'), '')
  assert.equal(validateReportDateRange('2026-10-15', '2026-10-15'), '')
  assert.match(
    validateReportDateRange('2026-10-29', '2026-10-01'),
    /cannot be later/i,
  )
  assert.match(validateReportDateRange('29-10-2026', ''), /YYYY-MM-DD/)
})

test('formatPeriodRangeLabel distinguishes lifetime vs bounded and open-ended periods', () => {
  assert.equal(
    formatPeriodRangeLabel({
      isDateFiltered: false,
      fromDate: null,
      toDate: null,
    }),
    'All Recorded Dates (Lifetime)',
  )
  const bounded = formatPeriodRangeLabel({
    isDateFiltered: true,
    fromDate: '2026-10-01',
    toDate: '2026-10-15',
  })
  assert.ok(bounded.includes('2026'))
  assert.ok(bounded.includes('–'))

  const fromOnly = formatPeriodRangeLabel({
    isDateFiltered: true,
    fromDate: '2026-10-01',
    toDate: null,
  })
  assert.match(fromOnly, /^From /)

  const toOnly = formatPeriodRangeLabel({
    isDateFiltered: true,
    fromDate: null,
    toDate: '2026-10-15',
  })
  assert.match(toOnly, /^Up to /)
})

test('parseSortOptionValue and buildSortOptionValue round-trip financial sort options', () => {
  assert.deepEqual(parseSortOptionValue('estimatedProfit:desc'), {
    sortBy: 'estimatedProfit',
    sortOrder: 'desc',
  })
  assert.deepEqual(parseSortOptionValue('profitMargin:asc'), {
    sortBy: 'profitMargin',
    sortOrder: 'asc',
  })
  assert.deepEqual(parseSortOptionValue(''), {
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })
  assert.equal(buildSortOptionValue('totalCost', 'desc'), 'totalCost:desc')
})

test('getHealthIndicatorMeta and clampProgressWidth handle all budget health states', () => {
  assert.equal(getHealthIndicatorMeta('profitable').label, 'Within budget')
  assert.equal(getHealthIndicatorMeta('near_limit').label, 'Near budget limit')
  assert.equal(getHealthIndicatorMeta('loss').label, 'Over budget')
  assert.equal(
    getHealthIndicatorMeta('neutral').label,
    'No contract / Break-even',
  )

  assert.equal(clampProgressWidth(-10), 0)
  assert.equal(clampProgressWidth(45.5), 45.5)
  assert.equal(clampProgressWidth(142.8), 100)
  assert.equal(clampProgressWidth(Number.NaN), 0)
})

test('formatReportDate formats ISO dates and falls back cleanly', () => {
  assert.equal(formatReportDate(null), '—')
  assert.equal(formatReportDate('invalid-date'), '—')
  assert.ok(formatReportDate('2026-10-20').includes('2026'))
})

test('navigationConfig highlights Reports for /reports and /projects/:id/report without mis-highlighting Projects', () => {
  assert.equal(isNavItemActive('/reports', '/reports'), true)
  assert.equal(isNavItemActive('/reports/PRJ-2026-0001', '/reports'), true)
  assert.equal(
    isNavItemActive('/projects/PRJ-2026-0001/report', '/reports'),
    true,
  )
  assert.equal(
    isNavItemActive('/projects/PRJ-2026-0001/report', '/projects'),
    false,
  )
  assert.equal(isNavItemActive('/projects/PRJ-2026-0001', '/projects'), true)
  assert.equal(findNavItemByPath('/projects/PRJ-2026-0001/report')?.id, 'reports')
})
