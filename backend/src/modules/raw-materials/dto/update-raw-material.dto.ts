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

export interface UpdateRawMaterialDto {
  name?: string;
  category?: RawMaterialCategory | null;
  unit?: RawMaterialUnit;
  minStockLevel?: number | null;
  description?: string;
}

export interface UpdateRawMaterialStatusDto {
  isActive: boolean;
}

export interface AdjustRawMaterialStockDto {
  quantityOnHand: number;
  reason?: string;
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
const QUANTITY_FIELDS = new Set(['quantityOnHand', 'initialQuantity', 'quantity']);

const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'category',
  'unit',
  'minStockLevel',
  'description',
]);

export function validateUpdateRawMaterialDto(
  body: unknown,
): ValidationResult<UpdateRawMaterialDto> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const updateValue: UpdateRawMaterialDto = {};

  for (const key of Object.keys(raw)) {
    if (SYSTEM_MANAGED_FIELDS.has(key)) {
      errors[key] = `'${key}' is system-managed and cannot be modified.`;
    } else if (STATUS_FIELDS.has(key)) {
      errors[key] = `'${key}' cannot be modified here. Use PATCH /api/raw-materials/:id/status instead.`;
    } else if (QUANTITY_FIELDS.has(key)) {
      errors[key] = `'${key}' cannot be modified directly via material update. Use the authorized stock adjustment endpoint instead.`;
    } else if (!ALLOWED_UPDATE_FIELDS.has(key)) {
      errors[key] = `'${key}' is not a permitted raw material update field.`;
    }
  }

  if (raw.name !== undefined) {
    if (raw.name === null || typeof raw.name !== 'string') {
      errors.name = 'Material name must be a non-empty string.';
    } else {
      const normalizedName = normalizeMaterialDisplayName(raw.name);
      if (!normalizedName) {
        errors.name = 'Material name cannot be empty.';
      } else if (normalizedName.length > 150) {
        errors.name = 'Material name cannot exceed 150 characters.';
      } else {
        updateValue.name = normalizedName;
      }
    }
  }

  if (raw.unit !== undefined) {
    if (raw.unit === null || typeof raw.unit !== 'string' || !raw.unit.trim()) {
      errors.unit = 'Purchase unit cannot be empty.';
    } else {
      const normalizedUnit = normalizeRawMaterialUnit(raw.unit);
      if (!normalizedUnit) {
        errors.unit = `Unit must be one of: ${RAW_MATERIAL_UNITS.join(', ')}.`;
      } else {
        updateValue.unit = normalizedUnit;
      }
    }
  }

  if (raw.category !== undefined) {
    if (raw.category === null || raw.category === '') {
      updateValue.category = null;
    } else if (typeof raw.category !== 'string') {
      errors.category = `Category must be one of: ${RAW_MATERIAL_CATEGORIES.join(', ')}.`;
    } else if (!raw.category.trim()) {
      updateValue.category = null;
    } else {
      const normalizedCategory = normalizeRawMaterialCategory(raw.category);
      if (!normalizedCategory) {
        errors.category = `Category must be one of: ${RAW_MATERIAL_CATEGORIES.join(', ')}.`;
      } else {
        updateValue.category = normalizedCategory;
      }
    }
  }

  if (raw.minStockLevel !== undefined) {
    if (raw.minStockLevel === null || raw.minStockLevel === '') {
      updateValue.minStockLevel = null;
    } else if (
      typeof raw.minStockLevel !== 'number' &&
      typeof raw.minStockLevel !== 'string'
    ) {
      errors.minStockLevel =
        'Minimum stock level must be a non-negative number or null.';
    } else {
      const parsedMin =
        typeof raw.minStockLevel === 'number'
          ? raw.minStockLevel
          : Number(String(raw.minStockLevel).trim());
      if (!Number.isFinite(parsedMin) || parsedMin < 0) {
        errors.minStockLevel =
          'Minimum stock level must be a non-negative number or null.';
      } else {
        updateValue.minStockLevel =
          Math.round((parsedMin + Number.EPSILON) * 1000) / 1000;
      }
    }
  }

  if (raw.description !== undefined) {
    if (raw.description === null) {
      updateValue.description = '';
    } else if (typeof raw.description !== 'string') {
      errors.description = 'Description must be a string.';
    } else if (raw.description.trim().length > 1000) {
      errors.description = 'Description cannot exceed 1000 characters.';
    } else {
      updateValue.description = raw.description.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  if (Object.keys(updateValue).length === 0) {
    return {
      isValid: false,
      errors: {
        body: 'At least one editable field (name, category, unit, description) must be provided.',
      },
    };
  }

  return {
    isValid: true,
    value: updateValue,
  };
}

export function validateUpdateRawMaterialStatusDto(
  body: unknown,
): ValidationResult<UpdateRawMaterialStatusDto> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(raw)) {
    if (!STATUS_FIELDS.has(key)) {
      errors[key] = `'${key}' is not permitted on status updates. Provide 'isActive' (boolean) or 'status' ('active' | 'inactive').`;
    }
  }

  let parsedFromBoolean: boolean | undefined;
  let parsedFromStatus: boolean | undefined;

  if (raw.isActive !== undefined) {
    if (typeof raw.isActive === 'boolean') {
      parsedFromBoolean = raw.isActive;
    } else {
      errors.isActive = "'isActive' must be a boolean (true or false).";
    }
  }

  if (raw.status !== undefined) {
    if (typeof raw.status !== 'string') {
      errors.status = "Status must be 'active' or 'inactive'.";
    } else {
      const normalized = raw.status.trim().toLowerCase();
      if (normalized === 'active') {
        parsedFromStatus = true;
      } else if (normalized === 'inactive') {
        parsedFromStatus = false;
      } else {
        errors.status = "Status must be 'active' or 'inactive'.";
      }
    }
  }

  if (
    parsedFromBoolean !== undefined &&
    parsedFromStatus !== undefined &&
    parsedFromBoolean !== parsedFromStatus
  ) {
    errors.status = "'isActive' and 'status' values conflict.";
  }

  const resolvedStatus =
    parsedFromBoolean !== undefined ? parsedFromBoolean : parsedFromStatus;

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  if (resolvedStatus === undefined) {
    return {
      isValid: false,
      errors: {
        isActive:
          "Provide 'isActive' (true or false) or 'status' ('active' or 'inactive').",
      },
    };
  }

  return {
    isValid: true,
    value: {
      isActive: resolvedStatus,
    },
  };
}

const ALLOWED_ADJUST_STOCK_FIELDS = new Set([
  'quantityOnHand',
  'quantity',
  'reason',
]);

export function validateAdjustStockDto(
  body: unknown,
): ValidationResult<AdjustRawMaterialStockDto> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_ADJUST_STOCK_FIELDS.has(key)) {
      errors[key] = `'${key}' is not permitted for stock adjustments. Provide 'quantityOnHand' (or 'quantity') and optional 'reason'.`;
    }
  }

  const rawQty = raw.quantityOnHand !== undefined ? raw.quantityOnHand : raw.quantity;
  let quantityOnHand: number | undefined;

  if (rawQty === undefined || rawQty === null || rawQty === '') {
    errors.quantityOnHand = 'Stock quantity is required.';
  } else if (typeof rawQty !== 'number' && typeof rawQty !== 'string') {
    errors.quantityOnHand = 'Stock quantity must be a non-negative number.';
  } else {
    const parsed = typeof rawQty === 'number' ? rawQty : Number(String(rawQty).trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.quantityOnHand = 'Stock quantity must be a non-negative number.';
    } else {
      quantityOnHand = parsed;
    }
  }

  let reason: string | undefined;
  if (raw.reason !== undefined && raw.reason !== null) {
    if (typeof raw.reason !== 'string') {
      errors.reason = 'Reason must be a string.';
    } else if (raw.reason.trim().length > 500) {
      errors.reason = 'Reason cannot exceed 500 characters.';
    } else {
      reason = raw.reason.trim();
    }
  }

  if (Object.keys(errors).length > 0 || quantityOnHand === undefined) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      quantityOnHand,
      ...(reason ? { reason } : {}),
    },
  };
}
