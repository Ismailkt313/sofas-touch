import {
  RAW_MATERIAL_CATEGORIES,
  RAW_MATERIAL_UNITS,
  RawMaterialCategory,
  RawMaterialUnit,
  normalizeMaterialDisplayName,
  normalizeRawMaterialCategory,
  normalizeRawMaterialUnit,
} from '../models/raw-material.model';
import { ValidationResult } from '../types';

export interface CreateRawMaterialDto {
  name: string;
  category: RawMaterialCategory | null;
  unit: RawMaterialUnit;
  quantityOnHand?: number;
  description: string;
}

const SYSTEM_MANAGED_FIELDS = new Set([
  '_id',
  'id',
  'normalizedName',
  'createdAt',
  'updatedAt',
  '__v',
  'createdBy',
]);

const STATUS_FIELDS = new Set(['isActive', 'status']);

const ALLOWED_CREATE_FIELDS = new Set([
  'name',
  'category',
  'unit',
  'quantityOnHand',
  'initialQuantity',
  'description',
]);

export function validateCreateRawMaterialDto(
  body: unknown,
): ValidationResult<CreateRawMaterialDto> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(raw)) {
    if (SYSTEM_MANAGED_FIELDS.has(key)) {
      errors[key] = `'${key}' is system-managed and cannot be supplied when creating a raw material.`;
    } else if (STATUS_FIELDS.has(key)) {
      errors[key] = `'${key}' cannot be set during creation. New raw materials start active by default.`;
    } else if (!ALLOWED_CREATE_FIELDS.has(key)) {
      errors[key] = `'${key}' is not a valid raw material field.`;
    }
  }

  let name = '';
  if (raw.name === undefined || raw.name === null || typeof raw.name !== 'string') {
    errors.name = 'Material name is required.';
  } else {
    const normalizedName = normalizeMaterialDisplayName(raw.name);
    if (!normalizedName) {
      errors.name = 'Material name is required.';
    } else if (normalizedName.length > 150) {
      errors.name = 'Material name cannot exceed 150 characters.';
    } else {
      name = normalizedName;
    }
  }

  let unit: RawMaterialUnit | null = null;
  if (raw.unit === undefined || raw.unit === null || typeof raw.unit !== 'string') {
    errors.unit = 'Purchase unit is required.';
  } else if (!raw.unit.trim()) {
    errors.unit = 'Purchase unit is required.';
  } else {
    const normalizedUnit = normalizeRawMaterialUnit(raw.unit);
    if (!normalizedUnit) {
      errors.unit = `Unit must be one of: ${RAW_MATERIAL_UNITS.join(', ')}.`;
    } else {
      unit = normalizedUnit;
    }
  }

  let category: RawMaterialCategory | null = null;
  if (raw.category !== undefined && raw.category !== null && raw.category !== '') {
    if (typeof raw.category !== 'string') {
      errors.category = `Category must be one of: ${RAW_MATERIAL_CATEGORIES.join(', ')}.`;
    } else if (!raw.category.trim()) {
      category = null;
    } else {
      const normalizedCategory = normalizeRawMaterialCategory(raw.category);
      if (!normalizedCategory) {
        errors.category = `Category must be one of: ${RAW_MATERIAL_CATEGORIES.join(', ')}.`;
      } else {
        category = normalizedCategory;
      }
    }
  }

  let quantityOnHand = 0;
  const rawQty = raw.quantityOnHand !== undefined ? raw.quantityOnHand : raw.initialQuantity;
  if (rawQty !== undefined && rawQty !== null && rawQty !== '') {
    if (typeof rawQty !== 'number' && typeof rawQty !== 'string') {
      errors.quantityOnHand = 'Initial quantity must be a non-negative number.';
    } else {
      const parsed = typeof rawQty === 'number' ? rawQty : Number(String(rawQty).trim());
      if (!Number.isFinite(parsed) || parsed < 0) {
        errors.quantityOnHand = 'Initial quantity must be a non-negative number.';
      } else {
        quantityOnHand = parsed;
      }
    }
  }

  let description = '';
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') {
      errors.description = 'Description must be a string.';
    } else if (raw.description.trim().length > 1000) {
      errors.description = 'Description cannot exceed 1000 characters.';
    } else {
      description = raw.description.trim();
    }
  }

  if (Object.keys(errors).length > 0 || !unit) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      name,
      category,
      unit,
      quantityOnHand,
      description,
    },
  };
}
