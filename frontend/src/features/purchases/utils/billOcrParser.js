import {
  buildSpatialRowsFromWords,
  extractWordsFromBlocks,
  parseTesseractTsv,
} from './ocrEngine.js'

export const DEFAULT_OCR_VALIDATION_LIMITS = Object.freeze({
  minQuantity: 0.001,
  maxQuantity: 10000,
  minUnitPrice: 0.5,
  maxUnitPrice: 500000,
  minLineAmount: 1,
  maxLineAmount: 5000000,
  lineMathRelativeTolerance: 0.02,
  lineMathAbsoluteTolerance: 1.5,
  totalsReconciliationTolerance: 1.0,
})

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

const CANONICAL_UNIT_SYNONYM_MAP = {
  kg: 'Kilogram',
  kgs: 'Kilogram',
  kilo: 'Kilogram',
  kilos: 'Kilogram',
  kilogram: 'Kilogram',
  kilograms: 'Kilogram',
  m: 'Meter',
  mtr: 'Meter',
  mtrs: 'Meter',
  mts: 'Meter',
  meter: 'Meter',
  meters: 'Meter',
  metre: 'Meter',
  metres: 'Meter',
  pc: 'Piece',
  pcs: 'Piece',
  pce: 'Piece',
  nos: 'Piece',
  n0s: 'Piece',
  no: 'Piece',
  ea: 'Piece',
  each: 'Piece',
  unit: 'Piece',
  units: 'Piece',
  piece: 'Piece',
  pieces: 'Piece',
  sheet: 'Sheet',
  sheets: 'Sheet',
  sht: 'Sheet',
  shts: 'Sheet',
  roll: 'Roll',
  rolls: 'Roll',
  rl: 'Roll',
  rls: 'Roll',
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
  'sq. ft': 'Square Feet',
  'square feet': 'Square Feet',
  'square ft': 'Square Feet',
  ft: 'Running Feet',
  feet: 'Running Feet',
  rft: 'Running Feet',
  'r.ft': 'Running Feet',
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

const EXTRA_RECOGNIZABLE_UNIT_MAP = {
  pkt: 'Packet',
  pkts: 'Packet',
  pack: 'Packet',
  packs: 'Packet',
  packet: 'Packet',
  packets: 'Packet',
  bag: 'Bag',
  bags: 'Bag',
  bdl: 'Bundle',
  bundle: 'Bundle',
  bundles: 'Bundle',
  coil: 'Coil',
  coils: 'Coil',
  can: 'Can',
  cans: 'Can',
  tin: 'Tin',
  tins: 'Tin',
  drum: 'Drum',
  spool: 'Spool',
  cone: 'Cone',
  cones: 'Cone',
  gm: 'Gram',
  gms: 'Gram',
  gram: 'Gram',
  grams: 'Gram',
  ml: 'Millilitre',
}

const MULTI_WORD_UNIT_KEYS = [
  'square feet',
  'square ft',
  'sq. ft',
  'sq ft',
  'running feet',
  'running ft',
]

const HEADER_SKIP_PATTERNS = [
  /^tax\s*invoice$/i,
  /^invoice$/i,
  /^cash\s*(?:bill|memo|invoice)$/i,
  /^credit\s*(?:bill|memo|invoice)$/i,
  /^retail\s*invoice$/i,
  /^purchase\s*(?:invoice|order|bill|voucher)$/i,
  /^proforma\s*invoice$/i,
  /^delivery\s*challan$/i,
  /^original\s+for\s+recipient$/i,
  /^duplicate\s+for/i,
  /^triplicate\s+for/i,
  /^gstin\b/i,
  /^gst\s*(?:no|in|reg)\b/i,
  /^pan\s*(?:no)?\b/i,
  /^cin\b/i,
  /^state\s*(?:name|code)\b/i,
  /^(?:phone|ph|mob|mobile|tel|email|web|website)\b/i,
  /^(?:bill\s*to|billed\s*to|ship\s*to|shipped\s*to|buyer|customer|consignee)\b/i,
  /soft\s*touch\s*sofas/i,
]

const ADDRESS_KEYWORDS_REGEX =
  /\b(?:pin\s*code|pincode|postal\s*code|door\s*no\.?|plot\s*no\.?|shop\s*no\.?|bldg\.?|building|floor|flr\.?|street|road|rd\.?|lane|avenue|ave\.?|nagar|colony|layout|enclave|phase|sector|industrial\s*(?:area|estate|park)|infopark|technopark|bypass|highway|nh[-\s]?\d+|junction|jn\.?|opp\.?|near|beside|behind|dist\.?|district|taluk|p\.?\s*o\.?|post\s*office|state\s*code|place\s*of\s*supply|kerala|karnataka|tamil\s*nadu|maharashtra|telangana|gujarat|delhi|india)\b/i

const ADDRESS_POSTAL_STRUCTURE_REGEX =
  /[A-Za-z]{3,}\s*,\s*[A-Za-z][A-Za-z\s.]{1,28}\s*[-–:]\s*[1-8]\d{5}\b/

const GSTIN_REGEX =
  /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z][A-Z0-9][0-9A-Z]\b/i

const PAN_REGEX = /\b[A-Z]{5}\d{4}[A-Z]\b/

const PHONE_NUMBER_REGEX =
  /(?:\+?91[\s.-]?)?[6-9]\d{9}\b|\b0\d{2,4}[\s.-]?\d{6,8}\b|\b[6-9]\d{4}[\s-]\d{5}\b/

const METADATA_LINE_REGEX =
  /\b(?:invoice\s*(?:no|number|#)|inv\.?\s*(?:no|number|#)|bill\s*(?:no|number|#)|voucher\s*(?:no|#)|po\s*(?:no|number|#)|purchase\s*order|challan\s*(?:no)?|dc\s*no|e-?way\s*bill|vehicle\s*no|lr\s*no|ack\s*no|irn\b|gstin|pan\s*no|cin\s*no|udyam|ifsc|account\s*(?:no|number|name)|a\/c\s*no|bank\s*(?:name|details)|branch\s*name|upi\s*id|payment\s*(?:terms|mode|due|status)|due\s*date|credit\s*period|terms\s*(?:&|and)?\s*conditions|authorized\s*signatory|authorised\s*signatory|customer\s*signature|receiver'?s?\s*signature|subject\s*to\b.*jurisdiction)\b/i

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

const COLUMN_ROLE_PATTERNS = [
  {
    role: 'serial',
    regex:
      /^(?:sl\.?(?:\s*no\.?)?|sr\.?(?:\s*no\.?)?|s\.?\s*no\.?|#|line|item\s*#?)$/i,
  },
  {
    role: 'description',
    regex:
      /^(?:item\s*description|description(?:\s*of\s*goods(?:\s*&\s*services)?)?|particulars|items?|materials?(?:\s*description|\s*name)?|goods(?:\s*description)?|product(?:\s*description|\s*name)?|name\s*of\s*item)$/i,
  },
  {
    role: 'hsn',
    regex: /^(?:hsn(?:\s*\/?\s*sac)?(?:\s*code)?|sac(?:\s*code)?|hsn\s*code)$/i,
  },
  {
    role: 'quantity',
    regex: /^(?:qty\.?|quantity|qnty\.?|billed\s*qty\.?)$/i,
  },
  {
    role: 'unit',
    regex: /^(?:unit|units|uom|u\.o\.m\.?|per)$/i,
  },
  {
    role: 'rate',
    regex:
      /^(?:rate(?:\s*\/?\s*(?:unit|pc|mtr|sqft|rft|kg))?|unit\s*(?:price|rate)|price|cost|basic\s*rate)$/i,
  },
  {
    role: 'discountCol',
    regex: /^(?:disc\.?(?:\s*%)?|discount(?:\s*%)?)$/i,
  },
  {
    role: 'taxCol',
    regex: /^(?:gst(?:\s*%)?|tax(?:\s*rate|\s*%)?|cgst(?:\s*%)?|sgst(?:\s*%)?|igst(?:\s*%)?)$/i,
  },
  {
    role: 'amount',
    regex:
      /^(?:amount|line\s*total|net\s*amount|total(?:\s*amount)?|value|taxable\s*(?:value|amount)|item\s*total|ext\.?\s*price)$/i,
  },
]

function roundMoney(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

function roundQuantity(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    return 0
  }
  const rounded = Math.round((num + Number.EPSILON) * 1000) / 1000
  return Object.is(rounded, -0) ? 0 : rounded
}

function repairCautiousOcrDecimals(line) {
  return line
    .replace(/(\d),\s(\d{3}\.\d{2})\b/g, '$1,$2')
    .replace(/(\d),\s(\d{2},\d{3}\.\d{2})\b/g, '$1,$2')
    .replace(/(\b\d[\d,]*\.\d)[Oo]\b/g, '$10')
    .replace(/(\b\d[\d,]*\.)[Oo](\d)\b/g, '$10$2')
    .replace(/(\b\d{1,3},)[Oo](\d{2})\b/g, '$10$2')
    .replace(/(\b\d{1,3},)(\d)[Oo](\d)\b/g, '$1$20$3')
}

export function normalizeOcrText(rawText) {
  if (typeof rawText !== 'string') {
    return ''
  }

  return rawText
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[₹₨]/g, ' Rs ')
    .replace(/[–—]/g, '-')
    .split('\n')
    .map((line) =>
      repairCautiousOcrDecimals(line)
        .replace(/[¦│┃]+/g, ' | ')
        .replace(/\t+/g, '   ')
        .replace(/ {4,}/g, '   ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
}

function parseCleanNumber(rawToken) {
  if (typeof rawToken !== 'string' && typeof rawToken !== 'number') {
    return null
  }
  if (typeof rawToken === 'number') {
    return Number.isFinite(rawToken) ? rawToken : null
  }

  const trimmedRaw = rawToken.trim()
  if (!trimmedRaw || /%/.test(trimmedRaw)) {
    return null
  }

  const cleaned = repairCautiousOcrDecimals(trimmedRaw)
    .replace(/^(?:rs\.?|inr|₹|₨|\$)\s*/i, '')
    .replace(/\s*(?:\/-|only|cr|dr)\.?$/i, '')
    .replace(/,/g, '')
    .trim()

  if (!/^-?\d+(?:\.\d{1,3})?$/.test(cleaned)) {
    return null
  }

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function buildRowsFromPlainText(rawText) {
  const normalized = normalizeOcrText(rawText)
  if (!normalized) {
    return []
  }

  return normalized.split('\n').map((line, idx) => {
    const rawCells = line
      .split(/\s*\|\s*|\s{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)

    let cursorX = 0
    const cells = rawCells.map((cellText) => {
      const width = Math.max(12, cellText.length * 9)
      const cell = {
        text: cellText,
        x0: cursorX,
        x1: cursorX + width,
        y0: idx * 24,
        y1: idx * 24 + 16,
        centerX: cursorX + width / 2,
        width,
        confidence: 80,
        synthetic: true,
      }
      cursorX += width + 36
      return cell
    })

    return {
      pageIndex: 0,
      rowIndex: idx,
      top: idx * 24,
      bottom: idx * 24 + 16,
      left: 0,
      right: cursorX,
      height: 16,
      centerY: idx * 24 + 8,
      hasRealCoordinates: false,
      cells,
      text: rawCells.join('   '),
    }
  })
}

function resolveDocumentPages(ocrInput, options = {}) {
  const inputIsObject = Boolean(ocrInput && typeof ocrInput === 'object')
  const rawText = inputIsObject
    ? String(ocrInput.rawText || '')
    : typeof ocrInput === 'string'
      ? ocrInput
      : ''
  const pagesInput = inputIsObject
    ? ocrInput.pages
    : Array.isArray(options.pages)
      ? options.pages
      : null
  const tsvInput = inputIsObject
    ? ocrInput.tsv
    : typeof options.tsv === 'string'
      ? options.tsv
      : ''
  const blocksInput = inputIsObject
    ? ocrInput.blocks
    : Array.isArray(options.blocks)
      ? options.blocks
      : null

  if (Array.isArray(pagesInput) && pagesInput.length > 0) {
    const builtPages = pagesInput
      .map((page, pIdx) => {
        let spatialRows = Array.isArray(page?.spatialRows)
          ? page.spatialRows
          : []
        if (spatialRows.length === 0 && typeof page?.tsv === 'string' && page.tsv.trim()) {
          const parsed = parseTesseractTsv(page.tsv, pIdx)
          spatialRows = buildSpatialRowsFromWords(parsed.words, pIdx)
        }
        if (spatialRows.length === 0 && Array.isArray(page?.words) && page.words.length > 0) {
          spatialRows = buildSpatialRowsFromWords(page.words, pIdx)
        }
        if (spatialRows.length > 0) {
          return {
            pageIndex: pIdx,
            width: Number(page.width) || 0,
            height: Number(page.height) || 0,
            hasRealCoordinates: true,
            rows: spatialRows.map((row, rIdx) => ({
              ...row,
              pageIndex: pIdx,
              rowIndex: rIdx,
              hasRealCoordinates: true,
              cells: (row.cells || []).map((c) => ({
                ...c,
                text: repairCautiousOcrDecimals(String(c.text || '').trim()),
              })),
              text: repairCautiousOcrDecimals(String(row.text || '').trim()),
            })),
          }
        }
        if (typeof page?.text === 'string' && page.text.trim()) {
          return {
            pageIndex: pIdx,
            width: 0,
            height: 0,
            hasRealCoordinates: false,
            rows: buildRowsFromPlainText(page.text),
          }
        }
        return null
      })
      .filter(Boolean)

    if (builtPages.length > 0) {
      return { pages: builtPages, fallbackRawText: rawText }
    }
  }

  if (typeof tsvInput === 'string' && tsvInput.trim()) {
    const parsed = parseTesseractTsv(tsvInput, 0)
    const spatialRows = buildSpatialRowsFromWords(parsed.words, 0)
    if (spatialRows.length > 0) {
      return {
        pages: [
          {
            pageIndex: 0,
            width: parsed.pageWidth,
            height: parsed.pageHeight,
            hasRealCoordinates: true,
            rows: spatialRows.map((row, rIdx) => ({
              ...row,
              rowIndex: rIdx,
              hasRealCoordinates: true,
              cells: (row.cells || []).map((c) => ({
                ...c,
                text: repairCautiousOcrDecimals(String(c.text || '').trim()),
              })),
              text: repairCautiousOcrDecimals(String(row.text || '').trim()),
            })),
          },
        ],
        fallbackRawText: rawText,
      }
    }
  }

  if (Array.isArray(blocksInput) && blocksInput.length > 0) {
    const parsed = extractWordsFromBlocks(blocksInput, 0)
    const spatialRows = buildSpatialRowsFromWords(parsed.words, 0)
    if (spatialRows.length > 0) {
      return {
        pages: [
          {
            pageIndex: 0,
            width: parsed.pageWidth,
            height: parsed.pageHeight,
            hasRealCoordinates: true,
            rows: spatialRows.map((row, rIdx) => ({
              ...row,
              rowIndex: rIdx,
              hasRealCoordinates: true,
              cells: (row.cells || []).map((c) => ({
                ...c,
                text: repairCautiousOcrDecimals(String(c.text || '').trim()),
              })),
              text: repairCautiousOcrDecimals(String(row.text || '').trim()),
            })),
          },
        ],
        fallbackRawText: rawText,
      }
    }
  }

  const plainRows = buildRowsFromPlainText(rawText)
  if (plainRows.length === 0) {
    return { pages: [], fallbackRawText: '' }
  }

  return {
    pages: [
      {
        pageIndex: 0,
        width: 0,
        height: 0,
        hasRealCoordinates: false,
        rows: plainRows,
      },
    ],
    fallbackRawText: rawText,
  }
}

function cleanHeaderLabelToken(raw) {
  return String(raw || '')
    .replace(/\([^)]{1,12}\)/g, '')
    .replace(/\[[^\]]{1,12}\]/g, '')
    .replace(/^[^A-Za-z#]+|[^A-Za-z#%]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchHeaderRole(text) {
  const cleaned = cleanHeaderLabelToken(text)
  if (!cleaned) {
    return null
  }
  for (const entry of COLUMN_ROLE_PATTERNS) {
    if (entry.regex.test(cleaned)) {
      return entry.role
    }
  }
  return null
}

function expandHeaderCellRoles(cell) {
  const directRole = matchHeaderRole(cell.text)
  if (directRole) {
    return [
      {
        role: directRole,
        label: cell.text,
        x0: cell.x0,
        x1: cell.x1,
        centerX: cell.centerX,
      },
    ]
  }

  const words = Array.isArray(cell.words) && cell.words.length > 1
    ? cell.words.map((w) => ({
        text: w.text,
        x0: w.left,
        x1: w.right,
        centerX: w.centerX,
      }))
    : String(cell.text || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((tok, idx, arr) => {
          const segW = Math.max(1, (cell.x1 - cell.x0) / arr.length)
          const x0 = cell.x0 + idx * segW
          const x1 = x0 + segW
          return { text: tok, x0, x1, centerX: (x0 + x1) / 2 }
        })

  const matched = []
  let i = 0
  while (i < words.length) {
    if (i + 1 < words.length) {
      const twoWord = `${words[i].text} ${words[i + 1].text}`
      const twoRole = matchHeaderRole(twoWord)
      if (twoRole) {
        matched.push({
          role: twoRole,
          label: twoWord,
          x0: words[i].x0,
          x1: words[i + 1].x1,
          centerX: (words[i].x0 + words[i + 1].x1) / 2,
        })
        i += 2
        continue
      }
    }
    const oneRole = matchHeaderRole(words[i].text)
    if (oneRole) {
      matched.push({
        role: oneRole,
        label: words[i].text,
        x0: words[i].x0,
        x1: words[i].x1,
        centerX: words[i].centerX,
      })
    }
    i += 1
  }

  return matched
}

export function detectTableHeaderColumns(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null
  }

  let bestCandidate = null

  for (let rIdx = 0; rIdx < rows.length; rIdx += 1) {
    const row = rows[rIdx]
    const rowText = String(row.text || '')
    if (!rowText || rowText.length > 160) {
      continue
    }

    const decimalMoneyCount = (rowText.match(/\b\d[\d,]*\.\d{2}\b/g) || []).length
    if (decimalMoneyCount >= 2) {
      continue
    }

    const detectedCols = []
    for (const cell of row.cells || []) {
      const roles = expandHeaderCellRoles(cell)
      detectedCols.push(...roles)
    }

    const uniqueRoles = new Set(detectedCols.map((c) => c.role))
    const hasDescription = uniqueRoles.has('description')
    const hasQuantity = uniqueRoles.has('quantity')
    const hasRate = uniqueRoles.has('rate')
    const hasAmount = uniqueRoles.has('amount')
    const hasUnit = uniqueRoles.has('unit')

    const isHsnSummaryHeader =
      !hasDescription &&
      !hasQuantity &&
      !hasRate &&
      uniqueRoles.has('hsn') &&
      uniqueRoles.has('taxCol')

    if (isHsnSummaryHeader) {
      continue
    }

    const hasValidCore =
      (hasDescription && (hasQuantity || hasRate || hasAmount)) ||
      (hasQuantity && hasRate && hasAmount) ||
      (hasQuantity && hasUnit && (hasRate || hasAmount))

    if (!hasValidCore || uniqueRoles.size < 2) {
      continue
    }

    const score =
      uniqueRoles.size * 10 +
      (hasDescription ? 8 : 0) +
      (hasQuantity ? 6 : 0) +
      (hasUnit ? 4 : 0) +
      (hasRate ? 6 : 0) +
      (hasAmount ? 6 : 0)

    if (!bestCandidate || score > bestCandidate.score) {
      const dedupedByRole = []
      const seenRoles = new Set()
      const sortedByX = [...detectedCols].sort((a, b) => a.centerX - b.centerX)
      for (const col of sortedByX) {
        if (!seenRoles.has(col.role)) {
          seenRoles.add(col.role)
          dedupedByRole.push(col)
        }
      }

      const columnsWithBounds = dedupedByRole.map((col, idx) => {
        const prev = dedupedByRole[idx - 1]
        const next = dedupedByRole[idx + 1]
        const leftBound = prev
          ? prev.role === 'description'
            ? col.x0 - Math.max(10, (col.x0 - prev.x1) * 0.2)
            : (prev.x1 + col.x0) / 2
          : -Infinity
        const rightBound = next
          ? col.role === 'description'
            ? next.x0 - Math.max(10, (next.x0 - col.x1) * 0.2)
            : (col.x1 + next.x0) / 2
          : Infinity
        return {
          ...col,
          leftBound,
          rightBound,
        }
      })

      bestCandidate = {
        headerRowIndex: rIdx,
        headerRow: row,
        hasRealCoordinates: Boolean(row.hasRealCoordinates),
        columns: columnsWithBounds,
        roles: uniqueRoles,
        score,
      }
    }
  }

  return bestCandidate
}

export function extractSummarySegmentFromRow(rowText) {
  const clean = String(rowText || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) {
    return null
  }

  if (
    /\bhsn\s*\/?\s*sac\b/i.test(clean) &&
    /\b(?:taxable|central\s*tax|state\s*tax|cgst|sgst|total\s*tax)\b/i.test(clean)
  ) {
    return { kind: 'footer_stop', segment: clean }
  }

  const grandTotalMatch =
    /\b(?:grand\s*total|final\s*(?:bill\s*)?total|bill\s*total|invoice\s*total|net\s*(?:total|payable|amount)|amount\s*payable|total\s*(?:amount|payable|bill|value))\b.*$/i.exec(
      clean,
    ) ||
    /(?:^|\s)(total(?:\s*\((?:rs\.?|inr|₹)\))?\s*[:-]?\s*(?:rs\.?|inr|₹)?\s*(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?)$/i.exec(
      clean,
    )
  if (grandTotalMatch) {
    return {
      kind: 'grand_total',
      segment: grandTotalMatch[1] || grandTotalMatch[0],
    }
  }

  const subtotalMatch =
    /\b(?:sub\s*[- ]?total|taxable\s*(?:value|amount)|total\s*taxable(?:\s*(?:value|amount))?|items?\s*sub\s*total|goods\s*total|basic\s*(?:total|amount))\b.*$/i.exec(
      clean,
    )
  if (subtotalMatch) {
    return { kind: 'subtotal', segment: subtotalMatch[0] }
  }

  const discountMatch =
    /\b(?:less\s*[:-]?\s*)?(?:trade\s*|cash\s*|special\s*)?discount(?:\s*amount)?\b.*$/i.exec(
      clean,
    )
  if (discountMatch && !/\bdiscount\s*%\s*amount\b/i.test(clean)) {
    return { kind: 'discount', segment: discountMatch[0] }
  }

  if (!/\b(?:gstin|gst\s*(?:no|number|reg|id)|tax\s*invoice)\b/i.test(clean)) {
    const taxTotalMatch =
      /\b(?:total\s*(?:gst|tax)\b|output\s*(?:gst|tax|vat)\b|input\s*(?:gst|tax)\b|gst(?:\s*@|\s*\(|\s*amount\b|\s*\d+|\s*[:-])|tax\s*amount\b|vat(?:\s*@|\s*amount\b|\s*[:-])).*$/i.exec(
        clean,
      )
    if (taxTotalMatch && !/\btaxable\b/i.test(taxTotalMatch[0])) {
      return { kind: 'tax_total', segment: taxTotalMatch[0] }
    }

    const taxCompMatch =
      /\b(?:cgst|sgst|utgst|igst|central\s*tax|state\s*tax|integrated\s*tax|cess)\b.*$/i.exec(
        clean,
      )
    if (taxCompMatch) {
      return { kind: 'tax_component', segment: taxCompMatch[0] }
    }
  }

  const roundOffMatch = /\bround(?:ing)?\s*off\b.*$/i.exec(clean)
  if (roundOffMatch) {
    return { kind: 'round_off', segment: roundOffMatch[0] }
  }

  const chargesMatch =
    /\b(?:add\s*[:-]?\s*)?(?:freight(?:\s*charges?)?|transport(?:ation)?\s*charges?|delivery\s*charges?|shipping\s*charges?|packing(?:\s*(?:&|and)?\s*forwarding)?\s*charges?|loading(?:\s*(?:&|and)?\s*unloading)?\s*charges?|handling\s*charges?|cartage|other\s*charges?)\b.*$/i.exec(
      clean,
    ) ||
    /^(?:add\s*[:-]?\s*)?(?:freight|transport|shipping|packing|loading)\b.*$/i.exec(
      clean,
    )
  if (
    chargesMatch &&
    !/\b(?:within\s+\d+\s+days|challan|vehicle|mode|terms)\b/i.test(chargesMatch[0])
  ) {
    return { kind: 'charges', segment: chargesMatch[0] }
  }

  if (
    /\b(?:amount\s*(?:chargeable\s*)?\(?in\s*words\)?|rupees\s+[a-z\s-]+only|inr\s+[a-z\s-]+only|bank\s*details|account\s*(?:no|number)|a\/c\s*no|ifsc\s*code|ifsc\s*[:-]|terms\s*(?:&|and)?\s*conditions|declaration\b|authorized\s*signatory|authorised\s*signatory|receiver'?s?\s*signature|e\.?\s*&\s*o\.?\s*e\.?|thank\s*you\s*for)\b/i.test(
      clean,
    )
  ) {
    return { kind: 'footer_stop', segment: clean }
  }

  return null
}

export function classifySummaryOrFooterRow(rowText) {
  const match = extractSummarySegmentFromRow(rowText)
  return match ? match.kind : null
}

function detectUnitInText(text, { allowSingleLetter = true } = {}) {
  const raw = String(text || '').trim()
  if (!raw) {
    return { canonicalUnit: '', recognizedUnit: '', isCatalogUnit: false }
  }

  const lower = raw.toLowerCase().replace(/\s+/g, ' ')

  for (const key of MULTI_WORD_UNIT_KEYS) {
    const regex = new RegExp(`(?:^|[^a-z])${key.replace('.', '\\.')}(?:$|[^a-z])`, 'i')
    if (regex.test(lower)) {
      return {
        canonicalUnit: CANONICAL_UNIT_SYNONYM_MAP[key],
        recognizedUnit: CANONICAL_UNIT_SYNONYM_MAP[key],
        isCatalogUnit: true,
      }
    }
  }

  if (/(?:^|[^a-z])sq\.?\s*ft\.?(?:$|[^a-z])/i.test(lower)) {
    return {
      canonicalUnit: 'Square Feet',
      recognizedUnit: 'Square Feet',
      isCatalogUnit: true,
    }
  }
  if (/(?:^|[^a-z])r\.?\s*ft\.?(?:$|[^a-z])/i.test(lower)) {
    return {
      canonicalUnit: 'Running Feet',
      recognizedUnit: 'Running Feet',
      isCatalogUnit: true,
    }
  }

  const tokens = lower
    .replace(/[()[\],:;/-]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean)

  for (const tok of tokens) {
    const strippedNumPrefix = tok.replace(/^\d+(?:\.\d+)?(?=[a-z]{2,})/, '')
    const candidates = strippedNumPrefix !== tok ? [tok, strippedNumPrefix] : [tok]

    for (const candidate of candidates) {
      if (!allowSingleLetter && candidate.length === 1) {
        continue
      }
      if (CANONICAL_UNIT_SYNONYM_MAP[candidate]) {
        return {
          canonicalUnit: CANONICAL_UNIT_SYNONYM_MAP[candidate],
          recognizedUnit: CANONICAL_UNIT_SYNONYM_MAP[candidate],
          isCatalogUnit: true,
        }
      }
      if (EXTRA_RECOGNIZABLE_UNIT_MAP[candidate]) {
        return {
          canonicalUnit: '',
          recognizedUnit: EXTRA_RECOGNIZABLE_UNIT_MAP[candidate],
          isCatalogUnit: false,
        }
      }
    }
  }

  return { canonicalUnit: '', recognizedUnit: '', isCatalogUnit: false }
}

export function isLikelyPinCode(rawToken, numericValue, surroundingText = '') {
  const cleanDigits = String(rawToken || '').replace(/[^\d]/g, '')
  const val = Number(numericValue)
  if (!Number.isInteger(val) || val < 100000 || val > 899999) {
    return false
  }
  if (String(rawToken || '').includes('.') || String(rawToken || '').includes(',')) {
    return false
  }
  if (cleanDigits.length === 6) {
    return true
  }
  if (/[-–:]\s*[1-8]\d{5}\b/.test(surroundingText) || /\bpin(?:\s*code)?\b/i.test(surroundingText)) {
    return true
  }
  return false
}

export function isLikelyPhoneNumber(rawToken, numericValue, surroundingText = '') {
  const cleanDigits = String(rawToken || '').replace(/[^\d]/g, '')
  if (cleanDigits.length >= 10 && cleanDigits.length <= 13) {
    return true
  }
  const val = Number(numericValue)
  if (Number.isInteger(val) && val >= 6000000000 && val <= 999999999999) {
    return true
  }
  if (PHONE_NUMBER_REGEX.test(surroundingText) && cleanDigits.length >= 6) {
    return true
  }
  return false
}

export function isLikelyHsnOrIdentifierCode(rawToken, numericValue) {
  const str = String(rawToken || '').trim()
  if (str.includes('.') || str.includes(',')) {
    return false
  }
  const val = Number(numericValue)
  if (!Number.isInteger(val)) {
    return false
  }
  return /^\d{6,12}$/.test(str)
}

export function isAddressOrMetadataText(text, fullRowText = '') {
  const combined = `${text || ''} ${fullRowText || ''}`.trim()
  if (!combined) {
    return { rejected: true, reason: 'Empty row' }
  }

  for (const rx of HEADER_SKIP_PATTERNS) {
    if (rx.test(String(text || '').trim()) || rx.test(String(fullRowText || '').trim())) {
      return { rejected: true, reason: 'Invoice header or party label' }
    }
  }

  if (GSTIN_REGEX.test(combined)) {
    return { rejected: true, reason: 'Contains GSTIN tax registration identifier' }
  }

  if (/\bpan\b/i.test(combined) && PAN_REGEX.test(combined)) {
    return { rejected: true, reason: 'Contains PAN identifier' }
  }

  if (PHONE_NUMBER_REGEX.test(combined)) {
    return { rejected: true, reason: 'Contains phone or mobile number' }
  }

  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(combined)) {
    return { rejected: true, reason: 'Contains email address' }
  }

  if (ADDRESS_POSTAL_STRUCTURE_REGEX.test(combined)) {
    return { rejected: true, reason: 'Address line with postal PIN code' }
  }

  if (/[-–,\s][1-8]\d{5}(?:\b|$)/.test(combined) && ADDRESS_KEYWORDS_REGEX.test(combined)) {
    return { rejected: true, reason: 'Address line containing PIN code' }
  }

  if (/\b(?:pin\s*code|pincode|postal\s*code)\s*[:-]?\s*[1-8]\d{5}\b/i.test(combined)) {
    return { rejected: true, reason: 'Postal PIN code metadata' }
  }

  if (METADATA_LINE_REGEX.test(combined)) {
    return { rejected: true, reason: 'Invoice, tax, bank, or signatory metadata' }
  }

  const descOnly = String(text || '').trim()
  if (ADDRESS_KEYWORDS_REGEX.test(descOnly)) {
    const commaCount = (descOnly.match(/,/g) || []).length
    const hasPin = /\b[1-8]\d{5}\b/.test(combined)
    if (commaCount >= 1 || hasPin || /^(?:door|plot|shop|no\.?\s*\d|bldg|building|floor|opp|near)/i.test(descOnly)) {
      return { rejected: true, reason: 'Supplier or buyer address line' }
    }
  }

  if (
    /^[A-Za-z\s.]+,\s*[A-Za-z\s.]+(?:-\s*\d{5,6})?$/.test(descOnly) &&
    !/\b(?:wood|teak|ply|plywood|foam|fabric|leather|velvet|linen|cotton|rexine|spring|webbing|adhesive|glue|polish|lacquer|screw|nail|tack|staple|hinge|channel|leg|castor|zip|thread|lining|wadding|fiber|fibre|cushion|curtain|rod|track|hook|ring|tape|button)\b/i.test(
      descOnly,
    )
  ) {
    return { rejected: true, reason: 'Location or address phrase' }
  }

  return { rejected: false, reason: '' }
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
    /\b(\d{1,2})[\s\-/.,]+([A-Za-z]{3,9})[\s\-/.,]+(20\d{2}|\d{2})\b/.exec(line)
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
    /\b([A-Za-z]{3,9})[\s\-/.,]+(\d{1,2})[\s\-/.,]+(20\d{2}|\d{2})\b/.exec(line)
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

function extractInvoiceDateFromRows(rows) {
  for (let i = 0; i < Math.min(rows.length, 24); i += 1) {
    const line = rows[i].text
    if (/\b(?:invoice\s*date|bill\s*date|dated?|date)\b/i.test(line)) {
      const found = extractDateFromLine(line)
      if (found) {
        return { value: found, confidence: 'high' }
      }
      if (i + 1 < rows.length) {
        const nextFound = extractDateFromLine(rows[i + 1].text)
        if (nextFound) {
          return { value: nextFound, confidence: 'high' }
        }
      }
    }
  }

  for (const row of rows.slice(0, 16)) {
    const found = extractDateFromLine(row.text)
    if (found) {
      return { value: found, confidence: 'medium' }
    }
  }

  return { value: '', confidence: 'none' }
}

function extractInvoiceNumberFromRows(rows) {
  const labeledPatterns = [
    /\b(?:invoice|inv\.?|bill|cash\s*memo|tax\s*inv\.?)\s*(?:no\.?|number|#)?\s*[:-]\s*([A-Z0-9][A-Z0-9/_-]{1,30})/i,
    /\b(?:invoice|inv\.?|bill|cash\s*memo)\s*(?:no\.?|number|#)\s*[:-]?\s*([A-Z0-9][A-Z0-9/_-]{1,30})/i,
    /\b(?:ref|voucher)\s*(?:no\.?|#)\s*[:-]?\s*([A-Z0-9][A-Z0-9/_-]{1,30})/i,
  ]

  for (let i = 0; i < Math.min(rows.length, 24); i += 1) {
    const row = rows[i]
    const segments = [
      ...(row.cells || []).map((c) => c.text),
      row.text,
    ]

    for (const segment of segments) {
      for (const pattern of labeledPatterns) {
        const match = pattern.exec(segment)
        if (match && match[1]) {
          const candidate = match[1].replace(/[.,;:]+$/, '').trim()
          if (
            candidate.length >= 2 &&
            !/^(?:date|dated|gst|gstin|pan|tax|to|no|number)$/i.test(candidate) &&
            /\d/.test(candidate) &&
            !extractDateFromLine(candidate)
          ) {
            return { value: candidate, confidence: 'high' }
          }
        }
      }
    }

    for (const cell of row.cells || []) {
      if (
        /^(?:invoice|inv\.?|bill)\s*(?:no\.?|number|#)$/i.test(
          cell.text.trim(),
        ) &&
        i + 1 < rows.length
      ) {
        const nextRow = rows[i + 1]
        const aligned = (nextRow.cells || []).find(
          (nc) => Math.abs(nc.centerX - cell.centerX) <= Math.max(80, cell.width),
        )
        const candidate = String(aligned?.text || '').trim()
        if (
          /^[A-Z0-9][A-Z0-9/_-]{1,28}$/i.test(candidate) &&
          /\d/.test(candidate) &&
          !extractDateFromLine(candidate)
        ) {
          return { value: candidate, confidence: 'high' }
        }
      }
    }
  }

  return { value: '', confidence: 'none' }
}

function extractSupplierNameFromRows(rows, headerLimitIdx) {
  const topRows = rows.slice(0, Math.min(headerLimitIdx, 16))

  for (const row of topRows) {
    for (const segment of [...(row.cells || []).map((c) => c.text), row.text]) {
      const labeled =
        /^(?:supplier|vendor|seller|sold\s*by|from|m\/s\.?)\s*[:-]?\s*(.+)$/i.exec(
          segment.trim(),
        )
      if (labeled && labeled[1]) {
        const cleaned = labeled[1]
          .replace(/\b(?:gstin|invoice|inv\s*no|bill\s*no|date|dated|mob|tel|ph|phone)\b.*$/i, '')
          .trim()
        if (
          cleaned.length >= 3 &&
          cleaned.length <= 90 &&
          !/soft\s*touch\s*sofas/i.test(cleaned) &&
          !isAddressOrMetadataText(cleaned).rejected
        ) {
          return { value: cleaned, confidence: 'high' }
        }
      }
    }
  }

  let insideBuyerBlock = false
  for (const row of topRows.slice(0, 10)) {
    const leftCellText =
      row.cells && row.cells.length > 1 ? row.cells[0].text : row.text
    const candidateLine = String(leftCellText || '')
      .replace(/\b(?:invoice\s*(?:no|date|#)|inv\.?\s*no|bill\s*no|dated?|gstin)\b.*$/i, '')
      .trim()

    if (!candidateLine) {
      continue
    }

    if (/^(?:bill\s*to|billed\s*to|ship\s*to|buyer|customer|consignee)\b/i.test(candidateLine)) {
      insideBuyerBlock = true
      continue
    }
    if (insideBuyerBlock) {
      continue
    }
    if (HEADER_SKIP_PATTERNS.some((rx) => rx.test(candidateLine))) {
      continue
    }
    if (isAddressOrMetadataText(candidateLine).rejected) {
      continue
    }
    if (classifySummaryOrFooterRow(candidateLine)) {
      continue
    }

    const alphaCount = (candidateLine.match(/[A-Za-z]/g) || []).length
    const digitCount = (candidateLine.match(/\d/g) || []).length
    if (alphaCount >= 4 && digitCount <= 4 && candidateLine.length <= 85) {
      const cleaned = candidateLine
        .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.)&]+$/g, '')
        .trim()
      if (cleaned.length >= 3 && !/soft\s*touch\s*sofas/i.test(cleaned)) {
        const hasBusinessHint =
          /\b(?:traders|trading|timber|woods?|veneers?|fabrics?|textiles?|furnishings?|foams?|hardware|enterprises?|agency|agencies|mart|house|co\.?|llp|pvt|ltd|corp|store|mills?|ply|plywood|upholstery|drapery|industries|exports|imports|associates|suppliers)\b/i.test(
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

function extractLastMonetaryAmountOnRow(rowText, { allowUnformattedSixDigit = false } = {}) {
  const withoutPercentages = repairCautiousOcrDecimals(String(rowText || ''))
    .replace(/\b\d+(?:\.\d+)?\s*%/g, ' ')
    .replace(/\(\s*\d+(?:\.\d+)?\s*%\s*\)/g, ' ')
    .replace(/@\s*\d+(?:\.\d+)?\b/g, ' ')

  const matches = withoutPercentages.match(
    /(?:Rs\.?\s*|INR\s*)?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,3})?/gi,
  )
  if (!matches || matches.length === 0) {
    return null
  }

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const raw = matches[i].trim()
    const val = parseCleanNumber(raw)
    if (val === null || val < 0) {
      continue
    }
    if (isLikelyPhoneNumber(raw, val, withoutPercentages)) {
      continue
    }
    if (!allowUnformattedSixDigit && isLikelyPinCode(raw, val, withoutPercentages)) {
      continue
    }
    return roundMoney(val)
  }

  return null
}

function extractSummaryAmountsFromRows(rows, startIdx = 0) {
  let discountAmount = 0
  let componentTaxSum = 0
  let explicitTotalTax = null
  let otherCharges = 0
  let detectedSubtotal = null
  let detectedGrandTotal = null
  let passedGrandTotal = false
  let seenHsnSummaryTable = false

  const scanRows = rows.slice(Math.max(0, startIdx))

  for (const row of scanRows) {
    const summaryInfo = extractSummarySegmentFromRow(row.text)
    if (!summaryInfo) {
      continue
    }

    const { kind, segment } = summaryInfo

    if (kind === 'footer_stop') {
      if (passedGrandTotal) {
        break
      }
      if (/\bhsn\s*\/?\s*sac\b/i.test(row.text)) {
        seenHsnSummaryTable = true
      }
      continue
    }

    if (
      seenHsnSummaryTable &&
      kind === 'grand_total' &&
      /^total(?:\s*\(|[:-]|\s+\d)/i.test(segment.trim())
    ) {
      continue
    }

    if (
      passedGrandTotal &&
      (kind === 'subtotal' || kind === 'tax_component' || kind === 'tax_total')
    ) {
      continue
    }

    const amt = extractLastMonetaryAmountOnRow(segment, {
      allowUnformattedSixDigit: true,
    })
    if (amt === null) {
      continue
    }

    if (kind === 'subtotal' && amt > 0) {
      detectedSubtotal = amt
      continue
    }

    if (kind === 'discount' && amt > 0) {
      discountAmount = roundMoney(discountAmount + amt)
      continue
    }

    if (kind === 'tax_component' && amt > 0) {
      componentTaxSum = roundMoney(componentTaxSum + amt)
      continue
    }

    if (kind === 'tax_total' && amt > 0) {
      explicitTotalTax = amt
      continue
    }

    if (kind === 'charges' && amt > 0) {
      otherCharges = roundMoney(otherCharges + amt)
      continue
    }

    if (kind === 'grand_total' && amt > 0) {
      detectedGrandTotal = amt
      passedGrandTotal = true
    }
  }

  let taxAmount
  if (explicitTotalTax !== null && componentTaxSum > 0) {
    if (Math.abs(explicitTotalTax - componentTaxSum) <= Math.max(2, explicitTotalTax * 0.03)) {
      taxAmount = explicitTotalTax
    } else if (
      detectedSubtotal !== null &&
      detectedGrandTotal !== null &&
      Math.abs(detectedSubtotal - discountAmount + explicitTotalTax + otherCharges - detectedGrandTotal) <= 2
    ) {
      taxAmount = explicitTotalTax
    } else {
      taxAmount = componentTaxSum
    }
  } else if (explicitTotalTax !== null) {
    taxAmount = explicitTotalTax
  } else {
    taxAmount = componentTaxSum
  }

  return {
    discountAmount,
    taxAmount,
    otherCharges,
    detectedSubtotal,
    detectedGrandTotal,
  }
}

function tokenizeDescription(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (tok) =>
        tok.length >= 2 &&
        !STOP_WORDS.has(tok) &&
        !CANONICAL_UNIT_SYNONYM_MAP[tok] &&
        !EXTRA_RECOGNIZABLE_UNIT_MAP[tok],
    )
}

export function matchDescriptionToRawMaterials(
  description,
  secondArg = '',
  thirdArg = [],
) {
  const detectedUnit = Array.isArray(secondArg)
    ? String(thirdArg || '')
    : String(secondArg || '')
  const rawMaterials = Array.isArray(secondArg)
    ? secondArg
    : Array.isArray(thirdArg)
      ? thirdArg
      : []
  const activeMaterials = rawMaterials.filter((m) => m && m.isActive !== false)
  if (!description || activeMaterials.length === 0) {
    return {
      autoMappedMaterialId: '',
      matchedMaterialId: '',
      confidence: 'none',
      suggestions: [],
    }
  }

  const cleanDesc = String(description).trim().toLowerCase()
  const descTokens = tokenizeDescription(description)
  if (descTokens.length === 0) {
    return {
      autoMappedMaterialId: '',
      matchedMaterialId: '',
      confidence: 'none',
      suggestions: [],
    }
  }

  const normalizeCatalogUnitName = (u) => {
    const raw = String(u || '').trim()
    if (!raw) return ''
    const lower = raw.toLowerCase()
    if (CANONICAL_UNIT_SYNONYM_MAP[lower]) {
      return CANONICAL_UNIT_SYNONYM_MAP[lower]
    }
    const matchedVal = Object.values(CANONICAL_UNIT_SYNONYM_MAP).find(
      (val) => val.toLowerCase() === lower,
    )
    return matchedVal || raw
  }

  const normalizedDetectedUnit = normalizeCatalogUnitName(detectedUnit)
  const isCatalogUnit = Boolean(
    normalizedDetectedUnit &&
      Object.values(CANONICAL_UNIT_SYNONYM_MAP).includes(normalizedDetectedUnit),
  )

  const scored = activeMaterials
    .map((mat) => {
      const matUnitCanonical = normalizeCatalogUnitName(mat.unit)
      const matNameLower = String(mat.name || '').trim().toLowerCase()
      const matTokens = tokenizeDescription(mat.name)
      if (matTokens.length === 0) {
        return { material: mat, score: 0, matchedTokens: 0, matTokenCount: 0 }
      }

      if (cleanDesc === matNameLower) {
        const unitMatches =
          !isCatalogUnit || normalizedDetectedUnit === matUnitCanonical
        return {
          material: mat,
          score: unitMatches ? 1 : 0.62,
          matchedTokens: matTokens.length,
          matTokenCount: matTokens.length,
        }
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

      if (matchedMatTokens === 0) {
        return { material: mat, score: 0, matchedTokens: 0, matTokenCount: matTokens.length }
      }

      const recallOnMaterial = matchedMatTokens / matTokens.length
      const precisionOnDesc = matchedMatTokens / Math.max(descTokens.length, 1)
      let score = recallOnMaterial * 0.68 + precisionOnDesc * 0.32

      if (
        matNameLower.length >= 6 &&
        (cleanDesc.includes(matNameLower) || matNameLower.includes(cleanDesc)) &&
        matchedMatTokens >= Math.min(2, matTokens.length)
      ) {
        score = Math.max(score, 0.88)
      }

      if (isCatalogUnit) {
        if (normalizedDetectedUnit === matUnitCanonical) {
          score += 0.06
        } else {
          score -= 0.35
        }
      }

      return {
        material: mat,
        score: Math.max(0, Math.min(1, Math.round(score * 100) / 100)),
        matchedTokens: matchedMatTokens,
        matTokenCount: matTokens.length,
      }
    })
    .filter((entry) => entry.score >= 0.45)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return {
      autoMappedMaterialId: '',
      matchedMaterialId: '',
      confidence: 'none',
      suggestions: [],
    }
  }

  const top = scored[0]
  const runnerUp = scored[1]
  const hasClearMargin = !runnerUp || top.score - runnerUp.score >= 0.18
  const topMatUnitCanonical = normalizeCatalogUnitName(top.material.unit)
  const unitCompatible =
    !isCatalogUnit ||
    !normalizedDetectedUnit ||
    normalizedDetectedUnit === topMatUnitCanonical
  const enoughTokenEvidence =
    top.matTokenCount <= 1 ? top.score >= 0.94 : top.matchedTokens >= 2

  if (top.score >= 0.9 && hasClearMargin && unitCompatible && enoughTokenEvidence) {
    return {
      autoMappedMaterialId: top.material.id,
      matchedMaterialId: top.material.id,
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
    matchedMaterialId: '',
    confidence: 'review',
    suggestions: scored.slice(0, 3).map((s) => ({
      id: s.material.id,
      name: s.material.name,
      unit: s.material.unit,
      score: s.score,
    })),
  }
}

function isLineMathConsistent(quantity, unitPrice, lineAmount, limits) {
  const expected = roundMoney(quantity * unitPrice)
  const diff = Math.abs(expected - lineAmount)
  const tolerance = Math.max(
    limits.lineMathAbsoluteTolerance,
    expected * limits.lineMathRelativeTolerance,
  )
  return {
    consistent: diff <= tolerance,
    expected,
    diff: roundMoney(diff),
  }
}

function extractNumericTokensFromSegment(text) {
  const cleanText = repairCautiousOcrDecimals(String(text || ''))
  const tokenRegex =
    /(?:Rs\.?\s*|INR\s*)?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,3})?%?/gi
  const results = []
  let match = tokenRegex.exec(cleanText)

  while (match !== null) {
    const raw = match[0].trim()
    const startIdx = match.index
    const endIdx = startIdx + match[0].length
    const beforeChar = startIdx > 0 ? cleanText[startIdx - 1] : ' '
    const afterSlice = cleanText.slice(endIdx, endIdx + 6)

    const isPercentage = raw.endsWith('%') || /^\s*%/.test(afterSlice)
    const isSpecToken =
      !raw.includes('.') &&
      !raw.includes(',') &&
      (/[A-Za-z/-]/.test(beforeChar) ||
        /^(?:mm|cm|in|inch|d|gsm|ply|ga|swg|x\d)\b/i.test(afterSlice))

    if (!isPercentage && !isSpecToken) {
      const value = parseCleanNumber(raw)
      if (value !== null) {
        results.push({
          raw,
          value,
          index: startIdx,
        })
      }
    }

    match = tokenRegex.exec(cleanText)
  }

  return results
}

function solveQuantityRateAmount(numericTokens, limits, rowText) {
  const usable = numericTokens.filter(
    (tok) =>
      tok.value > 0 &&
      !isLikelyPhoneNumber(tok.raw, tok.value, rowText) &&
      !isLikelyPinCode(tok.raw, tok.value, rowText),
  )

  if (usable.length < 3) {
    return {
      matched: false,
      usable,
    }
  }

  for (let i = 0; i <= usable.length - 3; i += 1) {
    for (let j = i + 1; j <= usable.length - 2; j += 1) {
      for (let k = j + 1; k <= usable.length - 1; k += 1) {
        const qTok = usable[i]
        const rTok = usable[j]
        const aTok = usable[k]

        if (
          i === 0 &&
          usable.length >= 4 &&
          !qTok.raw.includes('.') &&
          !qTok.raw.includes(',') &&
          /^\d{4,8}$/.test(qTok.raw.replace(/[^\d]/g, '')) &&
          qTok.value >= 1000
        ) {
          continue
        }

        if (
          qTok.value < limits.minQuantity ||
          qTok.value > limits.maxQuantity ||
          isLikelyHsnOrIdentifierCode(qTok.raw, qTok.value)
        ) {
          continue
        }

        if (
          rTok.value < limits.minUnitPrice ||
          rTok.value > limits.maxUnitPrice
        ) {
          continue
        }

        if (
          aTok.value < limits.minLineAmount ||
          aTok.value > limits.maxLineAmount
        ) {
          continue
        }

        const mathCheck = isLineMathConsistent(
          qTok.value,
          rTok.value,
          aTok.value,
          limits,
        )
        if (mathCheck.consistent) {
          return {
            matched: true,
            quantityToken: qTok,
            rateToken: rTok,
            amountToken: aTok,
            expectedAmount: mathCheck.expected,
          }
        }
      }
    }
  }

  return {
    matched: false,
    usable,
  }
}

function assignCellToHeaderColumn(cell, headerColumns) {
  if (!headerColumns || !Array.isArray(headerColumns.columns)) {
    return null
  }

  const descCol = headerColumns.columns.find((c) => c.role === 'description')
  if (descCol) {
    const cellText = String(cell.text || '').trim()
    const alphaCount = (cellText.match(/[A-Za-z]/g) || []).length
    const isUnitOnly =
      Boolean(detectUnitInText(cellText, { allowSingleLetter: true }).recognizedUnit) &&
      cellText.replace(/[^A-Za-z.]/g, '').length <= 8
    const hasNumeric = extractNumericTokensFromSegment(cellText).length > 0

    if (
      alphaCount >= 3 &&
      !isUnitOnly &&
      !hasNumeric &&
      cell.x0 <= descCol.rightBound + 24
    ) {
      return 'description'
    }
  }

  for (const col of headerColumns.columns) {
    if (cell.centerX >= col.leftBound && cell.centerX < col.rightBound) {
      return col.role
    }
  }
  return null
}

function cleanDescriptionText(rawDesc) {
  return String(rawDesc || '')
    .replace(/^\s*(?:0?[1-9]|[1-9]\d)\s*(?:[.)|-]\s+|\s+(?=[A-Za-z]))/, '')
    .replace(/\b(?:Rs\.?|INR)\b/gi, '')
    .replace(/^[|¦:.-]+|[|¦:.-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractCandidateFromRow(row, headerMeta, limits) {
  const fullRowText = String(row.text || '').trim()
  if (!fullRowText || fullRowText.length < 4) {
    return null
  }

  if (classifySummaryOrFooterRow(fullRowText)) {
    return null
  }

  if (detectTableHeaderColumns([row])) {
    return null
  }

  if (headerMeta && headerMeta.hasRealCoordinates && Array.isArray(row.cells) && row.cells.length >= 2) {
    const buckets = {
      serial: [],
      description: [],
      hsn: [],
      quantity: [],
      unit: [],
      rate: [],
      discountCol: [],
      taxCol: [],
      amount: [],
    }

    for (const cell of row.cells) {
      const role = assignCellToHeaderColumn(cell, headerMeta)
      if (role && buckets[role]) {
        buckets[role].push(cell)
      }
    }

    const rawDescFromBucket = cleanDescriptionText(
      buckets.description.map((c) => c.text).join(' '),
    )

    if (
      rawDescFromBucket &&
      buckets.quantity.length === 0 &&
      buckets.rate.length === 0 &&
      buckets.amount.length === 0 &&
      extractNumericTokensFromSegment(fullRowText).length === 0
    ) {
      return {
        isContinuationOnly: true,
        continuationText: rawDescFromBucket,
      }
    }

    if (rawDescFromBucket) {
      const qtyText = buckets.quantity.map((c) => c.text).join(' ')
      const unitText = buckets.unit.map((c) => c.text).join(' ')
      const rateText = buckets.rate.map((c) => c.text).join(' ')
      const amountText = buckets.amount.map((c) => c.text).join(' ')

      const qtyNums = extractNumericTokensFromSegment(qtyText)
      const rateNums = extractNumericTokensFromSegment(rateText)
      const amountNums = extractNumericTokensFromSegment(amountText)

      let unitDetection = detectUnitInText(unitText, { allowSingleLetter: true })
      if (!unitDetection.recognizedUnit) {
        unitDetection = detectUnitInText(qtyText, { allowSingleLetter: true })
      }
      if (!unitDetection.recognizedUnit) {
        const postDescText = row.cells
          .filter((c) => assignCellToHeaderColumn(c, headerMeta) !== 'description')
          .map((c) => c.text)
          .join(' ')
        unitDetection = detectUnitInText(postDescText, { allowSingleLetter: false })
      }
      if (!unitDetection.recognizedUnit) {
        unitDetection = detectUnitInText(rawDescFromBucket, { allowSingleLetter: false })
      }

      if (qtyNums.length >= 1 && rateNums.length >= 1 && amountNums.length >= 1) {
        return {
          rawRowText: fullRowText,
          extractedDescription: rawDescFromBucket,
          detectedUnit: unitDetection.canonicalUnit || unitDetection.recognizedUnit,
          isCatalogUnit: unitDetection.isCatalogUnit,
          quantityToken: qtyNums[0],
          rateToken: rateNums[rateNums.length - 1],
          amountToken: amountNums[amountNums.length - 1],
          fromAnchoredColumns: true,
        }
      }

      const rightSideCells = row.cells.filter((cell) => {
        const role = assignCellToHeaderColumn(cell, headerMeta)
        return role !== 'serial' && role !== 'description' && role !== 'hsn' && role !== 'taxCol'
      })
      const rightSideNums = extractNumericTokensFromSegment(
        rightSideCells.map((c) => c.text).join('   '),
      )
      const solved = solveQuantityRateAmount(rightSideNums, limits, fullRowText)
      if (solved.matched) {
        return {
          rawRowText: fullRowText,
          extractedDescription: rawDescFromBucket,
          detectedUnit: unitDetection.canonicalUnit || unitDetection.recognizedUnit,
          isCatalogUnit: unitDetection.isCatalogUnit,
          quantityToken: solved.quantityToken,
          rateToken: solved.rateToken,
          amountToken: solved.amountToken,
          fromAnchoredColumns: true,
        }
      }

      return {
        rawRowText: fullRowText,
        extractedDescription: rawDescFromBucket,
        detectedUnit: unitDetection.canonicalUnit || unitDetection.recognizedUnit,
        isCatalogUnit: unitDetection.isCatalogUnit,
        quantityToken: qtyNums[0] || rightSideNums[0] || null,
        rateToken: rateNums[0] || rightSideNums[1] || null,
        amountToken: amountNums[0] || rightSideNums[2] || null,
        fromAnchoredColumns: true,
      }
    }
  }

  const cells = Array.isArray(row.cells) && row.cells.length > 0
    ? row.cells.map((c) => c.text.trim()).filter(Boolean)
    : [fullRowText]

  if (cells.length >= 3) {
    let startCellIdx = 0
    if (/^(?:0?[1-9]|[1-9]\d)[.)]?$/.test(cells[0]) && /[A-Za-z]{2,}/.test(cells[1])) {
      startCellIdx = 1
    }

    const descCells = []
    let tailStartIdx = startCellIdx
    for (let cIdx = startCellIdx; cIdx < cells.length; cIdx += 1) {
      const cText = cells[cIdx]
      const alphaCount = (cText.match(/[A-Za-z]/g) || []).length
      const unitCheck = detectUnitInText(cText, { allowSingleLetter: true })
      const isPureUnitCell =
        unitCheck.recognizedUnit &&
        cText.replace(/[^A-Za-z.]/g, '').length <= 8 &&
        descCells.length > 0
      const isPureNumericOrMoney =
        extractNumericTokensFromSegment(cText).length > 0 && alphaCount <= 3 && !/[A-Za-z]{4,}/.test(cText)

      if (descCells.length === 0) {
        descCells.push(cText)
        tailStartIdx = cIdx + 1
      } else if (!isPureUnitCell && !isPureNumericOrMoney && alphaCount >= 3 && cIdx < cells.length - 2) {
        descCells.push(cText)
        tailStartIdx = cIdx + 1
      } else {
        break
      }
    }

    const descText = cleanDescriptionText(descCells.join(' '))
    const tailText = cells.slice(tailStartIdx).join('   ')
    let unitInfo = detectUnitInText(tailText, { allowSingleLetter: true })
    if (!unitInfo.recognizedUnit) {
      unitInfo = detectUnitInText(descText, { allowSingleLetter: false })
    }

    const tailNumbers = extractNumericTokensFromSegment(tailText)
    const solved = solveQuantityRateAmount(tailNumbers, limits, fullRowText)
    if (solved.matched) {
      return {
        rawRowText: fullRowText,
        extractedDescription: descText,
        detectedUnit: unitInfo.canonicalUnit || unitInfo.recognizedUnit,
        isCatalogUnit: unitInfo.isCatalogUnit,
        quantityToken: solved.quantityToken,
        rateToken: solved.rateToken,
        amountToken: solved.amountToken,
        fromAnchoredColumns: false,
      }
    }

    if ((descText.match(/[A-Za-z]/g) || []).length >= 3 && tailNumbers.length > 0) {
      const filteredTail = tailNumbers.filter(
        (t, idx) =>
          !(
            idx === 0 &&
            tailNumbers.length >= 4 &&
            !t.raw.includes('.') &&
            /^\d{4,8}$/.test(t.raw.replace(/[^\d]/g, ''))
          ),
      )
      return {
        rawRowText: fullRowText,
        extractedDescription: descText,
        detectedUnit: unitInfo.canonicalUnit || unitInfo.recognizedUnit,
        isCatalogUnit: unitInfo.isCatalogUnit,
        quantityToken: filteredTail[0] || null,
        rateToken: filteredTail[1] || null,
        amountToken: filteredTail[2] || null,
        fromAnchoredColumns: false,
      }
    }
  }

  const strippedLine = cleanDescriptionText(fullRowText)
  const allNumbers = extractNumericTokensFromSegment(strippedLine)
  if (allNumbers.length === 0) {
    if (headerMeta && (strippedLine.match(/[A-Za-z]/g) || []).length >= 4) {
      return {
        isContinuationOnly: true,
        continuationText: strippedLine,
      }
    }
    return null
  }

  const solvedInline = solveQuantityRateAmount(allNumbers, limits, fullRowText)
  const cutIndex = solvedInline.matched
    ? solvedInline.quantityToken.index
    : allNumbers[0].index

  let inlineDesc = cleanDescriptionText(strippedLine.slice(0, cutIndex))
  inlineDesc = inlineDesc.replace(/\b\d{4,8}\s*$/, '').trim()

  const inlineTail = strippedLine.slice(cutIndex)
  let inlineUnit = detectUnitInText(inlineTail, { allowSingleLetter: true })
  if (!inlineUnit.recognizedUnit) {
    inlineUnit = detectUnitInText(inlineDesc, { allowSingleLetter: false })
  }

  return {
    rawRowText: fullRowText,
    extractedDescription: inlineDesc,
    detectedUnit: inlineUnit.canonicalUnit || inlineUnit.recognizedUnit,
    isCatalogUnit: inlineUnit.isCatalogUnit,
    quantityToken: solvedInline.matched
      ? solvedInline.quantityToken
      : allNumbers[0] || null,
    rateToken: solvedInline.matched
      ? solvedInline.rateToken
      : allNumbers[1] || null,
    amountToken: solvedInline.matched
      ? solvedInline.amountToken
      : allNumbers[2] || null,
    fromAnchoredColumns: false,
  }
}

function normalizeCandidateInput(input) {
  if (!input || typeof input !== 'object') {
    return null
  }
  if (
    'quantityToken' in input ||
    'rateToken' in input ||
    'amountToken' in input ||
    'isContinuationOnly' in input
  ) {
    return input
  }

  const unitInfo = input.unit
    ? detectUnitInText(String(input.unit), { allowSingleLetter: true })
    : { canonicalUnit: '', recognizedUnit: '', isCatalogUnit: false }
  const resolvedUnit =
    input.unitRecognized === false
      ? ''
      : unitInfo.canonicalUnit || unitInfo.recognizedUnit || String(input.unit || '')
  const isCatalogUnit =
    Boolean(unitInfo.isCatalogUnit) ||
    Object.values(CANONICAL_UNIT_SYNONYM_MAP).includes(resolvedUnit)

  const makeTok = (val, raw) => {
    if (val === null || val === undefined || val === '') {
      return null
    }
    const num = Number(val)
    if (!Number.isFinite(num)) {
      return null
    }
    return {
      value: num,
      raw: raw !== undefined ? String(raw) : String(val),
    }
  }

  return {
    rawRowText: String(input.rawRowText || input.description || ''),
    extractedDescription: String(
      input.extractedDescription || input.description || '',
    ),
    detectedUnit: resolvedUnit,
    isCatalogUnit,
    quantityToken: makeTok(input.quantity, input.rawQuantity),
    rateToken: makeTok(input.unitPrice, input.rawUnitPrice),
    amountToken: makeTok(input.lineAmount, input.rawLineAmount),
  }
}

export function validateCandidateLineItem(
  candidateInput,
  rawMaterials = [],
  { limits = DEFAULT_OCR_VALIDATION_LIMITS, insideConfirmedTable = false } = {},
) {
  const candidate = normalizeCandidateInput(candidateInput)
  if (!candidate || candidate.isContinuationOnly) {
    return {
      valid: false,
      status: 'rejected',
      failureCodes: ['empty_or_continuation'],
      reasons: ['Continuation or empty row'],
    }
  }

  const desc = String(candidate.extractedDescription || '').trim()
  const rawRow = String(candidate.rawRowText || '').trim()

  const nonItemCheck = isAddressOrMetadataText(desc, rawRow)
  if (nonItemCheck.rejected) {
    return {
      valid: false,
      status: 'rejected',
      failureCodes: ['address_or_metadata'],
      reasons: [nonItemCheck.reason],
    }
  }

  if (classifySummaryOrFooterRow(rawRow) || classifySummaryOrFooterRow(desc)) {
    return {
      valid: false,
      status: 'rejected',
      failureCodes: ['summary_row'],
      reasons: ['Summary or total row'],
    }
  }

  const alphaLetters = (desc.match(/[A-Za-z]/g) || []).length
  if (alphaLetters < 3) {
    return {
      valid: false,
      status: 'rejected',
      failureCodes: ['invalid_description'],
      reasons: ['Missing plausible material description'],
    }
  }

  if (extractDateFromLine(rawRow) && !insideConfirmedTable) {
    return {
      valid: false,
      status: 'rejected',
      failureCodes: ['date_row'],
      reasons: ['Row contains invoice/document date'],
    }
  }

  const reasons = []
  const failureCodes = []
  const qTok = candidate.quantityToken
  const rTok = candidate.rateToken
  const aTok = candidate.amountToken

  const qty = qTok ? roundQuantity(qTok.value) : null
  const rate = rTok ? roundMoney(rTok.value) : null
  const amount = aTok ? roundMoney(aTok.value) : null

  if (qTok && isLikelyPinCode(qTok.raw, qTok.value, rawRow)) {
    return {
      valid: false,
      status: 'rejected',
      failureCodes: ['pin_code_quantity'],
      reasons: [`Quantity '${qTok.raw}' looks like a 6-digit PIN code`],
    }
  }
  if (qTok && isLikelyPhoneNumber(qTok.raw, qTok.value, rawRow)) {
    return {
      valid: false,
      status: 'rejected',
      failureCodes: ['phone_number_quantity'],
      reasons: [`Quantity '${qTok.raw}' looks like a phone number`],
    }
  }
  if (qTok && isLikelyHsnOrIdentifierCode(qTok.raw, qTok.value)) {
    return {
      valid: false,
      status: 'rejected',
      failureCodes: ['hsn_or_identifier_quantity'],
      reasons: [`Quantity '${qTok.raw}' looks like an HSN or document identifier`],
    }
  }

  if (qty === null || qty <= 0) {
    failureCodes.push('missing_quantity')
    reasons.push('Missing valid numeric quantity')
  } else if (qty < limits.minQuantity || qty > limits.maxQuantity) {
    failureCodes.push('quantity_out_of_bounds')
    reasons.push(
      `Quantity (${qty}) is outside plausible bounds (${limits.minQuantity}–${limits.maxQuantity})`,
    )
  }

  if (!candidate.detectedUnit) {
    failureCodes.push('missing_unit')
    reasons.push('Missing recognizable purchase unit')
  }

  if (rate === null || rate <= 0) {
    failureCodes.push('missing_unit_price')
    reasons.push('Missing valid unit price')
  } else if (rate < limits.minUnitPrice || rate > limits.maxUnitPrice) {
    failureCodes.push('unit_price_out_of_bounds')
    reasons.push(
      `Unit price (${rate}) is outside plausible bounds (${limits.minUnitPrice}–${limits.maxUnitPrice})`,
    )
  }

  if (amount === null || amount <= 0) {
    failureCodes.push('missing_line_amount')
    reasons.push('Missing extracted line amount to verify quantity × unit price')
  } else if (amount < limits.minLineAmount || amount > limits.maxLineAmount) {
    failureCodes.push('line_amount_out_of_bounds')
    reasons.push(`Line amount (${amount}) is outside plausible bounds`)
  }

  if (qty !== null && qty > 0 && rate !== null && rate > 0 && amount !== null && amount > 0) {
    const mathCheck = isLineMathConsistent(qty, rate, amount, limits)
    if (!mathCheck.consistent) {
      failureCodes.push('amount_mismatch')
      reasons.push(
        `Quantity (${qty}) × Unit Price (${rate}) = ${mathCheck.expected.toFixed(2)} does not reconcile with line amount ${amount.toFixed(2)}`,
      )
    }
  }

  if (reasons.length > 0) {
    if (!insideConfirmedTable && !candidate.detectedUnit) {
      return { valid: false, status: 'rejected', failureCodes, reasons }
    }

    const uncertainMatch = matchDescriptionToRawMaterials(
      desc,
      candidate.isCatalogUnit ? candidate.detectedUnit : '',
      rawMaterials,
    )
    const safeQty =
      qty !== null && qty > 0 && qty <= limits.maxQuantity ? String(qty) : ''
    const safeRate =
      rate !== null && rate > 0 && rate <= limits.maxUnitPrice
        ? String(rate)
        : ''
    const safeAmount = amount !== null && amount > 0 ? amount : null

    return {
      valid: false,
      status: 'uncertain',
      failureCodes,
      reasons,
      uncertainItem: {
        rawRowText: rawRow,
        rawText: rawRow,
        extractedDescription: desc,
        detectedUnit: candidate.detectedUnit || '',
        quantity: safeQty,
        unitPrice: safeRate,
        lineAmount: safeAmount,
        candidateQuantity: safeQty,
        candidateUnitPrice: safeRate,
        candidateAmount: safeAmount,
        validationReasons: reasons,
        reasons,
        suggestions: uncertainMatch.suggestions,
      },
    }
  }

  const materialMatch = matchDescriptionToRawMaterials(
    desc,
    candidate.isCatalogUnit ? candidate.detectedUnit : '',
    rawMaterials,
  )

  return {
    valid: true,
    status: 'valid',
    failureCodes: [],
    reasons: [],
    lineItem: {
      extractedDescription: desc,
      detectedUnit: candidate.detectedUnit,
      isCatalogUnit: Boolean(candidate.isCatalogUnit),
      quantity: String(qty),
      unitPrice: String(rate),
      detectedLineTotal: amount,
      validatedLineTotal: roundMoney(qty * rate),
      materialId: materialMatch.autoMappedMaterialId,
      matchConfidence: materialMatch.confidence,
      suggestions: materialMatch.suggestions,
      needsReview: true,
    },
  }
}

export function reconcileInvoiceTotals(params = {}) {
  const {
    validatedLineItems,
    summary = {},
    calculatedSubtotal: directCalculatedSubtotal,
    printedSubtotal: directPrintedSubtotal,
    discountAmount: directDiscount,
    taxAmount: directTax,
    otherCharges: directOtherCharges,
    printedFinalTotal: directPrintedFinalTotal,
    limits = DEFAULT_OCR_VALIDATION_LIMITS,
  } = params

  const tolerance = limits.totalsReconciliationTolerance ?? 1.0
  const usingLineItems = Array.isArray(validatedLineItems)

  const calculatedSubtotal = usingLineItems
    ? roundMoney(
        validatedLineItems.reduce(
          (sum, item) =>
            sum +
            roundMoney(
              Number(item.quantity || 0) * Number(item.unitPrice || 0),
            ),
          0,
        ),
      )
    : roundMoney(Number(directCalculatedSubtotal || 0))

  const hasValidatedItems = usingLineItems
    ? validatedLineItems.length > 0
    : calculatedSubtotal > 0

  const rawPrintedSub =
    directPrintedSubtotal !== undefined
      ? directPrintedSubtotal
      : summary.detectedSubtotal
  const printedSubtotal =
    typeof rawPrintedSub === 'number' && rawPrintedSub > 0
      ? roundMoney(rawPrintedSub)
      : null

  const discount = roundMoney(
    directDiscount !== undefined
      ? Number(directDiscount || 0)
      : Number(summary.discountAmount || 0),
  )
  const tax = roundMoney(
    directTax !== undefined
      ? Number(directTax || 0)
      : Number(summary.taxAmount || 0),
  )
  const otherCharges = roundMoney(
    directOtherCharges !== undefined
      ? Number(directOtherCharges || 0)
      : Number(summary.otherCharges || 0),
  )

  const rawPrintedFinal =
    directPrintedFinalTotal !== undefined
      ? directPrintedFinalTotal
      : summary.detectedGrandTotal
  const printedFinalTotal =
    typeof rawPrintedFinal === 'number' && rawPrintedFinal > 0
      ? roundMoney(rawPrintedFinal)
      : null

  const calculatedFinalTotal = hasValidatedItems
    ? roundMoney(calculatedSubtotal - discount + tax + otherCharges)
    : 0

  const mismatchMessages = []
  let subtotalMatches = true
  let finalTotalMatches = true

  if (printedSubtotal !== null) {
    if (!hasValidatedItems) {
      subtotalMatches = false
      mismatchMessages.push(
        `Printed bill subtotal is ₹${printedSubtotal.toFixed(2)}, but no validated material rows could be confirmed.`,
      )
    } else if (Math.abs(calculatedSubtotal - printedSubtotal) > tolerance) {
      subtotalMatches = false
      mismatchMessages.push(
        `Calculated items subtotal (₹${calculatedSubtotal.toFixed(2)}) differs from printed bill subtotal (₹${printedSubtotal.toFixed(2)}).`,
      )
    }
  }

  if (printedFinalTotal !== null) {
    if (!hasValidatedItems) {
      finalTotalMatches = false
      mismatchMessages.push(
        `Printed bill total is ₹${printedFinalTotal.toFixed(2)}, but no validated material rows could be confirmed to reconcile it.`,
      )
    } else if (Math.abs(calculatedFinalTotal - printedFinalTotal) > tolerance) {
      finalTotalMatches = false
      mismatchMessages.push(
        `Calculated final total (₹${calculatedFinalTotal.toFixed(2)}) differs from printed bill total (₹${printedFinalTotal.toFixed(2)}).`,
      )
    }
  }

  return {
    calculatedSubtotal,
    printedSubtotal,
    extractedDiscount: discount,
    extractedTax: tax,
    extractedOtherCharges: otherCharges,
    calculatedFinalTotal,
    printedFinalTotal,
    subtotalMatches,
    finalTotalMatches,
    hasMismatch: !subtotalMatches || !finalTotalMatches,
    mismatchMessages,
  }
}

export function parseBillOcrText(ocrInput, rawMaterials = [], options = {}) {
  const limits = {
    ...DEFAULT_OCR_VALIDATION_LIMITS,
    ...(options.limits || {}),
  }

  const { pages, fallbackRawText } = resolveDocumentPages(ocrInput, options)
  const allRows = pages.flatMap((p) => p.rows)
  const normalizedText =
    allRows.length > 0
      ? allRows.map((r) => r.text).join('\n')
      : normalizeOcrText(fallbackRawText)

  if (!normalizedText || allRows.length === 0) {
    return {
      hasContent: false,
      normalizedText: '',
      tableDetected: false,
      tableHeaderDetected: false,
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
      calculatedSubtotal: 0,
      calculatedFinalTotal: 0,
      lineItems: [],
      uncertainLineItems: [],
      rejectedRowCount: 0,
      totalsValidation: reconcileInvoiceTotals({
        validatedLineItems: [],
        summary: {},
        limits,
      }),
      warnings: [
        'No readable text could be extracted from this bill. Please verify image clarity or enter details manually.',
      ],
    }
  }

  let firstPageHeaderIdx = allRows.length
  const pageHeaderMetas = pages.map((page) => {
    const header = detectTableHeaderColumns(page.rows)
    if (header && page.pageIndex === 0) {
      firstPageHeaderIdx = header.headerRowIndex
    }
    return header
  })

  const tableHeaderDetected = pageHeaderMetas.some(Boolean)

  const supplier = extractSupplierNameFromRows(allRows, firstPageHeaderIdx)
  const invoiceNo = extractInvoiceNumberFromRows(allRows)
  const invoiceDate = extractInvoiceDateFromRows(allRows)

  const validatedLineItems = []
  const uncertainLineItems = []
  let rejectedRowCount = 0
  let earliestSummaryGlobalIdx = 0
  let globalRowOffset = 0

  pages.forEach((page, pIdx) => {
    const headerMeta = pageHeaderMetas[pIdx]
    const startIdx = headerMeta ? headerMeta.headerRowIndex + 1 : 0
    let hitSummaryBoundary = false

    for (let rIdx = startIdx; rIdx < page.rows.length; rIdx += 1) {
      const row = page.rows[rIdx]
      const summaryKind = classifySummaryOrFooterRow(row.text)

      if (summaryKind) {
        if (!hitSummaryBoundary && pIdx === 0 && earliestSummaryGlobalIdx === 0) {
          earliestSummaryGlobalIdx = globalRowOffset + rIdx
        }
        hitSummaryBoundary = true
        if (headerMeta) {
          break
        }
        continue
      }

      if (hitSummaryBoundary && headerMeta) {
        break
      }

      const candidate = extractCandidateFromRow(row, headerMeta, limits)
      if (!candidate) {
        continue
      }

      if (candidate.isContinuationOnly) {
        if (
          headerMeta &&
          validatedLineItems.length > 0 &&
          !isAddressOrMetadataText(candidate.continuationText).rejected
        ) {
          const prevItem = validatedLineItems[validatedLineItems.length - 1]
          const combinedDesc = `${prevItem.extractedDescription} ${candidate.continuationText}`
            .replace(/\s{2,}/g, ' ')
            .trim()
          if (combinedDesc.length <= 180) {
            prevItem.extractedDescription = combinedDesc
            const rematched = matchDescriptionToRawMaterials(
              combinedDesc,
              prevItem.isCatalogUnit ? prevItem.detectedUnit : '',
              rawMaterials,
            )
            prevItem.materialId = rematched.autoMappedMaterialId
            prevItem.matchConfidence = rematched.confidence
            prevItem.suggestions = rematched.suggestions
          }
        }
        continue
      }

      const evaluation = validateCandidateLineItem(candidate, rawMaterials, {
        limits,
        insideConfirmedTable: Boolean(headerMeta),
      })

      if (evaluation.status === 'valid' && evaluation.lineItem) {
        validatedLineItems.push(evaluation.lineItem)
      } else if (evaluation.status === 'uncertain' && evaluation.uncertainItem) {
        uncertainLineItems.push(evaluation.uncertainItem)
      } else {
        rejectedRowCount += 1
      }
    }

    globalRowOffset += page.rows.length
  })

  const summaryStartIdx = tableHeaderDetected
    ? Math.max(0, firstPageHeaderIdx + 1)
    : 0
  const summary = extractSummaryAmountsFromRows(allRows, summaryStartIdx)

  const totalsValidation = reconcileInvoiceTotals({
    validatedLineItems,
    summary,
    limits,
  })

  const warnings = []
  if (!tableHeaderDetected) {
    warnings.push(
      'Item-table column headers (such as Description, Qty, Unit, Rate, Amount) were not clearly recognized; review extracted fields carefully.',
    )
  }
  if (!supplier.value) {
    warnings.push(
      'Supplier name could not be confidently detected; please enter it.',
    )
  }
  if (!invoiceDate.value) {
    warnings.push(
      'Purchase date was unclear on the bill; verify the voucher date.',
    )
  }
  if (validatedLineItems.length === 0) {
    warnings.push(
      'No material line items passed quantity, unit, and rate × amount verification; review flagged rows or enter material lines manually.',
    )
  } else if (validatedLineItems.some((item) => !item.materialId)) {
    warnings.push(
      'One or more validated bill items need to be matched to an existing Raw Material before saving.',
    )
  }
  if (uncertainLineItems.length > 0) {
    warnings.push(
      `${uncertainLineItems.length} ambiguous or incomplete table ${
        uncertainLineItems.length === 1 ? 'row was' : 'rows were'
      } excluded from totals and held below for manual review.`,
    )
  }
  if (totalsValidation.hasMismatch) {
    warnings.push(...totalsValidation.mismatchMessages)
  }

  return {
    hasContent: true,
    normalizedText,
    tableDetected: tableHeaderDetected,
    tableHeaderDetected,
    supplierName: supplier.value,
    supplierConfidence: supplier.confidence,
    supplierInvoiceNumber: invoiceNo.value,
    invoiceNumberConfidence: invoiceNo.confidence,
    purchaseDate: invoiceDate.value,
    purchaseDateConfidence: invoiceDate.confidence,
    discountAmount:
      summary.discountAmount > 0 ? String(summary.discountAmount) : '',
    taxAmount: summary.taxAmount > 0 ? String(summary.taxAmount) : '',
    otherCharges:
      summary.otherCharges > 0 ? String(summary.otherCharges) : '',
    detectedSubtotal: totalsValidation.printedSubtotal,
    detectedGrandTotal: totalsValidation.printedFinalTotal,
    printedDiscountAmount: summary.discountAmount,
    printedTaxAmount: summary.taxAmount,
    printedOtherCharges: summary.otherCharges,
    calculatedSubtotal: totalsValidation.calculatedSubtotal,
    calculatedFinalTotal: totalsValidation.calculatedFinalTotal,
    totalsValidation,
    lineItems: validatedLineItems,
    uncertainLineItems,
    rejectedRowCount,
    warnings,
  }
}
