import api from '../../../services/api'
import { clearStoredSession, getStoredSession } from '../../auth'

export const RAW_MATERIAL_CATEGORIES = [
  'Sofa',
  'Curtain',
  'Upholstery',
  'Timber',
  'Foam',
  'Hardware',
  'General',
]

export const RAW_MATERIAL_UNITS = [
  'Piece',
  'Meter',
  'Kilogram',
  'Sheet',
  'Roll',
  'Set',
  'Box',
  'Litre',
  'Square Feet',
  'Running Feet',
  'Pair',
  'Yard',
]

export const MAX_MATERIAL_NAME_LENGTH = 150
export const MAX_MATERIAL_DESCRIPTION_LENGTH = 1000

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

export function normalizeWhitespace(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function formatMaterialDate(dateInput) {
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

export function formatMaterialDateTime(dateInput) {
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

export function normalizeRawMaterial(raw = {}) {
  return {
    id: String(raw.id || raw._id || '').trim(),
    name: normalizeWhitespace(raw.name) || 'Untitled Material',
    category:
      typeof raw.category === 'string' && raw.category.trim()
        ? raw.category.trim()
        : null,
    unit: typeof raw.unit === 'string' ? raw.unit.trim() : '',
    description:
      typeof raw.description === 'string' ? raw.description.trim() : '',
    isActive: raw.isActive !== undefined ? Boolean(raw.isActive) : true,
    createdBy:
      typeof raw.createdBy === 'string' ? raw.createdBy.trim() : '',
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || raw.createdAt || null,
  }
}

export function extractRawMaterialApiError(
  error,
  fallbackMessage = 'Unable to complete the request. Please try again.',
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
    const firstFieldMsg = Object.values(fieldErrors).find(
      (val) => typeof val === 'string' && val.trim(),
    )
    if (firstFieldMsg) {
      message = firstFieldMsg.trim()
    }
  } else if (error?.code === 'ECONNABORTED') {
    message = 'The server took too long to respond. Please try again.'
  } else if (!error?.response && error?.message) {
    message = 'Unable to reach the server. Check your connection and try again.'
  }

  const normalizedError = new Error(message || fallbackMessage)
  normalizedError.status = status
  normalizedError.fieldErrors = fieldErrors
  return normalizedError
}

export function buildUnitOptions(currentUnit = '') {
  const baseOptions = RAW_MATERIAL_UNITS.map((unit) => ({
    value: unit,
    label: unit,
  }))
  const trimmedCurrent = typeof currentUnit === 'string' ? currentUnit.trim() : ''
  if (
    trimmedCurrent &&
    !RAW_MATERIAL_UNITS.some(
      (unit) => unit.toLowerCase() === trimmedCurrent.toLowerCase(),
    )
  ) {
    return [{ value: trimmedCurrent, label: trimmedCurrent }, ...baseOptions]
  }
  return baseOptions
}

export function buildCreateMaterialPayload(formValues) {
  const payload = {
    name: normalizeWhitespace(formValues.name),
    unit: String(formValues.unit || '').trim(),
  }

  const cleanCategory =
    typeof formValues.category === 'string' ? formValues.category.trim() : ''
  if (cleanCategory) {
    payload.category = cleanCategory
  }

  const cleanDescription =
    typeof formValues.description === 'string'
      ? formValues.description.trim()
      : ''
  if (cleanDescription) {
    payload.description = cleanDescription
  }

  return payload
}

export function buildChangedMaterialPayload(originalMaterial, formValues) {
  const updates = {}

  const nextName = normalizeWhitespace(formValues.name)
  const prevName = normalizeWhitespace(originalMaterial?.name)
  if (nextName !== prevName) {
    updates.name = nextName
  }

  const nextUnit = String(formValues.unit || '').trim()
  const prevUnit = String(originalMaterial?.unit || '').trim()
  if (nextUnit !== prevUnit) {
    updates.unit = nextUnit
  }

  const rawCategory =
    typeof formValues.category === 'string' ? formValues.category.trim() : ''
  const nextCategory = rawCategory || null
  const prevCategory = originalMaterial?.category || null
  if (nextCategory !== prevCategory) {
    updates.category = nextCategory
  }

  const nextDescription =
    typeof formValues.description === 'string'
      ? formValues.description.trim()
      : ''
  const prevDescription =
    typeof originalMaterial?.description === 'string'
      ? originalMaterial.description.trim()
      : ''
  if (nextDescription !== prevDescription) {
    updates.description = nextDescription
  }

  return updates
}

export async function fetchRawMaterials({
  page = 1,
  limit = 10,
  search = '',
  category = 'all',
  status = 'all',
  isAdmin = false,
} = {}) {
  try {
    const params = {
      page,
      limit,
    }

    const cleanSearch = normalizeWhitespace(search)
    if (cleanSearch) {
      params.search = cleanSearch
    }

    if (category && category !== 'all') {
      params.category = category
    }

    if (isAdmin) {
      if (status === 'active' || status === 'inactive' || status === 'all') {
        params.status = status
      }
    } else if (status === 'active') {
      params.status = 'active'
    }

    const response = await api.get('/api/raw-materials', { params })
    const data = response.data || {}
    const rawList = Array.isArray(data.rawMaterials)
      ? data.rawMaterials
      : Array.isArray(data.items)
        ? data.items
        : []

    const total = Number.isFinite(Number(data.total))
      ? Number(data.total)
      : rawList.length
    const resolvedLimit = Number.isFinite(Number(data.limit))
      ? Number(data.limit)
      : limit
    const resolvedPage = Number.isFinite(Number(data.page))
      ? Number(data.page)
      : page
    const totalPages = Number.isFinite(Number(data.totalPages))
      ? Math.max(1, Number(data.totalPages))
      : Math.max(1, Math.ceil(total / Math.max(1, resolvedLimit)))

    return {
      materials: rawList.map(normalizeRawMaterial),
      total,
      page: resolvedPage,
      limit: resolvedLimit,
      totalPages,
    }
  } catch (error) {
    throw extractRawMaterialApiError(
      error,
      'Unable to load raw materials from the server.',
    )
  }
}

export async function fetchRawMaterialById(id) {
  const cleanId = String(id || '').trim()
  try {
    const response = await api.get(
      `/api/raw-materials/${encodeURIComponent(cleanId)}`,
    )
    const rawMaterial = response.data?.rawMaterial || response.data
    return normalizeRawMaterial(rawMaterial)
  } catch (error) {
    throw extractRawMaterialApiError(
      error,
      'Unable to load raw material details.',
    )
  }
}

export async function createRawMaterial(payload) {
  try {
    const response = await api.post('/api/raw-materials', payload)
    const rawMaterial = response.data?.rawMaterial || response.data
    return {
      material: normalizeRawMaterial(rawMaterial),
      message:
        response.data?.message || 'Raw material created successfully.',
    }
  } catch (error) {
    throw extractRawMaterialApiError(
      error,
      'Unable to create raw material.',
    )
  }
}

export async function updateRawMaterial(id, payload) {
  const cleanId = String(id || '').trim()
  try {
    const response = await api.patch(
      `/api/raw-materials/${encodeURIComponent(cleanId)}`,
      payload,
    )
    const rawMaterial = response.data?.rawMaterial || response.data
    return {
      material: normalizeRawMaterial(rawMaterial),
      message:
        response.data?.message || 'Raw material updated successfully.',
    }
  } catch (error) {
    throw extractRawMaterialApiError(
      error,
      'Unable to update raw material.',
    )
  }
}

export async function updateRawMaterialStatus(id, isActive) {
  const cleanId = String(id || '').trim()
  try {
    const response = await api.patch(
      `/api/raw-materials/${encodeURIComponent(cleanId)}/status`,
      { isActive: Boolean(isActive) },
    )
    const rawMaterial = response.data?.rawMaterial || response.data
    return {
      material: normalizeRawMaterial(rawMaterial),
      message:
        response.data?.message ||
        (isActive
          ? 'Raw material activated successfully.'
          : 'Raw material deactivated successfully.'),
    }
  } catch (error) {
    throw extractRawMaterialApiError(
      error,
      isActive
        ? 'Unable to activate raw material.'
        : 'Unable to deactivate raw material.',
    )
  }
}
