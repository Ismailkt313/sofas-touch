const inrFullFormatter = new Intl.NumberFormat('en-IN', {
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

export const DASHBOARD_PROJECT_STATUS_OPTIONS = Object.freeze([
  { value: 'all', label: 'All Statuses' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Under Review', label: 'Under Review' },
  { value: 'Completed', label: 'Completed' },
])

export const DASHBOARD_PROJECT_SORT_OPTIONS = Object.freeze([
  { value: 'totalCost:desc', label: 'Total Costs: High to Low' },
  { value: 'contractValue:desc', label: 'Contract Value: High to Low' },
  { value: 'estimatedProfit:desc', label: 'Estimated Profit: High to Low' },
  { value: 'estimatedProfit:asc', label: 'Estimated Profit: Low to High' },
  { value: 'profitMargin:desc', label: 'Profit Margin: High to Low' },
  { value: 'profitMargin:asc', label: 'Profit Margin: Low to High' },
  { value: 'createdAt:desc', label: 'Newest Projects First' },
])

export const DASHBOARD_EXPENSE_PERIOD_OPTIONS = Object.freeze([
  { value: '3', label: 'Last 3 Months' },
  { value: '6', label: 'Last 6 Months' },
  { value: '12', label: 'Last 12 Months' },
  { value: 'custom', label: 'Custom Date Range' },
])

export function parseDashboardSort(composite = 'totalCost:desc') {
  const [rawField, rawOrder] = String(composite || '').split(':')
  const validFields = new Set([
    'totalCost',
    'contractValue',
    'estimatedProfit',
    'profitMargin',
    'createdAt',
  ])
  return {
    sortBy: validFields.has(rawField) ? rawField : 'totalCost',
    sortOrder: rawOrder === 'asc' ? 'asc' : 'desc',
  }
}

export function formatDashboardCurrency(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return inrFullFormatter.format(0)
  }
  const normalized = Object.is(num, -0) ? 0 : num
  if (normalized < 0) {
    return `−${inrFullFormatter.format(Math.abs(normalized))}`
  }
  return inrFullFormatter.format(normalized)
}

export function formatCompactCurrency(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num === 0) {
    return '₹0'
  }
  const sign = num < 0 ? '−' : ''
  const abs = Math.abs(num)
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2).replace(/\.?0+$/, '')}L`
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return `${sign}₹${Math.round(abs)}`
}

export function formatDashboardPercent(value, applicable = true) {
  if (!applicable || value === null || value === undefined) {
    return 'N/A'
  }
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 'N/A'
  }
  const normalized = Object.is(num, -0) ? 0 : num
  if (normalized < 0) {
    return `−${Math.abs(normalized).toFixed(2)}%`
  }
  return `${normalized.toFixed(2)}%`
}

export function formatDashboardDate(value) {
  if (!value) return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [y, m, d] = value.trim().split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    if (!Number.isNaN(dt.getTime())) {
      return shortDateFormatter.format(dt)
    }
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return shortDateFormatter.format(parsed)
}

export function getProjectHealthBadgeMeta(healthStatus) {
  switch (healthStatus) {
    case 'loss':
      return {
        tone: 'danger',
        label: 'Over Budget',
      }
    case 'near_limit':
      return {
        tone: 'warning',
        label: 'Near Limit',
      }
    case 'unpriced':
      return {
        tone: 'neutral',
        label: 'Unpriced',
      }
    default:
      return {
        tone: 'success',
        label: 'On Track',
      }
  }
}

export function getProjectStatusBadgeTone(status) {
  if (status === 'Completed') return 'completed'
  if (status === 'Under Review') return 'review'
  return 'progress'
}

export function getStockAlertBadgeMeta(alertStatus) {
  if (alertStatus === 'out_of_stock') {
    return {
      tone: 'danger',
      label: 'Out of Stock',
    }
  }
  return {
    tone: 'warning',
    label: 'Low Stock',
  }
}

export function buildProjectChartBars(rows = [], maxItems = 10) {
  const subset = Array.isArray(rows) ? rows.slice(0, maxItems) : []
  let peak = 0
  for (const row of subset) {
    const cv = Math.max(0, Number(row.contractValue) || 0)
    const tc = Math.max(0, Number(row.totalProjectCosts) || 0)
    if (cv > peak) peak = cv
    if (tc > peak) peak = tc
  }

  const denominator = peak > 0 ? peak : 1

  return {
    maxAmount: peak,
    items: subset.map((row) => {
      const contractValue = Math.max(0, Number(row.contractValue) || 0)
      const totalProjectCosts = Math.max(0, Number(row.totalProjectCosts) || 0)
      return {
        ...row,
        contractRatio:
          peak > 0 ? Math.min(100, (contractValue / denominator) * 100) : 0,
        costRatio:
          peak > 0 ? Math.min(100, (totalProjectCosts / denominator) * 100) : 0,
      }
    }),
  }
}

export function computeNiceCeiling(rawPeak) {
  const num = Math.max(0, Number(rawPeak) || 0)
  if (num <= 0) return 10000
  const exponent = Math.floor(Math.log10(num))
  const magnitude = 10 ** exponent
  const fraction = num / magnitude
  let niceFraction = 10
  if (fraction <= 1) niceFraction = 1
  else if (fraction <= 2) niceFraction = 2
  else if (fraction <= 5) niceFraction = 5
  return niceFraction * magnitude
}

export function buildMonthlyChartScale(buckets = []) {
  const list = Array.isArray(buckets) ? buckets : []
  let rawPeak = 0
  for (const b of list) {
    const p = Math.max(0, Number(b.purchaseCosts) || 0)
    const e = Math.max(0, Number(b.otherExpenses) || 0)
    const localMax = Math.max(p, e)
    if (localMax > rawPeak) rawPeak = localMax
  }

  const ceiling = computeNiceCeiling(rawPeak)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    ratio,
    value: Math.round(ceiling * ratio),
    label: formatCompactCurrency(ceiling * ratio),
  }))

  const bars = list.map((b) => {
    const purchaseCosts = Math.max(0, Number(b.purchaseCosts) || 0)
    const otherExpenses = Math.max(0, Number(b.otherExpenses) || 0)
    return {
      ...b,
      purchaseRatio:
        rawPeak > 0 ? Math.min(100, (purchaseCosts / ceiling) * 100) : 0,
      expenseRatio:
        rawPeak > 0 ? Math.min(100, (otherExpenses / ceiling) * 100) : 0,
    }
  })

  return {
    hasData: rawPeak > 0,
    maxScaleValue: ceiling,
    ticks,
    bars,
  }
}
