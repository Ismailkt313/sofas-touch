const MONTH_INDEX_BY_TOKEN = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

const UNIT_SYNONYM_MAP = {
  kg: 'Kilogram',
  kgs: 'Kilogram',
  kilo: 'Kilogram',
  kilogram: 'Kilogram',
  kilograms: 'Kilogram',
  m: 'Meter',
  mtr: 'Meter',
  mtrs: 'Meter',
  meter: 'Meter',
  meters: 'Meter',
  metre: 'Meter',
  metres: 'Meter',
  pc: 'Piece',
  pcs: 'Piece',
  nos: 'Piece',
  no: 'Piece',
  piece: 'Piece',
  pieces: 'Piece',
  sheet: 'Sheet',
  sheets: 'Sheet',
  sht: 'Sheet',
  roll: 'Roll',
  rolls: 'Roll',
  ltr: 'Litre',
  ltrs: 'Litre',
  l: 'Litre',
  litre: 'Litre',
  litres: 'Litre',
  liter: 'Litre',
  liters: 'Litre',
  sqft: 'Square Feet',
  sft: 'Square Feet',
  'sq ft': 'Square Feet',
  'sq.ft': 'Square Feet',
  'square feet': 'Square Feet',
  ft: 'Running Feet',
  feet: 'Running Feet',
  rft: 'Running Feet',
  'running feet': 'Running Feet',
  'running ft': 'Running Feet',
  yd: 'Yard',
  yds: 'Yard',
  yard: 'Yard',
  yards: 'Yard',
  set: 'Set',
  sets: 'Set',
  box: 'Box',
  boxes: 'Box',
  bx: 'Box',
  pair: 'Pair',
  pairs: 'Pair',
  pr: 'Pair',
}

const HEADER_SKIP_PATTERNS = [
  /^tax\s*invoice$/i,
  /^cash\s*(bill|memo|invoice)$/i,
  /^credit\s*(bill|memo|invoice)$/i,
  /^retail\s*invoice$/i,
  /^purchase\s*(invoice|order|bill|voucher)$/i,
  /^proforma\s*invoice$/i,
  /^original\s+for\s+recipient$/i,
  /^duplicate\s+for/i,
  /^gstin\b/i,
  /^gst\s*no\b/i,
  /^pan\s*no\b/i,
  /^state\s*code\b/i,
  /^phone\b|^mob\b|^tel\b|^email\b/i,
  /^(bill\s*to|billed\s*to|ship\s*to|buyer|customer|consignee)\b/i,
  /soft\s*touch\s*sofas/i,
]

const NON_LINE_ROW_PATTERNS = [
  /\b(sub\s*total|subtotal|grand\s*total|net\s*total|total\s*amount|amount\s*payable|balance\s*due|round\s*off)\b/i,
  /\b(cgst|sgst|igst|utgst|total\s*gst|gst|vat|output\s*tax|input\s*tax|tax\s*amount)\b/i,
  /\b(discount|less\s*discount|trade\s*discount)\b/i,
  /\b(freight|transport|delivery\s*charges?|packing\s*charges?|handling|loading|other\s*charges?)\b/i,
  /\b(sl\.?\s*no|sr\.?\s*no|item\s*description|particulars|hsn|sac|qty|quantity|unit\s*price|rate|amount)\b.*\b(qty|rate|amount|total|price)\b/i,
  /\b(authorized\s*signatory|terms\s*&?\s*conditions|bank\s*details|ifsc|account\s*no|thank\s*you|e\.?\s*&\s*o\.?\s*e)\b/i,
]

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'per',
  'item',
  'grade',
  'quality',
  'material',
  'raw',
  'no',
  'code',
])

export function normalizeOcrText(rawText) {
  if (typeof rawText !== 'string') {
    return ''
  }

  return rawText
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00A0\t]+/g, ' ')
    .replace(/[¦|]+/g, '  ')
    .replace(/[₹]/g, ' Rs ')
    .split('\n')
    .map((line) =>
      line
        .replace(/(\d)[Oo](\d)/g, '$10$2')
        .replace(/(\d)[Oo]\b/g, '$10')
        .replace(/\b[Oo](\d{2,})/g, '0$1')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
}

function parseCleanNumber(rawToken) {
  if (typeof rawToken !== 'string') {
    return null
  }
  const cleaned = rawToken
    .replace(/^(rs\.?|inr)\s*/i, '')
    .replace(/,/g, '')
    .trim()

  if (!/^-?\d+(?:\.\d{1,3})?$/.test(cleaned)) {
    return null
  }
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function buildValidIsoDate(year, month, day) {
  let y = Number(year)
  if (y >= 0 && y < 100) {
    y += 2000
  }
  const m = Number(month)
  const d = Number(day)
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return null
  }
  const utc = new Date(Date.UTC(y, m - 1, d))
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== m - 1 ||
    utc.getUTCDate() !== d
  ) {
    return null
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function extractDateFromLine(line) {
  const isoMatch = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(line)
  if (isoMatch) {
    const valid = buildValidIsoDate(isoMatch[1], isoMatch[2], isoMatch[3])
    if (valid) return valid
  }

  const namedMonthFirst =
    /\b(\d{1,2})[\s\-/,]+([A-Za-z]{3,9})[\s\-/,]+(20\d{2}|\d{2})\b/.exec(line)
  if (namedMonthFirst) {
    const monthIdx =
      MONTH_INDEX_BY_TOKEN[namedMonthFirst[2].toLowerCase()] || 0
    if (monthIdx) {
      const valid = buildValidIsoDate(
        namedMonthFirst[3],
        monthIdx,
        namedMonthFirst[1],
      )
      if (valid) return valid
    }
  }

  const namedMonthSecond =
    /\b([A-Za-z]{3,9})[\s\-/,]+(\d{1,2})[\s\-/,]+(20\d{2}|\d{2})\b/.exec(line)
  if (namedMonthSecond) {
    const monthIdx =
      MONTH_INDEX_BY_TOKEN[namedMonthSecond[1].toLowerCase()] || 0
    if (monthIdx) {
      const valid = buildValidIsoDate(
        namedMonthSecond[3],
        monthIdx,
        namedMonthSecond[2],
      )
      if (valid) return valid
    }
  }

  const dmyMatch = /\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/.exec(line)
  if (dmyMatch) {
    const first = Number(dmyMatch[1])
    const second = Number(dmyMatch[2])
    const yr = dmyMatch[3]
    if (first > 12 && second <= 12) {
      return buildValidIsoDate(yr, second, first)
    }
    if (second > 12 && first <= 12) {
      return buildValidIsoDate(yr, first, second)
    }
    if (first <= 12 && second <= 12) {
      return buildValidIsoDate(yr, second, first)
    }
  }

  return null
}

function extractInvoiceDate(lines) {
  for (const line of lines) {
    if (/\b(invoice\s*date|bill\s*date|dated?|date)\b/i.test(line)) {
      const found = extractDateFromLine(line)
      if (found) {
        return { value: found, confidence: 'high' }
      }
    }
  }

  for (const line of lines.slice(0, 14)) {
    const found = extractDateFromLine(line)
    if (found) {
      return { value: found, confidence: 'medium' }
    }
  }

  return { value: '', confidence: 'none' }
}

function extractInvoiceNumber(lines) {
  const labeledPatterns = [
    /\b(?:invoice|inv|bill|cash\s*memo)\s*(?:no\.?|number|#)\s*[:-]?\s*([A-Z0-9][A-Z0-9/_-]{1,28})/i,
    /\b(?:ref|voucher)\s*(?:no\.?|#)\s*[:-]?\s*([A-Z0-9][A-Z0-9/_-]{2,28})/i,
  ]

  for (const line of lines.slice(0, 20)) {
    for (const pattern of labeledPatterns) {
      const match = pattern.exec(line)
      if (match && match[1]) {
        const candidate = match[1].replace(/[.,;:]+$/, '').trim()
        if (
          candidate.length >= 2 &&
          !/^(date|dated|gst|gstin|pan|tax|to)$/i.test(candidate) &&
          /\d/.test(candidate)
        ) {
          return { value: candidate, confidence: 'high' }
        }
      }
    }
  }

  return { value: '', confidence: 'none' }
}

function extractSupplierName(lines) {
  for (const line of lines.slice(0, 15)) {
    const labeled =
      /^(?:supplier|vendor|seller|sold\s*by|from|m\/s\.?)\s*[:-]?\s*(.+)$/i.exec(
        line,
      )
    if (labeled && labeled[1]) {
      const cleaned = labeled[1]
        .replace(/\b(?:gstin|invoice|date|mob|tel|ph)\b.*$/i, '')
        .trim()
      if (
        cleaned.length >= 3 &&
        cleaned.length <= 90 &&
        !/soft\s*touch\s*sofas/i.test(cleaned)
      ) {
        return { value: cleaned, confidence: 'high' }
      }
    }
  }

  let insideBuyerBlock = false
  for (const line of lines.slice(0, 8)) {
    if (/^(bill\s*to|billed\s*to|buyer|customer)\b/i.test(line)) {
      insideBuyerBlock = true
      continue
    }
    if (insideBuyerBlock) {
      continue
    }
    if (HEADER_SKIP_PATTERNS.some((rx) => rx.test(line))) {
      continue
    }
    if (/\b(invoice|inv\s*no|bill\s*no|date|gstin)\b/i.test(line)) {
      continue
    }

    const alphaCount = (line.match(/[A-Za-z]/g) || []).length
    const digitCount = (line.match(/\d/g) || []).length
    if (alphaCount >= 4 && digitCount <= 4 && line.length <= 80) {
      const cleaned = line.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.)&]+$/g, '').trim()
      if (cleaned.length >= 3) {
        const hasBusinessHint =
          /\b(traders|trading|timber|woods?|veneers?|fabrics?|textiles?|furnishings?|foams?|hardware|enterprises?|agency|agencies|mart|house|co\.?|llp|pvt|ltd|corp|store|mills?|ply|upholstery|drapery)\b/i.test(
            cleaned,
          )
        return {
          value: cleaned,
          confidence: hasBusinessHint ? 'high' : 'medium',
        }
      }
    }
  }

  return { value: '', confidence: 'none' }
}

function extractLastPositiveAmount(line) {
  const matches = line.match(
    /(?:Rs\.?\s*)?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,3})?/gi,
  )
  if (!matches || matches.length === 0) {
    return null
  }
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const val = parseCleanNumber(matches[i])
    if (val !== null && val >= 0) {
      if (/%/.test(line) && i === 0 && matches.length > 1) {
        continue
      }
      return val
    }
  }
  return null
}

function extractSummaryAmounts(lines) {
  let discountAmount = 0
  let taxAmount = 0
  let otherCharges = 0
  let detectedSubtotal = null
  let detectedGrandTotal = null

  for (const line of lines) {
    const lower = line.toLowerCase()

    if (/\b(sub\s*total|taxable\s*(?:value|amount))\b/i.test(lower)) {
      const amt = extractLastPositiveAmount(line)
      if (amt !== null && amt > 0) {
        detectedSubtotal = amt
      }
      continue
    }

    if (/\b(discount|less\s*disc)/i.test(lower)) {
      const amt = extractLastPositiveAmount(line)
      if (amt !== null && amt > 0) {
        discountAmount = Math.round((discountAmount + amt) * 100) / 100
      }
      continue
    }

    if (
      /\b(cgst|sgst|igst|utgst|total\s*gst|gst|tax(?:\s*amount)?|vat)\b/i.test(
        lower,
      ) &&
      !/\b(gstin|gst\s*(?:no|number|reg|id)|tax\s*invoice|taxable)\b/i.test(
        lower,
      )
    ) {
      const amt = extractLastPositiveAmount(line)
      if (amt !== null && amt > 0) {
        taxAmount = Math.round((taxAmount + amt) * 100) / 100
      }
      continue
    }

    if (/\b(freight|delivery|transport|shipping|packing|loading|other\s*charges?)\b/i.test(lower)) {
      const amt = extractLastPositiveAmount(line)
      if (amt !== null && amt > 0) {
        otherCharges = Math.round((otherCharges + amt) * 100) / 100
      }
      continue
    }

    if (/\b(grand\s*total|net\s*(?:total|payable|amount)|total\s*(?:amount|payable)|invoice\s*total)\b/i.test(lower)) {
      const amt = extractLastPositiveAmount(line)
      if (amt !== null && amt > 0) {
        detectedGrandTotal = amt
      }
    }
  }

  return {
    discountAmount,
    taxAmount,
    otherCharges,
    detectedSubtotal,
    detectedGrandTotal,
  }
}

function detectUnitTokenInSegment(text) {
  const lower = text.toLowerCase()
  const multiWordKeys = ['square feet', 'sq ft', 'running feet', 'running ft']
  for (const key of multiWordKeys) {
    if (lower.includes(key)) {
      return { canonicalUnit: UNIT_SYNONYM_MAP[key], matchedToken: key }
    }
  }

  const tokens = lower.split(/[^a-z]+/).filter(Boolean)
  for (const tok of tokens) {
    if (UNIT_SYNONYM_MAP[tok]) {
      return { canonicalUnit: UNIT_SYNONYM_MAP[tok], matchedToken: tok }
    }
  }

  return { canonicalUnit: '', matchedToken: '' }
}

function tokenizeDescription(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok) && !UNIT_SYNONYM_MAP[tok])
}

export function matchDescriptionToRawMaterials(
  description,
  detectedUnit,
  rawMaterials = [],
) {
  const activeMaterials = rawMaterials.filter((m) => m && m.isActive !== false)
  if (!description || activeMaterials.length === 0) {
    return {
      autoMappedMaterialId: '',
      confidence: 'none',
      suggestions: [],
    }
  }

  const cleanDesc = String(description).trim().toLowerCase()
  const descTokens = tokenizeDescription(description)
  if (descTokens.length === 0) {
    return {
      autoMappedMaterialId: '',
      confidence: 'none',
      suggestions: [],
    }
  }

  const scored = activeMaterials
    .map((mat) => {
      const matNameLower = String(mat.name || '').trim().toLowerCase()
      const matTokens = tokenizeDescription(mat.name)
      if (matTokens.length === 0) {
        return { material: mat, score: 0 }
      }

      if (cleanDesc === matNameLower) {
        const unitBonus =
          !detectedUnit || detectedUnit === mat.unit ? 0.05 : -0.35
        return { material: mat, score: Math.min(1, 0.96 + unitBonus) }
      }

      let matchedMatTokens = 0
      for (const mTok of matTokens) {
        if (
          descTokens.some(
            (dTok) =>
              dTok === mTok ||
              (dTok.length >= 4 && mTok.startsWith(dTok)) ||
              (mTok.length >= 4 && dTok.startsWith(mTok)),
          )
        ) {
          matchedMatTokens += 1
        }
      }

      const recallOnMaterial = matchedMatTokens / matTokens.length
      const precisionOnDesc = matchedMatTokens / Math.max(descTokens.length, 1)
      let score = recallOnMaterial * 0.68 + precisionOnDesc * 0.32

      if (cleanDesc.includes(matNameLower) || matNameLower.includes(cleanDesc)) {
        score = Math.max(score, 0.86)
      }

      if (detectedUnit) {
        if (detectedUnit === mat.unit) {
          score += 0.06
        } else {
          score -= 0.3
        }
      }

      return {
        material: mat,
        score: Math.max(0, Math.min(1, Math.round(score * 100) / 100)),
      }
    })
    .filter((entry) => entry.score >= 0.42)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return {
      autoMappedMaterialId: '',
      confidence: 'none',
      suggestions: [],
    }
  }

  const top = scored[0]
  const runnerUp = scored[1]
  const hasClearMargin = !runnerUp || top.score - runnerUp.score >= 0.15

  if (top.score >= 0.88 && hasClearMargin) {
    return {
      autoMappedMaterialId: top.material.id,
      confidence: 'high',
      suggestions: scored.slice(0, 3).map((s) => ({
        id: s.material.id,
        name: s.material.name,
        unit: s.material.unit,
        score: s.score,
      })),
    }
  }

  return {
    autoMappedMaterialId: '',
    confidence: 'review',
    suggestions: scored.slice(0, 3).map((s) => ({
      id: s.material.id,
      name: s.material.name,
      unit: s.material.unit,
      score: s.score,
    })),
  }
}

function parseCandidateLineItems(lines, rawMaterials = []) {
  const extractedRows = []

  for (const line of lines) {
    if (line.length < 6) {
      continue
    }
    if (HEADER_SKIP_PATTERNS.some((rx) => rx.test(line))) {
      continue
    }
    if (NON_LINE_ROW_PATTERNS.some((rx) => rx.test(line))) {
      continue
    }
    if (
      /\b(invoice\s*(?:no|number|#)|inv\s*(?:no|number|#)|bill\s*(?:no|number|#)|voucher\s*(?:no|#)|(?:invoice\s*|bill\s*)?dated?|gstin|pan|phone|mobile|tel|email)\b/i.test(
        line,
      )
    ) {
      continue
    }

    const withoutLeadingSerial = line.replace(/^\s*\d{1,2}[.)]\s+/, '').trim()
    const numberRegex = /(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,3})?/g
    const numericMatches = []
    let match = numberRegex.exec(withoutLeadingSerial)
    while (match !== null) {
      const value = parseCleanNumber(match[0])
      if (value !== null) {
        numericMatches.push({
          raw: match[0],
          value,
          index: match.index,
        })
      }
      match = numberRegex.exec(withoutLeadingSerial)
    }

    if (numericMatches.length < 2) {
      continue
    }

    const firstTailNumberIdx =
      numericMatches.length >= 3
        ? numericMatches[numericMatches.length - 3].index
        : numericMatches[numericMatches.length - 2].index

    let rawDescription = withoutLeadingSerial
      .slice(0, firstTailNumberIdx)
      .replace(/\b(?:Rs\.?|INR)\b/gi, '')
      .replace(/[-:|]+$/g, '')
      .trim()

    if ((rawDescription.match(/[A-Za-z]/g) || []).length < 3) {
      continue
    }

    const tailText = withoutLeadingSerial.slice(firstTailNumberIdx)
    let { canonicalUnit } = detectUnitTokenInSegment(tailText)
    if (!canonicalUnit) {
      canonicalUnit = detectUnitTokenInSegment(rawDescription).canonicalUnit
    }

    rawDescription = rawDescription
      .replace(/\b\d{4,8}\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    let quantity = ''
    let unitPrice = ''
    let detectedLineTotal = null

    if (numericMatches.length >= 3) {
      const n1 = numericMatches[numericMatches.length - 3].value
      const n2 = numericMatches[numericMatches.length - 2].value
      const n3 = numericMatches[numericMatches.length - 1].value

      const product = n1 * n2
      const relativeDiff =
        n3 > 0 ? Math.abs(product - n3) / Math.max(product, n3) : 1

      if (n1 > 0 && n2 > 0 && relativeDiff <= 0.08) {
        quantity = String(n1)
        unitPrice = String(n2)
        detectedLineTotal = n3
      } else if (numericMatches.length >= 4) {
        const m1 = numericMatches[numericMatches.length - 4].value
        const m2 = numericMatches[numericMatches.length - 3].value
        const m4 = numericMatches[numericMatches.length - 1].value
        if (m1 > 0 && m2 > 0 && m4 >= m1 * m2 * 0.9) {
          quantity = String(m1)
          unitPrice = String(m2)
          detectedLineTotal = m4
        }
      } else if (n1 > 0 && n2 > 0 && n3 > 0) {
        quantity = String(n1)
        unitPrice = String(n2)
        detectedLineTotal = n3
      }
    } else if (numericMatches.length === 2) {
      const n1 = numericMatches[0].value
      const n2 = numericMatches[1].value
      if (n1 > 0 && n2 > 0) {
        quantity = String(n1)
        unitPrice = String(n2)
      }
    }

    if (!quantity && !unitPrice) {
      continue
    }

    const materialMatch = matchDescriptionToRawMaterials(
      rawDescription,
      canonicalUnit,
      rawMaterials,
    )

    extractedRows.push({
      extractedDescription: rawDescription,
      detectedUnit: canonicalUnit,
      quantity,
      unitPrice,
      detectedLineTotal,
      materialId: materialMatch.autoMappedMaterialId,
      matchConfidence: materialMatch.confidence,
      suggestions: materialMatch.suggestions,
      needsReview: true,
    })
  }

  return extractedRows
}

export function parseBillOcrText(rawText, rawMaterials = []) {
  const normalizedText = normalizeOcrText(rawText)
  if (!normalizedText) {
    return {
      hasContent: false,
      normalizedText: '',
      supplierName: '',
      supplierConfidence: 'none',
      supplierInvoiceNumber: '',
      invoiceNumberConfidence: 'none',
      purchaseDate: '',
      purchaseDateConfidence: 'none',
      discountAmount: '',
      taxAmount: '',
      otherCharges: '',
      detectedSubtotal: null,
      detectedGrandTotal: null,
      lineItems: [],
      warnings: [
        'No readable text could be extracted from this bill. Please verify image clarity or enter details manually.',
      ],
    }
  }

  const lines = normalizedText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const supplier = extractSupplierName(lines)
  const invoiceNo = extractInvoiceNumber(lines)
  const invoiceDate = extractInvoiceDate(lines)
  const summary = extractSummaryAmounts(lines)
  const lineItems = parseCandidateLineItems(lines, rawMaterials)

  const warnings = []
  if (!supplier.value) {
    warnings.push('Supplier name could not be confidently detected; please enter it.')
  }
  if (!invoiceDate.value) {
    warnings.push('Purchase date was unclear on the bill; verify the voucher date.')
  }
  if (lineItems.length === 0) {
    warnings.push(
      'Individual material line rows could not be reliably separated; add material lines manually below.',
    )
  } else if (lineItems.some((item) => !item.materialId)) {
    warnings.push(
      'One or more detected bill items need to be matched to an existing Raw Material before saving.',
    )
  }

  return {
    hasContent: true,
    normalizedText,
    supplierName: supplier.value,
    supplierConfidence: supplier.confidence,
    supplierInvoiceNumber: invoiceNo.value,
    invoiceNumberConfidence: invoiceNo.confidence,
    purchaseDate: invoiceDate.value,
    purchaseDateConfidence: invoiceDate.confidence,
    discountAmount:
      summary.discountAmount > 0 ? String(summary.discountAmount) : '',
    taxAmount: summary.taxAmount > 0 ? String(summary.taxAmount) : '',
    otherCharges: summary.otherCharges > 0 ? String(summary.otherCharges) : '',
    detectedSubtotal: summary.detectedSubtotal,
    detectedGrandTotal: summary.detectedGrandTotal,
    lineItems,
    warnings,
  }
}
