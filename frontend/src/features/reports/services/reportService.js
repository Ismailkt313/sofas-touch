import api from '../../../services/api'
import { getStoredSession } from '../../auth'

function extractReportApiError(error, fallbackMessage) {
  const status = error?.response?.status || 0
  const data = error?.response?.data
  const fieldErrors =
    data?.errors && typeof data.errors === 'object' ? data.errors : null

  let message =
    (typeof data?.message === 'string' && data.message.trim()) || ''

  if (!message && fieldErrors) {
    const firstMsg = Object.values(fieldErrors).find(
      (v) => typeof v === 'string' && v.trim(),
    )
    if (firstMsg) {
      message = firstMsg
    }
  }

  if (!message) {
    if (status === 401) {
      message = 'Your session has expired. Please sign in again.'
    } else if (status === 403) {
      message =
        'Administrator privileges are required to view financial profitability reports.'
    } else if (status === 404) {
      message = 'Requested project report was not found.'
    } else {
      message = fallbackMessage
    }
  }

  const normalized = new Error(message)
  normalized.status = status
  normalized.fieldErrors = fieldErrors
  return normalized
}

export function hasActiveAuthToken() {
  const session = getStoredSession()
  return Boolean(session?.token)
}

export function isAdminUser(user) {
  const target = user || getStoredSession()?.user
  const role = String(target?.role || '')
    .trim()
    .toLowerCase()
  return role === 'admin'
}

function buildReportsQueryParams({
  page,
  limit,
  search,
  status,
  fromDate,
  toDate,
  sortBy,
  sortOrder,
} = {}) {
  const params = {}
  if (page !== undefined) params.page = page
  if (limit !== undefined) params.limit = limit
  if (search && String(search).trim()) params.search = String(search).trim()
  if (status && status !== 'all') params.status = status
  if (fromDate) params.fromDate = fromDate
  if (toDate) params.toDate = toDate
  if (sortBy) params.sortBy = sortBy
  if (sortOrder) params.sortOrder = sortOrder
  return params
}

function extractDispositionFileName(headers, fallbackName) {
  const disposition = headers?.['content-disposition'] || ''
  const match = /filename="?([^";]+)"?/i.exec(disposition)
  return match && match[1] ? match[1].trim() : fallbackName
}

function triggerBrowserBlobDownload(blob, fileName) {
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
}

export async function fetchProjectReports(filters = {}) {
  try {
    const params = buildReportsQueryParams(filters)
    const response = await api.get('/api/reports/projects', { params })
    return response.data
  } catch (error) {
    throw extractReportApiError(
      error,
      'Unable to load project profitability reports.',
    )
  }
}

export async function downloadProjectReportsCsv(filters = {}) {
  try {
    const params = buildReportsQueryParams({
      search: filters.search,
      status: filters.status,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    })
    const response = await api.get('/api/reports/projects/export', {
      params,
      responseType: 'blob',
      timeout: 25000,
    })
    const fileName = extractDispositionFileName(
      response.headers,
      'soft-touch-sofas-project-reports.csv',
    )
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
    triggerBrowserBlobDownload(blob, fileName)
    return fileName
  } catch (error) {
    throw extractReportApiError(error, 'Unable to export CSV report.')
  }
}

export async function fetchIndividualProjectReport(
  projectIdentifier,
  { fromDate = '', toDate = '' } = {},
) {
  try {
    const params = {}
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate

    const response = await api.get(
      `/api/reports/projects/${encodeURIComponent(projectIdentifier)}`,
      { params },
    )
    return response.data
  } catch (error) {
    throw extractReportApiError(
      error,
      'Unable to load individual project report.',
    )
  }
}

export async function downloadIndividualProjectReportPdf(
  projectIdentifier,
  { fromDate = '', toDate = '' } = {},
) {
  try {
    const params = {}
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate

    const response = await api.get(
      `/api/reports/projects/${encodeURIComponent(projectIdentifier)}/pdf`,
      {
        params,
        responseType: 'blob',
        timeout: 25000,
      },
    )
    const fileName = extractDispositionFileName(
      response.headers,
      `soft-touch-sofas-${projectIdentifier}-report.pdf`,
    )
    const blob = new Blob([response.data], { type: 'application/pdf' })
    triggerBrowserBlobDownload(blob, fileName)
    return fileName
  } catch (error) {
    throw extractReportApiError(error, 'Unable to export PDF report.')
  }
}
