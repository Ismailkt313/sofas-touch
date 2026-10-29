let stagedMaterialCounter = 1

export const STAGED_NEW_MATERIAL_PREFIX = 'pv-new-mat-'

export const CANONICAL_RAW_MATERIAL_CATEGORIES = Object.freeze([
  'Sofa',
  'Curtain',
  'Upholstery',
  'Timber',
  'Foam',
  'Hardware',
  'General',
])

export const CANONICAL_RAW_MATERIAL_UNITS = Object.freeze([
  'Kilogram',
  'Meter',
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

const UNIT_CANONICAL_MAP = Object.freeze({
  kilogram: 'Kilogram',
  kilograms: 'Kilogram',
  kg: 'Kilogram',
  kgs: 'Kilogram',
  kilo: 'Kilogram',
  meter: 'Meter',
  meters: 'Meter',
  metre: 'Meter',
  metres: 'Meter',
  m: 'Meter',
  mtr: 'Meter',
  mtrs: 'Meter',
  piece: 'Piece',
  pieces: 'Piece',
  pc: 'Piece',
  pcs: 'Piece',
  no: 'Piece',
  nos: 'Piece',
  sheet: 'Sheet',
  sheets: 'Sheet',
  sht: 'Sheet',
  roll: 'Roll',
  rolls: 'Roll',
  litre: 'Litre',
  litres: 'Litre',
  liter: 'Litre',
  liters: 'Litre',
  l: 'Litre',
  ltr: 'Litre',
  'square feet': 'Square Feet',
  sqft: 'Square Feet',
  sft: 'Square Feet',
  'sq ft': 'Square Feet',
  'sq. ft.': 'Square Feet',
  'running feet': 'Running Feet',
  rft: 'Running Feet',
  ft: 'Running Feet',
  feet: 'Running Feet',
  'running ft': 'Running Feet',
  yard: 'Yard',
  yards: 'Yard',
  yd: 'Yard',
  yds: 'Yard',
  set: 'Set',
  sets: 'Set',
  box: 'Box',
  boxes: 'Box',
  pair: 'Pair',
  pairs: 'Pair',
})

const UNIT_SHORT_DISPLAY = Object.freeze({
  Kilogram: 'kg',
  Meter: 'm',
  Piece: 'pcs',
  Sheet: 'Sheet',
  Roll: 'Roll',
  Litre: 'L',
  'Square Feet': 'sq ft',
  'Running Feet': 'rft',
  Yard: 'yd',
  Set: 'Set',
  Box: 'Box',
  Pair: 'Pair',
})

export function nextStagedMaterialTempId() {
  stagedMaterialCounter += 1
  return `${STAGED_NEW_MATERIAL_PREFIX}${stagedMaterialCounter}`
}

export function isStagedNewMaterialId(materialId) {
  return (
    typeof materialId === 'string' &&
    materialId.startsWith(STAGED_NEW_MATERIAL_PREFIX)
  )
}

export function normalizeMaterialDisplayName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeMaterialNameKey(value) {
  return normalizeMaterialDisplayName(value).toLowerCase()
}

export function resolveCanonicalMaterialUnit(rawUnit) {
  if (typeof rawUnit !== 'string') {
    return ''
  }
  const clean = rawUnit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  if (!clean) {
    return ''
  }
  if (UNIT_CANONICAL_MAP[clean]) {
    return UNIT_CANONICAL_MAP[clean]
  }
  const withoutDots = clean.replace(/\./g, '')
  return UNIT_CANONICAL_MAP[withoutDots] || ''
}

export function formatShortCanonicalUnit(unit) {
  const canonical = resolveCanonicalMaterialUnit(unit)
  if (canonical && UNIT_SHORT_DISPLAY[canonical]) {
    return UNIT_SHORT_DISPLAY[canonical]
  }
  return normalizeMaterialDisplayName(unit)
}

export function buildNewMaterialDraft({
  searchQuery = '',
  row = null,
  existingStagedMaterial = null,
} = {}) {
  if (existingStagedMaterial) {
    return {
      name: normalizeMaterialDisplayName(existingStagedMaterial.name),
      unit: resolveCanonicalMaterialUnit(existingStagedMaterial.unit),
      category: existingStagedMaterial.category || '',
      description: existingStagedMaterial.description || '',
    }
  }

  const candidateName = normalizeMaterialDisplayName(
    searchQuery || row?.extractedDescription || '',
  )
  const prefilledUnit = resolveCanonicalMaterialUnit(row?.detectedUnit || '')

  return {
    name: candidateName,
    unit: prefilledUnit,
    category: '',
    description: '',
  }
}

export function findMaterialNameCollision(
  name,
  {
    existingMaterials = [],
    stagedNewMaterials = [],
    editingTempId = '',
  } = {},
) {
  const nameKey = normalizeMaterialNameKey(name)
  if (!nameKey) {
    return { existingMatch: null, stagedMatch: null }
  }

  const existingMatch =
    existingMaterials.find(
      (mat) => mat && normalizeMaterialNameKey(mat.name) === nameKey,
    ) || null

  const stagedMatch =
    stagedNewMaterials.find(
      (mat) =>
        mat &&
        mat.tempId !== editingTempId &&
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
  const cleanName = normalizeMaterialDisplayName(draft.name)
  const canonicalUnit = resolveCanonicalMaterialUnit(draft.unit)
  const cleanCategory = normalizeMaterialDisplayName(draft.category)
  const cleanDescription = String(draft.description || '').trim()

  if (!cleanName) {
    errors.name = 'Material name is required.'
  } else if (cleanName.length > 150) {
    errors.name = 'Material name cannot exceed 150 characters.'
  }

  if (!canonicalUnit) {
    errors.unit = 'Select a valid purchase unit.'
  }

  if (
    cleanCategory &&
    !CANONICAL_RAW_MATERIAL_CATEGORIES.includes(cleanCategory)
  ) {
    errors.category = 'Select a valid category.'
  }

  if (cleanDescription.length > 1000) {
    errors.description = 'Description cannot exceed 1000 characters.'
  }

  const { existingMatch, stagedMatch } = findMaterialNameCollision(cleanName, {
    existingMaterials,
    stagedNewMaterials,
    editingTempId,
  })

  let conflict = null

  if (cleanName && existingMatch) {
    const existingUnit =
      resolveCanonicalMaterialUnit(existingMatch.unit) || existingMatch.unit
    if (existingMatch.isActive === false) {
      conflict = {
        type: 'inactive_existing',
        material: existingMatch,
        message: `An inactive raw material named "${existingMatch.name}" already exists in the catalogue. Enter a distinct material name.`,
      }
      errors.name = conflict.message
    } else if (canonicalUnit && existingUnit !== canonicalUnit) {
      conflict = {
        type: 'unit_conflict',
        material: existingMatch,
        message: `"${existingMatch.name}" already exists with unit ${existingUnit} (${formatShortCanonicalUnit(existingUnit)}), which conflicts with ${canonicalUnit} (${formatShortCanonicalUnit(canonicalUnit)}). Select the existing material or enter a distinct material name.`,
      }
      errors.unit = conflict.message
    } else {
      conflict = {
        type: 'existing_compatible',
        material: existingMatch,
        message: `"${existingMatch.name}" (${formatShortCanonicalUnit(existingUnit)}) already exists in Raw Materials.`,
      }
      errors.name = `Select the existing "${existingMatch.name}" material instead of creating a duplicate.`
    }
  } else if (cleanName && stagedMatch) {
    const stagedUnit =
      resolveCanonicalMaterialUnit(stagedMatch.unit) || stagedMatch.unit
    if (canonicalUnit && stagedUnit !== canonicalUnit) {
      conflict = {
        type: 'staged_unit_conflict',
        material: stagedMatch,
        message: `New material "${stagedMatch.name}" is already defined on this voucher with unit ${stagedUnit} (${formatShortCanonicalUnit(stagedUnit)}).`,
      }
      errors.unit = conflict.message
    } else {
      conflict = {
        type: 'staged_compatible',
        material: stagedMatch,
        message: `New material "${stagedMatch.name}" (${formatShortCanonicalUnit(stagedUnit)}) is already staged on this voucher.`,
      }
      errors.name = `Select the staged "${stagedMatch.name}" material instead of creating a duplicate.`
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
      conflict,
      value: null,
    }
  }

  return {
    isValid: true,
    errors: {},
    conflict: null,
    value: {
      name: cleanName,
      normalizedName: normalizeMaterialNameKey(cleanName),
      unit: canonicalUnit,
      category: cleanCategory || null,
      description: cleanDescription,
    },
  }
}

export function buildCreateMaterialDropdownAction({
  searchQuery = '',
  row = null,
  existingMaterials = [],
  stagedNewMaterials = [],
} = {}) {
  const typedName = normalizeMaterialDisplayName(searchQuery)
  const billName = normalizeMaterialDisplayName(row?.extractedDescription || '')
  const candidateName = typedName || billName

  if (!candidateName) {
    return {
      value: '__create_new_material__',
      label: '+ Create new material...',
      description: 'Define a missing material without leaving this voucher',
      position: 'bottom',
      createName: '',
    }
  }

  const { existingMatch, stagedMatch } = findMaterialNameCollision(
    candidateName,
    {
      existingMaterials,
      stagedNewMaterials,
    },
  )

  const detectedCanonicalUnit = resolveCanonicalMaterialUnit(
    row?.detectedUnit || '',
  )

  if (stagedMatch) {
    const stagedCanonicalUnit = resolveCanonicalMaterialUnit(stagedMatch.unit)
    if (
      !detectedCanonicalUnit ||
      stagedCanonicalUnit === detectedCanonicalUnit
    ) {
      return null
    }
    return {
      value: '__create_new_material__',
      label: `+ Create "${candidateName}" with distinct unit...`,
      description: `Resolve unit conflict with staged ${stagedMatch.name} (${formatShortCanonicalUnit(stagedCanonicalUnit)})`,
      position: typedName ? 'bottom' : 'top',
      createName: candidateName,
    }
  }

  if (existingMatch) {
    const existingCanonicalUnit = resolveCanonicalMaterialUnit(
      existingMatch.unit,
    )
    if (
      existingMatch.isActive !== false &&
      (!detectedCanonicalUnit ||
        existingCanonicalUnit === detectedCanonicalUnit)
    ) {
      return null
    }
    return {
      value: '__create_new_material__',
      label: `+ Resolve or create "${candidateName}"...`,
      description:
        existingMatch.isActive === false
          ? 'Existing catalogue item is inactive — review name & unit'
          : `Existing item uses ${formatShortCanonicalUnit(existingCanonicalUnit)} — review conflict`,
      position: typedName ? 'bottom' : 'top',
      createName: candidateName,
    }
  }

  const unitHint = detectedCanonicalUnit
    ? `Unit: ${formatShortCanonicalUnit(detectedCanonicalUnit)} · review & confirm`
    : 'Review name & unit — saved with this purchase voucher'

  return {
    value: '__create_new_material__',
    label: `+ Create "${candidateName}" as new material`,
    description: unitHint,
    position: typedName ? 'bottom' : 'top',
    createName: candidateName,
  }
}

export function buildVoucherLineItemPayload(row, materialById) {
  const mat = materialById.get(row.materialId)
  const quantity = Number(row.quantity)
  const unitPrice = Number(row.unitPrice)
  const remarks = String(row.remarks || '').trim()

  if (mat?.isStagedNew || isStagedNewMaterialId(row.materialId)) {
    const source = mat || row.newMaterial || {}
    const newMaterial = {
      name: normalizeMaterialDisplayName(source.name),
      unit: resolveCanonicalMaterialUnit(source.unit) || source.unit,
    }
    if (source.category) {
      newMaterial.category = source.category
    }
    if (source.description) {
      newMaterial.description = String(source.description).trim()
    }
    return {
      newMaterial,
      unit: newMaterial.unit,
      quantity,
      unitPrice,
      remarks,
    }
  }

  return {
    materialId: row.materialId,
    unit: mat?.unit || undefined,
    quantity,
    unitPrice,
    remarks,
  }
}
