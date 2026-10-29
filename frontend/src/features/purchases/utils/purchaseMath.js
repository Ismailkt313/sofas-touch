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

export function calculateVoucherPreviewTotals(
  lineItems = [],
  adjustments = {},
) {
  const subtotal = lineItems.reduce((sum, item) => {
    const lineTotal = calculateLineTotalPreview(item.quantity, item.unitPrice)
    return roundMoney(sum + lineTotal)
  }, 0)

  const discount = Math.max(0, roundMoney(adjustments.discountAmount || 0))
  const tax = Math.max(0, roundMoney(adjustments.taxAmount || 0))
  const otherCharges = Math.max(0, roundMoney(adjustments.otherCharges || 0))
  const finalTotal = roundMoney(subtotal - discount + tax + otherCharges)

  return {
    subtotal,
    discountAmount: discount,
    taxAmount: tax,
    otherCharges,
    finalTotal,
    discountExceedsSubtotal: discount > subtotal && subtotal >= 0,
  }
}
