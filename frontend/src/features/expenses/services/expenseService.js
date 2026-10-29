import api from '../../../services/api'
import { getStoredSession } from '../../auth'
import { roundExpenseAmount } from '../utils/expenseValidation'

function extractExpenseApiError(error, fallbackMessage) {
  const status = error?.response?.status || 0
  const data = error?.response?.data
  const fieldErrors =
    data?.errors && typeof data.errors === 'object' ? data.errors : null

  let message =
    (typeof data?.message === 'string' && data.message.trim()) || ''

  if (!message && fieldErrors) {
    const firstFieldMsg = Object.values(fieldErrors).find(
      (val) => typeof val === 'string' && val.trim(),
    )
    if (firstFieldMsg) {
      message = firstFieldMsg
    }
  }

  if (!message) {
    if (status === 401) {
      message = 'Your session has expired. Please sign in again.'
    } else if (status === 403) {
      message = 'You do not have permission to perform this action.'
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

export function normalizeExpenseCategory(raw = {}) {
  return {
    id: String(raw.id || raw._id || ''),
    name: String(raw.name || ''),
    description: String(raw.description || ''),
    isDefault: Boolean(raw.isDefault),
    isActive: raw.isActive !== false,
    createdBy: String(raw.createdBy || ''),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

export function normalizeExpenseAttachment(raw = {}) {
  return {
    attachmentId: String(raw.attachmentId || ''),
    originalName: String(raw.originalName || 'expense-receipt'),
    mimeType: String(raw.mimeType || 'application/octet-stream'),
    sizeBytes: Number(raw.sizeBytes || 0),
    storageProvider: String(raw.storageProvider || 'local_protected'),
    uploadedBy: String(raw.uploadedBy || ''),
    uploadedByName: String(raw.uploadedByName || ''),
    uploadedAt: raw.uploadedAt || null,
    viewUrl: String(raw.viewUrl || ''),
    downloadUrl: String(raw.downloadUrl || ''),
  }
}

export function normalizeExpenseVoucher(raw = {}) {
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map(normalizeExpenseAttachment)
    : []

  return {
    id: String(raw.id || raw._id || ''),
    voucherNumber: String(raw.voucherNumber || ''),
    expenseDate: raw.expenseDate || null,
    categoryId: String(raw.categoryId || ''),
    categoryName: String(raw.categoryName || 'Uncategorized'),
    amount: roundExpenseAmount(raw.amount),
    description: String(raw.description || ''),
    projectRecordId: raw.projectRecordId ? String(raw.projectRecordId) : null,
    projectCode: raw.projectCode ? String(raw.projectCode) : null,
    projectName: raw.projectName ? String(raw.projectName) : null,
    attachments,
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    status: raw.status === 'cancelled' ? 'cancelled' : 'active',
    createdBy: String(raw.createdBy || ''),
    createdByName: String(raw.createdByName || ''),
    updatedBy: String(raw.updatedBy || ''),
    updatedByName: String(raw.updatedByName || ''),
    cancelledAt: raw.cancelledAt || null,
    cancelledBy: raw.cancelledBy || null,
    cancelReason: raw.cancelReason || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

export async function fetchExpenseCategories({ includeInactive = false } = {}) {
  try {
    const response = await api.get('/api/expenses/categories', {
      params: includeInactive ? { includeInactive: 'true' } : undefined,
    })
    const list = Array.isArray(response.data?.categories)
      ? response.data.categories
      : []
    return list.map(normalizeExpenseCategory)
  } catch (error) {
    throw extractExpenseApiError(error, 'Failed to load expense categories.')
  }
}

export async function createExpenseCategory(payload) {
  try {
    const response = await api.post('/api/expenses/categories', payload)
    return normalizeExpenseCategory(response.data?.category || response.data)
  } catch (error) {
    throw extractExpenseApiError(error, 'Failed to create expense category.')
  }
}

export async function updateExpenseCategory(categoryId, payload) {
  try {
    const response = await api.patch(
      `/api/expenses/categories/${encodeURIComponent(categoryId)}`,
      payload,
    )
    return normalizeExpenseCategory(response.data?.category || response.data)
  } catch (error) {
    throw extractExpenseApiError(error, 'Failed to update expense category.')
  }
}

export async function fetchExpenses({
  page = 1,
  limit = 10,
  search = '',
  categoryId = 'all',
  projectId = 'all',
  fromDate = '',
  toDate = '',
  status = 'active',
} = {}) {
  try {
    const params = { page, limit }
    if (search && search.trim()) params.search = search.trim()
    if (categoryId && categoryId !== 'all') params.categoryId = categoryId
    if (projectId && projectId !== 'all') params.projectId = projectId
    if (fromDate) params.fromDate = fromDate
    if (toDate) params.toDate = toDate
    if (status) params.status = status

    const response = await api.get('/api/expenses', { params })
    const data = response.data || {}
    const items = Array.isArray(data.expenses)
      ? data.expenses
      : Array.isArray(data.items)
        ? data.items
        : []

    const rawSummary = data.summary || {}
    return {
      expenses: items.map(normalizeExpenseVoucher),
      total: Number(data.total ?? items.length),
      page: Number(data.page ?? page),
      limit: Number(data.limit ?? limit),
      totalPages: Math.max(1, Number(data.totalPages ?? 1)),
      summary: {
        activeCount: Number(rawSummary.activeCount ?? 0),
        cancelledCount: Number(rawSummary.cancelledCount ?? 0),
        activeTotalAmount: roundExpenseAmount(rawSummary.activeTotalAmount),
        projectLinkedCount: Number(rawSummary.projectLinkedCount ?? 0),
        projectLinkedTotalAmount: roundExpenseAmount(
          rawSummary.projectLinkedTotalAmount,
        ),
        generalExpenseCount: Number(rawSummary.generalExpenseCount ?? 0),
        generalTotalAmount: roundExpenseAmount(rawSummary.generalTotalAmount),
        withReceiptCount: Number(rawSummary.withReceiptCount ?? 0),
      },
    }
  } catch (error) {
    throw extractExpenseApiError(error, 'Failed to load expenses.')
  }
}

export async function fetchExpenseById(identifier) {
  try {
    const response = await api.get(
      `/api/expenses/${encodeURIComponent(identifier)}`,
    )
    return normalizeExpenseVoucher(response.data?.voucher || response.data)
  } catch (error) {
    throw extractExpenseApiError(error, 'Failed to load expense details.')
  }
}

export async function createExpense(payload, receiptFiles = []) {
  try {
    const hasFiles = Array.isArray(receiptFiles) && receiptFiles.length > 0
    if (hasFiles) {
      const formData = new FormData()
      formData.append('payload', JSON.stringify(payload))
      receiptFiles.forEach((file) => {
        formData.append('receipt', file)
      })
      const response = await api.post('/api/expenses', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      return normalizeExpenseVoucher(response.data?.voucher || response.data)
    }

    const response = await api.post('/api/expenses', payload)
    return normalizeExpenseVoucher(response.data?.voucher || response.data)
  } catch (error) {
    throw extractExpenseApiError(error, 'Failed to record expense.')
  }
}

export async function updateExpense(identifier, payload, receiptFiles = []) {
  try {
    const hasFiles = Array.isArray(receiptFiles) && receiptFiles.length > 0
    const url = `/api/expenses/${encodeURIComponent(identifier)}`

    if (hasFiles) {
      const formData = new FormData()
      formData.append('payload', JSON.stringify(payload))
      receiptFiles.forEach((file) => {
        formData.append('receipt', file)
      })
      const response = await api.patch(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      })
      return normalizeExpenseVoucher(response.data?.voucher || response.data)
    }

    const response = await api.patch(url, payload)
    return normalizeExpenseVoucher(response.data?.voucher || response.data)
  } catch (error) {
    throw extractExpenseApiError(error, 'Failed to update expense.')
  }
}

export async function cancelExpense(identifier, reason = '') {
  try {
    const response = await api.post(
      `/api/expenses/${encodeURIComponent(identifier)}/cancel`,
      { reason },
    )
    return normalizeExpenseVoucher(response.data?.voucher || response.data)
  } catch (error) {
    throw extractExpenseApiError(error, 'Failed to cancel expense.')
  }
}

export async function fetchAuthorizedReceiptBlobUrl(viewUrl) {
  try {
    const response = await api.get(viewUrl, {
      responseType: 'blob',
      timeout: 25000,
    })
    const mime =
      response.headers?.['content-type'] ||
      response.data?.type ||
      'application/octet-stream'
    const blob = new Blob([response.data], { type: mime })
    return {
      blobUrl: URL.createObjectURL(blob),
      mimeType: mime,
    }
  } catch (error) {
    throw extractExpenseApiError(error, 'Unable to load receipt preview.')
  }
}

export async function downloadAuthorizedReceipt(downloadUrl, fileName) {
  try {
    const response = await api.get(downloadUrl, {
      responseType: 'blob',
      timeout: 25000,
    })
    const blobUrl = URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = fileName || 'expense-receipt'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
  } catch (error) {
    throw extractExpenseApiError(error, 'Unable to download receipt.')
  }
}
