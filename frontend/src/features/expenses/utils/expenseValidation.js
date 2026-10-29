export const DEFAULT_EXPENSE_CATEGORY_NAMES = Object.freeze([
  'Transportation',
  'Labour',
  'Installation',
  'Repairs',
  'Miscellaneous',
])

export const SUPPORTED_RECEIPT_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

export const MAX_RECEIPT_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_EXPENSE_AMOUNT = 100_000_000

const inrCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateDisplayFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function normalizeExpenseWhitespace(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeCategoryLookupKey(value) {
  return normalizeExpenseWhitespace(value).toLowerCase()
}

export function findDuplicateExpenseCategory(categories = [], candidateName, excludeId = null) {
  const key = normalizeCategoryLookupKey(candidateName)
  if (!key || !Array.isArray(categories)) {
    return null
  }
  return (
    categories.find((cat) => {
      if (!cat) return false
      if (excludeId && String(cat.id) === String(excludeId)) {
        return false
      }
      return normalizeCategoryLookupKey(cat.name) === key
    }) || null
  )
}

export function roundExpenseAmount(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatExpenseCurrency(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return inrCurrencyFormatter.format(0)
  }
  return inrCurrencyFormatter.format(num)
}

export function formatExpenseDate(value) {
  if (!value) {
    return '—'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '—'
  }
  return dateDisplayFormatter.format(parsed)
}

export function toExpenseDateInputValue(value) {
  if (!value) {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  const y = parsed.getUTCFullYear()
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const d = String(parsed.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatReceiptByteSize(bytes) {
  const num = Number(bytes || 0)
  if (!Number.isFinite(num) || num <= 0) {
    return '0 B'
  }
  if (num < 1024) {
    return `${num} B`
  }
  if (num < 1024 * 1024) {
    return `${(num / 1024).toFixed(1)} KB`
  }
  return `${(num / (1024 * 1024)).toFixed(2)} MB`
}

export function isPdfReceiptMime(mimeType, fileName = '') {
  const cleanMime = String(mimeType || '').toLowerCase()
  if (cleanMime === 'application/pdf') {
    return true
  }
  return /\.pdf$/i.test(String(fileName || ''))
}

export function validateReceiptFile(file) {
  if (!file) {
    return ''
  }

  const rawType = String(file.type || '').toLowerCase()
  const normalizedType = rawType === 'image/jpg' ? 'image/jpeg' : rawType
  const extMatch = /\.(jpe?g|png|webp|pdf)$/i.test(String(file.name || ''))

  if (!SUPPORTED_RECEIPT_MIME_TYPES.includes(normalizedType) && !extMatch) {
    return 'Unsupported file type. Upload a JPG, PNG, WEBP image, or PDF receipt.'
  }

  if (Number(file.size || 0) <= 0) {
    return 'Selected receipt file is empty.'
  }

  if (Number(file.size || 0) > MAX_RECEIPT_FILE_SIZE_BYTES) {
    return 'Receipt file exceeds the 10 MB size limit.'
  }

  return ''
}

export function validateExpenseFormValues(values = {}, options = {}) {
  const { categories = [], isCreatingCategory = false, canCreateCategory = false } = options
  const errors = {}

  const dateText = String(values.expenseDate || '').trim()
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    errors.expenseDate = 'Please select a valid expense date.'
  }

  if (isCreatingCategory) {
    if (!canCreateCategory) {
      errors.newCategoryName = 'Only Administrators can create new categories.'
    } else {
      const cleanNewName = normalizeExpenseWhitespace(values.newCategoryName)
      if (!cleanNewName) {
        errors.newCategoryName = 'Enter a category name.'
      } else if (cleanNewName.length < 2) {
        errors.newCategoryName = 'Category name must be at least 2 characters.'
      } else if (cleanNewName.length > 80) {
        errors.newCategoryName = 'Category name cannot exceed 80 characters.'
      } else {
        const duplicate = findDuplicateExpenseCategory(categories, cleanNewName)
        if (duplicate) {
          errors.newCategoryName = `Category '${duplicate.name}' already exists.`
        }
      }
    }
  } else {
    const cleanCatId = String(values.categoryId || '').trim()
    if (!cleanCatId) {
      errors.categoryId = 'Please select an expense category.'
    }
  }

  const rawAmt = String(values.amount ?? '').trim()
  if (!rawAmt) {
    errors.amount = 'Expense amount is required.'
  } else {
    const parsedAmt = Number(rawAmt)
    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      errors.amount = 'Amount must be greater than ₹0.00.'
    } else if (parsedAmt > MAX_EXPENSE_AMOUNT) {
      errors.amount = 'Amount exceeds the maximum allowed limit.'
    } else if (roundExpenseAmount(parsedAmt) <= 0) {
      errors.amount = 'Amount must be at least ₹0.01.'
    }
  }

  const cleanDesc = normalizeExpenseWhitespace(values.description)
  if (!cleanDesc) {
    errors.description = 'Description is required.'
  } else if (cleanDesc.length < 2) {
    errors.description = 'Description must be at least 2 characters.'
  } else if (cleanDesc.length > 500) {
    errors.description = 'Description cannot exceed 500 characters.'
  }

  return errors
}

export function validateCategoryFormValues(values = {}, categories = [], excludeId = null) {
  const errors = {}
  const cleanName = normalizeExpenseWhitespace(values.name)

  if (!cleanName) {
    errors.name = 'Category name is required.'
  } else if (cleanName.length < 2) {
    errors.name = 'Category name must be at least 2 characters.'
  } else if (cleanName.length > 80) {
    errors.name = 'Category name cannot exceed 80 characters.'
  } else {
    const duplicate = findDuplicateExpenseCategory(categories, cleanName, excludeId)
    if (duplicate) {
      errors.name = `Category '${duplicate.name}' already exists.`
    }
  }

  const cleanDesc = normalizeExpenseWhitespace(values.description || '')
  if (cleanDesc.length > 240) {
    errors.description = 'Description cannot exceed 240 characters.'
  }

  return errors
}
