import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import { calculateVoucherPreviewTotals } from '../utils/purchaseMath.js'
import {
  classifySummaryOrFooterRow,
  detectTableHeaderColumns,
  isAddressOrMetadataText,
  isLikelyPinCode,
  matchDescriptionToRawMaterials,
  parseBillOcrText,
  reconcileInvoiceTotals,
  validateCandidateLineItem,
} from '../utils/billOcrParser.js'
import {
  buildSpatialRowsFromWords,
  extractBillTextLocally,
  parseTesseractTsv,
} from '../utils/ocrEngine.js'

const LOCAL_ENG_LANG_PATH = fileURLToPath(
  new URL(
    '../../../../node_modules/@tesseract.js-data/eng/4.0.0_best_int',
    import.meta.url,
  ),
)
globalThis.__STS_OCR_BASE_HREF__ = LOCAL_ENG_LANG_PATH

const SAMPLE_CATALOG = [
  {
    id: 'mat-foam-40d',
    name: 'High Density Foam Sheet 40D',
    category: 'Foam',
    unit: 'Sheet',
    quantityOnHand: 25,
    isActive: true,
  },
  {
    id: 'mat-velvet-fab',
    name: 'Premium Velvet Upholstery Fabric',
    category: 'Upholstery',
    unit: 'Meter',
    quantityOnHand: 80,
    isActive: true,
  },
  {
    id: 'mat-teak-battens',
    name: 'Kiln Dried Teak Wood Battens',
    category: 'Timber',
    unit: 'Square Feet',
    quantityOnHand: 40,
    isActive: true,
  },
  {
    id: 'mat-webbing-roll',
    name: 'Elastic Sofa Webbing Roll',
    category: 'Hardware',
    unit: 'Roll',
    quantityOnHand: 12,
    isActive: true,
  },
  {
    id: 'mat-wood-adhesive',
    name: 'Synthetic Wood Adhesive',
    category: 'General',
    unit: 'Kilogram',
    quantityOnHand: 18,
    isActive: true,
  },
  {
    id: 'mat-spring-clips',
    name: 'Zig Zag Spring Clips Box',
    category: 'Hardware',
    unit: 'Box',
    quantityOnHand: 9,
    isActive: true,
  },
  {
    id: 'mat-cotton-cloth',
    name: 'Cotton Lining Cloth',
    category: 'Curtain',
    unit: 'Meter',
    quantityOnHand: 50,
    isActive: true,
  },
  {
    id: 'mat-teak-legs',
    name: 'Teak Frame Legs',
    category: 'Timber',
    unit: 'Piece',
    quantityOnHand: 60,
    isActive: true,
  },
]

function renderDummyGstInvoicePng() {
  const width = 1650
  const height = 1360
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#222222'
  ctx.lineWidth = 2
  ctx.strokeRect(45, 40, width - 90, height - 80)

  ctx.fillStyle = '#111111'
  ctx.font = 'bold 34px DejaVu Sans'
  ctx.fillText('KERALA UPHOLSTERY & FOAM SUPPLIES', 75, 96)

  ctx.font = '21px DejaVu Sans'
  ctx.fillText(
    'Plot 223, Industrial Estate, Kakkanad, Kochi - 682030',
    75,
    134,
  )
  ctx.fillText('GSTIN: 32AABCK4829L1Z5    Phone: 9847012345', 75, 168)

  ctx.font = 'bold 28px DejaVu Sans'
  ctx.fillText('TAX INVOICE', 1320, 95)
  ctx.font = '21px DejaVu Sans'
  ctx.fillText('Invoice No: INV-2026-0842', 1180, 134)
  ctx.fillText('Date: 24/10/2026', 1180, 168)

  ctx.beginPath()
  ctx.moveTo(45, 195)
  ctx.lineTo(width - 45, 195)
  ctx.stroke()

  ctx.font = 'bold 21px DejaVu Sans'
  ctx.fillText('Bill To:', 75, 232)
  ctx.font = '21px DejaVu Sans'
  ctx.fillText('Soft Touch Sofas Manufacturing Unit', 75, 264)
  ctx.fillText(
    'Door No 223, Seaport Airport Road, Kakkanad, Kochi - 682030',
    75,
    296,
  )
  ctx.fillText('Challan Ref: 223    State Code: 32', 1180, 264)

  const tableTop = 335
  const headerBottom = 392
  ctx.fillStyle = '#f2f2f2'
  ctx.fillRect(46, tableTop, width - 92, headerBottom - tableTop)

  ctx.beginPath()
  ctx.moveTo(45, tableTop)
  ctx.lineTo(width - 45, tableTop)
  ctx.moveTo(45, headerBottom)
  ctx.lineTo(width - 45, headerBottom)
  ctx.stroke()

  const colX = {
    sl: 72,
    desc: 155,
    hsn: 785,
    qty: 965,
    unit: 1105,
    rate: 1265,
    amount: 1435,
  }

  ctx.fillStyle = '#111111'
  ctx.font = 'bold 22px DejaVu Sans'
  ctx.fillText('Sl', colX.sl, 372)
  ctx.fillText('Description', colX.desc, 372)
  ctx.fillText('HSN', colX.hsn, 372)
  ctx.fillText('Qty', colX.qty, 372)
  ctx.fillText('Unit', colX.unit, 372)
  ctx.fillText('Rate', colX.rate, 372)
  ctx.fillText('Amount', colX.amount, 372)

  const items = [
    [
      '1',
      'High Density Foam Sheet 40D',
      '392190',
      '10',
      'sheet',
      '650.00',
      '6,500.00',
    ],
    [
      '2',
      'Premium Velvet Upholstery Fabric',
      '580126',
      '15',
      'meter',
      '420.00',
      '6,300.00',
    ],
    [
      '3',
      'Kiln Dried Teak Wood Battens',
      '440729',
      '8',
      'sqft',
      '480.00',
      '3,840.00',
    ],
    [
      '4',
      'Elastic Sofa Webbing Roll',
      '580620',
      '4',
      'roll',
      '450.00',
      '1,800.00',
    ],
    [
      '5',
      'Synthetic Wood Adhesive',
      '350691',
      '5',
      'kg',
      '230.00',
      '1,150.00',
    ],
    [
      '6',
      'Zig Zag Spring Clips Box',
      '830242',
      '2',
      'box',
      '260.00',
      '520.00',
    ],
  ]

  ctx.font = '22px DejaVu Sans'
  let rowY = 442
  for (const row of items) {
    ctx.fillText(row[0], colX.sl, rowY)
    ctx.fillText(row[1], colX.desc, rowY)
    ctx.fillText(row[2], colX.hsn, rowY)
    ctx.fillText(row[3], colX.qty, rowY)
    ctx.fillText(row[4], colX.unit, rowY)
    ctx.fillText(row[5], colX.rate, rowY)
    ctx.fillText(row[6], colX.amount, rowY)

    ctx.strokeStyle = '#dddddd'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(45, rowY + 22)
    ctx.lineTo(width - 45, rowY + 22)
    ctx.stroke()

    rowY += 68
  }

  const summaryTop = rowY + 10
  ctx.strokeStyle = '#222222'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(45, summaryTop - 25)
  ctx.lineTo(width - 45, summaryTop - 25)
  ctx.stroke()

  ctx.font = '20px DejaVu Sans'
  ctx.fillText('Bank Details: Federal Bank, Kakkanad - 682030', 75, summaryTop + 20)
  ctx.fillText('A/c No: 13880200049223    IFSC: FDRL0001388', 75, summaryTop + 62)
  ctx.fillText(
    'Terms & Conditions: Goods once sold cannot be returned.',
    75,
    summaryTop + 104,
  )
  ctx.fillText('Authorized Signatory', 75, summaryTop + 190)

  ctx.font = '22px DejaVu Sans'
  ctx.fillText('Subtotal:', 1120, summaryTop + 20)
  ctx.fillText('20,110.00', 1425, summaryTop + 20)

  ctx.fillText('CGST (9%):', 1120, summaryTop + 64)
  ctx.fillText('1,809.90', 1435, summaryTop + 64)

  ctx.fillText('SGST (9%):', 1120, summaryTop + 108)
  ctx.fillText('1,809.90', 1435, summaryTop + 108)

  ctx.font = 'bold 25px DejaVu Sans'
  ctx.fillText('Final Bill Total:', 1090, summaryTop + 168)
  ctx.fillText('23,729.80', 1410, summaryTop + 168)

  return canvas.toBuffer('image/png')
}

function renderCorruptedRowAndMismatchInvoicePng() {
  const width = 1600
  const height = 1050
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#111111'
  ctx.font = 'bold 32px DejaVu Sans'
  ctx.fillText('MALABAR TIMBER & HARDWARE TRADERS', 70, 90)
  ctx.font = '21px DejaVu Sans'
  ctx.fillText('NH Bypass, Edappally, Kochi - 682024   Ph: 9447123456', 70, 128)
  ctx.fillText('Invoice No: MTH-771   Date: 19/10/2026', 1080, 90)

  ctx.strokeStyle = '#222222'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(50, 175)
  ctx.lineTo(width - 50, 175)
  ctx.moveTo(50, 232)
  ctx.lineTo(width - 50, 232)
  ctx.stroke()

  ctx.font = 'bold 22px DejaVu Sans'
  ctx.fillText('Sl', 75, 212)
  ctx.fillText('Description', 155, 212)
  ctx.fillText('HSN', 760, 212)
  ctx.fillText('Qty', 930, 212)
  ctx.fillText('Unit', 1070, 212)
  ctx.fillText('Rate', 1230, 212)
  ctx.fillText('Amount', 1400, 212)

  ctx.font = '22px DejaVu Sans'
  const rows = [
    ['1', 'Teak Frame Legs', '940190', '12', 'pcs', '150.00', '1,800.00'],
    ['2', 'Damaged Foam Roll', '392190', '5', 'roll', '400.00', '9,999.00'],
    ['3', 'Cotton Lining Cloth', '520811', '20', 'mtr', '95.00', '1,900.00'],
  ]

  let y = 285
  for (const r of rows) {
    ctx.fillText(r[0], 75, y)
    ctx.fillText(r[1], 155, y)
    ctx.fillText(r[2], 760, y)
    ctx.fillText(r[3], 930, y)
    ctx.fillText(r[4], 1070, y)
    ctx.fillText(r[5], 1230, y)
    ctx.fillText(r[6], 1400, y)
    y += 70
  }

  ctx.beginPath()
  ctx.moveTo(50, y)
  ctx.lineTo(width - 50, y)
  ctx.stroke()

  ctx.font = '22px DejaVu Sans'
  ctx.fillText('Subtotal:', 1120, y + 55)
  ctx.fillText('5,700.00', 1400, y + 55)

  ctx.fillText('GST (18%):', 1120, y + 100)
  ctx.fillText('1,026.00', 1400, y + 100)

  ctx.font = 'bold 24px DejaVu Sans'
  ctx.fillText('Grand Total:', 1100, y + 155)
  ctx.fillText('6,726.00', 1395, y + 155)

  return canvas.toBuffer('image/png')
}

test('Real OCR on dummy GST invoice with Kakkanad Kochi 682030 PIN extracts 6 valid material rows, ₹20,110 subtotal, ₹3,619.80 GST, and ₹23,729.80 final total', async () => {
  const pngBuffer = renderDummyGstInvoicePng()
  const ocrResult = await extractBillTextLocally(pngBuffer)

  assert.ok(
    ocrResult.rawText.includes('682030'),
    'OCR raw text should include the printed PIN code 682030 from the image',
  )
  assert.ok(
    Array.isArray(ocrResult.pages) && ocrResult.pages.length === 1,
    'OCR engine should produce structured spatial page metadata',
  )
  assert.ok(
    ocrResult.pages[0].spatialRows.length >= 10,
    'OCR engine should reconstruct spatial horizontal rows from word bounding boxes',
  )

  const parsed = parseBillOcrText(ocrResult, SAMPLE_CATALOG)

  assert.equal(parsed.tableDetected, true)
  assert.equal(
    parsed.lineItems.length,
    6,
    `Expected 6 valid material rows from real OCR, got ${parsed.lineItems.length}: ${JSON.stringify(parsed.lineItems)}`,
  )

  for (const item of parsed.lineItems) {
    assert.ok(
      !/kakkanad|kochi|682030|gstin|subtotal|cgst|sgst|final|bank|terms/i.test(
        item.extractedDescription,
      ),
      `Non-item text leaked into line item description: ${item.extractedDescription}`,
    )
    assert.notEqual(item.quantity, '682030')
    assert.notEqual(item.unitPrice, '223')
    assert.ok(Number(item.quantity) > 0 && Number(item.quantity) <= 100)
    assert.ok(Number(item.unitPrice) > 0)
    assert.ok(item.detectedUnit, `Expected recognized unit on ${item.extractedDescription}`)
  }

  const previewTotals = calculateVoucherPreviewTotals(parsed.lineItems, {
    discountAmount: parsed.discountAmount,
    taxAmount: parsed.taxAmount,
    otherCharges: parsed.otherCharges,
  })

  assert.equal(previewTotals.subtotal, 20110)
  assert.equal(previewTotals.taxAmount, 3619.8)
  assert.equal(previewTotals.finalTotal, 23729.8)

  assert.equal(parsed.detectedSubtotal, 20110)
  assert.equal(parsed.detectedGrandTotal, 23729.8)
  assert.equal(parsed.totalsValidation.calculatedSubtotal, 20110)
  assert.equal(parsed.totalsValidation.printedSubtotal, 20110)
  assert.equal(parsed.totalsValidation.calculatedFinalTotal, 23729.8)
  assert.equal(parsed.totalsValidation.printedFinalTotal, 23729.8)
  assert.equal(parsed.totalsValidation.hasMismatch, false)
})

test('Real OCR isolates corrupted table row into uncertainLineItems, excludes it from totals, and flags printed total mismatch', async () => {
  const pngBuffer = renderCorruptedRowAndMismatchInvoicePng()
  const ocrResult = await extractBillTextLocally(pngBuffer)
  const parsed = parseBillOcrText(ocrResult, SAMPLE_CATALOG)

  assert.equal(parsed.tableDetected, true)
  assert.equal(
    parsed.lineItems.length,
    2,
    `Expected only 2 valid rows in lineItems, got ${JSON.stringify(parsed.lineItems)}`,
  )
  assert.equal(
    parsed.uncertainLineItems.length,
    1,
    `Expected corrupted row in uncertainLineItems, got ${JSON.stringify(parsed.uncertainLineItems)}`,
  )
  assert.match(parsed.uncertainLineItems[0].extractedDescription, /Damaged Foam Roll/i)

  const previewTotals = calculateVoucherPreviewTotals(parsed.lineItems, {
    discountAmount: parsed.discountAmount,
    taxAmount: parsed.taxAmount,
    otherCharges: parsed.otherCharges,
  })

  assert.equal(previewTotals.subtotal, 3700)
  assert.equal(parsed.detectedSubtotal, 5700)
  assert.equal(parsed.detectedGrandTotal, 6726)
  assert.equal(parsed.totalsValidation.hasMismatch, true)
  assert.ok(
    parsed.warnings.some((w) => /subtotal/i.test(w) && /differs/i.test(w)),
    'Should warn about printed vs calculated subtotal mismatch',
  )
})

test('Address PIN codes, phone numbers, GSTINs, and metadata numbers without item table are never parsed as material line items', () => {
  const nonItemOcrText = [
    'SOFT TOUCH SUPPLIERS PVT LTD',
    'Door No 223, Kakkanad, Kochi - 682030',
    'Branch: Palarivattom, Ernakulam - 682025   Code: 145',
    'GSTIN: 32AABCS1429B1Z1   PAN: AABCS1429B',
    'Contact: +91 98470 55223 / 0484-2422230',
    'Invoice No: STS/2026/223   Date: 28-10-2026',
    'Vehicle No: KL 07 CD 4522   E-Way Bill: 581002938471',
    'HSN/SAC  Taxable Value  CGST 9%  SGST 9%  Total Tax',
    '94016100   12,000.00    1,080.00  1,080.00  2,160.00',
  ].join('\n')

  const parsed = parseBillOcrText(nonItemOcrText, SAMPLE_CATALOG)

  assert.equal(parsed.lineItems.length, 0)
  assert.ok(isLikelyPinCode('682030', 682030, 'Kakkanad, Kochi - 682030'))
  assert.equal(
    isAddressOrMetadataText(
      'Door No 223, Kakkanad, Kochi - 682030',
      'Door No 223, Kakkanad, Kochi - 682030',
    ).rejected,
    true,
  )
  assert.ok(
    parsed.warnings.some((w) => /manual|validated|table/i.test(w)),
    'Should emit clear warning when no valid material line items exist',
  )
})

test('Summary rows (Subtotal, Discount, CGST, SGST, Total GST, Freight, Grand Total) are excluded from items and GST is never double-counted', () => {
  const invoiceWithBothTaxBreakupAndTotal = [
    'COCHIN FABRICS & FOAMS',
    'Invoice No: CF-908   Date: 20/10/2026',
    'Sl   Description   HSN   Qty   Unit   Rate   Amount',
    '1   Premium Velvet Upholstery Fabric   580126   20   meter   350.00   7,000.00',
    '2   High Density Foam Sheet 40D   392190   5   sheet   600.00   3,000.00',
    'Subtotal: 10,000.00',
    'Less Discount: 500.00',
    'CGST 9%: 855.00',
    'SGST 9%: 855.00',
    'Total GST (18%): 1,710.00',
    'Freight Charges: 290.00',
    'Grand Total: 11,500.00',
  ].join('\n')

  const parsed = parseBillOcrText(invoiceWithBothTaxBreakupAndTotal, SAMPLE_CATALOG)

  assert.equal(parsed.lineItems.length, 2)
  assert.equal(classifySummaryOrFooterRow('Subtotal: 10,000.00'), 'subtotal')
  assert.equal(classifySummaryOrFooterRow('CGST 9%: 855.00'), 'tax_component')
  assert.equal(classifySummaryOrFooterRow('Total GST (18%): 1,710.00'), 'tax_total')
  assert.equal(classifySummaryOrFooterRow('Grand Total: 11,500.00'), 'grand_total')

  assert.equal(parsed.discountAmount, '500')
  assert.equal(parsed.taxAmount, '1710')
  assert.equal(parsed.otherCharges, '290')

  const totals = calculateVoucherPreviewTotals(parsed.lineItems, {
    discountAmount: parsed.discountAmount,
    taxAmount: parsed.taxAmount,
    otherCharges: parsed.otherCharges,
  })
  assert.equal(totals.subtotal, 10000)
  assert.equal(totals.finalTotal, 11500)
  assert.equal(parsed.totalsValidation.hasMismatch, false)
})

test('validateCandidateLineItem enforces description plausibility, supported unit, numeric bounds, and quantity × rate ≈ amount', () => {
  const valid = validateCandidateLineItem({
    description: 'High Density Foam Sheet 40D',
    quantity: 10,
    rawQuantity: '10',
    unit: 'sheet',
    unitRecognized: true,
    unitPrice: 650,
    rawUnitPrice: '650.00',
    lineAmount: 6500,
    rawLineAmount: '6,500.00',
  })
  assert.equal(valid.valid, true)

  const pinAsQty = validateCandidateLineItem({
    description: 'Kakkanad, Kochi',
    quantity: 682030,
    rawQuantity: '682030',
    unit: 'piece',
    unitRecognized: true,
    unitPrice: 223,
    rawUnitPrice: '223',
    lineAmount: 152092690,
    rawLineAmount: '152092690',
    rawRowText: 'Kakkanad, Kochi - 682030 223',
  })
  assert.equal(pinAsQty.valid, false)

  const missingUnit = validateCandidateLineItem({
    description: 'Elastic Sofa Webbing',
    quantity: 4,
    rawQuantity: '4',
    unit: '',
    unitRecognized: false,
    unitPrice: 450,
    rawUnitPrice: '450.00',
    lineAmount: 1800,
    rawLineAmount: '1,800.00',
  })
  assert.equal(missingUnit.valid, false)
  assert.ok(missingUnit.failureCodes.includes('missing_unit'))

  const mathMismatch = validateCandidateLineItem({
    description: 'Synthetic Wood Adhesive',
    quantity: 5,
    rawQuantity: '5',
    unit: 'kg',
    unitRecognized: true,
    unitPrice: 230,
    rawUnitPrice: '230.00',
    lineAmount: 4200,
    rawLineAmount: '4,200.00',
  })
  assert.equal(mathMismatch.valid, false)
  assert.ok(mathMismatch.failureCodes.includes('amount_mismatch'))

  const roundingTolerance = validateCandidateLineItem({
    description: 'Cotton Lining Cloth',
    quantity: 3,
    rawQuantity: '3',
    unit: 'meter',
    unitRecognized: true,
    unitPrice: 33.33,
    rawUnitPrice: '33.33',
    lineAmount: 100,
    rawLineAmount: '100.00',
  })
  assert.equal(roundingTolerance.valid, true)
})

test('Missing or poorly recognized columns and unreadable OCR output never invent values and allow clean manual fallback', () => {
  const missingColumnsInvoice = [
    'SHREE TRADERS',
    'Invoice No: ST-12   Date: 15/10/2026',
    'Description   Qty   Amount',
    'Upholstery Tacks Assorted   4   600.00',
    'Heavy Duty Staple Pins   10   1,250.00',
    'Total: 1,850.00',
  ].join('\n')

  const parsedMissing = parseBillOcrText(missingColumnsInvoice, SAMPLE_CATALOG)
  assert.equal(parsedMissing.lineItems.length, 0)
  assert.ok(parsedMissing.uncertainLineItems.length >= 1)
  assert.equal(parsedMissing.detectedGrandTotal, 1850)
  assert.ok(parsedMissing.warnings.length > 0)

  const emptyOcr = parseBillOcrText('   \n  ', SAMPLE_CATALOG)
  assert.equal(emptyOcr.hasContent, false)
  assert.equal(emptyOcr.lineItems.length, 0)
  assert.equal(emptyOcr.discountAmount, '')
  assert.equal(emptyOcr.taxAmount, '')
  assert.equal(emptyOcr.otherCharges, '')
})

test('Conservative Raw Material matching auto-selects only strong unit-compatible matches and keeps ambiguous matches unselected', () => {
  const strongMatch = matchDescriptionToRawMaterials(
    'High Density Foam Sheet 40D',
    SAMPLE_CATALOG,
    'sheet',
  )
  assert.equal(strongMatch.matchedMaterialId, 'mat-foam-40d')

  const unitConflictMatch = matchDescriptionToRawMaterials(
    'High Density Foam Sheet 40D',
    SAMPLE_CATALOG,
    'kg',
  )
  assert.equal(unitConflictMatch.matchedMaterialId, '')
  assert.ok(unitConflictMatch.suggestions.length >= 1)

  const weakGenericMatch = matchDescriptionToRawMaterials(
    'Imported Upholstery Material Special',
    SAMPLE_CATALOG,
    'meter',
  )
  assert.equal(weakGenericMatch.matchedMaterialId, '')
})

test('Spatial TSV parser clusters jittered words into rows, strips vertical pipe artifacts, and detects column bounds', () => {
  const sampleTsv = [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    '5\t1\t1\t1\t1\t1\t60\t100\t120\t22\t95\tDescription',
    '5\t1\t1\t1\t1\t2\t420\t102\t45\t22\t94\t|',
    '5\t1\t1\t1\t1\t3\t520\t101\t42\t22\t96\tQty',
    '5\t1\t1\t1\t1\t4\t630\t100\t48\t22\t95\tUnit',
    '5\t1\t1\t1\t1\t5\t760\t101\t52\t22\t96\tRate',
    '5\t1\t1\t1\t1\t6\t910\t100\t84\t22\t96\tAmount',
    '5\t1\t1\t1\t2\t1\t60\t155\t72\t22\t93\tCotton',
    '5\t1\t1\t1\t2\t2\t142\t157\t68\t22\t92\tLining',
    '5\t1\t1\t1\t2\t3\t220\t156\t60\t22\t94\tCloth',
    '5\t1\t1\t1\t2\t4\t522\t156\t28\t22\t96\t20',
    '5\t1\t1\t1\t2\t5\t630\t155\t42\t22\t95\tmtr',
    '5\t1\t1\t1\t2\t6\t760\t156\t58\t22\t96\t95.00',
    '5\t1\t1\t1\t2\t7\t910\t155\t88\t22\t96\t1,900.00',
  ].join('\n')

  const words = parseTesseractTsv(sampleTsv)
  const spatialRows = buildSpatialRowsFromWords(words)

  assert.equal(spatialRows.length, 2)
  assert.ok(!spatialRows[0].text.includes('|'))

  const header = detectTableHeaderColumns(spatialRows)
  assert.ok(header)
  assert.equal(header.hasRealCoordinates, true)

  const reconciliation = reconcileInvoiceTotals({
    calculatedSubtotal: 1900,
    printedSubtotal: 1900,
    taxAmount: 342,
    printedFinalTotal: 2500,
  })
  assert.equal(reconciliation.subtotalMatches, true)
  assert.equal(reconciliation.finalTotalMatches, false)
  assert.equal(reconciliation.hasMismatch, true)
})

test('Header/footer metadata, HSN codes, and PIN codes adjacent to item table are excluded while wrapped item descriptions merge cleanly', () => {
  const mixedTableInvoice = [
    'ERNAKULAM SOFA SUPPLIES',
    'Plot 223, Kakkanad, Kochi - 682030   GSTIN: 32AABCE9911K1Z8',
    'PO No: 223   Despatch Through: Road   HSN Summary Ref: 94016100',
    'Sl   Description   HSN   Qty   Unit   Rate   Amount',
    '1   Kiln Dried Teak   440729   6   sqft   500.00   3,000.00',
    'Wood Battens',
    'Kakkanad, Kochi - 682030   223',
    'GSTIN: 32AABCE9911K1Z8   Phone: 9847012345',
    '2   Synthetic Wood Adhesive   350691   4   kg   250.00   1,000.00',
    'Subtotal: 4,000.00',
    'HSN/SAC   Taxable Value   CGST   SGST   Total Tax',
    '440729   3,000.00   270.00   270.00   540.00',
    '350691   1,000.00   90.00   90.00   180.00',
    'Total GST: 720.00',
    'Final Total: 4,720.00',
  ].join('\n')

  const parsed = parseBillOcrText(mixedTableInvoice, SAMPLE_CATALOG)

  assert.equal(parsed.lineItems.length, 2)
  assert.match(parsed.lineItems[0].extractedDescription, /Kiln Dried Teak Wood Battens/i)
  assert.equal(parsed.lineItems[0].materialId, 'mat-teak-battens')
  assert.equal(parsed.lineItems[1].materialId, 'mat-wood-adhesive')
  assert.equal(parsed.uncertainLineItems.length, 0)
  assert.equal(parsed.calculatedSubtotal, 4000)
  assert.equal(parsed.calculatedFinalTotal, 4720)
  assert.equal(parsed.totalsValidation.hasMismatch, false)
})

test('Real OCR on blank/unreadable bill image falls back cleanly without inventing items or totals so manual entry continues safely', async () => {
  const blankCanvas = createCanvas(900, 600)
  const ctx = blankCanvas.getContext('2d')
  ctx.fillStyle = '#faf8f4'
  ctx.fillRect(0, 0, 900, 600)
  const blankPng = blankCanvas.toBuffer('image/png')

  const ocrResult = await extractBillTextLocally(blankPng)
  const parsed = parseBillOcrText(ocrResult, SAMPLE_CATALOG)

  assert.equal(parsed.hasContent, false)
  assert.equal(parsed.lineItems.length, 0)
  assert.equal(parsed.uncertainLineItems.length, 0)
  assert.equal(parsed.detectedSubtotal, null)
  assert.equal(parsed.detectedGrandTotal, null)

  const manualLineItems = [
    {
      materialId: 'mat-foam-40d',
      quantity: '6',
      unitPrice: '650',
    },
  ]
  const manualTotals = calculateVoucherPreviewTotals(manualLineItems, {
    discountAmount: '0',
    taxAmount: '702',
    otherCharges: '100',
  })
  assert.equal(manualTotals.subtotal, 3900)
  assert.equal(manualTotals.finalTotal, 4702)
})

