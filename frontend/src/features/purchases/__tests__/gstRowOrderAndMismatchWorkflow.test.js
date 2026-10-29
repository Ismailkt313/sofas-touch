import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import {
  parseBillOcrText,
  reconcileInvoiceTotals,
} from '../utils/billOcrParser.js'
import { extractBillTextLocally } from '../utils/ocrEngine.js'
import {
  GST_PERCENTAGE_PRESETS,
  calculateTaxFromPercentage,
  calculateVoucherPreviewTotals,
  evaluateFinalTotalMismatchModal,
  roundTaxPercent,
} from '../utils/purchaseMath.js'
import {
  applyManualLineItemEdit,
  createEmptyLineItem,
  createFieldProvenance,
  createInitialHeaderFieldMeta,
  mergeHeaderFieldsWithOcr,
  mergeLineItemsWithOcr,
  prependEmptyLineItem,
  shiftLineItemFieldErrorsOnPrepend,
  shiftLineItemFieldErrorsOnRemove,
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
    quantityOnHand: 20,
    isActive: true,
  },
  {
    id: 'mat-velvet',
    name: 'Premium Velvet Upholstery Fabric',
    category: 'Upholstery',
    unit: 'Meter',
    quantityOnHand: 40,
    isActive: true,
  },
  {
    id: 'mat-teak',
    name: 'Kiln Dried Teak Wood Battens',
    category: 'Timber',
    unit: 'Square Feet',
    quantityOnHand: 50,
    isActive: true,
  },
  {
    id: 'mat-webbing',
    name: 'Elastic Sofa Webbing Roll',
    category: 'Hardware',
    unit: 'Roll',
    quantityOnHand: 10,
    isActive: true,
  },
  {
    id: 'mat-adhesive',
    name: 'Synthetic Wood Adhesive',
    category: 'Adhesive',
    unit: 'Kilogram',
    quantityOnHand: 15,
    isActive: true,
  },
  {
    id: 'mat-clips',
    name: 'Zig Zag Spring Clips Box',
    category: 'Hardware',
    unit: 'Box',
    quantityOnHand: 8,
    isActive: true,
  },
]

test('Real OCR on ₹-prefixed ₹23,729.80 GST invoice extracts ₹20,110.00 subtotal, 18% GST ₹3,619.80, and ₹23,729.80 final total instead of ₹619.80', async () => {
  const canvas = createCanvas(1650, 900)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 1650, 900)
  ctx.fillStyle = '#111111'

  ctx.font = 'bold 30px DejaVu Sans'
  ctx.fillText('KERALA UPHOLSTERY & FOAM SUPPLIES', 70, 80)
  ctx.font = '21px DejaVu Sans'
  ctx.fillText('Invoice No: INV-2026-0842   Date: 24/10/2026', 1050, 80)

  ctx.font = 'bold 22px DejaVu Sans'
  ctx.fillText('Sl', 75, 160)
  ctx.fillText('Description', 160, 160)
  ctx.fillText('HSN', 780, 160)
  ctx.fillText('Qty', 960, 160)
  ctx.fillText('Unit', 1100, 160)
  ctx.fillText('Rate', 1260, 160)
  ctx.fillText('Amount', 1430, 160)

  ctx.font = '22px DejaVu Sans'
  const rows = [
    ['1', 'High Density Foam Sheet 40D', '392190', '10', 'sheet', '₹650.00', '₹6,500.00'],
    ['2', 'Premium Velvet Upholstery Fabric', '580126', '15', 'meter', '₹420.00', '₹6,300.00'],
    ['3', 'Kiln Dried Teak Wood Battens', '440729', '8', 'sqft', '₹480.00', '₹3,840.00'],
    ['4', 'Elastic Sofa Webbing Roll', '580620', '4', 'roll', '₹450.00', '₹1,800.00'],
    ['5', 'Synthetic Wood Adhesive', '350691', '5', 'kg', '₹230.00', '₹1,150.00'],
    ['6', 'Zig Zag Spring Clips Box', '830242', '2', 'box', '₹260.00', '₹520.00'],
  ]

  let y = 225
  for (const r of rows) {
    ctx.fillText(r[0], 75, y)
    ctx.fillText(r[1], 160, y)
    ctx.fillText(r[2], 780, y)
    ctx.fillText(r[3], 960, y)
    ctx.fillText(r[4], 1100, y)
    ctx.fillText(r[5], 1260, y)
    ctx.fillText(r[6], 1430, y)
    y += 62
  }

  ctx.fillText('Material Subtotal:', 1060, y + 30)
  ctx.fillText('₹20,110.00', 1420, y + 30)

  ctx.fillText('GST at 18%:', 1060, y + 80)
  ctx.fillText('₹3,619.80', 1430, y + 80)

  ctx.font = 'bold 24px DejaVu Sans'
  ctx.fillText('Final Bill Total:', 1060, y + 135)
  ctx.fillText('₹23,729.80', 1410, y + 135)

  const ocrRes = await extractBillTextLocally(canvas.toBuffer('image/png'))
  const parsed = parseBillOcrText(ocrRes, CATALOG)

  assert.equal(parsed.lineItems.length, 6)
  assert.equal(parsed.uncertainLineItems.length, 0)
  assert.equal(parsed.detectedSubtotal, 20110)
  assert.equal(Number(parsed.taxAmount), 3619.8)
  assert.equal(parsed.printedTaxAmount, 3619.8)
  assert.equal(parsed.detectedTaxRatePercent, 18)
  assert.equal(parsed.taxBreakdownLabel, 'GST @ 18%')
  assert.equal(parsed.detectedGrandTotal, 23729.8)
  assert.equal(parsed.calculatedSubtotal, 20110)
  assert.equal(parsed.calculatedFinalTotal, 23729.8)
  assert.equal(parsed.totalsValidation.hasMismatch, false)
})

test('General ₹-symbol thousands OCR corruptions reconcile accurately across arbitrary invoice amounts without hardcoding', () => {
  const corruptedVariants23729 = [
    ['Material Subtotal: 20,110.00', 'GST @ 18%: R,619.80', 'Final Bill Total: 23,729.80'],
    ['Material Subtotal: 20,110.00', 'GST at 18%: 3%,619.80', 'Final Bill Total: 23,729.80'],
    ['Material Subtotal: 20,110.00', 'GST @ 18%: 3,   619.80', 'Final Bill Total: 23,729.80'],
    ['Material Subtotal: 320,110.00', 'GST @ 18%: 33,619.80', 'Final Bill Total: 323,729.80'],
  ]

  for (const summaryLines of corruptedVariants23729) {
    const text = [
      'MALABAR CUSHION HOUSE',
      'Invoice No: MCH-908   Date: 25/10/2026',
      'Sl  Description                       Qty  Unit   Rate     Amount',
      '1   High Density Foam Sheet 40D       10   sheet  650.00   6,500.00',
      '2   Premium Velvet Upholstery Fabric  15   meter  420.00   6,300.00',
      '3   Kiln Dried Teak Wood Battens      8    sqft   480.00   3,840.00',
      '4   Elastic Sofa Webbing Roll         4    roll   450.00   1,800.00',
      '5   Synthetic Wood Adhesive           5    kg     230.00   1,150.00',
      '6   Zig Zag Spring Clips Box          2    box    260.00   520.00',
      ...summaryLines,
    ].join('\n')

    const parsed = parseBillOcrText(text, CATALOG)
    assert.equal(parsed.detectedSubtotal, 20110)
    assert.equal(Number(parsed.taxAmount), 3619.8)
    assert.equal(parsed.printedTaxAmount, 3619.8)
    assert.equal(parsed.detectedTaxRatePercent, 18)
    assert.equal(parsed.detectedGrandTotal, 23729.8)
    assert.equal(parsed.calculatedFinalTotal, 23729.8)
  }

  const differentInvoiceText = [
    'THRISSUR TIMBER TRADERS',
    'Invoice No: TTT-114   Date: 26/10/2026',
    'Sl  Description                   Qty   Unit   Rate     Amount',
    '1   Kiln Dried Teak Wood Battens  25    sqft   498.00   12,450.00',
    'Material Subtotal: 12,450.00',
    'GST @ 18%: R,241.00',
    'Grand Total: 14,691.00',
  ].join('\n')

  const parsedOther = parseBillOcrText(differentInvoiceText, CATALOG)
  assert.equal(parsedOther.detectedSubtotal, 12450)
  assert.equal(Number(parsedOther.taxAmount), 2241)
  assert.equal(parsedOther.detectedTaxRatePercent, 18)
  assert.equal(parsedOther.detectedGrandTotal, 14691)
})

test('GST extraction handles CGST + SGST components, combined CGST+SGST, IGST, metadata isolation, and non-GST invoices without inventing 18%', () => {
  const cgstSgstWithTotal = [
    'KOCHI FOAM TRADERS',
    'GSTIN: 32AABCS1429B1Z5   Invoice No: GST-2026-1899   Date: 27/10/2026',
    'Sl  Description                   HSN      Qty  Unit   Rate     Amount',
    '1   High Density Foam Sheet 40D   392190   10   sheet  650.00   6,500.00',
    'Subtotal: 6,500.00',
    'CGST @ 9%: 585.00',
    'SGST @ 9%: 585.00',
    'Total GST: 1,170.00',
    'Grand Total: 7,670.00',
  ].join('\n')

  const parsedSplit = parseBillOcrText(cgstSgstWithTotal, CATALOG)
  assert.equal(Number(parsedSplit.taxAmount), 1170)
  assert.equal(parsedSplit.printedTaxAmount, 1170)
  assert.equal(parsedSplit.detectedTaxRatePercent, 18)
  assert.equal(parsedSplit.taxBreakdownLabel, 'CGST 9% + SGST 9%')
  assert.equal(parsedSplit.calculatedFinalTotal, 7670)

  const combinedCgstSgstSingleLine = [
    'KOCHI FOAM TRADERS',
    'Invoice No: INV-4401   Date: 27/10/2026',
    'Sl  Description                   Qty  Unit   Rate     Amount',
    '1   High Density Foam Sheet 40D   10   sheet  650.00   6,500.00',
    'Subtotal: 6,500.00',
    'CGST + SGST (12%): 780.00',
    'Grand Total: 7,280.00',
  ].join('\n')

  const parsedCombined = parseBillOcrText(combinedCgstSgstSingleLine, CATALOG)
  assert.equal(Number(parsedCombined.taxAmount), 780)
  assert.equal(parsedCombined.detectedTaxRatePercent, 12)
  assert.equal(parsedCombined.taxBreakdownLabel, 'CGST + SGST (12%)')
  assert.equal(parsedCombined.calculatedFinalTotal, 7280)

  const igstInvoice = [
    'COIMBATORE WEAVING MILLS',
    'Invoice No: CWM-772   Date: 27/10/2026',
    'Sl  Description                       Qty  Unit   Rate     Amount',
    '1   Premium Velvet Upholstery Fabric  20   meter  400.00   8,000.00',
    'Taxable Value: 8,000.00',
    'IGST @ 5%: 400.00',
    'Invoice Total: 8,400.00',
  ].join('\n')

  const parsedIgst = parseBillOcrText(igstInvoice, CATALOG)
  assert.equal(Number(parsedIgst.taxAmount), 400)
  assert.equal(parsedIgst.detectedTaxRatePercent, 5)
  assert.equal(parsedIgst.taxBreakdownLabel, 'IGST @ 5%')
  assert.equal(parsedIgst.calculatedFinalTotal, 8400)

  const nonGstBill = [
    'CHALAKUDY TIMBER YARD',
    'GST No: N/A   Bill No: 9818   HSN Code: 440729   Date: 28/10/2026',
    'Sl  Description                   Qty  Unit   Rate     Amount',
    '1   Kiln Dried Teak Wood Battens  10   sqft   500.00   5,000.00',
    'Total Amount: 5,000.00',
  ].join('\n')

  const parsedNoGst = parseBillOcrText(nonGstBill, CATALOG)
  assert.equal(parsedNoGst.taxAmount, '')
  assert.equal(parsedNoGst.printedTaxAmount, null)
  assert.equal(parsedNoGst.detectedTaxRatePercent, null)
  assert.equal(parsedNoGst.taxBreakdownLabel, '')
  assert.equal(parsedNoGst.calculatedFinalTotal, 5000)
})

test('Readable printed GST is preserved when an item row is uncertain, and reconcileInvoiceTotals distinguishes printed GST from modified GST', () => {
  const partialBill = [
    'KERALA UPHOLSTERY & FOAM SUPPLIES',
    'Invoice No: INV-2026-0843   Date: 28/10/2026',
    'Sl  Description                       Qty  Unit   Rate     Amount',
    '1   High Density Foam Sheet 40D       10   sheet  650.00   6,500.00',
    '2   Smudged Fabric Entry              15   meter  420.00   9,999.00',
    'Material Subtotal: 20,110.00',
    'GST @ 18%: 3,619.80',
    'Final Bill Total: 23,729.80',
  ].join('\n')

  const parsed = parseBillOcrText(partialBill, CATALOG)
  assert.equal(parsed.lineItems.length, 1)
  assert.equal(parsed.uncertainLineItems.length, 1)
  assert.equal(Number(parsed.taxAmount), 3619.8)
  assert.equal(parsed.printedTaxAmount, 3619.8)

  const overriddenReconcile = reconcileInvoiceTotals({
    calculatedSubtotal: 20110,
    printedSubtotal: 20110,
    printedTaxAmount: 3619.8,
    discountAmount: 0,
    taxAmount: 2413.2,
    otherCharges: 0,
    printedFinalTotal: 23729.8,
  })
  assert.equal(overriddenReconcile.taxMatches, false)
  assert.equal(overriddenReconcile.hasMismatch, true)
  assert.match(overriddenReconcile.mismatchMessages[0], /printed bill GST/i)
})

test('Tax percentage presets, manual GST % overrides, and OCR header merge never overwrite manual tax edits', () => {
  assert.deepEqual(GST_PERCENTAGE_PRESETS, [0, 5, 12, 18, 28])
  assert.equal(roundTaxPercent(''), null)
  assert.equal(roundTaxPercent('18'), 18)
  assert.equal(roundTaxPercent('12.5'), 12.5)
  assert.equal(roundTaxPercent('-5'), null)
  assert.equal(roundTaxPercent('120'), null)

  assert.equal(calculateTaxFromPercentage(20110, 0, 18), 3619.8)
  assert.equal(calculateTaxFromPercentage(20110, 0, 12), 2413.2)
  assert.equal(calculateTaxFromPercentage(20110, 0, 0), 0)
  assert.equal(calculateTaxFromPercentage(10000, 1000, 18), 1620)

  const previewAt18 = calculateVoucherPreviewTotals(
    [{ quantity: '10', unitPrice: '2011' }],
    { discountAmount: '0', taxAmount: '3619.8', otherCharges: '0' },
  )
  assert.equal(previewAt18.subtotal, 20110)
  assert.equal(previewAt18.taxableSubtotal, 20110)
  assert.equal(previewAt18.taxAmount, 3619.8)
  assert.equal(previewAt18.finalTotal, 23729.8)

  const manualValues = {
    purchaseDate: '2026-10-28',
    supplierName: '',
    supplierInvoiceNumber: '',
    projectId: '',
    discountAmount: '',
    taxRatePercent: '12',
    taxAmount: '2413.2',
    otherCharges: '',
    notes: '',
  }
  const manualMeta = {
    ...createInitialHeaderFieldMeta(),
    taxRatePercent: createFieldProvenance('manual', { touched: true }),
    taxAmount: createFieldProvenance('manual', { touched: true }),
  }

  const merged = mergeHeaderFieldsWithOcr({
    values: manualValues,
    fieldMeta: manualMeta,
    fieldSuggestions: {},
    parsedOcr: {
      supplierName: 'Kerala Foam Supplies',
      supplierConfidence: 'high',
      detectedTaxRatePercent: 18,
      taxAmount: '3619.8',
    },
  })

  assert.equal(merged.values.taxRatePercent, '12')
  assert.equal(merged.values.taxAmount, '2413.2')
  assert.equal(merged.fieldSuggestions.taxAmount?.value, '3619.8')
})

test('+ Add Material prepends each new empty row at index 0, preserves existing rows and field errors, and avoids OCR duplication', () => {
  let rowA = createEmptyLineItem()
  rowA = applyManualLineItemEdit(rowA, 'materialId', 'mat-foam-40d')
  rowA = applyManualLineItemEdit(rowA, 'quantity', '10')
  rowA = applyManualLineItemEdit(rowA, 'unitPrice', '650')
  const rowAKey = rowA.rowKey

  const firstPrepend = prependEmptyLineItem([rowA])
  assert.equal(firstPrepend.lineItems.length, 2)
  assert.equal(firstPrepend.lineItems[0].rowKey, firstPrepend.newRow.rowKey)
  assert.equal(firstPrepend.lineItems[0].materialId, '')
  assert.equal(firstPrepend.lineItems[1].rowKey, rowAKey)
  assert.equal(firstPrepend.lineItems[1].materialId, 'mat-foam-40d')
  assert.equal(firstPrepend.lineItems[1].quantity, '10')
  assert.equal(firstPrepend.lineItems[1].unitPrice, '650')

  const secondPrepend = prependEmptyLineItem(firstPrepend.lineItems)
  assert.equal(secondPrepend.lineItems.length, 3)
  assert.equal(secondPrepend.lineItems[0].rowKey, secondPrepend.newRow.rowKey)
  assert.equal(secondPrepend.lineItems[1].rowKey, firstPrepend.newRow.rowKey)
  assert.equal(secondPrepend.lineItems[2].rowKey, rowAKey)

  const initialErrors = {
    supplierName: 'Supplier name is required.',
    'lineItems[0].materialId': 'Select a material.',
    'lineItems[1].quantity': 'Enter quantity.',
  }
  const shiftedOnAdd = shiftLineItemFieldErrorsOnPrepend(initialErrors)
  assert.equal(shiftedOnAdd.supplierName, 'Supplier name is required.')
  assert.equal(shiftedOnAdd['lineItems[0].materialId'], undefined)
  assert.equal(shiftedOnAdd['lineItems[1].materialId'], 'Select a material.')
  assert.equal(shiftedOnAdd['lineItems[2].quantity'], 'Enter quantity.')

  const shiftedOnRemoveTop = shiftLineItemFieldErrorsOnRemove(shiftedOnAdd, 0)
  assert.equal(shiftedOnRemoveTop['lineItems[0].materialId'], 'Select a material.')
  assert.equal(shiftedOnRemoveTop['lineItems[1].quantity'], 'Enter quantity.')

  const ocrSeed = mergeLineItemsWithOcr({
    existingRows: [createEmptyLineItem()],
    existingSuggestedRows: [],
    incomingOcrRows: [
      {
        extractedDescription: 'High Density Foam Sheet 40D',
        detectedUnit: 'Sheet',
        materialId: 'mat-foam-40d',
        quantity: '10',
        unitPrice: '650',
      },
      {
        extractedDescription: 'Premium Velvet Upholstery Fabric',
        detectedUnit: 'Meter',
        materialId: 'mat-velvet',
        quantity: '15',
        unitPrice: '420',
      },
    ],
  })
  assert.equal(ocrSeed.lineItems.length, 2)
  assert.equal(ocrSeed.lineItems[0].materialId, 'mat-foam-40d')
  assert.equal(ocrSeed.lineItems[1].materialId, 'mat-velvet')

  const withManualTopRow = prependEmptyLineItem(ocrSeed.lineItems)
  let editedTop = applyManualLineItemEdit(
    withManualTopRow.lineItems[0],
    'materialId',
    'mat-adhesive',
  )
  editedTop = applyManualLineItemEdit(editedTop, 'quantity', '5')
  editedTop = applyManualLineItemEdit(editedTop, 'unitPrice', '230')
  const rowsBeforeRerun = [editedTop, ...withManualTopRow.lineItems.slice(1)]

  const afterRerun = mergeLineItemsWithOcr({
    existingRows: rowsBeforeRerun,
    existingSuggestedRows: [],
    incomingOcrRows: [
      {
        extractedDescription: 'High Density Foam Sheet 40D',
        detectedUnit: 'Sheet',
        materialId: 'mat-foam-40d',
        quantity: '10',
        unitPrice: '650',
      },
      {
        extractedDescription: 'Premium Velvet Upholstery Fabric',
        detectedUnit: 'Meter',
        materialId: 'mat-velvet',
        quantity: '15',
        unitPrice: '420',
      },
    ],
  })

  assert.equal(afterRerun.lineItems.length, 3)
  assert.equal(afterRerun.lineItems[0].materialId, 'mat-adhesive')
  assert.equal(afterRerun.lineItems[1].materialId, 'mat-foam-40d')
  assert.equal(afterRerun.lineItems[2].materialId, 'mat-velvet')
  assert.equal(afterRerun.suggestedLineItems.length, 0)
})

test('Final total mismatch modal triggers only when bill is attached, printed total exists, and difference exceeds ₹1.00', () => {
  const mismatch3000 = evaluateFinalTotalMismatchModal({
    hasAttachedBill: true,
    printedBillTotal: 23729.8,
    calculatedVoucherTotal: 20729.8,
    tolerance: 1.0,
  })
  assert.equal(mismatch3000.shouldConfirm, true)
  assert.equal(mismatch3000.printedBillTotal, 23729.8)
  assert.equal(mismatch3000.calculatedVoucherTotal, 20729.8)
  assert.equal(mismatch3000.difference, 3000)

  const withinRounding = evaluateFinalTotalMismatchModal({
    hasAttachedBill: true,
    printedBillTotal: 23729.8,
    calculatedVoucherTotal: 23730.4,
    tolerance: 1.0,
  })
  assert.equal(withinRounding.shouldConfirm, false)

  const noBillAttached = evaluateFinalTotalMismatchModal({
    hasAttachedBill: false,
    printedBillTotal: 23729.8,
    calculatedVoucherTotal: 20729.8,
    tolerance: 1.0,
  })
  assert.equal(noBillAttached.shouldConfirm, false)

  const noPrintedTotal = evaluateFinalTotalMismatchModal({
    hasAttachedBill: true,
    printedBillTotal: null,
    calculatedVoucherTotal: 20729.8,
    tolerance: 1.0,
  })
  assert.equal(noPrintedTotal.shouldConfirm, false)

  const exactOneRupeeBoundary = evaluateFinalTotalMismatchModal({
    hasAttachedBill: true,
    printedBillTotal: 23729.8,
    calculatedVoucherTotal: 23728.8,
    tolerance: 1.0,
  })
  assert.equal(exactOneRupeeBoundary.shouldConfirm, false)

  const justOverOneRupeeBoundary = evaluateFinalTotalMismatchModal({
    hasAttachedBill: true,
    printedBillTotal: 23729.8,
    calculatedVoucherTotal: 23728.75,
    tolerance: 1.0,
  })
  assert.equal(justOverOneRupeeBoundary.shouldConfirm, true)
  assert.equal(justOverOneRupeeBoundary.difference, 1.05)
})
