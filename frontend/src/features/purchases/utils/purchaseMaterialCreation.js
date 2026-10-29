export const SUPPORTED_MATERIAL_UNITS = Object.freeze([
  'Meter',
  'Kilogram',
  'Piece',
  'Sheet',
  'Roll',
  'Litre',
  'Square Feet',
  'Running Feet',
  'Yard',
  'Set',
  'Box',
  'Pair',
])

const MAX_NAME_LEN = 120
const MAX_DESC_LEN = 500

const UNIT_SYNONYM_TO_CANONICAL = Object.freeze({
  m: 'Meter',
  mtr: 'Meter',
  mtrs: 'Meter',
  meter: 'Meter',
  meters: 'Meter',
  metre: 'Meter',
  metres: 'Meter',
  kg: 'Kilogram',
  kgs: 'Kilogram',
  kilo: 'Kilogram',
  kilos: 'Kilogram',
  kilogram: 'Kilogram',
  kilograms: 'Kilogram',
  gm: 'Kilogram',
  pc: 'Piece',
  pcs: 'Piece',
  nos: 'Piece',
  no: 'Piece',
  piece: 'Piece',
  pieces: 'Piece',
  unit: 'Piece',
  units: 'Piece',
  sheet: 'Sheet',
  sheets: 'Sheet',
  sht: 'Sheet',
  shts: 'Sheet',
  roll: 'Roll',
  rolls: 'Roll',
  rl: 'Roll',
  l: 'Litre',
  ltr: 'Litre',
  ltrs: 'Litre',
  litre: 'Litre',
  litres: 'Litre',
  liter: 'Litre',
  liters: 'Litre',
  sqft: 'Square Feet',
  sft: 'Square Feet',
  'sq ft': 'Square Feet',
  'sq feet': 'Square Feet',
  'square feet': 'Square Feet',
  'square foot': 'Square Feet',
  rft: 'Running Feet',
  'r ft': 'Running Feet',
  ft: 'Running Feet',
  feet: 'Running Feet',
  foot: 'Running Feet',
  'running feet': 'Running Feet',
  'running foot': 'Running Feet',
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
})

let stagedMaterialCounter = 1

export function nextStagedMaterialTempId() {
  const id = `staged-new-mat-${stagedMaterialCounter}`
  stagedMaterialCounter += 1
  return id
}

export function normalizeMaterialDisplayName(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeMaterialNameKey(raw) {
  return normalizeMaterialDisplayName(raw).toLowerCase()
}

export function resolveCanonicalMaterialUnit(rawUnit) {
  const clean = String(rawUnit ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
  if (!clean) {
    return ''
  }

  const exactSupported = SUPPORTED_MATERIAL_UNITS.find(
    (u) => u.toLowerCase() === clean.toLowerCase(),
  )
  if (exactSupported) {
    return exactSupported
  }

  return UNIT_SYNONYM_TO_CANONICAL[clean.toLowerCase()] || ''
}

export function findCatalogMaterialMatchByName(
  name,
  existingMaterials = [],
  stagedNewMaterials = [],
  excludeTempId = '',
) {
  const nameKey = normalizeMaterialNameKey(name)
  if (!nameKey) {
    return { existingMatch: null, stagedMatch: null }
  }

  const existingMatch =
    (existingMaterials || []).find(
      (mat) => mat && normalizeMaterialNameKey(mat.name) === nameKey,
    ) || null

  const stagedMatch =
    (stagedNewMaterials || []).find(
      (mat) =>
        mat &&
        mat.tempId !== excludeTempId &&
        normalizeMaterialNameKey(mat.name) === nameKey,
    ) || null

  return { existingMatch, stagedMatch }
}

export function validateStagedNewMaterialDraft(
  draft = {},
  {
    existingMaterials = [],
    stagedNewMaterials = [],
    editingTempId = '',
  } = {},
) {
  const errors = {}
  const name = normalizeMaterialDisplayName(draft.name)
  const nameKey = normalizeMaterialNameKey(name)
  const unit = resolveCanonicalMaterialUnit(draft.unit)
  const rawCategory = String(draft.category ?? '').trim()
  const category = rawCategory || 'General'
  const description = String(draft.description ?? '').trim()

  if (!name) {
    errors.name = 'Material name is required.'
  } else if (name.length < 2) {
    errors.name = 'Material name must be at least 2 characters.'
  } else if (name.length > MAX_NAME_LEN) {
    errors.name = `Material name cannot exceed ${MAX_NAME_LEN} characters.`
  }

  if (!unit) {
    errors.unit = 'Select a valid measurement unit.'
  }

  if (description.length > MAX_DESC_LEN) {
    errors.description = `Description cannot exceed ${MAX_DESC_LEN} characters.`
  }

  const { existingMatch, stagedMatch } = findCatalogMaterialMatchByName(
    name,
    existingMaterials,
    stagedNewMaterials,
    editingTempId,
  )

  let conflict = null

  if (!errors.name && existingMatch) {
    const existingUnit = resolveCanonicalMaterialUnit(existingMatch.unit) || existingMatch.unit
    if (existingMatch.isActive === false) {
      conflict = {
        type: 'inactive_existing',
        material: existingMatch,
        message: `An inactive raw material named "${existingMatch.name}" (${existingUnit}) already exists. Reactivate it in Raw Materials or enter a distinct name.`,
      }
      errors.name = conflict.message
    } else if (unit && existingUnit !== unit) {
      conflict = {
        type: 'unit_conflict',
        material: existingMatch,
        message: `"${existingMatch.name}" already exists with unit "${existingUnit}" (not "${unit}"). Select the existing material or enter a distinct name.`,
      }
      errors.unit = conflict.message
    } else {
      conflict = {
        type: 'existing_compatible',
        material: existingMatch,
        message: `"${existingMatch.name}" (${existingUnit}) already exists in Raw Materials.`,
      }
      errors.name = conflict.message
    }
  } else if (!errors.name && stagedMatch) {
    if (unit && stagedMatch.unit !== unit) {
      conflict = {
        type: 'staged_unit_conflict',
        material: stagedMatch,
        message: `"${stagedMatch.name}" is already staged on this voucher with unit "${stagedMatch.unit}".`,
      }
      errors.unit = conflict.message
    } else {
      conflict = {
        type: 'staged_compatible',
        material: stagedMatch,
        message: `"${stagedMatch.name}" (${stagedMatch.unit}) is already staged for creation on this voucher.`,
      }
      errors.name = conflict.message
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
      conflict,
    }
  }

  return {
    isValid: true,
    errors: {},
    conflict: null,
    value: {
      name,
      normalizedName: nameKey,
      unit,
      category,
      description,
    },
  }
}

export function buildNewMaterialDraft({
  searchQuery = '',
  row = null,
  existingStagedMaterial = null,
} = {}) {
  if (existingStagedMaterial) {
    return {
      name: normalizeMaterialDisplayName(existingStagedMaterial.name || ''),
      unit: resolveCanonicalMaterialUnit(existingStagedMaterial.unit || ''),
      category: existingStagedMaterial.category || 'General',
      description: String(existingStagedMaterial.description || ''),
    }
  }

  const candidateName = normalizeMaterialDisplayName(
    searchQuery || row?.description || row?.extractedDescription || '',
  ).slice(0, MAX_NAME_LEN)
  const candidateUnit = resolveCanonicalMaterialUnit(
    row?.unit || row?.detectedUnit || '',
  )

  return {
    name: candidateName,
    unit: candidateUnit,
    category: 'General',
    description: '',
  }
}

export function buildCreateMaterialDropdownAction({
  searchQuery = '',
  row = null,
  existingMaterials = [],
  stagedNewMaterials = [],
} = {}) {
  const typedName = normalizeMaterialDisplayName(searchQuery)
  const ocrUnmatchedName =
    !row?.materialId &&
    row?.itemType !== 'expense' &&
    row?.extractedDescription
      ? normalizeMaterialDisplayName(row.extractedDescription)
      : ''

  const targetName = typedName || ocrUnmatchedName
  const targetKey = normalizeMaterialNameKey(targetName)

  if (targetKey) {
    const exactExists =
      (existingMaterials || []).some(
        (m) => m && normalizeMaterialNameKey(m.name) === targetKey,
      ) ||
      (stagedNewMaterials || []).some(
        (m) => m && normalizeMaterialNameKey(m.name) === targetKey,
      )

    if (exactExists && typedName) {
      return null
    }

    if (!exactExists && targetName.length >= 2) {
      const displaySlice =
        targetName.length > 42 ? `${targetName.slice(0, 39)}...` : targetName
      return {
        label: `+ Create "${displaySlice}" as new material`,
        createName: targetName,
        position: ocrUnmatchedName && !typedName ? 'top' : 'bottom',
      }
    }
  }

  return {
    label: '+ Create new raw material...',
    createName: '',
    position: 'bottom',
  }
}

export function buildBulkMissingMaterialAnalysis({
  lineItems = [],
  uncertainLineItems = [],
  existingMaterials = [],
  stagedNewMaterials = [],
  draftEditsByRowKey = {},
} = {}) {
  const existingById = new Map()
  for (const mat of existingMaterials || []) {
    if (mat?.id) existingById.set(mat.id, mat)
  }
  const stagedById = new Map()
  for (const st of stagedNewMaterials || []) {
    if (st?.tempId) stagedById.set(st.tempId, st)
  }

  const matchedItems = []
  const rawProposed = []
  const unresolvedItems = []

  for (let idx = 0; idx < (lineItems || []).length; idx += 1) {
    const row = lineItems[idx]
    if (!row) continue

    if (row.itemType === 'expense') {
      if (row.expenseHeadId) {
        matchedItems.push({
          rowKey: row.rowKey,
          lineNumber: idx + 1,
          kind: 'expense',
          label:
            normalizeMaterialDisplayName(
              row.description || row.extractedDescription,
            ) || 'Expense item',
          unit: row.unit || '',
          quantity: row.quantity || '',
        })
      }
      continue
    }

    if (row.materialId) {
      const stagedMat = stagedById.get(row.materialId)
      const catalogMat = existingById.get(row.materialId)
      if (stagedMat) {
        matchedItems.push({
          rowKey: row.rowKey,
          lineNumber: idx + 1,
          kind: 'staged_new',
          materialId: stagedMat.tempId,
          label: stagedMat.name,
          unit: stagedMat.unit,
          quantity: row.quantity || '',
        })
        continue
      }
      if (catalogMat) {
        matchedItems.push({
          rowKey: row.rowKey,
          lineNumber: idx + 1,
          kind: 'existing_material',
          materialId: catalogMat.id,
          label: catalogMat.name,
          unit: catalogMat.unit,
          quantity: row.quantity || '',
        })
        continue
      }
    }

    const ocrSourceDesc = normalizeMaterialDisplayName(
      row.extractedDescription || row.description || '',
    )
    const edit = draftEditsByRowKey[row.rowKey] || {}
    const hasEditName = Object.prototype.hasOwnProperty.call(edit, 'name')
    const hasEditUnit = Object.prototype.hasOwnProperty.call(edit, 'unit')

    const proposedName = normalizeMaterialDisplayName(
      hasEditName ? edit.name : ocrSourceDesc,
    )
    const proposedUnit = hasEditUnit
      ? resolveCanonicalMaterialUnit(edit.unit)
      : resolveCanonicalMaterialUnit(row.unit || row.detectedUnit || '')
    const proposedCategory = String(edit.category || 'General').trim() || 'General'

    const isBlankManualRow =
      !ocrSourceDesc &&
      !proposedName &&
      !String(row.quantity || '').trim() &&
      !String(row.unitPrice || '').trim()

    if (isBlankManualRow) {
      continue
    }

    if (!ocrSourceDesc && !proposedName) {
      unresolvedItems.push({
        key: row.rowKey,
        rowKey: row.rowKey,
        source: 'line',
        lineNumber: idx + 1,
        rawText: 'Missing item description',
        reason: 'Enter an item name or classify manually.',
      })
      continue
    }

    rawProposed.push({
      rowKey: row.rowKey,
      lineNumber: idx + 1,
      ocrDescription: ocrSourceDesc,
      detectedUnitRaw: row.detectedUnit || row.unit || '',
      quantity: row.quantity || '',
      unitPrice: row.unitPrice || '',
      name: proposedName,
      normalizedName: normalizeMaterialNameKey(proposedName),
      unit: proposedUnit,
      category: proposedCategory,
    })
  }

  for (let uIdx = 0; uIdx < (uncertainLineItems || []).length; uIdx += 1) {
    const uRow = uncertainLineItems[uIdx]
    if (!uRow) continue
    unresolvedItems.push({
      key: `uncertain-${uIdx}`,
      uncertainIndex: uIdx,
      source: 'uncertain',
      rawText:
        uRow.extractedDescription ||
        uRow.rawRowText ||
        uRow.rawText ||
        'Ambiguous bill line',
      quantity: uRow.quantity || uRow.candidateQuantity || '',
      unitPrice: uRow.unitPrice || uRow.candidateUnitPrice || '',
      detectedUnit: uRow.detectedUnit || '',
      reason:
        Array.isArray(uRow.validationReasons) && uRow.validationReasons.length > 0
          ? uRow.validationReasons[0]
          : 'Unverified OCR row — confirm before adding to voucher.',
    })
  }

  const unitsByNormalizedName = new Map()
  for (const item of rawProposed) {
    if (!item.normalizedName) continue
    if (!unitsByNormalizedName.has(item.normalizedName)) {
      unitsByNormalizedName.set(item.normalizedName, new Set())
    }
    if (item.unit) {
      unitsByNormalizedName.get(item.normalizedName).add(item.unit)
    }
  }

  const proposedItems = rawProposed.map((item) => {
    if (!item.name || item.name.length < 2) {
      return {
        ...item,
        status: 'missing_name',
        canStage: false,
        existingMatch: null,
        stagedMatch: null,
        statusMessage: 'Enter a valid material name (at least 2 characters).',
      }
    }

    const { existingMatch, stagedMatch } = findCatalogMaterialMatchByName(
      item.name,
      existingMaterials,
      stagedNewMaterials,
    )

    if (existingMatch) {
      const existingUnit =
        resolveCanonicalMaterialUnit(existingMatch.unit) || existingMatch.unit
      if (existingMatch.isActive === false) {
        return {
          ...item,
          status: 'inactive_existing',
          canStage: false,
          existingMatch,
          stagedMatch: null,
          statusMessage: `Inactive material "${existingMatch.name}" (${existingUnit}) already exists. Use a distinct name.`,
        }
      }
      if (item.unit && item.unit !== existingUnit) {
        return {
          ...item,
          status: 'unit_conflict',
          canStage: false,
          existingMatch,
          stagedMatch: null,
          statusMessage: `Unit conflict: "${existingMatch.name}" already exists with unit "${existingUnit}".`,
        }
      }
      return {
        ...item,
        unit: item.unit || existingUnit,
        status: 'existing_compatible',
        canStage: true,
        existingMatch,
        stagedMatch: null,
        statusMessage: `Matches existing "${existingMatch.name}" (${existingUnit}) — will link instead of duplicating.`,
      }
    }

    if (stagedMatch) {
      if (item.unit && item.unit !== stagedMatch.unit) {
        return {
          ...item,
          status: 'staged_unit_conflict',
          canStage: false,
          existingMatch: null,
          stagedMatch,
          statusMessage: `Unit conflict: "${stagedMatch.name}" is already staged with unit "${stagedMatch.unit}".`,
        }
      }
      return {
        ...item,
        unit: item.unit || stagedMatch.unit,
        status: 'staged_compatible',
        canStage: true,
        existingMatch: null,
        stagedMatch,
        statusMessage: `Matches staged "${stagedMatch.name}" (${stagedMatch.unit}) — will reuse.`,
      }
    }

    if (!item.unit) {
      return {
        ...item,
        status: 'missing_unit',
        canStage: false,
        existingMatch: null,
        stagedMatch: null,
        statusMessage: 'Select a measurement unit before creating.',
      }
    }

    const batchUnits = unitsByNormalizedName.get(item.normalizedName)
    if (batchUnits && batchUnits.size > 1) {
      return {
        ...item,
        status: 'intra_batch_unit_conflict',
        canStage: false,
        existingMatch: null,
        stagedMatch: null,
        statusMessage: `Conflicting units selected across duplicate "${item.name}" rows.`,
      }
    }

    return {
      ...item,
      status: 'ready_new',
      canStage: true,
      existingMatch: null,
      stagedMatch: null,
      statusMessage: 'Ready to create at 0 stock and increment on voucher save.',
    }
  })

  return {
    matchedItems,
    proposedItems,
    unresolvedItems,
    hasReviewContent:
      proposedItems.length > 0 || unresolvedItems.length > 0,
  }
}

export function applyBulkMaterialSelection({
  lineItems = [],
  selectedRowKeys = [],
  analysis = null,
  existingMaterials = [],
  stagedNewMaterials = [],
  draftEditsByRowKey = {},
} = {}) {
  const computedAnalysis =
    analysis ||
    buildBulkMissingMaterialAnalysis({
      lineItems,
      existingMaterials,
      stagedNewMaterials,
      draftEditsByRowKey,
    })

  const selectedSet = new Set(selectedRowKeys || [])
  const chosenProposals = computedAnalysis.proposedItems.filter((p) =>
    selectedSet.has(p.rowKey),
  )

  if (chosenProposals.length === 0) {
    return {
      ok: false,
      rowErrors: {},
      message: 'Select at least one proposed material to confirm.',
    }
  }

  const rowErrors = {}
  const selectedUnitsByName = new Map()
  for (const prop of chosenProposals) {
    if (!prop.canStage) {
      rowErrors[prop.rowKey] = prop.statusMessage
      continue
    }
    if (!selectedUnitsByName.has(prop.normalizedName)) {
      selectedUnitsByName.set(prop.normalizedName, new Set())
    }
    selectedUnitsByName.get(prop.normalizedName).add(prop.unit)
  }

  for (const prop of chosenProposals) {
    const uSet = selectedUnitsByName.get(prop.normalizedName)
    if (uSet && uSet.size > 1) {
      rowErrors[prop.rowKey] =
        `Conflicting units selected across "${prop.name}" rows.`
    }
  }

  if (Object.keys(rowErrors).length > 0) {
    const firstMsg = Object.values(rowErrors)[0]
    return {
      ok: false,
      rowErrors,
      message: firstMsg,
    }
  }

  const nextStaged = [...(stagedNewMaterials || [])]
  const targetByRowKey = new Map()
  const newlyCreatedByNameKey = new Map()
  let createdStagedCount = 0
  let reusedExistingCount = 0

  for (const prop of chosenProposals) {
    if (prop.status === 'existing_compatible' && prop.existingMatch) {
      const existingUnit =
        resolveCanonicalMaterialUnit(prop.existingMatch.unit) ||
        prop.existingMatch.unit
      targetByRowKey.set(prop.rowKey, {
        materialId: prop.existingMatch.id,
        unit: existingUnit,
        name: prop.existingMatch.name,
      })
      reusedExistingCount += 1
      continue
    }

    if (prop.status === 'staged_compatible' && prop.stagedMatch) {
      targetByRowKey.set(prop.rowKey, {
        materialId: prop.stagedMatch.tempId,
        unit: prop.stagedMatch.unit,
        name: prop.stagedMatch.name,
      })
      reusedExistingCount += 1
      continue
    }

    let createdStaged = newlyCreatedByNameKey.get(prop.normalizedName)
    if (!createdStaged) {
      const tempId = nextStagedMaterialTempId()
      createdStaged = {
        id: tempId,
        tempId,
        isStagedNew: true,
        isActive: true,
        quantityOnHand: 0,
        name: prop.name,
        normalizedName: prop.normalizedName,
        unit: prop.unit,
        category: prop.category || 'General',
        description: '',
      }
      nextStaged.push(createdStaged)
      newlyCreatedByNameKey.set(prop.normalizedName, createdStaged)
      createdStagedCount += 1
    }

    targetByRowKey.set(prop.rowKey, {
      materialId: createdStaged.tempId,
      unit: createdStaged.unit,
      name: createdStaged.name,
    })
  }

  const nextLineItems = (lineItems || []).map((row) => {
    const target = targetByRowKey.get(row.rowKey)
    if (!target) {
      return row
    }
    return {
      ...row,
      itemType: 'material',
      materialId: target.materialId,
      unit: target.unit,
      description: row.description || target.name,
      needsReview: false,
      fieldMeta: {
        ...(row.fieldMeta || {}),
        itemType: {
          source: 'manual',
          touched: true,
          confirmed: true,
        },
        materialId: {
          source: 'manual',
          touched: true,
          confirmed: true,
        },
      },
    }
  })

  return {
    ok: true,
    rowErrors: {},
    nextLineItems,
    nextStagedNewMaterials: nextStaged,
    createdStagedCount,
    reusedExistingCount,
  }
}

export function buildVoucherLineItemPayload(
  row,
  materialById,
  expenseHeadById = new Map(),
) {
  const remarks = String(row?.remarks || '').trim()
  const hasTaxRate =
    row?.taxRate !== null &&
    row?.taxRate !== undefined &&
    String(row.taxRate).trim() !== '' &&
    Number.isFinite(Number(row.taxRate))
  const taxRateObj = hasTaxRate ? { taxRate: Number(row.taxRate) } : {}

  if (row?.itemType === 'expense') {
    const headId = String(row?.expenseHeadId || '').trim()
    const head = expenseHeadById.get(headId) || null
    const description =
      String(
        row?.description || row?.extractedDescription || head?.name || '',
      ).trim() || 'Expense'

    const usesQtyRate =
      row?.expensePricingMode === 'qty_rate' &&
      String(row?.quantity ?? '').trim() !== '' &&
      String(row?.unitPrice ?? '').trim() !== ''

    if (usesQtyRate) {
      const qty = Number(row.quantity)
      const price = Number(row.unitPrice)
      const amt = Math.round((qty * price + Number.EPSILON) * 100) / 100
      const cleanUnit = resolveCanonicalMaterialUnit(row?.unit || '')
      return {
        itemType: 'expense',
        expenseHeadId: headId,
        description,
        ...(cleanUnit ? { unit: cleanUnit } : {}),
        quantity: qty,
        unitPrice: price,
        amount: amt,
        ...taxRateObj,
        remarks,
      }
    }

    return {
      itemType: 'expense',
      expenseHeadId: headId,
      description,
      amount: Number(row?.amount),
      ...taxRateObj,
      remarks,
    }
  }

  const matId = String(row?.materialId || '').trim()
  const material = materialById?.get ? materialById.get(matId) : null
  const quantity = Number(row?.quantity)
  const unitPrice = Number(row?.unitPrice)
  const explicitDesc = String(row?.description || '').trim()

  if (material && material.isStagedNew) {
    return {
      ...(row?.itemType ? { itemType: 'material' } : {}),
      newMaterial: {
        name: material.name,
        unit: material.unit,
        category: material.category || 'General',
        description: material.description || '',
      },
      unit: material.unit,
      ...(explicitDesc ? { description: explicitDesc } : {}),
      quantity,
      unitPrice,
      ...taxRateObj,
      remarks,
    }
  }

  return {
    ...(row?.itemType ? { itemType: 'material' } : {}),
    materialId: matId,
    ...(material?.unit ? { unit: material.unit } : {}),
    ...(explicitDesc ? { description: explicitDesc } : {}),
    quantity,
    unitPrice,
    ...taxRateObj,
    remarks,
  }
}
