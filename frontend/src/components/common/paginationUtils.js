/**
 * Intelligent page number generator.
 * Always includes page 1 and safeTotalPages.
 * Displays ellipses when gaps exist, never rendering more than 7 page-related tokens.
 */
export function buildVisiblePages(currentPage, totalPages) {
  const safeTotal = Math.max(1, totalPages || 1)
  const current = Math.min(Math.max(1, currentPage || 1), safeTotal)

  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1)
  }

  // If close to beginning: 1 2 3 4 5 ... total
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', safeTotal]
  }

  // If close to end: 1 ... total-4 total-3 total-2 total-1 total
  if (current >= safeTotal - 3) {
    return [
      1,
      'ellipsis-start',
      safeTotal - 4,
      safeTotal - 3,
      safeTotal - 2,
      safeTotal - 1,
      safeTotal,
    ]
  }

  // Middle: 1 ... current-1 current current+1 ... total
  return [
    1,
    'ellipsis-start',
    current - 1,
    current,
    current + 1,
    'ellipsis-end',
    safeTotal,
  ]
}

/**
 * Calculates new page position preserving the first visible record when page size changes.
 *
 * Example:
 *   Current page = 13, limit = 5 (records 61-65).
 *   New limit = 10 -> new page = 7 (records 61-70).
 */
export function calculatePreservedPage(currentPage, currentLimit, nextLimit, totalItems = null) {
  const safePage = Math.max(1, parseInt(currentPage, 10) || 1)
  const safePrevLimit = Math.max(1, parseInt(currentLimit, 10) || 10)
  const safeNextLimit = Math.max(1, parseInt(nextLimit, 10) || 10)

  const firstItemIndex = (safePage - 1) * safePrevLimit
  let newPage = Math.floor(firstItemIndex / safeNextLimit) + 1

  if (totalItems !== null && Number.isFinite(totalItems) && totalItems > 0) {
    const maxPage = Math.ceil(totalItems / safeNextLimit)
    newPage = Math.min(newPage, maxPage)
  }

  return Math.max(1, newPage)
}

/**
 * Pluralizes item name for summary string.
 */
export function getPluralName(singular, plural) {
  if (plural) return plural
  if (!singular) return 'records'
  if (singular.endsWith('y') && !/[aeiou]y$/i.test(singular)) {
    return `${singular.slice(0, -1)}ies`
  }
  if (
    singular.endsWith('s') ||
    singular.endsWith('x') ||
    singular.endsWith('ch') ||
    singular.endsWith('sh')
  ) {
    return `${singular}es`
  }
  return `${singular}s`
}

