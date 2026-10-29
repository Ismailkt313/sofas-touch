const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const shortDateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export const REPORT_STATUS_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Project Statuses' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Under Review', label: 'Under Review' },
  { value: 'Completed', label: 'Completed' },
])

export const REPORT_SORT_OPTIONS = Object.freeze([
  { value: 'createdAt:desc', label: 'Newest Projects First' },
  { value: 'contractValue:desc', label: 'Contract Value: High to Low' },
  { value: 'contractValue:asc', label: 'Contract Value: Low to High' },
  { value: 'totalCost:desc', label: 'Total Costs: High to Low' },
  { value: 'totalCost:asc', label: 'Total Costs: Low to High' },
  { value: 'estimatedProfit:desc', label: 'Estimated Profit: High to Low' },
  { value: 'estimatedProfit:asc', label: 'Estimated Profit: Low to High' },
  { value: 'profitMargin:desc', label: 'Profit Margin: High to Low' },
  { value: 'profitMargin:asc', label: 'Profit Margin: Low to High' },
])

export function parseSortOptionValue(composite = 'createdAt:desc') {
  const [rawField, rawOrder] = String(composite || '').split(':')
  const validFields = new Set([
    'createdAt',
    'contractValue',
    'totalCost',
    'estimatedProfit',
    'profitMargin',
  ])
  const sortBy = validFields.has(rawField) ? rawField : 'createdAt'
  const sortOrder = rawOrder === 'asc' ? 'asc' : 'desc'
  return { sortBy, sortOrder }
}

export function buildSortOptionValue(sortBy = 'createdAt', sortOrder = 'desc') {
  const parsed = parseSortOptionValue(`${sortBy}:${sortOrder}`)
  return `${parsed.sortBy}:${parsed.sortOrder}`
}

export function formatReportCurrency(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return inrFormatter.format(0)
  }
  const normalized = Object.is(num, -0) ? 0 : num
  if (normalized < 0) {
    return `−${inrFormatter.format(Math.abs(normalized))}`
  }
  return inrFormatter.format(normalized)
}

export function formatSafePercentage(value, applicable = true) {
  if (!applicable || value === null || value === undefined) {
    return '—'
  }
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return '—'
  }
  const normalized = Object.is(num, -0) ? 0 : num
  if (normalized < 0) {
    return `−${Math.abs(normalized).toFixed(2)}%`
  }
  return `${normalized.toFixed(2)}%`
}

export function formatReportDate(value) {
  if (!value) {
    return '—'
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [y, m, d] = value.trim().split('-').map(Number)
    const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    if (!Number.isNaN(utcDate.getTime())) {
      return shortDateFormatter.format(utcDate)
    }
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return shortDateFormatter.format(parsed)
}

export function formatReportingPeriodLabel(period) {
  if (!period?.isDateFiltered) {
    return 'All Recorded Dates (Lifetime)'
  }
  if (period.fromDate && period.toDate) {
    return `${formatReportDate(period.fromDate)} – ${formatReportDate(period.toDate)}`
  }
  if (period.fromDate) {
    return `From ${formatReportDate(period.fromDate)}`
  }
  if (period.toDate) {
    return `Up to ${formatReportDate(period.toDate)}`
  }
  return 'All Recorded Dates (Lifetime)'
}

export const formatPeriodRangeLabel = formatReportingPeriodLabel

export function validateReportDateRange(fromDate, toDate) {
  if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return 'From date must be in YYYY-MM-DD format.'
  }
  if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return 'To date must be in YYYY-MM-DD format.'
  }
  if (fromDate && toDate && fromDate > toDate) {
    return 'From date cannot be later than To date.'
  }
  return ''
}

export function getHealthIndicatorMeta(healthStatus) {
  switch (healthStatus) {
    case 'loss':
      return {
        key: 'loss',
        label: 'Over budget',
        className: 'rep-health--loss',
      }
    case 'near_limit':
      return {
        key: 'near_limit',
        label: 'Near budget limit',
        className: 'rep-health--warning',
      }
    case 'profitable':
      return {
        key: 'profitable',
        label: 'Within budget',
        className: 'rep-health--good',
      }
    default:
      return {
        key: 'neutral',
        label: 'No contract / Break-even',
        className: 'rep-health--neutral',
      }
  }
}

export function clampProgressBarPercent(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) {
    return 0
  }
  return Math.min(100, Math.max(0, num))
}

export const clampProgressWidth = clampProgressBarPercent
