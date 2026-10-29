let internalLineCounter = 1
let internalSuggestionCounter = 1

export function nextVoucherLineKey() {
  internalLineCounter += 1
  return `pv-line-${internalLineCounter}`
}

export function nextSuggestedLineKey() {
  internalSuggestionCounter += 1
  return `pv-sug-line-${internalSuggestionCounter}`
}

export const HEADER_TRACKED_FIELDS = Object.freeze([
  'purchaseDate',
  'supplierName',
  'supplierInvoiceNumber',
  'projectId',
  'discountAmount',
  'taxAmount',
  'otherCharges',
  'notes',
])

export const LINE_TRACKED_FIELDS = Object.freeze([
  'materialId',
  'quantity',
  'unitPrice',
  'remarks',
  'extractedDescription',
  'detectedUnit',
])

const NUMERIC_COMPARE_FIELDS = new Set([
  'discountAmount',
  'taxAmount',
  'otherCharges',
  'quantity',
  'unitPrice',
])

const UNIT_CANONICAL_LOOKUP = {
  kg: 'kilogram',
  kgs: 'kilogram',
  kilo: 'kilogram',
  kilogram: 'kilogram',
  kilograms: 'kilogram',
  m: 'meter',
  mtr: 'meter',
  mtrs: 'meter',
  meter: 'meter',
  meters: 'meter',
  metre: 'meter',
  metres: 'meter',
  pc: 'piece',
  pcs: 'piece',
  nos: 'piece',
  no: 'piece',
  piece: 'piece',
  pieces: 'piece',
  sheet: 'sheet',
  sheets: 'sheet',
  sht: 'sheet',
  roll: 'roll',
  rolls: 'roll',
  l: 'litre',
  ltr: 'litre',
  litre: 'litre',
  litres: 'litre',
  liter: 'litre',
  liters: 'litre',
  sqft: 'square feet',
  sft: 'square feet',
  'sq ft': 'square feet',
  'square feet': 'square feet',
  rft: 'running feet',
  ft: 'running feet',
  feet: 'running feet',
  'running feet': 'running feet',
  yd: 'yard',
  yds: 'yard',
  yard: 'yard',
  yards: 'yard',
  set: 'set',
  sets: 'set',
  box: 'box',
  boxes: 'box',
  pair: 'pair',
  pairs: 'pair',
}

function normalizeUnitComparable(unitValue) {
  const clean = String(unitValue || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
  if (!clean) return ''
  return UNIT_CANONICAL_LOOKUP[clean] || clean
}

function normalizeDescriptionComparable(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function createFieldProvenance(
  source = 'initial',
  { touched = false, confirmed = false } = {},
) {
  return {
    source,
    touched: Boolean(touched),
    confirmed: Boolean(confirmed),
  }
}

export function createInitialHeaderFieldMeta() {
  const meta = {}
  for (const key of HEADER_TRACKED_FIELDS) {
    meta[key] = createFieldProvenance('initial')
  }
  return meta
}

export function createSavedHeaderFieldMeta(voucher = {}) {
  const hasStr = (v) => Boolean(String(v || '').trim())
  const hasPosNum = (v) => Number(v) > 0
  return {
    purchaseDate: createFieldProvenance('saved'),
    supplierName: hasStr(voucher.supplierName)
      ? createFieldProvenance('saved')
      : createFieldProvenance('initial'),
    supplierInvoiceNumber: hasStr(voucher.supplierInvoiceNumber)
      ? createFieldProvenance('saved')
      : createFieldProvenance('initial'),
    projectId: hasStr(voucher.projectRecordId)
      ? createFieldProvenance('saved')
      : createFieldProvenance('initial'),
    discountAmount: hasPosNum(voucher.discountAmount)
      ? createFieldProvenance('saved')
      : createFieldProvenance('initial'),
    taxAmount: hasPosNum(voucher.taxAmount)
      ? createFieldProvenance('saved')
      : createFieldProvenance('initial'),
    otherCharges: hasPosNum(voucher.otherCharges)
      ? createFieldProvenance('saved')
      : createFieldProvenance('initial'),
    notes: hasStr(voucher.notes)
      ? createFieldProvenance('saved')
      : createFieldProvenance('initial'),
  }
}

export function isFieldProtected(meta) {
  if (!meta) {
    return false
  }
  return Boolean(meta.touched || meta.confirmed || meta.source === 'saved')
}

export function areFieldValuesEquivalent(fieldKey, leftVal, rightVal) {
  const leftStr = String(leftVal ?? '').trim()
  const rightStr = String(rightVal ?? '').trim()

  if (leftStr === '' && rightStr === '') {
    return true
  }

  if (NUMERIC_COMPARE_FIELDS.has(fieldKey)) {
    if (leftStr === '' || rightStr === '') {
      return false
    }
    const leftNum = Number(leftStr)
    const rightNum = Number(rightStr)
    if (Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
      return Math.abs(leftNum - rightNum) <= 0.0005
    }
    return leftStr === rightStr
  }

  if (fieldKey === 'detectedUnit') {
    return normalizeUnitComparable(leftStr) === normalizeUnitComparable(rightStr)
  }

  if (fieldKey === 'supplierName' || fieldKey === 'extractedDescription') {
    return (
      leftStr.replace(/\s+/g, ' ').toLowerCase() ===
      rightStr.replace(/\s+/g, ' ').toLowerCase()
    )
  }

  return leftStr === rightStr
}

export function buildOcrRowFingerprint(ocrRow, occurrenceIndex = 0) {
  const descKey = normalizeDescriptionComparable(
    ocrRow?.extractedDescription || ocrRow?.rawRowText || '',
  )
  const unitKey = normalizeUnitComparable(ocrRow?.detectedUnit || '')
  const base = `${descKey}|${unitKey}`
  return occurrenceIndex > 0 ? `${base}#${occurrenceIndex}` : base
}

export function createEmptyLineItem() {
  const fieldMeta = {}
  for (const key of LINE_TRACKED_FIELDS) {
    fieldMeta[key] = createFieldProvenance('initial')
  }
  return {
    rowKey: nextVoucherLineKey(),
    ocrFingerprint: '',
    materialId: '',
    quantity: '',
    unitPrice: '',
    remarks: '',
    extractedDescription: '',
    detectedUnit: '',
    suggestions: [],
    needsReview: false,
    fieldMeta,
    rowSuggestions: {},
  }
}

export function createSavedLineItem(savedLine = {}) {
  const hasStr = (v) => Boolean(String(v || '').trim())
  return {
    rowKey: nextVoucherLineKey(),
    ocrFingerprint: '',
    materialId: savedLine.materialId || '',
    quantity:
      savedLine.quantity !== undefined && savedLine.quantity !== null
        ? String(savedLine.quantity)
        : '',
    unitPrice:
      savedLine.unitPrice !== undefined && savedLine.unitPrice !== null
        ? String(savedLine.unitPrice)
        : '',
    remarks: savedLine.remarks || '',
    extractedDescription: '',
    detectedUnit: '',
    suggestions: [],
    needsReview: false,
    fieldMeta: {
      materialId: hasStr(savedLine.materialId)
        ? createFieldProvenance('saved')
        : createFieldProvenance('initial'),
      quantity: hasStr(savedLine.quantity)
        ? createFieldProvenance('saved')
        : createFieldProvenance('initial'),
      unitPrice: hasStr(savedLine.unitPrice)
        ? createFieldProvenance('saved')
        : createFieldProvenance('initial'),
      remarks: hasStr(savedLine.remarks)
        ? createFieldProvenance('saved')
        : createFieldProvenance('initial'),
      extractedDescription: createFieldProvenance('initial'),
      detectedUnit: createFieldProvenance('initial'),
    },
    rowSuggestions: {},
  }
}

export function createOcrLineItem(ocrRow, fingerprint = '') {
  const hasMat = Boolean(ocrRow?.materialId)
  const hasQty = Boolean(String(ocrRow?.quantity ?? '').trim())
  const hasPrice = Boolean(String(ocrRow?.unitPrice ?? '').trim())
  const hasDesc = Boolean(String(ocrRow?.extractedDescription ?? '').trim())
  const hasUnit = Boolean(String(ocrRow?.detectedUnit ?? '').trim())

  return {
    rowKey: nextVoucherLineKey(),
    ocrFingerprint: fingerprint || buildOcrRowFingerprint(ocrRow, 0),
    materialId: ocrRow?.materialId || '',
    quantity: hasQty ? String(ocrRow.quantity) : '',
    unitPrice: hasPrice ? String(ocrRow.unitPrice) : '',
    remarks: '',
    extractedDescription: hasDesc ? String(ocrRow.extractedDescription) : '',
    detectedUnit: hasUnit ? String(ocrRow.detectedUnit) : '',
    suggestions: Array.isArray(ocrRow?.suggestions) ? ocrRow.suggestions : [],
    needsReview: true,
    fieldMeta: {
      materialId: hasMat
        ? createFieldProvenance('ocr')
        : createFieldProvenance('initial'),
      quantity: hasQty
        ? createFieldProvenance('ocr')
        : createFieldProvenance('initial'),
      unitPrice: hasPrice
        ? createFieldProvenance('ocr')
        : createFieldProvenance('initial'),
      remarks: createFieldProvenance('initial'),
      extractedDescription: hasDesc
        ? createFieldProvenance('ocr')
        : createFieldProvenance('initial'),
      detectedUnit: hasUnit
        ? createFieldProvenance('ocr')
        : createFieldProvenance('initial'),
    },
    rowSuggestions: {},
  }
}

export function isUntouchedBlankLineItem(row) {
  if (!row) {
    return true
  }
  const hasAnyValue = Boolean(
    String(row.materialId || '').trim() ||
      String(row.quantity || '').trim() ||
      String(row.unitPrice || '').trim() ||
      String(row.remarks || '').trim() ||
      String(row.extractedDescription || '').trim() ||
      String(row.detectedUnit || '').trim(),
  )
  if (hasAnyValue) {
    return false
  }
  const fm = row.fieldMeta || {}
  for (const key of LINE_TRACKED_FIELDS) {
    if (isFieldProtected(fm[key])) {
      return false
    }
  }
  return true
}

export function isLineItemListEffectivelyEmpty(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return true
  }
  return rows.length === 1 && isUntouchedBlankLineItem(rows[0])
}

export function applyManualLineItemEdit(row, fieldKey, nextValue) {
  const nextFieldMeta = {
    ...(row.fieldMeta || {}),
    [fieldKey]: createFieldProvenance('manual', {
      touched: true,
      confirmed: false,
    }),
  }

  const nextRowSuggestions = { ...(row.rowSuggestions || {}) }
  if (
    nextRowSuggestions[fieldKey] &&
    areFieldValuesEquivalent(
      fieldKey,
      nextValue,
      nextRowSuggestions[fieldKey].value,
    )
  ) {
    delete nextRowSuggestions[fieldKey]
  }

  const updated = {
    ...row,
    [fieldKey]: nextValue,
    fieldMeta: nextFieldMeta,
    rowSuggestions: nextRowSuggestions,
  }

  if (fieldKey === 'materialId') {
    updated.needsReview = false
  }

  return updated
}

export function confirmLineItemOcrValues(row) {
  const nextFieldMeta = { ...(row.fieldMeta || {}) }
  for (const key of LINE_TRACKED_FIELDS) {
    const val = String(row[key] ?? '').trim()
    const current = nextFieldMeta[key] || createFieldProvenance('initial')
    if (val !== '' && !current.touched) {
      nextFieldMeta[key] = {
        ...current,
        confirmed: true,
      }
    }
  }
  return {
    ...row,
    needsReview: Boolean(row.extractedDescription) && !row.materialId,
    fieldMeta: nextFieldMeta,
  }
}

export function acceptLineItemSuggestion(row, fieldKey) {
  const suggestion = row?.rowSuggestions?.[fieldKey]
  if (!suggestion) {
    return row
  }

  const nextRowSuggestions = { ...(row.rowSuggestions || {}) }
  delete nextRowSuggestions[fieldKey]

  return {
    ...row,
    [fieldKey]: suggestion.value,
    needsReview: fieldKey === 'materialId' ? false : row.needsReview,
    fieldMeta: {
      ...(row.fieldMeta || {}),
      [fieldKey]: createFieldProvenance('ocr', {
        touched: false,
        confirmed: true,
      }),
    },
    rowSuggestions: nextRowSuggestions,
  }
}

export function dismissLineItemSuggestion(row, fieldKey) {
  if (!row?.rowSuggestions?.[fieldKey]) {
    return row
  }
  const nextRowSuggestions = { ...row.rowSuggestions }
  delete nextRowSuggestions[fieldKey]
  return {
    ...row,
    rowSuggestions: nextRowSuggestions,
  }
}

function getReliableHeaderCandidates(parsedOcr = {}) {
  const candidates = {}

  if (
    String(parsedOcr.supplierName || '').trim() &&
    parsedOcr.supplierConfidence !== 'none'
  ) {
    candidates.supplierName = String(parsedOcr.supplierName).trim()
  }

  if (
    String(parsedOcr.supplierInvoiceNumber || '').trim() &&
    parsedOcr.invoiceNumberConfidence !== 'none'
  ) {
    candidates.supplierInvoiceNumber = String(
      parsedOcr.supplierInvoiceNumber,
    ).trim()
  }

  if (
    String(parsedOcr.purchaseDate || '').trim() &&
    parsedOcr.purchaseDateConfidence !== 'none'
  ) {
    candidates.purchaseDate = String(parsedOcr.purchaseDate).trim()
  }

  if (
    String(parsedOcr.discountAmount || '').trim() &&
    Number(parsedOcr.discountAmount) > 0
  ) {
    candidates.discountAmount = String(parsedOcr.discountAmount).trim()
  }

  if (
    String(parsedOcr.taxAmount || '').trim() &&
    Number(parsedOcr.taxAmount) > 0
  ) {
    candidates.taxAmount = String(parsedOcr.taxAmount).trim()
  }

  if (
    String(parsedOcr.otherCharges || '').trim() &&
    Number(parsedOcr.otherCharges) > 0
  ) {
    candidates.otherCharges = String(parsedOcr.otherCharges).trim()
  }

  return candidates
}

export function mergeHeaderFieldsWithOcr({
  values,
  fieldMeta,
  fieldSuggestions = {},
  parsedOcr,
  isAdditionalBill = false,
}) {
  const nextValues = { ...values }
  const nextFieldMeta = { ...fieldMeta }
  const nextFieldSuggestions = { ...fieldSuggestions }
  const autofilledFields = []
  const preservedFields = []

  const candidates = getReliableHeaderCandidates(parsedOcr)

  for (const [fieldKey, ocrValue] of Object.entries(candidates)) {
    const currentVal = nextValues[fieldKey] ?? ''
    const currentMeta =
      nextFieldMeta[fieldKey] || createFieldProvenance('initial')
    const protectedByEditOrConfirm = isFieldProtected(currentMeta)
    const hasExistingOcrValueOnSecondBill =
      isAdditionalBill &&
      currentMeta.source === 'ocr' &&
      String(currentVal).trim() !== ''

    if (areFieldValuesEquivalent(fieldKey, currentVal, ocrValue)) {
      if (!protectedByEditOrConfirm && currentMeta.source === 'initial') {
        nextFieldMeta[fieldKey] = createFieldProvenance('ocr')
      }
      delete nextFieldSuggestions[fieldKey]
      continue
    }

    if (protectedByEditOrConfirm || hasExistingOcrValueOnSecondBill) {
      nextFieldSuggestions[fieldKey] = {
        value: ocrValue,
        source: 'ocr',
      }
      preservedFields.push(fieldKey)
      continue
    }

    nextValues[fieldKey] = ocrValue
    nextFieldMeta[fieldKey] = createFieldProvenance('ocr')
    delete nextFieldSuggestions[fieldKey]
    autofilledFields.push(fieldKey)
  }

  return {
    values: nextValues,
    fieldMeta: nextFieldMeta,
    fieldSuggestions: nextFieldSuggestions,
    autofilledFields,
    preservedFields,
  }
}

function mergePairedLineItem(existingRow, ocrRow, fingerprint, isAdditionalBill) {
  const nextRow = {
    ...existingRow,
    ocrFingerprint: existingRow.ocrFingerprint || fingerprint,
    fieldMeta: { ...(existingRow.fieldMeta || {}) },
    rowSuggestions: { ...(existingRow.rowSuggestions || {}) },
  }

  if (
    !nextRow.materialId &&
    Array.isArray(ocrRow.suggestions) &&
    ocrRow.suggestions.length > 0
  ) {
    nextRow.suggestions = ocrRow.suggestions
  }

  const mergeableCells = [
    'materialId',
    'quantity',
    'unitPrice',
    'extractedDescription',
    'detectedUnit',
  ]

  let anyAutofilled = false
  let anyConflict = false

  for (const cellKey of mergeableCells) {
    const ocrVal = String(ocrRow?.[cellKey] ?? '').trim()
    if (!ocrVal) {
      continue
    }

    const currentVal = String(nextRow[cellKey] ?? '').trim()
    const cellMeta =
      nextRow.fieldMeta[cellKey] || createFieldProvenance('initial')
    const cellProtected = isFieldProtected(cellMeta)
    const keepPriorOcrCell =
      isAdditionalBill && cellMeta.source === 'ocr' && currentVal !== ''

    if (areFieldValuesEquivalent(cellKey, currentVal, ocrVal)) {
      if (!cellProtected && cellMeta.source === 'initial') {
        nextRow.fieldMeta[cellKey] = createFieldProvenance('ocr')
      }
      delete nextRow.rowSuggestions[cellKey]
      continue
    }

    if (cellProtected || keepPriorOcrCell) {
      nextRow.rowSuggestions[cellKey] = {
        value: ocrVal,
        source: 'ocr',
      }
      anyConflict = true
      continue
    }

    if (currentVal === '' || cellMeta.source === 'ocr') {
      nextRow[cellKey] = ocrVal
      nextRow.fieldMeta[cellKey] = createFieldProvenance('ocr')
      delete nextRow.rowSuggestions[cellKey]
      anyAutofilled = true
    } else {
      nextRow.rowSuggestions[cellKey] = {
        value: ocrVal,
        source: 'ocr',
      }
      anyConflict = true
    }
  }

  return {
    row: nextRow,
    anyAutofilled,
    anyConflict,
  }
}

export function mergeLineItemsWithOcr({
  existingRows = [],
  existingSuggestedRows = [],
  incomingOcrRows = [],
  dismissedFingerprints = [],
  isAdditionalBill = false,
}) {
  if (!Array.isArray(incomingOcrRows) || incomingOcrRows.length === 0) {
    return {
      lineItems:
        existingRows.length > 0 ? existingRows : [createEmptyLineItem()],
      suggestedLineItems: existingSuggestedRows,
      populatedCount: 0,
      suggestedCount: existingSuggestedRows.length,
    }
  }

  const dismissedSet = new Set(dismissedFingerprints || [])
  const occurrenceByBaseKey = new Map()
  const fingerprintedIncoming = incomingOcrRows.map((ocrRow) => {
    const baseKey = buildOcrRowFingerprint(ocrRow, 0)
    const count = occurrenceByBaseKey.get(baseKey) || 0
    occurrenceByBaseKey.set(baseKey, count + 1)
    const fp = buildOcrRowFingerprint(ocrRow, count)
    return {
      ocrRow,
      fingerprint: fp,
      descKey: normalizeDescriptionComparable(ocrRow.extractedDescription),
      materialId: String(ocrRow.materialId || '').trim(),
    }
  })

  if (isLineItemListEffectivelyEmpty(existingRows)) {
    const nonDismissed = fingerprintedIncoming.filter(
      (entry) => !dismissedSet.has(entry.fingerprint),
    )
    const dismissedEntries = fingerprintedIncoming.filter((entry) =>
      dismissedSet.has(entry.fingerprint),
    )

    if (nonDismissed.length > 0) {
      const createdRows = nonDismissed.map((entry) =>
        createOcrLineItem(entry.ocrRow, entry.fingerprint),
      )
      const extraSuggestions = buildDeduplicatedSuggestions(
        existingSuggestedRows,
        dismissedEntries,
        createdRows,
      )
      return {
        lineItems: createdRows,
        suggestedLineItems: extraSuggestions,
        populatedCount: createdRows.length,
        suggestedCount: extraSuggestions.length,
      }
    }
  }

  const pairedExistingToIncoming = new Map()
  const pairedIncomingIndices = new Set()

  existingRows.forEach((row, eIdx) => {
    if (!row.ocrFingerprint) return
    const matchIdx = fingerprintedIncoming.findIndex(
      (inc, iIdx) =>
        !pairedIncomingIndices.has(iIdx) &&
        inc.fingerprint === row.ocrFingerprint,
    )
    if (matchIdx !== -1) {
      pairedExistingToIncoming.set(eIdx, matchIdx)
      pairedIncomingIndices.add(matchIdx)
    }
  })

  existingRows.forEach((row, eIdx) => {
    if (pairedExistingToIncoming.has(eIdx)) return
    const rowDescKey = normalizeDescriptionComparable(row.extractedDescription)
    if (!rowDescKey) return

    const matchingExistingCount = existingRows.filter(
      (r, idx) =>
        !pairedExistingToIncoming.has(idx) &&
        normalizeDescriptionComparable(r.extractedDescription) === rowDescKey,
    ).length
    if (matchingExistingCount !== 1) return

    const candidateIndices = fingerprintedIncoming
      .map((inc, iIdx) => ({ inc, iIdx }))
      .filter(
        ({ inc, iIdx }) =>
          !pairedIncomingIndices.has(iIdx) && inc.descKey === rowDescKey,
      )

    if (candidateIndices.length === 1) {
      const chosenIdx = candidateIndices[0].iIdx
      pairedExistingToIncoming.set(eIdx, chosenIdx)
      pairedIncomingIndices.add(chosenIdx)
    }
  })

  existingRows.forEach((row, eIdx) => {
    if (pairedExistingToIncoming.has(eIdx)) return
    const rowMatId = String(row.materialId || '').trim()
    if (!rowMatId) return

    const matchingExistingMatCount = existingRows.filter(
      (r, idx) =>
        !pairedExistingToIncoming.has(idx) &&
        String(r.materialId || '').trim() === rowMatId,
    ).length
    if (matchingExistingMatCount !== 1) return

    const candidateIndices = fingerprintedIncoming
      .map((inc, iIdx) => ({ inc, iIdx }))
      .filter(
        ({ inc, iIdx }) =>
          !pairedIncomingIndices.has(iIdx) && inc.materialId === rowMatId,
      )

    if (candidateIndices.length === 1) {
      const chosenIdx = candidateIndices[0].iIdx
      pairedExistingToIncoming.set(eIdx, chosenIdx)
      pairedIncomingIndices.add(chosenIdx)
    }
  })

  let populatedCount = 0
  const nextRows = existingRows.map((row, eIdx) => {
    if (!pairedExistingToIncoming.has(eIdx)) {
      return row
    }
    const incEntry = fingerprintedIncoming[pairedExistingToIncoming.get(eIdx)]
    const merged = mergePairedLineItem(
      row,
      incEntry.ocrRow,
      incEntry.fingerprint,
      isAdditionalBill,
    )
    if (merged.anyAutofilled) {
      populatedCount += 1
    }
    return merged.row
  })

  const unpairedIncoming = fingerprintedIncoming.filter(
    (_, iIdx) => !pairedIncomingIndices.has(iIdx),
  )

  const nextSuggested = buildDeduplicatedSuggestions(
    existingSuggestedRows,
    unpairedIncoming,
    nextRows,
  )

  return {
    lineItems: nextRows,
    suggestedLineItems: nextSuggested,
    populatedCount,
    suggestedCount: nextSuggested.length,
  }
}

function buildDeduplicatedSuggestions(
  existingSuggestedRows,
  unpairedIncomingEntries,
  activeLineItems,
) {
  const activeFingerprints = new Set(
    (activeLineItems || []).map((r) => r.ocrFingerprint).filter(Boolean),
  )
  const byFingerprint = new Map()

  for (const prev of existingSuggestedRows || []) {
    if (prev.ocrFingerprint && !activeFingerprints.has(prev.ocrFingerprint)) {
      byFingerprint.set(prev.ocrFingerprint, prev)
    }
  }

  for (const entry of unpairedIncomingEntries || []) {
    if (activeFingerprints.has(entry.fingerprint)) {
      continue
    }
    const existing = byFingerprint.get(entry.fingerprint)
    byFingerprint.set(entry.fingerprint, {
      suggestionKey: existing?.suggestionKey || nextSuggestedLineKey(),
      ocrFingerprint: entry.fingerprint,
      materialId: entry.ocrRow.materialId || '',
      quantity: entry.ocrRow.quantity ? String(entry.ocrRow.quantity) : '',
      unitPrice: entry.ocrRow.unitPrice ? String(entry.ocrRow.unitPrice) : '',
      extractedDescription: entry.ocrRow.extractedDescription || '',
      detectedUnit: entry.ocrRow.detectedUnit || '',
      suggestions: Array.isArray(entry.ocrRow.suggestions)
        ? entry.ocrRow.suggestions
        : [],
    })
  }

  return Array.from(byFingerprint.values())
}

export function promoteSuggestedLineItemToRows(existingRows = [], suggestedItem) {
  if (!suggestedItem) {
    return existingRows
  }

  const created = createOcrLineItem(
    suggestedItem,
    suggestedItem.ocrFingerprint || '',
  )
  created.fieldMeta = {
    ...created.fieldMeta,
    ...(created.materialId
      ? {
          materialId: createFieldProvenance('ocr', {
            touched: false,
            confirmed: true,
          }),
        }
      : {}),
    ...(created.quantity
      ? {
          quantity: createFieldProvenance('ocr', {
            touched: false,
            confirmed: true,
          }),
        }
      : {}),
    ...(created.unitPrice
      ? {
          unitPrice: createFieldProvenance('ocr', {
            touched: false,
            confirmed: true,
          }),
        }
      : {}),
  }

  if (isLineItemListEffectivelyEmpty(existingRows)) {
    return [created]
  }

  const blankIndex = existingRows.findIndex((r) => isUntouchedBlankLineItem(r))
  if (blankIndex !== -1) {
    return existingRows.map((r, idx) => (idx === blankIndex ? created : r))
  }

  return [...existingRows, created]
}

