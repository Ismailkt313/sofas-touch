export const GST_PERCENTAGE_PRESETS = Object.freeze([0, 5, 12, 18, 28])

export function roundMoney(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function roundQuantity(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

export function roundTaxPercent(value) {
  if (value === null || value === undefined) {
    return null
  }
  const cleanStr = String(value).trim().replace(/%$/, '').trim()
  if (cleanStr === '') {
    return null
  }
  const num = Number(cleanStr)
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    return null
  }
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export function formatInrCurrency(amount) {
  const safe = roundMoney(amount)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)
}

export function calculateLineTotalPreview(quantity, unitPrice) {
  const qty = Number(quantity)
  const price = Number(unitPrice)
  if (
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return 0
  }
  return roundMoney(roundQuantity(qty) * roundMoney(price))
}

export function calculateTaxFromPercentage(
  subtotal,
  discountAmount = 0,
  taxRatePercent = '',
) {
  const rate = roundTaxPercent(taxRatePercent)
  if (rate === null) {
    return null
  }
  const safeSub = Math.max(0, roundMoney(subtotal || 0))
  const safeDiscount = Math.max(0, roundMoney(discountAmount || 0))
  const taxableSubtotal = Math.max(0, roundMoney(safeSub - safeDiscount))
  return roundMoney((taxableSubtotal * rate) / 100)
}

export function calculateVoucherPreviewTotals(
  lineItems = [],
  adjustments = {},
) {
  const subtotal = lineItems.reduce((sum, item) => {
    const lineTotal = calculateLineTotalPreview(item.quantity, item.unitPrice)
    return roundMoney(sum + lineTotal)
  }, 0)

  const discount = Math.max(0, roundMoney(adjustments.discountAmount || 0))
  const taxableSubtotal = Math.max(0, roundMoney(subtotal - discount))
  const tax = Math.max(0, roundMoney(adjustments.taxAmount || 0))
  const otherCharges = Math.max(0, roundMoney(adjustments.otherCharges || 0))
  const finalTotal = roundMoney(subtotal - discount + tax + otherCharges)

  return {
    subtotal,
    discountAmount: discount,
    taxableSubtotal,
    taxAmount: tax,
    otherCharges,
    finalTotal,
    discountExceedsSubtotal: discount > subtotal && subtotal >= 0,
  }
}

export function evaluateFinalTotalMismatchModal({
  hasAttachedBill = false,
  printedBillTotal,
  printedFinalTotal,
  calculatedVoucherTotal,
  voucherFinalTotal,
  tolerance,
  threshold,
} = {}) {
  const resolvedPrinted =
    printedBillTotal !== undefined ? printedBillTotal : printedFinalTotal
  const resolvedCalculated =
    calculatedVoucherTotal !== undefined
      ? calculatedVoucherTotal
      : voucherFinalTotal
  const resolvedTolerance =
    tolerance !== undefined
      ? tolerance
      : threshold !== undefined
        ? threshold
        : 1.0

  const safeCalculated = roundMoney(resolvedCalculated || 0)

  if (!hasAttachedBill) {
    return {
      shouldConfirm: false,
      printedBillTotal: null,
      calculatedVoucherTotal: safeCalculated,
      difference: 0,
      printedFinalTotal: null,
      voucherFinalTotal: safeCalculated,
      absoluteDifference: 0,
    }
  }

  if (
    resolvedPrinted === null ||
    resolvedPrinted === undefined ||
    String(resolvedPrinted).trim() === ''
  ) {
    return {
      shouldConfirm: false,
      printedBillTotal: null,
      calculatedVoucherTotal: safeCalculated,
      difference: 0,
      printedFinalTotal: null,
      voucherFinalTotal: safeCalculated,
      absoluteDifference: 0,
    }
  }

  const parsedPrinted = Number(resolvedPrinted)
  if (!Number.isFinite(parsedPrinted) || parsedPrinted <= 0) {
    return {
      shouldConfirm: false,
      printedBillTotal: null,
      calculatedVoucherTotal: safeCalculated,
      difference: 0,
      printedFinalTotal: null,
      voucherFinalTotal: safeCalculated,
      absoluteDifference: 0,
    }
  }

  const safePrinted = roundMoney(parsedPrinted)
  const difference = roundMoney(Math.abs(safePrinted - safeCalculated))

  return {
    shouldConfirm: difference > resolvedTolerance,
    printedBillTotal: safePrinted,
    calculatedVoucherTotal: safeCalculated,
    difference,
    printedFinalTotal: safePrinted,
    voucherFinalTotal: safeCalculated,
    absoluteDifference: difference,
  }
}
