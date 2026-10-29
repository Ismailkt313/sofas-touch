import assert from 'node:assert/strict'
import test from 'node:test'
import { matchDescriptionToRawMaterials, parseBillOcrText } from '../utils/billOcrParser.js'
import {
  buildCreateMaterialDropdownAction,
  buildNewMaterialDraft,
  buildVoucherLineItemPayload,
  nextStagedMaterialTempId,
  resolveCanonicalMaterialUnit,
  validateStagedNewMaterialDraft,
} from '../utils/purchaseMaterialCreation.js'
import {
  applyManualLineItemEdit,
  createFieldProvenance,
  createOcrLineItem,
  mergeLineItemsWithOcr,
} from '../utils/voucherOcrMerge.js'

const CATALOG_FIXTURE = [
  {
    id: '507f1f77bcf86cd799439011',
    name: 'Cotton Sponge',
    category: 'Foam',
    unit: 'Kilogram',
    quantityOnHand: 20,
    isActive: true,
  },
  {
    id: '507f1f77bcf86cd799439012',
    name: 'Italian Velvet Sand',
    category: 'Upholstery',
    unit: 'Meter',
    quantityOnHand: 35,
    isActive: true,
  },
  {
    id: '507f1f77bcf86cd799439013',
    name: 'Archived Brass Stud',
    category: 'Hardware',
    unit: 'Box',
    quantityOnHand: 0,
    isActive: false,
  },
]

test('OCR never auto-creates materials for missing items and surfaces + Create "<name>" as new material with prefilled name and unit', () => {
  const billText = [
    'COCHIN DRAPERY MART',
    'Invoice No: CDM-402   Date: 28/10/2026',
    'Sl  Description           Qty   Unit   Rate     Amount',
    '1   Cotton Sponge         10    kg     180.00   1,800.00',
    '2   Curtain               15    m      320.00   4,800.00',
    'Grand Total: 6,600.00',
  ].join('\n')

  const parsed = parseBillOcrText(billText, CATALOG_FIXTURE)
  assert.equal(parsed.lineItems.length, 2)

  assert.equal(parsed.lineItems[0].materialId, '507f1f77bcf86cd799439011')
  assert.equal(parsed.lineItems[1].materialId, '')
  assert.equal(parsed.lineItems[1].extractedDescription, 'Curtain')
  assert.equal(parsed.lineItems[1].detectedUnit, 'Meter')

  const curtainRow = createOcrLineItem(parsed.lineItems[1])
  const createAction = buildCreateMaterialDropdownAction({
    searchQuery: '',
    row: curtainRow,
    existingMaterials: CATALOG_FIXTURE,
    stagedNewMaterials: [],
  })

  assert.ok(createAction)
  assert.equal(createAction.label, '+ Create "Curtain" as new material')
  assert.equal(createAction.position, 'top')
  assert.equal(createAction.createName, 'Curtain')

  const prefilledDraft = buildNewMaterialDraft({
    searchQuery: '',
    row: curtainRow,
  })
  assert.equal(prefilledDraft.name, 'Curtain')
  assert.equal(prefilledDraft.unit, 'Meter')
})

test('resolveCanonicalMaterialUnit maps common invoice unit abbreviations and leaves unknown units blank for user confirmation', () => {
  assert.equal(resolveCanonicalMaterialUnit('m'), 'Meter')
  assert.equal(resolveCanonicalMaterialUnit('mtrs'), 'Meter')
  assert.equal(resolveCanonicalMaterialUnit('kgs'), 'Kilogram')
  assert.equal(resolveCanonicalMaterialUnit('pcs'), 'Piece')
  assert.equal(resolveCanonicalMaterialUnit('sqft'), 'Square Feet')
  assert.equal(resolveCanonicalMaterialUnit('rft'), 'Running Feet')
  assert.equal(resolveCanonicalMaterialUnit('pkt'), '')
  assert.equal(resolveCanonicalMaterialUnit(''), '')

  const nonCatalogUnitMatch = matchDescriptionToRawMaterials(
    'Cotton Sponge',
    CATALOG_FIXTURE,
    'pkt',
  )
  assert.equal(nonCatalogUnitMatch.matchedMaterialId, '')
  assert.ok(nonCatalogUnitMatch.suggestions.length >= 1)
})

test('validateStagedNewMaterialDraft normalizes names and blocks duplicates and unit conflicts cleanly', () => {
  const validNew = validateStagedNewMaterialDraft(
    {
      name: '  Curtain   Lining  ',
      unit: 'm',
      category: 'Curtain',
      description: 'Width 54 inch',
    },
    {
      existingMaterials: CATALOG_FIXTURE,
      stagedNewMaterials: [],
    },
  )
  assert.equal(validNew.isValid, true)
  assert.equal(validNew.value.name, 'Curtain Lining')
  assert.equal(validNew.value.normalizedName, 'curtain lining')
  assert.equal(validNew.value.unit, 'Meter')

  const sameUnitExisting = validateStagedNewMaterialDraft(
    {
      name: '  cotton   sponge ',
      unit: 'Kilogram',
    },
    {
      existingMaterials: CATALOG_FIXTURE,
      stagedNewMaterials: [],
    },
  )
  assert.equal(sameUnitExisting.isValid, false)
  assert.equal(sameUnitExisting.conflict?.type, 'existing_compatible')
  assert.equal(
    sameUnitExisting.conflict?.material?.id,
    '507f1f77bcf86cd799439011',
  )

  const conflictingUnitExisting = validateStagedNewMaterialDraft(
    {
      name: 'Cotton Sponge',
      unit: 'Meter',
    },
    {
      existingMaterials: CATALOG_FIXTURE,
      stagedNewMaterials: [],
    },
  )
  assert.equal(conflictingUnitExisting.isValid, false)
  assert.equal(conflictingUnitExisting.conflict?.type, 'unit_conflict')
  assert.ok(conflictingUnitExisting.errors.unit)

  const inactiveCollision = validateStagedNewMaterialDraft(
    {
      name: 'archived brass stud',
      unit: 'Box',
    },
    {
      existingMaterials: CATALOG_FIXTURE,
      stagedNewMaterials: [],
    },
  )
  assert.equal(inactiveCollision.isValid, false)
  assert.equal(inactiveCollision.conflict?.type, 'inactive_existing')

  const suppressedDropdownDup = buildCreateMaterialDropdownAction({
    searchQuery: 'Cotton Sponge',
    row: null,
    existingMaterials: CATALOG_FIXTURE,
    stagedNewMaterials: [],
  })
  assert.equal(suppressedDropdownDup, null)
})

test('Confirmed staged new material builds inline newMaterial payload and stays protected during OCR re-runs', () => {
  const tempId = nextStagedMaterialTempId()
  const staged = {
    tempId,
    isStagedNew: true,
    name: 'Curtain',
    normalizedName: 'curtain',
    unit: 'Meter',
    category: 'Curtain',
    description: 'Blackout weave',
  }

  const materialById = new Map([
    [CATALOG_FIXTURE[0].id, CATALOG_FIXTURE[0]],
    [tempId, { ...staged, id: tempId }],
  ])

  const existingRow = {
    rowKey: 'row-1',
    materialId: CATALOG_FIXTURE[0].id,
    quantity: '10',
    unitPrice: '180',
    remarks: 'Foam batch A',
  }

  let newMatRow = createOcrLineItem({
    materialId: '',
    quantity: '15',
    unitPrice: '320',
    extractedDescription: 'Curtain',
    detectedUnit: 'm',
  })
  newMatRow = applyManualLineItemEdit(newMatRow, 'materialId', tempId)
  newMatRow = {
    ...newMatRow,
    fieldMeta: {
      ...newMatRow.fieldMeta,
      materialId: createFieldProvenance('manual', {
        touched: true,
        confirmed: true,
      }),
    },
  }

  const payloadLines = [existingRow, newMatRow].map((r) =>
    buildVoucherLineItemPayload(r, materialById),
  )

  assert.deepEqual(payloadLines[0], {
    materialId: '507f1f77bcf86cd799439011',
    unit: 'Kilogram',
    quantity: 10,
    unitPrice: 180,
    remarks: 'Foam batch A',
  })

  assert.deepEqual(payloadLines[1], {
    itemType: 'material',
    newMaterial: {
      name: 'Curtain',
      unit: 'Meter',
      category: 'Curtain',
      description: 'Blackout weave',
    },
    unit: 'Meter',
    description: 'Curtain',
    quantity: 15,
    unitPrice: 320,
    remarks: '',
  })

  const afterReprocess = mergeLineItemsWithOcr({
    existingRows: [newMatRow],
    existingSuggestedRows: [],
    incomingOcrRows: [
      {
        materialId: '507f1f77bcf86cd799439012',
        quantity: '15',
        unitPrice: '320',
        extractedDescription: 'Curtain',
        detectedUnit: 'm',
      },
    ],
    dismissedFingerprints: [],
    isAdditionalBill: false,
  })

  assert.equal(afterReprocess.lineItems[0].materialId, tempId)
})
