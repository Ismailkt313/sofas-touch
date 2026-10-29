export const GST_PERCENTAGE_PRESETS = Object.freeze([0, 5, 12, 18, 28])

export function roundPurchaseMoney(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  return Math.round((num + Number.EPSILON) * 100) / 100
}

export const roundMoney = roundPurchaseMoney

export function roundPurchaseQty(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  return Math.round((num + Number.EPSILON) * 1000) / 1000
}

export const roundQuantity = roundPurchaseQty

export function formatInrCurrency(amount) {
  const safe = roundPurchaseMoney(amount)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)
}

export function calculateLineTotalPreview(quantity, unitPrice) {
  const qty = Math.max(0, Number(quantity) || 0)
  const price = Math.max(0, Number(unitPrice) || 0)
  return roundPurchaseMoney(qty * price)
}

export function roundPurchasePercent(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  return Math.round((num + Number.EPSILON) * 10000) / 10000
}

export function resolveEffectiveLineItemType(row = {}) {
  if (row.itemType === 'expense') {
    return 'expense'
  }
  if (row.itemType === 'material') {
    return 'material'
  }
  if (row.itemType === '') {
    return ''
  }
  if (row.expenseHeadId && !row.materialId) {
    return 'expense'
  }
  return 'material'
}

export function computeRowLineTotal(row = {}) {
  const effectiveType = resolveEffectiveLineItemType(row)

  if (effectiveType === 'expense') {
    const usesQtyRate =
      row.expensePricingMode === 'qty_rate' ||
      ((row.amount === undefined ||
        row.amount === null ||
        String(row.amount).trim() === '') &&
        String(row.quantity ?? '').trim() !== '' &&
        String(row.unitPrice ?? '').trim() !== '')

    if (usesQtyRate) {
      const qty = Math.max(0, Number(row.quantity) || 0)
      const price = Math.max(0, Number(row.unitPrice) || 0)
      return roundPurchaseMoney(qty * price)
    }

    const amt = Math.max(0, Number(row.amount) || 0)
    return roundPurchaseMoney(amt)
  }

  const hasAmountOnly =
    (row.quantity === undefined ||
      row.quantity === null ||
      String(row.quantity).trim() === '') &&
    row.amount !== undefined &&
    row.amount !== null &&
    String(row.amount).trim() !== ''
  if (hasAmountOnly) {
    return roundPurchaseMoney(Math.max(0, Number(row.amount) || 0))
  }

  const qty = Math.max(0, Number(row.quantity) || 0)
  const price = Math.max(0, Number(row.unitPrice) || 0)
  return roundPurchaseMoney(qty * price)
}

export function calculateVoucherPreviewTotals(
  lineItems = [],
  {
    discountAmount = 0,
    taxMode = 'bill_amount',
    taxRatePercent = '',
    taxAmount = 0,
    otherCharges = 0,
  } = {},
) {
  const computedLines = lineItems.map((row) => {
    const itemType = resolveEffectiveLineItemType(row)
    const lineTotal = computeRowLineTotal(row)
    const isConfirmedType = itemType === 'material' || itemType === 'expense'
    const parsedTaxRate =
      row.taxRate !== null &&
      row.taxRate !== undefined &&
      String(row.taxRate).trim() !== '' &&
      Number.isFinite(Number(row.taxRate))
        ? roundPurchasePercent(Math.max(0, Number(row.taxRate)))
        : null

    return {
      itemType,
      isConfirmedType,
      lineTotal,
      taxRate: parsedTaxRate,
    }
  })

  let materialSubtotal = 0
  let expenseSubtotal = 0
  let unclassifiedSubtotal = 0
  let unclassifiedCount = 0

  for (const entry of computedLines) {
    if (entry.itemType === 'material') {
      materialSubtotal = roundPurchaseMoney(materialSubtotal + entry.lineTotal)
    } else if (entry.itemType === 'expense') {
      expenseSubtotal = roundPurchaseMoney(expenseSubtotal + entry.lineTotal)
    } else {
      unclassifiedCount += 1
      unclassifiedSubtotal = roundPurchaseMoney(
        unclassifiedSubtotal + entry.lineTotal,
      )
    }
  }

  const subtotal = roundPurchaseMoney(
    materialSubtotal + expenseSubtotal + unclassifiedSubtotal,
  )
  const discount = Math.max(0, roundPurchaseMoney(Number(discountAmount) || 0))
  const charges = Math.max(0, roundPurchaseMoney(Number(otherCharges) || 0))
  const taxableSubtotal = roundPurchaseMoney(Math.max(0, subtotal - discount))

  const resolvedTaxMode =
    taxMode === 'percentage' ? 'percentage' : 'bill_amount'
  const billTax = Math.max(0, roundPurchaseMoney(Number(taxAmount) || 0))

  const hasValidPercent =
    taxRatePercent !== null &&
    taxRatePercent !== undefined &&
    String(taxRatePercent).trim() !== '' &&
    Number.isFinite(Number(taxRatePercent))
  const parsedPercent = hasValidPercent
    ? roundPurchasePercent(Math.max(0, Number(taxRatePercent)))
    : null

  const percentageTax =
    parsedPercent !== null
      ? roundPurchaseMoney((taxableSubtotal * parsedPercent) / 100)
      : 0

  const effectiveTax =
    resolvedTaxMode === 'percentage' ? percentageTax : billTax

  const finalTotal = Math.max(
    0,
    roundPurchaseMoney(taxableSubtotal + effectiveTax + charges),
  )

  const classifiedSubtotal = roundPurchaseMoney(
    materialSubtotal + expenseSubtotal,
  )
  let materialAllocatedTotal = 0
  let expenseAllocatedTotal = 0

  if (unclassifiedCount === 0) {
    if (expenseSubtotal <= 0) {
      materialAllocatedTotal = finalTotal
      expenseAllocatedTotal = 0
    } else if (materialSubtotal <= 0) {
      materialAllocatedTotal = 0
      expenseAllocatedTotal = finalTotal
    } else if (classifiedSubtotal > 0) {
      const materialShare = materialSubtotal / classifiedSubtotal
      const discountMat = discount * materialShare
      const chargesMat = charges * materialShare

      const confirmedLines = computedLines.filter((l) => l.isConfirmedType)
      const allCarryTaxRate =
        confirmedLines.length > 0 &&
        confirmedLines.every(
          (l) => typeof l.taxRate === 'number' && l.taxRate >= 0,
        )

      let taxMat = effectiveTax * materialShare
      if (allCarryTaxRate && effectiveTax > 0) {
        const postDiscountFactor =
          classifiedSubtotal > 0
            ? Math.max(0, classifiedSubtotal - discount) / classifiedSubtotal
            : 0
        let theoMat = 0
        let theoExp = 0
        for (const l of confirmedLines) {
          const lt = l.lineTotal * postDiscountFactor * ((l.taxRate || 0) / 100)
          if (l.itemType === 'expense') {
            theoExp += lt
          } else {
            theoMat += lt
          }
        }
        if (theoMat + theoExp > 0) {
          taxMat = effectiveTax * (theoMat / (theoMat + theoExp))
        }
      }

      const rawMatAlloc = roundPurchaseMoney(
        materialSubtotal - discountMat + taxMat + chargesMat,
      )
      materialAllocatedTotal = Math.min(finalTotal, Math.max(0, rawMatAlloc))
      expenseAllocatedTotal = roundPurchaseMoney(
        finalTotal - materialAllocatedTotal,
      )
    }
  }

  return {
    computedLines,
    lineTotals: computedLines.map((l) => l.lineTotal),
    materialSubtotal,
    expenseSubtotal,
    unclassifiedSubtotal,
    unclassifiedCount,
    subtotal,
    discount,
    discountAmount: discount,
    taxableSubtotal,
    taxMode: resolvedTaxMode,
    taxRatePercent: parsedPercent,
    billTax,
    percentageTax,
    tax: effectiveTax,
    taxAmount: effectiveTax,
    charges,
    otherCharges: charges,
    finalTotal,
    materialAllocatedTotal,
    expenseAllocatedTotal,
    discountExceedsSubtotal: discount > subtotal,
  }
}
