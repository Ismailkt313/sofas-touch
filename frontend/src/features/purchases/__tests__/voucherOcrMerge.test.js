import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import { parseBillOcrText } from '../utils/billOcrParser.js'
import { extractBillTextLocally } from '../utils/ocrEngine.js'
import { calculateVoucherPreviewTotals } from '../utils/purchaseMath.js'
import {
  acceptLineItemSuggestion,
  applyManualLineItemEdit,
  confirmLineItemOcrValues,
  createEmptyLineItem,
  createFieldProvenance,
  createInitialHeaderFieldMeta,
  dismissLineItemSuggestion,
  isFieldProtected,
  mergeHeaderFieldsWithOcr,
  mergeLineItemsWithOcr,
  promoteSuggestedLineItemToRows,
} from '../utils/voucherOcrMerge.js'

const LOCAL_ENG_LANG_PATH = fileURLToPath(
  new URL(
    '../../../../node_modules/@tesseract.js-data/eng/4.0.0_best_int',
    import.meta.url,
  ),
)
globalThis.__STS_OCR_BASE_HREF__ = LOCAL_ENG_LANG_PATH

const CATALOG = [
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
    id: 'mat-wood-adhesive',
    name: 'Synthetic Wood Adhesive',
    category: 'General',
    unit: 'Kilogram',
    quantityOnHand: 18,
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

function renderPrimaryBillPng() {
  const width = 1600
  const height = 980
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#111111'

  ctx.font = 'bold 32px DejaVu Sans'
  ctx.fillText('KERALA UPHOLSTERY & FOAM SUPPLIES', 70, 88)
  ctx.font = '21px DejaVu Sans'
  ctx.fillText('Plot 223, Kakkanad, Kochi - 682030   GSTIN: 32AABCK4829L1Z5', 70, 126)
  ctx.fillText('Invoice No: INV-2026-501', 1120, 88)
  ctx.fillText('Date: 22/10/2026', 1120, 126)

  ctx.strokeStyle = '#222222'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(50, 165)
  ctx.lineTo(width - 50, 165)
  ctx.moveTo(50, 222)
  ctx.lineTo(width - 50, 222)
  ctx.stroke()

  ctx.font = 'bold 22px DejaVu Sans'
  ctx.fillText('Sl', 75, 202)
  ctx.fillText('Description', 155, 202)
  ctx.fillText('HSN', 780, 202)
  ctx.fillText('Qty', 950, 202)
  ctx.fillText('Unit', 1090, 202)
  ctx.fillText('Rate', 1245, 202)
  ctx.fillText('Amount', 1415, 202)

  ctx.font = '22px DejaVu Sans'
  const items = [
    ['1', 'High Density Foam Sheet 40D', '392190', '10', 'sheet', '650.00', '6,500.00'],
    ['2', 'Premium Velvet Upholstery Fabric', '580126', '5', 'meter', '420.00', '2,100.00'],
  ]

  let y = 278
  for (const row of items) {
    ctx.fillText(row[0], 75, y)
    ctx.fillText(row[1], 155, y)
    ctx.fillText(row[2], 780, y)
    ctx.fillText(row[3], 950, y)
    ctx.fillText(row[4], 1090, y)
    ctx.fillText(row[5], 1245, y)
    ctx.fillText(row[6], 1415, y)
    y += 68
  }

  ctx.beginPath()
  ctx.moveTo(50, y)
  ctx.lineTo(width - 50, y)
  ctx.stroke()

  ctx.fillText('Subtotal:', 1120, y + 52)
  ctx.fillText('8,600.00', 1415, y + 52)
  ctx.fillText('GST (18%):', 1120, y + 96)
  ctx.fillText('1,548.00', 1415, y + 96)
  ctx.font = 'bold 24px DejaVu Sans'
  ctx.fillText('Final Total:', 1105, y + 148)
  ctx.fillText('10,148.00', 1405, y + 148)

  return canvas.toBuffer('image/png')
}

test('Scenarios 1 & 2: Uploading bill on empty form autofills eligible fields, whereas manual supplier name is preserved with bill suggestion', async () => {
  const pngBuffer = renderPrimaryBillPng()
  const ocrResult = await extractBillTextLocally(pngBuffer)
  const parsed = parseBillOcrText(ocrResult, CATALOG)

  assert.equal(parsed.lineItems.length, 2)

  const emptyHeaderValues = {
    purchaseDate: '2026-10-28',
    supplierName: '',
    supplierInvoiceNumber: '',
    projectId: '',
    discountAmount: '',
    taxAmount: '',
    otherCharges: '',
    notes: '',
  }
  const emptyHeaderMeta = createInitialHeaderFieldMeta()

  const scenario1Header = mergeHeaderFieldsWithOcr({
    values: emptyHeaderValues,
    fieldMeta: emptyHeaderMeta,
    fieldSuggestions: {},
    parsedOcr: parsed,
  })
  const scenario1Lines = mergeLineItemsWithOcr({
    existingRows: [createEmptyLineItem()],
    existingSuggestedRows: [],
    incomingOcrRows: parsed.lineItems,
  })

  assert.match(scenario1Header.values.supplierName, /KERALA UPHOLSTERY/i)
  assert.equal(scenario1Header.values.supplierInvoiceNumber, 'INV-2026-501')
  assert.equal(scenario1Header.values.purchaseDate, '2026-10-22')
  assert.equal(scenario1Header.values.taxAmount, '1548')
  assert.equal(scenario1Header.fieldMeta.supplierName.source, 'ocr')
  assert.equal(Object.keys(scenario1Header.fieldSuggestions).length, 0)
  assert.equal(scenario1Lines.lineItems.length, 2)
  assert.equal(scenario1Lines.suggestedLineItems.length, 0)

  const totals1 = calculateVoucherPreviewTotals(scenario1Lines.lineItems, {
    discountAmount: scenario1Header.values.discountAmount,
    taxAmount: scenario1Header.values.taxAmount,
    otherCharges: scenario1Header.values.otherCharges,
  })
  assert.equal(totals1.subtotal, 8600)
  assert.equal(totals1.finalTotal, 10148)

  const manualSupplierValues = {
    ...emptyHeaderValues,
    supplierName: 'Vazhakkala Timber Mart',
  }
  const manualSupplierMeta = {
    ...createInitialHeaderFieldMeta(),
    supplierName: createFieldProvenance('manual', { touched: true }),
  }

  const scenario2Header = mergeHeaderFieldsWithOcr({
    values: manualSupplierValues,
    fieldMeta: manualSupplierMeta,
    fieldSuggestions: {},
    parsedOcr: parsed,
  })

  assert.equal(scenario2Header.values.supplierName, 'Vazhakkala Timber Mart')
  assert.ok(isFieldProtected(scenario2Header.fieldMeta.supplierName))
  assert.ok(scenario2Header.fieldSuggestions.supplierName)
  assert.match(
    scenario2Header.fieldSuggestions.supplierName.value,
    /KERALA UPHOLSTERY/i,
  )
  assert.equal(scenario2Header.values.supplierInvoiceNumber, 'INV-2026-501')
  assert.equal(scenario2Header.values.taxAmount, '1548')
})

test('Scenario 3: Partial manual edits (including touched empty field and untouched default date) protect edited fields and fill only untouched fields', () => {
  const parsed = parseBillOcrText(
    [
      'COCHIN FOAMS LLP',
      'Invoice No: CF-404   Date: 18/10/2026',
      'Sl   Description   Qty   Unit   Rate   Amount',
      '1   High Density Foam Sheet 40D   6   sheet   650.00   3,900.00',
      'Subtotal: 3,900.00',
      'Less Discount: 150.00',
      'GST 18%: 675.00',
      'Freight Charges: 200.00',
      'Grand Total: 4,625.00',
    ].join('\n'),
    CATALOG,
  )

  const initialValues = {
    purchaseDate: '2026-10-28',
    supplierName: '',
    supplierInvoiceNumber: '',
    projectId: 'proj-sofa-99',
    discountAmount: '300',
    taxAmount: '',
    otherCharges: '',
    notes: 'Urgent workshop restock',
  }
  const initialMeta = {
    ...createInitialHeaderFieldMeta(),
    supplierInvoiceNumber: createFieldProvenance('manual', { touched: true }),
    projectId: createFieldProvenance('manual', { touched: true }),
    discountAmount: createFieldProvenance('manual', { touched: true }),
    notes: createFieldProvenance('manual', { touched: true }),
  }

  const merged = mergeHeaderFieldsWithOcr({
    values: initialValues,
    fieldMeta: initialMeta,
    fieldSuggestions: {},
    parsedOcr: parsed,
  })

  assert.equal(merged.values.supplierName, 'COCHIN FOAMS LLP')
  assert.equal(merged.values.purchaseDate, '2026-10-18')
  assert.equal(merged.values.taxAmount, '675')
  assert.equal(merged.values.otherCharges, '200')

  assert.equal(merged.values.projectId, 'proj-sofa-99')
  assert.equal(merged.values.notes, 'Urgent workshop restock')
  assert.equal(merged.values.discountAmount, '300')
  assert.equal(merged.fieldSuggestions.discountAmount?.value, '150')

  assert.equal(merged.values.supplierInvoiceNumber, '')
  assert.equal(merged.fieldSuggestions.supplierInvoiceNumber?.value, 'CF-404')
})

test('Scenario 4: Editing an OCR-filled quantity or confirming a row and rerunning OCR preserves user values without appending duplicates', () => {
  const parsed = parseBillOcrText(
    [
      'KERALA UPHOLSTERY & FOAM SUPPLIES',
      'Invoice No: INV-88   Date: 21/10/2026',
      'Sl   Description   Qty   Unit   Rate   Amount',
      '1   High Density Foam Sheet 40D   10   sheet   650.00   6,500.00',
      '2   Premium Velvet Upholstery Fabric   5   meter   420.00   2,100.00',
      'Subtotal: 8,600.00',
      'Grand Total: 8,600.00',
    ].join('\n'),
    CATALOG,
  )

  const firstRun = mergeLineItemsWithOcr({
    existingRows: [createEmptyLineItem()],
    existingSuggestedRows: [],
    incomingOcrRows: parsed.lineItems,
  })
  assert.equal(firstRun.lineItems.length, 2)

  const editedRow0 = applyManualLineItemEdit(
    firstRun.lineItems[0],
    'quantity',
    '14',
  )
  const confirmedRow1 = confirmLineItemOcrValues(firstRun.lineItems[1])

  const rerunResult = mergeLineItemsWithOcr({
    existingRows: [editedRow0, confirmedRow1],
    existingSuggestedRows: [],
    incomingOcrRows: parsed.lineItems,
  })

  assert.equal(rerunResult.lineItems.length, 2)
  assert.equal(rerunResult.suggestedLineItems.length, 0)
  assert.equal(rerunResult.lineItems[0].quantity, '14')
  assert.equal(rerunResult.lineItems[0].rowSuggestions.quantity?.value, '10')
  assert.equal(rerunResult.lineItems[1].quantity, '5')
  assert.equal(rerunResult.lineItems[1].fieldMeta.quantity.confirmed, true)

  const dismissed = dismissLineItemSuggestion(
    rerunResult.lineItems[0],
    'quantity',
  )
  assert.equal(dismissed.quantity, '14')
  assert.equal(dismissed.rowSuggestions.quantity, undefined)

  const accepted = acceptLineItemSuggestion(
    rerunResult.lineItems[0],
    'quantity',
  )
  assert.equal(accepted.quantity, '10')
  assert.equal(accepted.fieldMeta.quantity.confirmed, true)
})

test('Scenario 5: Adding manual material rows first then uploading a bill preserves manual rows, fills unambiguous empty fields, and queues additional bill items as suggestions', () => {
  let manualRow1 = createEmptyLineItem()
  manualRow1 = applyManualLineItemEdit(
    manualRow1,
    'materialId',
    'mat-foam-40d',
  )
  manualRow1 = applyManualLineItemEdit(manualRow1, 'quantity', '12')

  let manualRow2 = createEmptyLineItem()
  manualRow2 = applyManualLineItemEdit(
    manualRow2,
    'materialId',
    'mat-teak-legs',
  )
  manualRow2 = applyManualLineItemEdit(manualRow2, 'quantity', '4')
  manualRow2 = applyManualLineItemEdit(manualRow2, 'unitPrice', '180')

  const parsed = parseBillOcrText(
    [
      'KERALA UPHOLSTERY & FOAM SUPPLIES',
      'Invoice No: INV-900   Date: 24/10/2026',
      'Sl   Description   Qty   Unit   Rate   Amount',
      '1   High Density Foam Sheet 40D   10   sheet   650.00   6,500.00',
      '2   Synthetic Wood Adhesive   5   kg   230.00   1,150.00',
      'Subtotal: 7,650.00',
      'Grand Total: 7,650.00',
    ].join('\n'),
    CATALOG,
  )

  const merged = mergeLineItemsWithOcr({
    existingRows: [manualRow1, manualRow2],
    existingSuggestedRows: [],
    incomingOcrRows: parsed.lineItems,
  })

  assert.equal(merged.lineItems.length, 2)
  assert.equal(merged.lineItems[0].materialId, 'mat-foam-40d')
  assert.equal(merged.lineItems[0].quantity, '12')
  assert.equal(merged.lineItems[0].unitPrice, '650')
  assert.equal(merged.lineItems[0].rowSuggestions.quantity?.value, '10')

  assert.equal(merged.lineItems[1].materialId, 'mat-teak-legs')
  assert.equal(merged.lineItems[1].quantity, '4')
  assert.equal(merged.lineItems[1].unitPrice, '180')

  assert.equal(merged.suggestedLineItems.length, 1)
  assert.equal(merged.suggestedLineItems[0].materialId, 'mat-wood-adhesive')

  const rerun = mergeLineItemsWithOcr({
    existingRows: merged.lineItems,
    existingSuggestedRows: merged.suggestedLineItems,
    incomingOcrRows: parsed.lineItems,
  })
  assert.equal(rerun.suggestedLineItems.length, 1)

  const promoted = promoteSuggestedLineItemToRows(
    rerun.lineItems,
    rerun.suggestedLineItems[0],
  )
  assert.equal(promoted.length, 3)
  assert.equal(promoted[2].materialId, 'mat-wood-adhesive')
  assert.equal(promoted[2].quantity, '5')
})

test('Scenario 6: Uploading a second bill or replacing a bill after editing extracted fields never overwrites edited or confirmed values', () => {
  const bill1 = parseBillOcrText(
    [
      'MALABAR WOODS',
      'Invoice No: MW-101   Date: 19/10/2026',
      'Sl   Description   Qty   Unit   Rate   Amount',
      '1   High Density Foam Sheet 40D   8   sheet   640.00   5,120.00',
      'Subtotal: 5,120.00',
      'GST 18%: 921.60',
      'Grand Total: 6,041.60',
    ].join('\n'),
    CATALOG,
  )

  const afterBill1Header = mergeHeaderFieldsWithOcr({
    values: {
      purchaseDate: '2026-10-28',
      supplierName: '',
      supplierInvoiceNumber: '',
      projectId: '',
      discountAmount: '',
      taxAmount: '',
      otherCharges: '',
      notes: '',
    },
    fieldMeta: createInitialHeaderFieldMeta(),
    fieldSuggestions: {},
    parsedOcr: bill1,
  })
  const afterBill1Lines = mergeLineItemsWithOcr({
    existingRows: [createEmptyLineItem()],
    existingSuggestedRows: [],
    incomingOcrRows: bill1.lineItems,
  })

  const postEditValues = {
    ...afterBill1Header.values,
    supplierInvoiceNumber: 'MW-101-VERIFIED',
  }
  const postEditMeta = {
    ...afterBill1Header.fieldMeta,
    supplierName: {
      ...afterBill1Header.fieldMeta.supplierName,
      confirmed: true,
    },
    supplierInvoiceNumber: createFieldProvenance('manual', { touched: true }),
  }
  const editedLine0 = applyManualLineItemEdit(
    afterBill1Lines.lineItems[0],
    'unitPrice',
    '645',
  )

  const bill2 = parseBillOcrText(
    [
      'TRAVANCORE ADHESIVES',
      'Invoice No: TA-777   Date: 25/10/2026',
      'Sl   Description   Qty   Unit   Rate   Amount',
      '1   High Density Foam Sheet 40D   8   sheet   700.00   5,600.00',
      '2   Synthetic Wood Adhesive   3   kg   240.00   720.00',
      'Subtotal: 6,320.00',
      'GST 18%: 1,137.60',
      'Freight Charges: 150.00',
      'Grand Total: 7,607.60',
    ].join('\n'),
    CATALOG,
  )

  const afterBill2Header = mergeHeaderFieldsWithOcr({
    values: postEditValues,
    fieldMeta: postEditMeta,
    fieldSuggestions: {},
    parsedOcr: bill2,
    isAdditionalBill: true,
  })
  const afterBill2Lines = mergeLineItemsWithOcr({
    existingRows: [editedLine0],
    existingSuggestedRows: [],
    incomingOcrRows: bill2.lineItems,
    isAdditionalBill: true,
  })

  assert.equal(afterBill2Header.values.supplierName, 'MALABAR WOODS')
  assert.equal(
    afterBill2Header.fieldSuggestions.supplierName?.value,
    'TRAVANCORE ADHESIVES',
  )
  assert.equal(
    afterBill2Header.values.supplierInvoiceNumber,
    'MW-101-VERIFIED',
  )
  assert.equal(
    afterBill2Header.fieldSuggestions.supplierInvoiceNumber?.value,
    'TA-777',
  )
  assert.equal(afterBill2Header.values.taxAmount, '921.6')
  assert.equal(afterBill2Header.fieldSuggestions.taxAmount?.value, '1137.6')
  assert.equal(afterBill2Header.values.otherCharges, '150')

  assert.equal(afterBill2Lines.lineItems.length, 1)
  assert.equal(afterBill2Lines.lineItems[0].unitPrice, '645')
  assert.equal(
    afterBill2Lines.lineItems[0].rowSuggestions.unitPrice?.value,
    '700',
  )
  assert.equal(afterBill2Lines.suggestedLineItems.length, 1)
  assert.equal(
    afterBill2Lines.suggestedLineItems[0].materialId,
    'mat-wood-adhesive',
  )
})

test('Scenario 7: Uncertain bill rows and OCR failures preserve user entries and never contaminate financial totals', () => {
  let manualRow = createEmptyLineItem()
  manualRow = applyManualLineItemEdit(manualRow, 'materialId', 'mat-teak-legs')
  manualRow = applyManualLineItemEdit(manualRow, 'quantity', '10')
  manualRow = applyManualLineItemEdit(manualRow, 'unitPrice', '150')

  const billWithUncertainRow = parseBillOcrText(
    [
      'EDAPPALLY SUPPLIERS',
      'Invoice No: ES-55   Date: 26/10/2026',
      'Sl   Description   Qty   Unit   Rate   Amount',
      '1   Smudged Foam Item   5   sheet   500.00   9,999.00',
      'Subtotal: 9,999.00',
      'Grand Total: 9,999.00',
    ].join('\n'),
    CATALOG,
  )

  assert.equal(billWithUncertainRow.lineItems.length, 0)
  assert.equal(billWithUncertainRow.uncertainLineItems.length, 1)

  const mergedUncertain = mergeLineItemsWithOcr({
    existingRows: [manualRow],
    existingSuggestedRows: [],
    incomingOcrRows: billWithUncertainRow.lineItems,
  })
  assert.equal(mergedUncertain.lineItems.length, 1)
  assert.equal(mergedUncertain.lineItems[0].materialId, 'mat-teak-legs')

  const totals = calculateVoucherPreviewTotals(mergedUncertain.lineItems, {})
  assert.equal(totals.subtotal, 1500)
  assert.equal(totals.finalTotal, 1500)

  const failedOcr = parseBillOcrText('', CATALOG)
  assert.equal(failedOcr.hasContent, false)
  const mergedAfterFailure = mergeLineItemsWithOcr({
    existingRows: [manualRow],
    existingSuggestedRows: [],
    incomingOcrRows: failedOcr.lineItems,
  })
  assert.equal(mergedAfterFailure.lineItems.length, 1)
  assert.equal(mergedAfterFailure.lineItems[0].quantity, '10')
  assert.equal(mergedAfterFailure.lineItems[0].unitPrice, '150')
})
