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
  IPurchasePrintedInvoiceSummary,
  PurchaseEntryMethod,
  PurchaseInlineNewMaterialDto,
  PurchaseLineItemInputDto,
  PurchaseLineItemType,
  PurchaseTaxMode,
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

export const IGNORED_CALCULATED_VOUCHER_FIELDS = new Set([
  'subtotal',
  'materialSubtotal',
  'expenseSubtotal',
  'taxableSubtotal',
  'finalTotal',
  'materialAllocatedTotal',
  'expenseAllocatedTotal',
  'totalAmount',
  'reconciliationWarnings',
]);

const ALLOWED_CREATE_FIELDS = new Set([
  'purchaseDate',
  'supplierName',
  'supplierInvoiceNumber',
  'projectId',
  'entryMethod',
  'lineItems',
  'discountAmount',
  'taxMode',
  'taxRatePercent',
  'cgstAmount',
  'sgstAmount',
  'igstAmount',
  'taxAmount',
  'otherCharges',
  'printedInvoiceSummary',
  'notes',
  'clientRequestId',
]);

const ALLOWED_LINE_ITEM_FIELDS = new Set([
  'itemType',
  'materialId',
  'newMaterial',
  'expenseHeadId',
  'description',
  'unit',
  'quantity',
  'unitPrice',
  'amount',
  'taxRate',
  'remarks',
]);

const IGNORED_CALCULATED_LINE_FIELDS = new Set([
  'lineTotal',
  'materialName',
  'materialCategory',
  'expenseHeadName',
  'expenseHeadCategory',
]);

export function roundPurchaseQuantity(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function roundPurchaseMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function roundPurchasePercentage(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 10000) / 10000;
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
    if (
      year < 1990 ||
      year > 2100 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
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
    return {
      value: 0,
      error: `${fieldLabel} exceeds maximum supported amount.`,
    };
  }
  return { value: roundPurchaseMoney(num) };
}

export function parseOptionalNonNegativeMoney(
  raw: unknown,
  fieldLabel: string,
): { value: number | null; error?: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: null };
  }
  const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num)) {
    return { value: null, error: `${fieldLabel} must be a valid number.` };
  }
  if (num < 0) {
    return { value: null, error: `${fieldLabel} cannot be negative.` };
  }
  if (num > 1_000_000_000) {
    return {
      value: null,
      error: `${fieldLabel} exceeds maximum supported amount.`,
    };
  }
  return { value: roundPurchaseMoney(num) };
}

export function parseOptionalTaxPercentage(
  raw: unknown,
  fieldLabel: string,
): { value: number | null; error?: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: null };
  }
  const cleanStr =
    typeof raw === 'string' ? raw.trim().replace(/%$/, '').trim() : raw;
  const num = typeof cleanStr === 'number' ? cleanStr : Number(cleanStr);
  if (!Number.isFinite(num)) {
    return { value: null, error: `${fieldLabel} must be a valid percentage.` };
  }
  if (num < 0 || num > 100) {
    return {
      value: null,
      error: `${fieldLabel} must be between 0% and 100%.`,
    };
  }
  return { value: roundPurchasePercentage(num) };
}

export function parseTaxModeInput(raw: unknown): {
  value: PurchaseTaxMode;
  error?: string;
} {
  if (raw === undefined || raw === null || raw === '') {
    return { value: 'bill_amount' };
  }
  if (raw === 'bill_amount' || raw === 'percentage') {
    return { value: raw };
  }
  return {
    value: 'bill_amount',
    error: "Tax mode must be 'bill_amount' or 'percentage'.",
  };
}

export function parsePrintedInvoiceSummaryInput(raw: unknown): {
  value: IPurchasePrintedInvoiceSummary | null;
  error?: string;
} {
  if (raw === undefined || raw === null || raw === '') {
    return { value: null };
  }

  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { value: null };
    }
    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return {
        value: null,
        error: 'printedInvoiceSummary must be valid JSON.',
      };
    }
  }

  if (
    !candidate ||
    typeof candidate !== 'object' ||
    Array.isArray(candidate)
  ) {
    return {
      value: null,
      error: 'printedInvoiceSummary must be an object.',
    };
  }

  const obj = candidate as Record<string, unknown>;
  const allowedKeys = new Set([
    'printedSubtotal',
    'printedDiscountAmount',
    'printedTaxAmount',
    'printedOtherCharges',
    'printedGrandTotal',
  ]);

  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      return {
        value: null,
        error: `Unknown printedInvoiceSummary field '${key}'.`,
      };
    }
  }

  const sub = parseOptionalNonNegativeMoney(
    obj.printedSubtotal,
    'Printed subtotal',
  );
  if (sub.error) return { value: null, error: sub.error };

  const disc = parseOptionalNonNegativeMoney(
    obj.printedDiscountAmount,
    'Printed discount amount',
  );
  if (disc.error) return { value: null, error: disc.error };

  const tax = parseOptionalNonNegativeMoney(
    obj.printedTaxAmount,
    'Printed tax amount',
  );
  if (tax.error) return { value: null, error: tax.error };

  const charges = parseOptionalNonNegativeMoney(
    obj.printedOtherCharges,
    'Printed other charges',
  );
  if (charges.error) return { value: null, error: charges.error };

  const grand = parseOptionalNonNegativeMoney(
    obj.printedGrandTotal,
    'Printed grand total',
  );
  if (grand.error) return { value: null, error: grand.error };

  if (
    sub.value === null &&
    disc.value === null &&
    tax.value === null &&
    charges.value === null &&
    grand.value === null
  ) {
    return { value: null };
  }

  return {
    value: {
      printedSubtotal: sub.value,
      printedDiscountAmount: disc.value,
      printedTaxAmount: tax.value,
      printedOtherCharges: charges.value,
      printedGrandTotal: grand.value,
    },
  };
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

export function parseLineItemsInput(rawLineItems: unknown): {
  items: PurchaseLineItemInputDto[];
  error?: string;
  itemErrors?: Record<string, string>;
} {
  let candidateList: unknown = rawLineItems;

  if (typeof rawLineItems === 'string') {
    const trimmed = rawLineItems.trim();
    if (!trimmed) {
      return {
        items: [],
        error: 'At least one purchase line item is required.',
      };
    }
    try {
      candidateList = JSON.parse(trimmed);
    } catch {
      return { items: [], error: 'Line items payload must be valid JSON.' };
    }
  }

  if (!Array.isArray(candidateList) || candidateList.length === 0) {
    return { items: [], error: 'At least one purchase line item is required.' };
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

    for (const key of Object.keys(entry)) {
      if (
        !ALLOWED_LINE_ITEM_FIELDS.has(key) &&
        !IGNORED_CALCULATED_LINE_FIELDS.has(key)
      ) {
        itemErrors[`${prefix}.${key}`] =
          `Line item #${idx + 1}: '${key}' is not a valid line item field.`;
      }
    }

    const materialId =
      typeof entry.materialId === 'string' ? entry.materialId.trim() : '';
    const hasNewMaterial =
      entry.newMaterial !== undefined && entry.newMaterial !== null;
    const expenseHeadId =
      typeof entry.expenseHeadId === 'string' ? entry.expenseHeadId.trim() : '';

    let itemType: PurchaseLineItemType | null = null;
    if (entry.itemType !== undefined && entry.itemType !== null) {
      const cleanType =
        typeof entry.itemType === 'string'
          ? entry.itemType.trim().toLowerCase()
          : '';
      if (cleanType === 'material' || cleanType === 'expense') {
        itemType = cleanType;
      } else {
        itemErrors[`${prefix}.itemType`] =
          `Line item #${idx + 1}: select whether this item is 'material' or 'expense'.`;
        return;
      }
    } else if ((materialId || hasNewMaterial) && !expenseHeadId) {
      itemType = 'material';
    } else if (expenseHeadId && !materialId && !hasNewMaterial) {
      itemType = 'expense';
    } else if (!expenseHeadId && !materialId && !hasNewMaterial) {
      itemType = 'material';
    } else {
      itemErrors[`${prefix}.itemType`] =
        `Line item #${idx + 1}: select whether this item is 'material' or 'expense'.`;
      return;
    }

    let lineTaxRate: number | null = null;
    if (
      entry.taxRate !== undefined &&
      entry.taxRate !== null &&
      String(entry.taxRate).trim() !== ''
    ) {
      const rateParsed = parseOptionalTaxPercentage(
        entry.taxRate,
        `Line item #${idx + 1} tax rate`,
      );
      if (rateParsed.error) {
        itemErrors[`${prefix}.taxRate`] = rateParsed.error;
      } else {
        lineTaxRate = rateParsed.value;
      }
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

    let description = '';
    if (entry.description !== undefined && entry.description !== null) {
      if (typeof entry.description !== 'string') {
        itemErrors[`${prefix}.description`] =
          `Line item #${idx + 1}: description must be text.`;
      } else {
        const cleanDesc = normalizePurchaseText(entry.description);
        if (cleanDesc.length > 240) {
          itemErrors[`${prefix}.description`] =
            `Line item #${idx + 1}: description cannot exceed 240 characters.`;
        } else {
          description = cleanDesc;
        }
      }
    }

    if (itemType === 'expense') {
      if (materialId || hasNewMaterial) {
        itemErrors[`${prefix}.materialId`] =
          `Line item #${idx + 1}: expense lines cannot specify a raw material.`;
      }

      if (!expenseHeadId) {
        itemErrors[`${prefix}.expenseHeadId`] =
          `Line item #${idx + 1}: select an Expense Head for this expense item.`;
      }

      if (!description) {
        itemErrors[`${prefix}.description`] =
          `Line item #${idx + 1}: description is required for an expense item.`;
      }

      let expQty: number | null = null;
      const hasQtyRaw =
        entry.quantity !== undefined &&
        entry.quantity !== null &&
        String(entry.quantity).trim() !== '';
      if (hasQtyRaw) {
        const q =
          typeof entry.quantity === 'number'
            ? entry.quantity
            : Number(String(entry.quantity).trim());
        if (!Number.isFinite(q) || q <= 0) {
          itemErrors[`${prefix}.quantity`] =
            `Line item #${idx + 1}: expense quantity must be greater than zero when provided.`;
        } else if (q > 1_000_000) {
          itemErrors[`${prefix}.quantity`] =
            `Line item #${idx + 1}: expense quantity exceeds maximum allowed limit.`;
        } else {
          expQty = roundPurchaseQuantity(q);
        }
      }

      let expUnit: string | null = null;
      if (
        entry.unit !== undefined &&
        entry.unit !== null &&
        String(entry.unit).trim() !== ''
      ) {
        if (typeof entry.unit !== 'string') {
          itemErrors[`${prefix}.unit`] =
            `Line item #${idx + 1}: unit must be text.`;
        } else {
          const cleanUnit = normalizePurchaseText(entry.unit);
          if (cleanUnit.length > 40) {
            itemErrors[`${prefix}.unit`] =
              `Line item #${idx + 1}: unit cannot exceed 40 characters.`;
          } else {
            expUnit = cleanUnit;
          }
        }
      }

      let expUnitPrice: number | null = null;
      const hasPriceRaw =
        entry.unitPrice !== undefined &&
        entry.unitPrice !== null &&
        String(entry.unitPrice).trim() !== '';
      if (hasPriceRaw) {
        const p =
          typeof entry.unitPrice === 'number'
            ? entry.unitPrice
            : Number(String(entry.unitPrice).trim());
        if (!Number.isFinite(p) || p <= 0) {
          itemErrors[`${prefix}.unitPrice`] =
            `Line item #${idx + 1}: unit price must be greater than zero when provided.`;
        } else if (p > 100_000_000) {
          itemErrors[`${prefix}.unitPrice`] =
            `Line item #${idx + 1}: unit price exceeds maximum allowed limit.`;
        } else {
          expUnitPrice = roundPurchaseMoney(p);
        }
      }

      let expAmount: number | null = null;
      const hasAmountRaw =
        entry.amount !== undefined &&
        entry.amount !== null &&
        String(entry.amount).trim() !== '';
      if (hasAmountRaw) {
        const a =
          typeof entry.amount === 'number'
            ? entry.amount
            : Number(String(entry.amount).trim());
        if (!Number.isFinite(a) || a <= 0) {
          itemErrors[`${prefix}.amount`] =
            `Line item #${idx + 1}: expense amount must be greater than zero.`;
        } else if (a > 1_000_000_000) {
          itemErrors[`${prefix}.amount`] =
            `Line item #${idx + 1}: expense amount exceeds maximum allowed limit.`;
        } else {
          expAmount = roundPurchaseMoney(a);
        }
      }

      if (expUnitPrice !== null && expQty === null && expAmount === null) {
        itemErrors[`${prefix}.quantity`] =
          `Line item #${idx + 1}: enter quantity when unit price is specified, or enter expense amount directly.`;
      }

      if (expQty !== null && expUnitPrice !== null && expAmount !== null) {
        const expected = roundPurchaseMoney(expQty * expUnitPrice);
        if (Math.abs(expected - expAmount) > Math.max(0.05, expAmount * 0.005)) {
          itemErrors[`${prefix}.amount`] =
            `Line item #${idx + 1}: expense amount (${expAmount.toFixed(2)}) conflicts with quantity × unit price (${expected.toFixed(2)}).`;
        }
      }

      if (expAmount === null && (expQty === null || expUnitPrice === null)) {
        if (!itemErrors[`${prefix}.amount`]) {
          itemErrors[`${prefix}.amount`] =
            `Line item #${idx + 1}: enter a valid positive expense amount.`;
        }
      }

      if (
        !Object.keys(itemErrors).some((errKey) => errKey.startsWith(prefix))
      ) {
        const resolvedAmount =
          expQty !== null && expUnitPrice !== null
            ? roundPurchaseMoney(expQty * expUnitPrice)
            : (expAmount as number);

        parsedItems.push({
          itemType: 'expense',
          expenseHeadId,
          description,
          unit: expUnit,
          quantity: expQty,
          unitPrice: expUnitPrice,
          amount: resolvedAmount,
          taxRate: lineTaxRate,
          remarks,
        });
      }
      return;
    }

    if (expenseHeadId) {
      itemErrors[`${prefix}.expenseHeadId`] =
        `Line item #${idx + 1}: raw material lines cannot specify an Expense Head.`;
    }

    if (materialId && hasNewMaterial) {
      itemErrors[`${prefix}.materialId`] =
        `Line item #${idx + 1}: provide either an existing materialId or newMaterial, not both.`;
    } else if (!materialId && !hasNewMaterial) {
      itemErrors[`${prefix}.materialId`] =
        `Line item #${idx + 1}: select a raw material or define a new material.`;
    }

    let unitValue: RawMaterialUnit | null = null;
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
              `Line item #${idx + 1}: '${key}' cannot be set separately; stock starts at 0 and increments on voucher commit.`;
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
        if (typeof rawNewMat.unit !== 'string' || !rawNewMat.unit.trim()) {
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
            !Object.keys(itemErrors).some(
              (errKey) =>
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
        : rawQty !== undefined &&
            rawQty !== null &&
            String(rawQty).trim() !== ''
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

    if (
      !Object.keys(itemErrors).some((errKey) => errKey.startsWith(prefix)) &&
      (materialId || parsedNewMaterial) &&
      Number.isFinite(qtyNum) &&
      qtyNum > 0 &&
      Number.isFinite(priceNum) &&
      priceNum > 0
    ) {
      parsedItems.push({
        itemType: 'material',
        ...(materialId ? { materialId } : {}),
        ...(parsedNewMaterial ? { newMaterial: parsedNewMaterial } : {}),
        description,
        unit: parsedNewMaterial ? parsedNewMaterial.unit : unitValue,
        quantity: roundPurchaseQuantity(qtyNum),
        unitPrice: roundPurchaseMoney(priceNum),
        taxRate: lineTaxRate,
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
      !IGNORED_CALCULATED_VOUCHER_FIELDS.has(key)
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
  if (
    raw.entryMethod !== undefined &&
    raw.entryMethod !== null &&
    raw.entryMethod !== ''
  ) {
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

  const taxModeParsed = parseTaxModeInput(raw.taxMode);
  if (taxModeParsed.error) {
    errors.taxMode = taxModeParsed.error;
  }

  const taxRateParsed = parseOptionalTaxPercentage(
    raw.taxRatePercent,
    'Tax rate percentage',
  );
  if (taxRateParsed.error) {
    errors.taxRatePercent = taxRateParsed.error;
  }

  if (
    !taxModeParsed.error &&
    taxModeParsed.value === 'percentage' &&
    taxRateParsed.value === null &&
    !taxRateParsed.error
  ) {
    errors.taxRatePercent =
      'Tax percentage rate is required when calculating tax by percentage.';
  }

  const cgstParsed = parseOptionalNonNegativeMoney(
    raw.cgstAmount,
    'CGST amount',
  );
  if (cgstParsed.error) {
    errors.cgstAmount = cgstParsed.error;
  }

  const sgstParsed = parseOptionalNonNegativeMoney(
    raw.sgstAmount,
    'SGST amount',
  );
  if (sgstParsed.error) {
    errors.sgstAmount = sgstParsed.error;
  }

  const igstParsed = parseOptionalNonNegativeMoney(
    raw.igstAmount,
    'IGST amount',
  );
  if (igstParsed.error) {
    errors.igstAmount = igstParsed.error;
  }

  const taxParsed = parseNonNegativeCharge(raw.taxAmount, 'Tax amount');
  if (taxParsed.error) {
    errors.taxAmount = taxParsed.error;
  }

  let resolvedBillTaxAmount = taxParsed.value;
  let resolvedCgstAmount = cgstParsed.value;
  let resolvedSgstAmount = sgstParsed.value;
  let resolvedIgstAmount = igstParsed.value;

  if (taxModeParsed.value === 'percentage') {
    resolvedBillTaxAmount = 0;
    resolvedCgstAmount = null;
    resolvedSgstAmount = null;
    resolvedIgstAmount = null;
  } else if (
    !cgstParsed.error &&
    !sgstParsed.error &&
    !igstParsed.error &&
    !taxParsed.error &&
    (resolvedCgstAmount !== null ||
      resolvedSgstAmount !== null ||
      resolvedIgstAmount !== null)
  ) {
    const componentSum = roundPurchaseMoney(
      (resolvedCgstAmount || 0) +
        (resolvedSgstAmount || 0) +
        (resolvedIgstAmount || 0),
    );
    const hasExplicitTaxAmount =
      raw.taxAmount !== undefined &&
      raw.taxAmount !== null &&
      String(raw.taxAmount).trim() !== '';

    if (!hasExplicitTaxAmount) {
      resolvedBillTaxAmount = componentSum;
    } else if (Math.abs(resolvedBillTaxAmount - componentSum) > 0.05) {
      errors.taxAmount =
        'Combined tax amount conflicts with CGST + SGST + IGST components — ensure tax is not counted twice.';
    }
  }

  const otherChargesParsed = parseNonNegativeCharge(
    raw.otherCharges,
    'Other charges',
  );
  if (otherChargesParsed.error) {
    errors.otherCharges = otherChargesParsed.error;
  }

  const printedSummaryParsed = parsePrintedInvoiceSummaryInput(
    raw.printedInvoiceSummary,
  );
  if (printedSummaryParsed.error) {
    errors.printedInvoiceSummary = printedSummaryParsed.error;
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
      errors.clientRequestId =
        'Client request identifier cannot exceed 120 characters.';
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
      taxMode: taxModeParsed.value,
      taxRatePercent: taxRateParsed.value,
      cgstAmount: resolvedCgstAmount,
      sgstAmount: resolvedSgstAmount,
      igstAmount: resolvedIgstAmount,
      taxAmount: resolvedBillTaxAmount,
      otherCharges: otherChargesParsed.value,
      printedInvoiceSummary: printedSummaryParsed.value,
      notes,
      clientRequestId,
    },
  };
}
