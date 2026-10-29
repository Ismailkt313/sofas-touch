import api from '../../../services/api'

export async function fetchDashboardOverview(options = {}) {
  const params = {}
  if (options.projectStatus && options.projectStatus !== 'all') {
    params.projectStatus = options.projectStatus
  }
  if (options.projectSearch && options.projectSearch.trim()) {
    params.projectSearch = options.projectSearch.trim()
  }
  if (options.projectSortBy) {
    params.projectSortBy = options.projectSortBy
  }
  if (options.projectSortOrder) {
    params.projectSortOrder = options.projectSortOrder
  }
  if (options.expenseMonths) {
    params.expenseMonths = options.expenseMonths
  }
  if (options.expenseFromDate) {
    params.expenseFromDate = options.expenseFromDate
  }
  if (options.expenseToDate) {
    params.expenseToDate = options.expenseToDate
  }
  if (options.recentLimit) {
    params.recentLimit = options.recentLimit
  }

  const response = await api.get('/api/dashboard/overview', { params })
  return response?.data || null
}

export async function fetchDashboardMonthlyExpenses(options = {}) {
  const params = {}
  if (options.months) params.months = options.months
  if (options.fromDate) params.fromDate = options.fromDate
  if (options.toDate) params.toDate = options.toDate

  const response = await api.get('/api/dashboard/monthly-expenses', { params })
  return response?.data || null
}
