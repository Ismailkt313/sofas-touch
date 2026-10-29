import api from '../../../services/api'
import { clearStoredSession, getStoredSession } from '../../auth'
import { formatMaterialUnit } from '../../raw-materials'
import {
  calculateLineTotalPreview,
  calculateVoucherPreviewTotals,
  formatInrCurrency,
  roundMoney,
  roundQuantity,
} from '../utils/purchaseMath'

export {
  calculateLineTotalPreview,
  calculateVoucherPreviewTotals,
  formatInrCurrency,
  roundMoney,
  roundQuantity,
}

export const SUPPORTED_BILL_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export const MAX_BILL_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_BILL_ATTACHMENTS = 5

export function hasActiveAuthToken() {
  const session = getStoredSession()
  return Boolean(session?.token || session?.accessToken)
}

export function isAdminUser(user) {
  if (!user || !user.role) {
    return false
  }
  return String(user.role).trim().toLowerCase().replace(/\s+/g, '_') === 'admin'
}

export function formatPurchaseQuantity(quantity, unit) {
  const num = Number(quantity)
  if (!Number.isFinite(num)) {
    return '—'
  }
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 3,
  }).format(num)
  const shortUnit = formatMaterialUnit(unit)
  return shortUnit ? `${formatted} ${shortUnit}` : formatted
}

export function formatPurchaseDate(dateInput) {
  if (!dateInput) {
    return '—'
  }
  const parsed = new Date(dateInput)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

export function formatPurchaseDateTime(dateInput) {
  if (!dateInput) {
    return '—'
  }
  const parsed = new Date(dateInput)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

export function toInputDateString(dateInput) {
  if (!dateInput) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim()
  }
  const parsed = new Date(dateInput)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }
  const y = parsed.getUTCFullYear()
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const d = String(parsed.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatFileSize(bytes) {
  const num = Number(bytes)
  if (!Number.isFinite(num) || num <= 0) {
    return '0 KB'
  }
  if (num < 1024) {
    return `${num} B`
  }
  if (num < 1024 * 1024) {
    return `${(num / 1024).toFixed(1)} KB`
  }
  return `${(num / (1024 * 1024)).toFixed(2)} MB`
}

export function validateLocalBillFile(file) {
  if (!file) {
    return 'Please choose a bill image or PDF document.'
  }
  const normalizedType =
    String(file.type || '').toLowerCase() === 'image/jpg'
      ? 'image/jpeg'
      : String(file.type || '').toLowerCase()

  const extMatch = /\.(jpe?g|png|webp|pdf)$/i.exec(String(file.name || ''))
  if (!SUPPORTED_BILL_MIME_TYPES.includes(normalizedType) && !extMatch) {
    return 'Unsupported file type. Upload a JPG, PNG, WEBP image, or PDF document.'
  }

  if (Number(file.size || 0) <= 0) {
    return 'Selected file is empty.'
  }

  if (Number(file.size || 0) > MAX_BILL_FILE_SIZE_BYTES) {
    return 'File size exceeds the 10 MB limit.'
  }

  return ''
}

export function normalizePurchaseAttachment(raw = {}) {
  return {
    attachmentId: String(raw.attachmentId || ''),
    originalName: String(raw.originalName || 'supplier-bill'),
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

export function normalizeExpenseHead(raw = {}) {
  return {
    id: String(raw.id || raw._id || ''),
    name: String(raw.name || ''),
    category: raw.category ? String(raw.category) : 'General',
    description: String(raw.description || ''),
    isActive: raw.isActive !== false,
  }
}

export function normalizePurchaseVoucher(raw = {}) {
  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.map(normalizePurchaseAttachment)
    : []

  const lineItems = Array.isArray(raw.lineItems)
    ? raw.lineItems.map((item) => {
        const itemType = item.itemType === 'expense' ? 'expense' : 'material'
        return {
          itemType,
          materialId: String(item.materialId || ''),
          materialName:
            itemType === 'expense'
              ? ''
              : String(
                  item.materialName || item.description || 'Unknown Material',
                ),
          materialCategory: item.materialCategory || null,
          expenseHeadId: String(item.expenseHeadId || ''),
          expenseHeadName: String(item.expenseHeadName || ''),
          expenseHeadCategory: item.expenseHeadCategory || null,
          description: String(
            item.description ||
              (itemType === 'expense'
                ? item.expenseHeadName
                : item.materialName) ||
              '',
          ),
          unit: item.unit ? String(item.unit) : '',
          quantity:
            item.quantity !== null && item.quantity !== undefined
              ? roundQuantity(item.quantity)
              : null,
          unitPrice:
            item.unitPrice !== null && item.unitPrice !== undefined
              ? roundMoney(item.unitPrice)
              : null,
          lineTotal: roundMoney(item.lineTotal),
          taxRate:
            item.taxRate !== null && item.taxRate !== undefined
              ? Number(item.taxRate)
              : null,
          remarks: String(item.remarks || ''),
        }
      })
    : []

  const computedMatSubtotal = roundMoney(
    lineItems
      .filter((li) => li.itemType !== 'expense')
      .reduce((acc, li) => acc + li.lineTotal, 0),
  )
  const computedExpSubtotal = roundMoney(
    lineItems
      .filter((li) => li.itemType === 'expense')
      .reduce((acc, li) => acc + li.lineTotal, 0),
  )

  const subtotal = roundMoney(raw.subtotal)
  const discountAmount = roundMoney(raw.discountAmount)
  const finalTotal = roundMoney(raw.finalTotal)
  const materialSubtotal =
    typeof raw.materialSubtotal === 'number'
      ? roundMoney(raw.materialSubtotal)
      : computedMatSubtotal
  const expenseSubtotal =
    typeof raw.expenseSubtotal === 'number'
      ? roundMoney(raw.expenseSubtotal)
      : computedExpSubtotal
  const materialAllocatedTotal =
    typeof raw.materialAllocatedTotal === 'number'
      ? roundMoney(raw.materialAllocatedTotal)
      : expenseSubtotal <= 0
        ? finalTotal
        : 0
  const expenseAllocatedTotal =
    typeof raw.expenseAllocatedTotal === 'number'
      ? roundMoney(raw.expenseAllocatedTotal)
      : roundMoney(finalTotal - materialAllocatedTotal)

  return {
    id: String(raw.id || raw._id || ''),
    voucherNumber: String(raw.voucherNumber || ''),
    purchaseDate: raw.purchaseDate || null,
    supplierName: String(raw.supplierName || ''),
    supplierInvoiceNumber: String(raw.supplierInvoiceNumber || ''),
    projectRecordId: raw.projectRecordId ? String(raw.projectRecordId) : null,
    projectCode: raw.projectCode ? String(raw.projectCode) : null,
    projectName: raw.projectName ? String(raw.projectName) : null,
    entryMethod: raw.entryMethod === 'upload_bill' ? 'upload_bill' : 'manual',
    lineItems,
    materialSubtotal,
    expenseSubtotal,
    subtotal,
    discountAmount,
    taxableSubtotal:
      typeof raw.taxableSubtotal === 'number'
        ? roundMoney(raw.taxableSubtotal)
        : roundMoney(Math.max(0, subtotal - discountAmount)),
    taxMode: raw.taxMode === 'percentage' ? 'percentage' : 'bill_amount',
    taxRatePercent:
      raw.taxRatePercent !== null && raw.taxRatePercent !== undefined
        ? Number(raw.taxRatePercent)
        : null,
    cgstAmount:
      raw.cgstAmount !== null && raw.cgstAmount !== undefined
        ? roundMoney(raw.cgstAmount)
        : null,
    sgstAmount:
      raw.sgstAmount !== null && raw.sgstAmount !== undefined
        ? roundMoney(raw.sgstAmount)
        : null,
    igstAmount:
      raw.igstAmount !== null && raw.igstAmount !== undefined
        ? roundMoney(raw.igstAmount)
        : null,
    taxAmount: roundMoney(raw.taxAmount),
    otherCharges: roundMoney(raw.otherCharges),
    finalTotal,
    materialAllocatedTotal,
    expenseAllocatedTotal,
    printedInvoiceSummary: raw.printedInvoiceSummary || null,
    reconciliationWarnings: Array.isArray(raw.reconciliationWarnings)
      ? raw.reconciliationWarnings
      : [],
    notes: String(raw.notes || ''),
    attachments,
    hasAttachments: attachments.length > 0 || Boolean(raw.hasAttachments),
    attachmentCount: Number(raw.attachmentCount ?? attachments.length),
    status: raw.status === 'cancelled' ? 'cancelled' : 'active',
    revision: Number(raw.revision || 1),
    stockSynchronized: Boolean(raw.stockSynchronized),
    createdBy: String(raw.createdBy || ''),
    createdByName: String(raw.createdByName || ''),
    updatedBy: String(raw.updatedBy || ''),
    updatedByName: String(raw.updatedByName || ''),
    cancelledAt: raw.cancelledAt || null,
    cancelledBy: raw.cancelledBy || null,
    cancelReason: raw.cancelReason || '',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  }
}

export function normalizeStockMovement(raw = {}) {
  return {
    id: String(raw.id || raw._id || ''),
    voucherId: String(raw.voucherId || ''),
    voucherNumber: String(raw.voucherNumber || ''),
    revision: Number(raw.revision || 1),
    movementType: String(raw.movementType || 'purchase_created'),
    materialId: String(raw.materialId || ''),
    materialName: String(raw.materialName || ''),
    unit: String(raw.unit || ''),
    quantityDelta: roundQuantity(raw.quantityDelta),
    resultingQuantityOnHand: roundQuantity(raw.resultingQuantityOnHand),
    performedBy: String(raw.performedBy || ''),
    createdAt: raw.createdAt || null,
  }
}

export function extractPurchaseApiError(
  error,
  fallbackMessage = 'Unable to complete the purchase voucher request.',
) {
  const status = error?.response?.status || 0
  const data = error?.response?.data

  if (status === 401) {
    clearStoredSession()
  }

  const fieldErrors =
    data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)
      ? data.errors
      : null

  let message = ''
  if (typeof data?.message === 'string' && data.message.trim()) {
    message = data.message.trim()
  } else if (fieldErrors) {
    const firstMsg = Object.values(fieldErrors).find(
      (val) => typeof val === 'string' && val.trim(),
    )
    if (firstMsg) {
      message = firstMsg.trim()
    }
  } else if (error?.code === 'ECONNABORTED') {
    message = 'The server took too long to respond. Please try again.'
  } else if (!error?.response && error?.message) {
    message = 'Unable to reach the server. Check your connection and try again.'
  }

  const normalized = new Error(message || fallbackMessage)
  normalized.status = status
  normalized.fieldErrors = fieldErrors
  return normalized
}

export async function fetchExpenseHeads({
  search = '',
  includeInactive = false,
  limit = 100,
} = {}) {
  try {
    const params = { limit }
    if (search && search.trim()) {
      params.search = search.trim()
    }
    if (includeInactive) {
      params.includeInactive = 'true'
    }

    const response = await api.get('/api/expense-heads', { params })
    const data = response.data || {}
    const rawHeads = Array.isArray(data.expenseHeads)
      ? data.expenseHeads
      : Array.isArray(data.items)
        ? data.items
        : []

    return {
      expenseHeads: rawHeads.map(normalizeExpenseHead),
      total: Number(data.total ?? rawHeads.length) || 0,
    }
  } catch (error) {
    throw extractPurchaseApiError(
      error,
      'Unable to load expense heads from the server.',
    )
  }
}

export async function fetchPurchaseVouchers({
  page = 1,
  limit = 10,
  search = '',
  projectId = 'all',
  fromDate = '',
  toDate = '',
  status = 'active',
} = {}) {
  try {
    const params = { page, limit }
    if (search && search.trim()) {
      params.search = search.trim()
    }
    if (projectId && projectId !== 'all') {
      params.projectId = projectId
    }
    if (fromDate) {
      params.fromDate = fromDate
    }
    if (toDate) {
      params.toDate = toDate
    }
    if (status) {
      params.status = status
    }

    const response = await api.get('/api/purchases', { params })
    const data = response.data || {}
    const rawList = Array.isArray(data.vouchers)
      ? data.vouchers
      : Array.isArray(data.items)
        ? data.items
        : []

    return {
      vouchers: rawList.map(normalizePurchaseVoucher),
      total: Number(data.total ?? rawList.length) || 0,
      page: Number(data.page ?? page) || 1,
      limit: Number(data.limit ?? limit) || limit,
      totalPages: Math.max(1, Number(data.totalPages ?? 1) || 1),
      summary: {
        activeCount: Number(data.summary?.activeCount || 0),
        cancelledCount: Number(data.summary?.cancelledCount || 0),
        activeTotalAmount: roundMoney(data.summary?.activeTotalAmount || 0),
        withAttachmentCount: Number(data.summary?.withAttachmentCount || 0),
      },
      storageInfo: data.storageInfo || {
        provider: 'local_protected',
        persistentExternalConfigured: false,
      },
    }
  } catch (error) {
    throw extractPurchaseApiError(
      error,
      'Unable to load purchase vouchers from the server.',
    )
  }
}

export async function fetchPurchaseVoucherById(identifier) {
  const cleanId = String(identifier || '').trim()
  if (!cleanId) {
    throw new Error('A valid purchase voucher identifier is required.')
  }

  try {
    const response = await api.get(
      `/api/purchases/${encodeURIComponent(cleanId)}`,
    )
    const data = response.data || {}
    const rawVoucher = data.voucher || data
    const rawMovements = Array.isArray(data.stockMovements)
      ? data.stockMovements
      : []

    return {
      voucher: normalizePurchaseVoucher(rawVoucher),
      stockMovements: rawMovements.map(normalizeStockMovement),
    }
  } catch (error) {
    throw extractPurchaseApiError(
      error,
      'Unable to load purchase voucher details.',
    )
  }
}

function buildMultipartFormData(payload, files = []) {
  const formData = new FormData()

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }
    if (
      key === 'lineItems' ||
      key === 'removeAttachmentIds' ||
      key === 'printedInvoiceSummary'
    ) {
      formData.append(key, JSON.stringify(value))
      return
    }
    if (value === null) {
      formData.append(key, '')
      return
    }
    formData.append(key, String(value))
  })

  files.forEach((file) => {
    if (file) {
      formData.append('attachments', file, file.name || 'supplier-bill')
    }
  })

  return formData
}

export async function createPurchaseVoucher({
  payload,
  files = [],
  onUploadProgress,
}) {
  try {
    const hasFiles = Array.isArray(files) && files.length > 0
    if (hasFiles) {
      const formData = buildMultipartFormData(payload, files)
      const response = await api.post('/api/purchases', formData, {
        headers: {
          'Content-Type': undefined,
        },
        timeout: 60000,
        onUploadProgress: (evt) => {
          if (typeof onUploadProgress === 'function' && evt.total) {
            const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100))
            onUploadProgress(pct)
          }
        },
      })
      return {
        voucher: normalizePurchaseVoucher(response.data?.voucher || response.data),
        message:
          response.data?.message || 'Purchase voucher recorded successfully.',
        idempotentReplay: Boolean(response.data?.idempotentReplay),
      }
    }

    const response = await api.post('/api/purchases', payload, {
      timeout: 25000,
    })
    return {
      voucher: normalizePurchaseVoucher(response.data?.voucher || response.data),
      message:
        response.data?.message || 'Purchase voucher recorded successfully.',
      idempotentReplay: Boolean(response.data?.idempotentReplay),
    }
  } catch (error) {
    throw extractPurchaseApiError(error, 'Unable to save purchase voucher.')
  }
}

export async function updatePurchaseVoucher(
  identifier,
  { payload, files = [], onUploadProgress },
) {
  const cleanId = String(identifier || '').trim()
  try {
    const hasFiles = Array.isArray(files) && files.length > 0
    const url = `/api/purchases/${encodeURIComponent(cleanId)}`

    if (hasFiles) {
      const formData = buildMultipartFormData(payload, files)
      const response = await api.patch(url, formData, {
        headers: {
          'Content-Type': undefined,
        },
        timeout: 60000,
        onUploadProgress: (evt) => {
          if (typeof onUploadProgress === 'function' && evt.total) {
            const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100))
            onUploadProgress(pct)
          }
        },
      })
      return {
        voucher: normalizePurchaseVoucher(response.data?.voucher || response.data),
        message:
          response.data?.message || 'Purchase voucher updated successfully.',
      }
    }

    const response = await api.patch(url, payload, { timeout: 25000 })
    return {
      voucher: normalizePurchaseVoucher(response.data?.voucher || response.data),
      message:
        response.data?.message || 'Purchase voucher updated successfully.',
    }
  } catch (error) {
    throw extractPurchaseApiError(error, 'Unable to update purchase voucher.')
  }
}

export async function cancelPurchaseVoucher(identifier, reason = '') {
  const cleanId = String(identifier || '').trim()
  try {
    const response = await api.post(
      `/api/purchases/${encodeURIComponent(cleanId)}/cancel`,
      { reason: String(reason || '').trim() },
    )
    return {
      voucher: normalizePurchaseVoucher(response.data?.voucher || response.data),
      message:
        response.data?.message ||
        'Purchase voucher cancelled and stock impact reversed.',
    }
  } catch (error) {
    throw extractPurchaseApiError(error, 'Unable to cancel purchase voucher.')
  }
}

export async function fetchAuthorizedAttachmentBlobUrl(viewUrl) {
  if (!viewUrl) {
    throw new Error('Attachment URL is missing.')
  }
  try {
    const response = await api.get(viewUrl, {
      responseType: 'blob',
      timeout: 30000,
    })
    const blob = response.data
    return URL.createObjectURL(blob)
  } catch (error) {
    throw extractPurchaseApiError(
      error,
      'Unable to load authorized bill preview.',
    )
  }
}

export async function downloadAuthorizedAttachment(
  downloadUrl,
  fileName = 'supplier-bill',
) {
  if (!downloadUrl) {
    throw new Error('Attachment download URL is missing.')
  }
  try {
    const response = await api.get(downloadUrl, {
      responseType: 'blob',
      timeout: 30000,
    })
    const blobUrl = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl)
    }, 3000)
  } catch (error) {
    throw extractPurchaseApiError(error, 'Unable to download bill attachment.')
  }
}
