import {
  normalizeMaterialDisplayName,
  normalizeMaterialNameKey,
  normalizeRawMaterialCategory,
  normalizeRawMaterialUnit,
  RAW_MATERIAL_CATEGORIES,
  RAW_MATERIAL_UNITS,
  RawMaterialCategory,
  RawMaterialUnit,
} from '../../raw-materials/models/raw-material.model';
import { normalizePurchaseText } from '../models/purchase-voucher.model';
import {
  CreatePurchaseVoucherDto,
  PurchaseEntryMethod,
  PurchaseInlineNewMaterialDto,
  PurchaseLineItemInputDto,
  ValidationResult,
} from '../types';

const SYSTEM_MANAGED_FIELDS = new Set([
  '_id',
  'id',
  'voucherNumber',
  'normalizedSupplierName',
  'normalizedInvoiceNumber',
  'projectRecordId',
  'projectCode',
  'projectName',
  'attachments',
  'status',
  'revision',
  'stockSync',
  'createdBy',
  'createdByName',
  'updatedBy',
  'updatedByName',
  'cancelledAt',
  'cancelledBy',
  'cancelReason',
  'createdAt',
  'updatedAt',
  '__v',
]);

const IGNORED_CALCULATED_FIELDS = new Set([
  'subtotal',
  'finalTotal',
  'totalAmount',
]);

const ALLOWED_CREATE_FIELDS = new Set([
  'purchaseDate',
  'supplierName',
  'supplierInvoiceNumber',
  'projectId',
  'entryMethod',
  'lineItems',
  'discountAmount',
  'taxAmount',
  'otherCharges',
  'notes',
  'clientRequestId',
]);

export function roundPurchaseQuantity(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function roundPurchaseMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function parsePurchaseDateInput(raw: unknown): Date | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    if (
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() !== month - 1 ||
      utcDate.getUTCDate() !== day
    ) {
      return null;
    }
    return utcDate;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const year = parsed.getUTCFullYear();
  if (year < 1990 || year > 2100) {
    return null;
  }
  return parsed;
}

export function parseNonNegativeCharge(
  raw: unknown,
  fieldLabel: string,
): { value: number; error?: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: 0 };
  }
  const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num)) {
    return { value: 0, error: `${fieldLabel} must be a valid number.` };
  }
  if (num < 0) {
    return { value: 0, error: `${fieldLabel} cannot be negative.` };
  }
  if (num > 1_000_000_000) {
    return { value: 0, error: `${fieldLabel} exceeds maximum supported amount.` };
  }
  return { value: roundPurchaseMoney(num) };
}

const ALLOWED_INLINE_NEW_MATERIAL_FIELDS = new Set([
  'name',
  'unit',
  'category',
  'description',
]);

const FORBIDDEN_INLINE_NEW_MATERIAL_STOCK_FIELDS = new Set([
  'quantityOnHand',
  'initialQuantity',
]);

const SYSTEM_INLINE_NEW_MATERIAL_FIELDS = new Set([
  '_id',
  'id',
  'normalizedName',
  'isActive',
  'status',
  'createdBy',
  'createdAt',
  'updatedAt',
  '__v',
]);

export function parseLineItemsInput(
  rawLineItems: unknown,
): { items: PurchaseLineItemInputDto[]; error?: string; itemErrors?: Record<string, string> } {
  let candidateList: unknown = rawLineItems;

  if (typeof rawLineItems === 'string') {
    const trimmed = rawLineItems.trim();
    if (!trimmed) {
      return { items: [], error: 'At least one material line item is required.' };
    }
    try {
      candidateList = JSON.parse(trimmed);
    } catch {
      return { items: [], error: 'Line items payload must be valid JSON.' };
    }
  }

  if (!Array.isArray(candidateList) || candidateList.length === 0) {
    return { items: [], error: 'At least one material line item is required.' };
  }

  if (candidateList.length > 100) {
    return {
      items: [],
      error: 'A single purchase voucher cannot exceed 100 line items.',
    };
  }

  const parsedItems: PurchaseLineItemInputDto[] = [];
  const itemErrors: Record<string, string> = {};
  const seenNewMaterialsByNameKey = new Map<
    string,
    { name: string; unit: RawMaterialUnit }
  >();

  candidateList.forEach((rawEntry, idx) => {
    const prefix = `lineItems[${idx}]`;
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      itemErrors[prefix] = `Line item #${idx + 1} must be an object.`;
      return;
    }

    const entry = rawEntry as Record<string, unknown>;
    const materialId =
      typeof entry.materialId === 'string' ? entry.materialId.trim() : '';
    const hasNewMaterial =
      entry.newMaterial !== undefined && entry.newMaterial !== null;

    if (materialId && hasNewMaterial) {
      itemErrors[`${prefix}.materialId`] =
        `Line item #${idx + 1}: provide either an existing materialId or newMaterial, not both.`;
    } else if (!materialId && !hasNewMaterial) {
      itemErrors[`${prefix}.materialId`] =
        `Line item #${idx + 1}: select a raw material or define a new material.`;
    }

    let unitValue: PurchaseLineItemInputDto['unit'] = null;
    if (
      entry.unit !== undefined &&
      entry.unit !== null &&
      String(entry.unit).trim() !== ''
    ) {
      const normalizedUnit = normalizeRawMaterialUnit(entry.unit);
      if (!normalizedUnit) {
        itemErrors[`${prefix}.unit`] =
          `Line item #${idx + 1}: unit must be one of ${RAW_MATERIAL_UNITS.join(', ')}.`;
      } else {
        unitValue = normalizedUnit;
      }
    }

    let parsedNewMaterial: PurchaseInlineNewMaterialDto | null = null;
    if (hasNewMaterial && !materialId) {
      if (
        typeof entry.newMaterial !== 'object' ||
        Array.isArray(entry.newMaterial)
      ) {
        itemErrors[`${prefix}.newMaterial`] =
          `Line item #${idx + 1}: newMaterial must be an object.`;
      } else {
        const rawNewMat = entry.newMaterial as Record<string, unknown>;
        for (const key of Object.keys(rawNewMat)) {
          if (FORBIDDEN_INLINE_NEW_MATERIAL_STOCK_FIELDS.has(key)) {
            itemErrors[`${prefix}.newMaterial.${key}`] =
              `Line item #${idx + 1}: '${key}' cannot be set separately; stock is initialized from the purchased quantity.`;
          } else if (SYSTEM_INLINE_NEW_MATERIAL_FIELDS.has(key)) {
            itemErrors[`${prefix}.newMaterial.${key}`] =
              `Line item #${idx + 1}: '${key}' is system-managed and cannot be supplied.`;
          } else if (!ALLOWED_INLINE_NEW_MATERIAL_FIELDS.has(key)) {
            itemErrors[`${prefix}.newMaterial.${key}`] =
              `Line item #${idx + 1}: '${key}' is not a valid new material field.`;
          }
        }

        let newMatName = '';
        if (typeof rawNewMat.name !== 'string') {
          itemErrors[`${prefix}.newMaterial.name`] =
            `Line item #${idx + 1}: new material name is required.`;
        } else {
          const cleanName = normalizeMaterialDisplayName(rawNewMat.name);
          if (!cleanName) {
            itemErrors[`${prefix}.newMaterial.name`] =
              `Line item #${idx + 1}: new material name is required.`;
          } else if (cleanName.length > 150) {
            itemErrors[`${prefix}.newMaterial.name`] =
              `Line item #${idx + 1}: new material name cannot exceed 150 characters.`;
          } else {
            newMatName = cleanName;
          }
        }

        let newMatUnit: RawMaterialUnit | null = null;
        if (
          typeof rawNewMat.unit !== 'string' ||
          !rawNewMat.unit.trim()
        ) {
          itemErrors[`${prefix}.newMaterial.unit`] =
            `Line item #${idx + 1}: new material unit is required.`;
        } else {
          const normalizedNewUnit = normalizeRawMaterialUnit(rawNewMat.unit);
          if (!normalizedNewUnit) {
            itemErrors[`${prefix}.newMaterial.unit`] =
              `Line item #${idx + 1}: new material unit must be one of ${RAW_MATERIAL_UNITS.join(', ')}.`;
          } else {
            newMatUnit = normalizedNewUnit;
          }
        }

        let newMatCategory: RawMaterialCategory | null = null;
        if (
          rawNewMat.category !== undefined &&
          rawNewMat.category !== null &&
          rawNewMat.category !== ''
        ) {
          if (typeof rawNewMat.category !== 'string') {
            itemErrors[`${prefix}.newMaterial.category`] =
              `Line item #${idx + 1}: category must be one of ${RAW_MATERIAL_CATEGORIES.join(', ')}.`;
          } else if (rawNewMat.category.trim()) {
            const normalizedCategory = normalizeRawMaterialCategory(
              rawNewMat.category,
            );
            if (!normalizedCategory) {
              itemErrors[`${prefix}.newMaterial.category`] =
                `Line item #${idx + 1}: category must be one of ${RAW_MATERIAL_CATEGORIES.join(', ')}.`;
            } else {
              newMatCategory = normalizedCategory;
            }
          }
        }

        let newMatDescription = '';
        if (
          rawNewMat.description !== undefined &&
          rawNewMat.description !== null
        ) {
          if (typeof rawNewMat.description !== 'string') {
            itemErrors[`${prefix}.newMaterial.description`] =
              `Line item #${idx + 1}: description must be text.`;
          } else if (rawNewMat.description.trim().length > 1000) {
            itemErrors[`${prefix}.newMaterial.description`] =
              `Line item #${idx + 1}: description cannot exceed 1000 characters.`;
          } else {
            newMatDescription = rawNewMat.description.trim();
          }
        }

        if (unitValue && newMatUnit && unitValue !== newMatUnit) {
          itemErrors[`${prefix}.unit`] =
            `Line item #${idx + 1}: unit '${unitValue}' conflicts with new material unit '${newMatUnit}'.`;
        }

        if (newMatName && newMatUnit) {
          const nameKey = normalizeMaterialNameKey(newMatName);
          const previousSpec = seenNewMaterialsByNameKey.get(nameKey);
          if (previousSpec && previousSpec.unit !== newMatUnit) {
            itemErrors[`${prefix}.unit`] =
              `Line item #${idx + 1}: new material '${newMatName}' has conflicting units ('${previousSpec.unit}' vs '${newMatUnit}') within this voucher.`;
          } else if (!previousSpec) {
            seenNewMaterialsByNameKey.set(nameKey, {
              name: newMatName,
              unit: newMatUnit,
            });
          }

          if (
            !Object.keys(itemErrors).some((errKey) =>
              errKey.startsWith(`${prefix}.newMaterial`) ||
              errKey === `${prefix}.unit`,
            )
          ) {
            parsedNewMaterial = {
              name: newMatName,
              unit: newMatUnit,
              category: newMatCategory,
              description: newMatDescription,
            };
          }
        }
      }
    }

    const rawQty = entry.quantity;
    const qtyNum =
      typeof rawQty === 'number'
        ? rawQty
        : rawQty !== undefined && rawQty !== null && String(rawQty).trim() !== ''
          ? Number(String(rawQty).trim())
          : NaN;

    if (!Number.isFinite(qtyNum)) {
      itemErrors[`${prefix}.quantity`] =
        `Line item #${idx + 1}: enter a valid numeric quantity.`;
    } else if (qtyNum <= 0) {
      itemErrors[`${prefix}.quantity`] =
        `Line item #${idx + 1}: quantity must be greater than zero.`;
    } else if (qtyNum > 1_000_000) {
      itemErrors[`${prefix}.quantity`] =
        `Line item #${idx + 1}: quantity exceeds maximum allowed limit.`;
    }

    const rawPrice = entry.unitPrice;
    const priceNum =
      typeof rawPrice === 'number'
        ? rawPrice
        : rawPrice !== undefined &&
            rawPrice !== null &&
            String(rawPrice).trim() !== ''
          ? Number(String(rawPrice).trim())
          : NaN;

    if (!Number.isFinite(priceNum)) {
      itemErrors[`${prefix}.unitPrice`] =
        `Line item #${idx + 1}: enter a valid unit price.`;
    } else if (priceNum <= 0) {
      itemErrors[`${prefix}.unitPrice`] =
        `Line item #${idx + 1}: unit price must be greater than zero.`;
    } else if (priceNum > 100_000_000) {
      itemErrors[`${prefix}.unitPrice`] =
        `Line item #${idx + 1}: unit price exceeds maximum allowed limit.`;
    }

    let remarks = '';
    if (entry.remarks !== undefined && entry.remarks !== null) {
      if (typeof entry.remarks !== 'string') {
        itemErrors[`${prefix}.remarks`] =
          `Line item #${idx + 1}: remarks must be text.`;
      } else if (entry.remarks.trim().length > 300) {
        itemErrors[`${prefix}.remarks`] =
          `Line item #${idx + 1}: remarks cannot exceed 300 characters.`;
      } else {
        remarks = entry.remarks.trim();
      }
    }

    if (
      (materialId || parsedNewMaterial) &&
      Number.isFinite(qtyNum) &&
      qtyNum > 0 &&
      Number.isFinite(priceNum) &&
      priceNum > 0
    ) {
      parsedItems.push({
        ...(materialId ? { materialId } : {}),
        ...(parsedNewMaterial ? { newMaterial: parsedNewMaterial } : {}),
        unit: parsedNewMaterial ? parsedNewMaterial.unit : unitValue,
        quantity: roundPurchaseQuantity(qtyNum),
        unitPrice: roundPurchaseMoney(priceNum),
        remarks,
      });
    }
  });

  if (Object.keys(itemErrors).length > 0) {
    const firstMsg = Object.values(itemErrors)[0];
    return {
      items: [],
      error: firstMsg,
      itemErrors,
    };
  }

  return { items: parsedItems };
}

export function validateCreatePurchaseVoucherDto(
  body: unknown,
  headerIdempotencyKey?: string,
): ValidationResult<CreatePurchaseVoucherDto> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be an object.' },
    };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(raw)) {
    if (SYSTEM_MANAGED_FIELDS.has(key)) {
      errors[key] =
        `'${key}' is system-managed and cannot be supplied when creating a purchase voucher.`;
    } else if (
      !ALLOWED_CREATE_FIELDS.has(key) &&
      !IGNORED_CALCULATED_FIELDS.has(key)
    ) {
      errors[key] = `'${key}' is not a valid purchase voucher field.`;
    }
  }

  const purchaseDate = parsePurchaseDateInput(raw.purchaseDate);
  if (!purchaseDate) {
    errors.purchaseDate = 'A valid purchase date is required.';
  }

  let supplierName = '';
  if (typeof raw.supplierName !== 'string' || !raw.supplierName.trim()) {
    errors.supplierName = 'Supplier name is required.';
  } else {
    const normalized = normalizePurchaseText(raw.supplierName);
    if (normalized.length > 200) {
      errors.supplierName = 'Supplier name cannot exceed 200 characters.';
    } else {
      supplierName = normalized;
    }
  }

  let supplierInvoiceNumber = '';
  if (
    raw.supplierInvoiceNumber !== undefined &&
    raw.supplierInvoiceNumber !== null &&
    raw.supplierInvoiceNumber !== ''
  ) {
    if (typeof raw.supplierInvoiceNumber !== 'string') {
      errors.supplierInvoiceNumber = 'Supplier invoice number must be text.';
    } else {
      const cleanInv = normalizePurchaseText(raw.supplierInvoiceNumber);
      if (cleanInv.length > 100) {
        errors.supplierInvoiceNumber =
          'Supplier invoice number cannot exceed 100 characters.';
      } else {
        supplierInvoiceNumber = cleanInv;
      }
    }
  }

  let projectId: string | null = null;
  if (
    raw.projectId !== undefined &&
    raw.projectId !== null &&
    String(raw.projectId).trim() !== ''
  ) {
    if (typeof raw.projectId !== 'string') {
      errors.projectId = 'Project identifier must be a string.';
    } else {
      projectId = raw.projectId.trim();
    }
  }

  let entryMethod: PurchaseEntryMethod = 'manual';
  if (raw.entryMethod !== undefined && raw.entryMethod !== null && raw.entryMethod !== '') {
    if (raw.entryMethod === 'upload_bill' || raw.entryMethod === 'manual') {
      entryMethod = raw.entryMethod;
    } else {
      errors.entryMethod = "Entry method must be 'upload_bill' or 'manual'.";
    }
  }

  const lineItemsParsed = parseLineItemsInput(raw.lineItems);
  if (lineItemsParsed.error) {
    errors.lineItems = lineItemsParsed.error;
    if (lineItemsParsed.itemErrors) {
      Object.assign(errors, lineItemsParsed.itemErrors);
    }
  }

  const discountParsed = parseNonNegativeCharge(
    raw.discountAmount,
    'Discount amount',
  );
  if (discountParsed.error) {
    errors.discountAmount = discountParsed.error;
  }

  const taxParsed = parseNonNegativeCharge(raw.taxAmount, 'Tax amount');
  if (taxParsed.error) {
    errors.taxAmount = taxParsed.error;
  }

  const otherChargesParsed = parseNonNegativeCharge(
    raw.otherCharges,
    'Other charges',
  );
  if (otherChargesParsed.error) {
    errors.otherCharges = otherChargesParsed.error;
  }

  let notes = '';
  if (raw.notes !== undefined && raw.notes !== null && raw.notes !== '') {
    if (typeof raw.notes !== 'string') {
      errors.notes = 'Notes must be a string.';
    } else if (raw.notes.trim().length > 1000) {
      errors.notes = 'Notes cannot exceed 1000 characters.';
    } else {
      notes = raw.notes.trim();
    }
  }

  let clientRequestId: string | null = null;
  const candidateReqId =
    (typeof headerIdempotencyKey === 'string' && headerIdempotencyKey.trim()) ||
    (typeof raw.clientRequestId === 'string' && raw.clientRequestId.trim()) ||
    '';
  if (candidateReqId) {
    if (candidateReqId.length > 120) {
      errors.clientRequestId = 'Client request identifier cannot exceed 120 characters.';
    } else {
      clientRequestId = candidateReqId;
    }
  }

  if (Object.keys(errors).length > 0 || !purchaseDate) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      purchaseDate,
      supplierName,
      supplierInvoiceNumber,
      projectId,
      entryMethod,
      lineItems: lineItemsParsed.items,
      discountAmount: discountParsed.value,
      taxAmount: taxParsed.value,
      otherCharges: otherChargesParsed.value,
      notes,
      clientRequestId,
    },
  };
}
