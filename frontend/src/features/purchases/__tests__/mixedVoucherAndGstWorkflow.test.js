import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateVoucherPreviewTotals,
} from '../utils/purchaseMath.js'
import {
  parseBillOcrText,
  reconcileInvoiceTotals,
} from '../utils/billOcrParser.js'
import {
  createInitialHeaderFieldMeta,
  createFieldProvenance,
  createEmptyLineItem,
  createOcrLineItem,
  switchLineItemType,
  applyManualLineItemEdit,
  mergeHeaderFieldsWithOcr,
  mergeLineItemsWithOcr,
} from '../utils/voucherOcrMerge.js'
import {
  buildBulkMissingMaterialAnalysis,
  applyBulkMaterialSelection,
  buildVoucherLineItemPayload,
} from '../utils/purchaseMaterialCreation.js'

const MATERIALS_CATALOG = [
  {
    id: '507f1f77bcf86cd799439011',
    name: 'Cotton Sponge',
    normalizedName: 'cotton sponge',
    category: 'Foam',
    unit: 'Kilogram',
    quantityOnHand: 20,
    isActive: true,
  },
  {
    id: '507f1f77bcf86cd799439012',
    name: 'Nilambur Teak Frame',
    normalizedName: 'nilambur teak frame',
    category: 'Timber',
    unit: 'Running Feet',
    quantityOnHand: 45,
    isActive: true,
  },
]

const EXPENSE_HEADS_CATALOG = [
  {
    id: '67200000000000000000e101',
    name: 'Transportation',
    normalizedName: 'transportation',
    category: 'Transportation',
    isActive: true,
  },
  {
    id: '67200000000000000000e102',
    name: 'Equipment Rental',
    normalizedName: 'equipment rental',
    category: 'Equipment Rental',
    isActive: true,
  },
  {
    id: '67200000000000000000e103',
    name: 'Delivery & Freight Charges',
    normalizedName: 'delivery freight charges',
    category: 'Delivery',
    isActive: true,
  },
]

test('Scenarios 1, 2 & 3: Material-only, Expense-only, and Mixed vouchers compute accurate subtotals, payloads, and penny-exact project allocations', () => {
  const matMap = new Map(MATERIALS_CATALOG.map((m) => [m.id, m]))
  const headMap = new Map(EXPENSE_HEADS_CATALOG.map((h) => [h.id, h]))

  const matOnlyLine = {
    ...createEmptyLineItem('material'),
    materialId: MATERIALS_CATALOG[0].id,
    unit: 'Kilogram',
    quantity: '10',
    unitPrice: '200',
  }
  const matOnlyTotals = calculateVoucherPreviewTotals([matOnlyLine], {
    taxMode: 'percentage',
    taxRatePercent: '18',
  })
  assert.equal(matOnlyTotals.materialSubtotal, 2000)
  assert.equal(matOnlyTotals.expenseSubtotal, 0)
  assert.equal(matOnlyTotals.taxAmount, 360)
  assert.equal(matOnlyTotals.finalTotal, 2360)
  assert.equal(matOnlyTotals.materialAllocatedTotal, 2360)
  assert.equal(matOnlyTotals.expenseAllocatedTotal, 0)

  const expAmountLine = {
    ...createEmptyLineItem('expense'),
    expenseHeadId: EXPENSE_HEADS_CATALOG[0].id,
    description: 'Tempo transport from Ernakulam',
    expensePricingMode: 'amount',
    amount: '1200',
  }
  const expQtyRateLine = {
    ...createEmptyLineItem('expense'),
    expenseHeadId: EXPENSE_HEADS_CATALOG[1].id,
    description: 'Air compressor hire',
    expensePricingMode: 'qty_rate',
    unit: 'Piece',
    quantity: '2',
    unitPrice: '900',
  }
  const expOnlyTotals = calculateVoucherPreviewTotals(
    [expAmountLine, expQtyRateLine],
    {
      taxMode: 'percentage',
      taxRatePercent: '18',
    },
  )
  assert.equal(expOnlyTotals.materialSubtotal, 0)
  assert.equal(expOnlyTotals.expenseSubtotal, 3000)
  assert.equal(expOnlyTotals.taxAmount, 540)
  assert.equal(expOnlyTotals.finalTotal, 3540)
  assert.equal(expOnlyTotals.materialAllocatedTotal, 0)
  assert.equal(expOnlyTotals.expenseAllocatedTotal, 3540)

  const expPayloads = [expAmountLine, expQtyRateLine].map((r) =>
    buildVoucherLineItemPayload(r, matMap, headMap),
  )
  assert.deepEqual(expPayloads[0], {
    itemType: 'expense',
    expenseHeadId: '67200000000000000000e101',
    description: 'Tempo transport from Ernakulam',
    amount: 1200,
    remarks: '',
  })
  assert.deepEqual(expPayloads[1], {
    itemType: 'expense',
    expenseHeadId: '67200000000000000000e102',
    description: 'Air compressor hire',
    unit: 'Piece',
    quantity: 2,
    unitPrice: 900,
    amount: 1800,
    remarks: '',
  })

  const mixedExpenseLine = {
    ...createEmptyLineItem('expense'),
    expenseHeadId: EXPENSE_HEADS_CATALOG[2].id,
    description: 'Unloading & doorstep delivery',
    amount: '500',
  }
  const mixedTotals = calculateVoucherPreviewTotals(
    [matOnlyLine, mixedExpenseLine],
    {
      discountAmount: '250',
      taxMode: 'percentage',
      taxRatePercent: '18',
      otherCharges: '100',
    },
  )
  assert.equal(mixedTotals.materialSubtotal, 2000)
  assert.equal(mixedTotals.expenseSubtotal, 500)
  assert.equal(mixedTotals.subtotal, 2500)
  assert.equal(mixedTotals.taxableSubtotal, 2250)
  assert.equal(mixedTotals.taxAmount, 405)
  assert.equal(mixedTotals.finalTotal, 2755)
  assert.equal(mixedTotals.materialAllocatedTotal, 2204)
  assert.equal(mixedTotals.expenseAllocatedTotal, 551)
  assert.equal(
    mixedTotals.materialAllocatedTotal + mixedTotals.expenseAllocatedTotal,
    mixedTotals.finalTotal,
  )

  const explicitRateMatLine = { ...matOnlyLine, taxRate: '18' }
  const explicitRateExpLine = { ...mixedExpenseLine, taxRate: '5' }
  const explicitRateTotals = calculateVoucherPreviewTotals(
    [explicitRateMatLine, explicitRateExpLine],
    {
      taxMode: 'bill_amount',
      taxAmount: '385',
    },
  )
  assert.equal(explicitRateTotals.finalTotal, 2885)
  assert.equal(explicitRateTotals.materialAllocatedTotal, 2360)
  assert.equal(explicitRateTotals.expenseAllocatedTotal, 525)
})

test('Scenario 10 (UI switching): Switching line item type between Raw Material and Other Expense preserves user-entered values cleanly', () => {
  let row = createEmptyLineItem('material')
  row = applyManualLineItemEdit(row, 'materialId', MATERIALS_CATALOG[0].id)
  row = applyManualLineItemEdit(row, 'description', 'High density foam cushioning')
  row = applyManualLineItemEdit(row, 'quantity', '8')
  row = applyManualLineItemEdit(row, 'unitPrice', '250')
  row = applyManualLineItemEdit(row, 'remarks', 'Urgent site batch')

  const asExpense = switchLineItemType(row, 'expense')
  assert.equal(asExpense.itemType, 'expense')
  assert.equal(asExpense.description, 'High density foam cushioning')
  assert.equal(asExpense.amount, '2000')
  assert.equal(asExpense.quantity, '8')
  assert.equal(asExpense.unitPrice, '250')
  assert.equal(asExpense.remarks, 'Urgent site batch')

  const editedExpense = applyManualLineItemEdit(
    asExpense,
    'expenseHeadId',
    EXPENSE_HEADS_CATALOG[0].id,
  )
  const backToMaterial = switchLineItemType(editedExpense, 'material')
  assert.equal(backToMaterial.itemType, 'material')
  assert.equal(backToMaterial.materialId, MATERIALS_CATALOG[0].id)
  assert.equal(backToMaterial.expenseHeadId, EXPENSE_HEADS_CATALOG[0].id)
  assert.equal(backToMaterial.quantity, '8')
  assert.equal(backToMaterial.unitPrice, '250')
  assert.equal(backToMaterial.description, 'High density foam cushioning')
})

test('Scenarios 4, 5 & 12: Unrecognized OCR rows require explicit classification, uncertain rows stay excluded, and Bulk Missing Materials handles multi-select, reuse, and conflicts', () => {
  const matchedOcrRow = createOcrLineItem({
    materialId: MATERIALS_CATALOG[0].id,
    unit: 'Kilogram',
    quantity: '10',
    unitPrice: '180',
    extractedDescription: 'Cotton Sponge',
    detectedUnit: 'kg',
  })
  assert.equal(matchedOcrRow.itemType, 'material')

  const missingCurtainRow = createOcrLineItem({
    materialId: '',
    quantity: '15',
    unitPrice: '320',
    extractedDescription: 'Curtain Fabric',
    detectedUnit: 'm',
  })
  const missingRingsRow = createOcrLineItem({
    materialId: '',
    quantity: '24',
    unitPrice: '18',
    extractedDescription: 'Brass Curtain Rings',
    detectedUnit: 'pcs',
  })
  const reuseCaseInsensitiveRow = createOcrLineItem({
    materialId: '',
    quantity: '5',
    unitPrice: '180',
    extractedDescription: '  cotton   sponge ',
    detectedUnit: 'kg',
  })
  const unitConflictRow = createOcrLineItem({
    materialId: '',
    quantity: '4',
    unitPrice: '250',
    extractedDescription: 'Cotton Sponge',
    detectedUnit: 'mtr',
  })

  assert.equal(missingCurtainRow.itemType, '')
  assert.equal(missingRingsRow.itemType, '')

  const uncertainTrayRows = [
    {
      rawText: '99 ??? smudged ink 4500.00',
      extractedDescription: 'smudged ink',
      reason: 'Missing valid quantity or unit price',
    },
  ]

  const previewBeforeConfirm = calculateVoucherPreviewTotals(
    [matchedOcrRow, missingCurtainRow, missingRingsRow],
    {
      taxMode: 'bill_amount',
      taxAmount: '0',
    },
  )
  assert.equal(previewBeforeConfirm.unclassifiedCount, 2)
  assert.equal(previewBeforeConfirm.subtotal, 7032)
  assert.equal(previewBeforeConfirm.materialAllocatedTotal, 0)
  assert.equal(previewBeforeConfirm.expenseAllocatedTotal, 0)

  const analysis = buildBulkMissingMaterialAnalysis({
    lineItems: [
      matchedOcrRow,
      missingCurtainRow,
      missingRingsRow,
      reuseCaseInsensitiveRow,
      unitConflictRow,
    ],
    uncertainLineItems: uncertainTrayRows,
    existingMaterials: MATERIALS_CATALOG,
    stagedNewMaterials: [],
    draftEditsByRowKey: {
      [missingCurtainRow.rowKey]: {
        name: 'Sheer Curtain Linen',
        unit: 'Meter',
        category: 'Curtain',
      },
    },
  })

  assert.equal(analysis.matchedItems.length, 1)
  assert.equal(analysis.unresolvedItems.length, 1)
  assert.equal(analysis.proposedItems.length, 4)

  const curtainProp = analysis.proposedItems.find(
    (p) => p.rowKey === missingCurtainRow.rowKey,
  )
  assert.equal(curtainProp.status, 'ready_new')
  assert.equal(curtainProp.name, 'Sheer Curtain Linen')
  assert.equal(curtainProp.unit, 'Meter')

  const reuseProp = analysis.proposedItems.find(
    (p) => p.rowKey === reuseCaseInsensitiveRow.rowKey,
  )
  assert.equal(reuseProp.status, 'existing_compatible')
  assert.equal(reuseProp.existingMatch.id, MATERIALS_CATALOG[0].id)

  const conflictProp = analysis.proposedItems.find(
    (p) => p.rowKey === unitConflictRow.rowKey,
  )
  assert.equal(conflictProp.status, 'unit_conflict')
  assert.equal(conflictProp.canStage, false)

  const bulkResult = applyBulkMaterialSelection({
    lineItems: [
      matchedOcrRow,
      missingCurtainRow,
      missingRingsRow,
      reuseCaseInsensitiveRow,
    ],
    selectedRowKeys: [
      missingCurtainRow.rowKey,
      missingRingsRow.rowKey,
      reuseCaseInsensitiveRow.rowKey,
    ],
    analysis,
    existingMaterials: MATERIALS_CATALOG,
    stagedNewMaterials: [],
  })

  assert.equal(bulkResult.ok, true)
  assert.equal(bulkResult.createdStagedCount, 2)
  assert.equal(bulkResult.reusedExistingCount, 1)
  assert.equal(bulkResult.nextStagedNewMaterials.length, 2)

  for (const updatedRow of bulkResult.nextLineItems) {
    assert.equal(updatedRow.itemType, 'material')
    assert.ok(updatedRow.materialId)
  }
  assert.equal(
    bulkResult.nextLineItems[3].materialId,
    MATERIALS_CATALOG[0].id,
  )
})

test('Scenarios 6, 7 & 8: Dummy GST Invoice (20110 + 3619.80 = 23729.80), Mode A vs Mode B GST, CGST+SGST non-double-counting, and 5-figure reconciliation', () => {
  const dummyBillText = [
    'Kakkanad Upholstery Supplies',
    'Invoice No: KUS-20110   Date: 29/10/2026',
    'Item Description   Qty   Unit   Rate   Amount',
    'Cotton Sponge   10   kg   2011.00   20110.00',
    'Taxable Subtotal 20,110.00',
    'CGST 9% 1,809.90',
    'SGST 9% 1,809.90',
    'Total GST 3,619.80',
    'Grand Total 23,729.80',
  ].join('\n')
  const parsedBill = parseBillOcrText(dummyBillText, MATERIALS_CATALOG)
  assert.equal(parsedBill.detectedSubtotal, 20110)
  assert.equal(parsedBill.cgstAmount, 1809.9)
  assert.equal(parsedBill.sgstAmount, 1809.9)
  assert.equal(Number(parsedBill.taxAmount), 3619.8)
  assert.equal(parsedBill.detectedGrandTotal, 23729.8)
  assert.equal(parsedBill.extractedTaxRatePercent, 18)

  const initialForm = {
    purchaseDate: '2026-10-29',
    supplierName: '',
    supplierInvoiceNumber: '',
    projectId: '',
    taxMode: 'bill_amount',
    taxRatePercent: '',
    discountAmount: '0',
    taxAmount: '0',
    otherCharges: '0',
    notes: '',
  }

  const mergedHeader = mergeHeaderFieldsWithOcr({
    values: initialForm,
    fieldMeta: createInitialHeaderFieldMeta(),
    parsedOcr: {
      supplierName: 'Kakkanad Upholstery Supplies',
      supplierConfidence: 'high',
      supplierInvoiceNumber: 'KUS-20110',
      invoiceNumberConfidence: 'high',
      purchaseDate: '2026-10-29',
      purchaseDateConfidence: 'high',
      taxAmount: '3619.8',
    },
  })

  assert.equal(mergedHeader.values.taxMode, 'bill_amount')
  assert.equal(mergedHeader.values.taxAmount, '3619.8')
  assert.equal(mergedHeader.values.taxRatePercent, '')

  const dummyLine = {
    ...createEmptyLineItem('material'),
    materialId: MATERIALS_CATALOG[0].id,
    quantity: '10',
    unitPrice: '2011',
  }

  const modeAPreview = calculateVoucherPreviewTotals([dummyLine], {
    taxMode: 'bill_amount',
    taxAmount: mergedHeader.values.taxAmount,
  })
  assert.equal(modeAPreview.subtotal, 20110)
  assert.equal(modeAPreview.taxAmount, 3619.8)
  assert.equal(modeAPreview.finalTotal, 23729.8)

  const matchedRecon = reconcileInvoiceTotals({
    calculatedSubtotal: modeAPreview.subtotal,
    discountAmount: modeAPreview.discountAmount,
    taxAmount: modeAPreview.taxAmount,
    otherCharges: modeAPreview.otherCharges,
    printedSubtotal: 20110,
    printedTaxAmount: 3619.8,
    printedFinalTotal: 23729.8,
    hasConfirmedItems: true,
  })
  assert.equal(matchedRecon.hasMismatch, false)
  assert.equal(matchedRecon.subtotalMatches, true)
  assert.equal(matchedRecon.taxMatches, true)
  assert.equal(matchedRecon.finalTotalMatches, true)

  const modeBPreview = calculateVoucherPreviewTotals([dummyLine], {
    taxMode: 'percentage',
    taxRatePercent: '12',
    taxAmount: '3619.8',
  })
  assert.equal(modeBPreview.taxAmount, 2413.2)
  assert.equal(modeBPreview.finalTotal, 22523.2)

  const mismatchRecon = reconcileInvoiceTotals({
    calculatedSubtotal: modeBPreview.subtotal,
    discountAmount: modeBPreview.discountAmount,
    taxAmount: modeBPreview.taxAmount,
    otherCharges: modeBPreview.otherCharges,
    printedSubtotal: 20110,
    printedTaxAmount: 3619.8,
    printedFinalTotal: 23729.8,
    hasConfirmedItems: true,
  })
  assert.equal(mismatchRecon.hasMismatch, true)
  assert.equal(mismatchRecon.taxMatches, false)
  assert.equal(mismatchRecon.finalTotalMatches, false)
  assert.ok(mismatchRecon.mismatchMessages.length >= 2)
})

test('Scenario 11: Rerunning OCR preserves manual Expense classification, Expense Head selection, and manual Percentage tax mode', () => {
  let expenseRow = createOcrLineItem({
    materialId: '',
    quantity: '1',
    unitPrice: '950',
    extractedDescription: 'Tempo Delivery Charge',
    detectedUnit: '',
  })
  expenseRow = switchLineItemType(expenseRow, 'expense')
  expenseRow = applyManualLineItemEdit(
    expenseRow,
    'expenseHeadId',
    EXPENSE_HEADS_CATALOG[0].id,
  )
  expenseRow = applyManualLineItemEdit(expenseRow, 'amount', '1100')

  const mergedRows = mergeLineItemsWithOcr({
    existingRows: [expenseRow],
    existingSuggestedRows: [],
    incomingOcrRows: [
      {
        materialId: '',
        quantity: '1',
        unitPrice: '950',
        extractedDescription: 'Tempo Delivery Charge',
        detectedUnit: '',
      },
    ],
  })

  assert.equal(mergedRows.lineItems.length, 1)
  assert.equal(mergedRows.lineItems[0].itemType, 'expense')
  assert.equal(mergedRows.lineItems[0].expenseHeadId, EXPENSE_HEADS_CATALOG[0].id)
  assert.equal(mergedRows.lineItems[0].amount, '1100')

  const manualTaxHeaderMeta = {
    ...createInitialHeaderFieldMeta(),
    taxMode: createFieldProvenance('manual', { touched: true }),
    taxRatePercent: createFieldProvenance('manual', { touched: true }),
  }
  const rerunTaxHeader = mergeHeaderFieldsWithOcr({
    values: {
      purchaseDate: '2026-10-29',
      supplierName: '',
      supplierInvoiceNumber: '',
      projectId: '',
      taxMode: 'percentage',
      taxRatePercent: '12',
      discountAmount: '0',
      taxAmount: '0',
      otherCharges: '0',
      notes: '',
    },
    fieldMeta: manualTaxHeaderMeta,
    parsedOcr: {
      taxAmount: '3619.8',
    },
  })
  assert.equal(rerunTaxHeader.values.taxMode, 'percentage')
  assert.equal(rerunTaxHeader.values.taxRatePercent, '12')
})
