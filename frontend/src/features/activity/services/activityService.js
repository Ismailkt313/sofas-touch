import api from '../../../services/api'

function normalizeActivityRecord(raw = {}) {
  return {
    id: String(raw.id || raw._id || ''),
    actionType: String(raw.actionType || ''),
    entityType: String(raw.entityType || ''),
    entityId: String(raw.entityId || ''),
    entityLabel: String(raw.entityLabel || ''),
    projectId: raw.projectId ? String(raw.projectId) : null,
    projectCode: raw.projectCode ? String(raw.projectCode) : null,
    projectName: raw.projectName ? String(raw.projectName) : null,
    actorId: raw.actorId ? String(raw.actorId) : null,
    actorName: String(raw.actorName || 'Workspace User'),
    actorRole: String(raw.actorRole || 'data_entry'),
    description: String(raw.description || ''),
    targetPath: typeof raw.targetPath === 'string' ? raw.targetPath : null,
    timestamp: raw.timestamp || raw.createdAt || null,
  }
}

export async function fetchRecentActivities(limit = 50) {
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 50))
  const response = await api.get('/api/activities/recent', {
    params: { limit: safeLimit },
  })
  const items = Array.isArray(response?.data?.items)
    ? response.data.items.map(normalizeActivityRecord)
    : []
  return {
    items,
    limit: Number(response?.data?.limit) || safeLimit,
  }
}

export async function fetchActivityHistory(filters = {}) {
  const params = {}
  const safePage = Math.max(1, parseInt(filters.page, 10) || 1)
  const safeLimit = Math.max(1, Math.min(100, parseInt(filters.limit, 10) || 10))
  params.page = safePage
  params.limit = safeLimit

  if (filters.entityType && filters.entityType !== 'all') {
    params.entityType = filters.entityType
  }
  if (filters.actionType && filters.actionType !== 'all') {
    params.actionType = filters.actionType
  }
  if (filters.actorId && filters.actorId !== 'all') {
    params.actorId = filters.actorId
  }
  if (filters.projectId && filters.projectId !== 'all') {
    params.projectId = filters.projectId
  }
  if (filters.fromDate) params.fromDate = filters.fromDate
  if (filters.toDate) params.toDate = filters.toDate
  if (filters.search && filters.search.trim()) {
    params.search = filters.search.trim()
  }

  const response = await api.get('/api/activities', { params })
  const data = response?.data || {}
  const items = Array.isArray(data.items)
    ? data.items.map(normalizeActivityRecord)
    : []

  return {
    items,
    total: Number(data.total) || 0,
    page: Number(data.page) || safePage,
    limit: Number(data.limit) || safeLimit,
    totalPages: Math.max(1, Number(data.totalPages) || 1),
    summary: data.summary || {
      total: Number(data.total) || 0,
      today: 0,
      projects: 0,
      financial: 0,
    },
    filterOptions: data.filterOptions || null,
  }
}
