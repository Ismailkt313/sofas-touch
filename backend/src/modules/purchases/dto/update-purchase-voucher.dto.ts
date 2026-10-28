import { normalizePurchaseText } from '../models/purchase-voucher.model';
import {
  UpdatePurchaseVoucherDto,
  ValidationResult,
} from '../types';
import {
  parseLineItemsInput,
  parseNonNegativeCharge,
  parsePurchaseDateInput,
} from './create-purchase-voucher.dto';

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
  'clientRequestId',
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

const ALLOWED_UPDATE_FIELDS = new Set([
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
  'removeAttachmentIds',
]);

export function validateUpdatePurchaseVoucherDto(
  body: unknown,
  hasUploadedFiles = false,
): ValidationResult<UpdatePurchaseVoucherDto> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be an object.' },
    };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const dto: UpdatePurchaseVoucherDto = {};

  for (const key of Object.keys(raw)) {
    if (SYSTEM_MANAGED_FIELDS.has(key)) {
      errors[key] = `'${key}' is system-managed and cannot be modified.`;
    } else if (
      !ALLOWED_UPDATE_FIELDS.has(key) &&
      !IGNORED_CALCULATED_FIELDS.has(key)
    ) {
      errors[key] = `'${key}' is not a valid purchase voucher update field.`;
    }
  }

  if (raw.purchaseDate !== undefined) {
    const parsedDate = parsePurchaseDateInput(raw.purchaseDate);
    if (!parsedDate) {
      errors.purchaseDate = 'Purchase date must be a valid date.';
    } else {
      dto.purchaseDate = parsedDate;
    }
  }

  if (raw.supplierName !== undefined) {
    if (typeof raw.supplierName !== 'string' || !raw.supplierName.trim()) {
      errors.supplierName = 'Supplier name cannot be empty.';
    } else {
      const normalized = normalizePurchaseText(raw.supplierName);
      if (normalized.length > 200) {
        errors.supplierName = 'Supplier name cannot exceed 200 characters.';
      } else {
        dto.supplierName = normalized;
      }
    }
  }

  if (raw.supplierInvoiceNumber !== undefined) {
    if (raw.supplierInvoiceNumber === null || raw.supplierInvoiceNumber === '') {
      dto.supplierInvoiceNumber = '';
    } else if (typeof raw.supplierInvoiceNumber !== 'string') {
      errors.supplierInvoiceNumber = 'Supplier invoice number must be text.';
    } else {
      const cleanInv = normalizePurchaseText(raw.supplierInvoiceNumber);
      if (cleanInv.length > 100) {
        errors.supplierInvoiceNumber =
          'Supplier invoice number cannot exceed 100 characters.';
      } else {
        dto.supplierInvoiceNumber = cleanInv;
      }
    }
  }

  if (raw.projectId !== undefined) {
    if (raw.projectId === null || String(raw.projectId).trim() === '') {
      dto.projectId = null;
    } else if (typeof raw.projectId !== 'string') {
      errors.projectId = 'Project identifier must be a string.';
    } else {
      dto.projectId = raw.projectId.trim();
    }
  }

  if (raw.entryMethod !== undefined) {
    if (raw.entryMethod === 'upload_bill' || raw.entryMethod === 'manual') {
      dto.entryMethod = raw.entryMethod;
    } else {
      errors.entryMethod = "Entry method must be 'upload_bill' or 'manual'.";
    }
  }

  if (raw.lineItems !== undefined) {
    const parsedLines = parseLineItemsInput(raw.lineItems);
    if (parsedLines.error) {
      errors.lineItems = parsedLines.error;
      if (parsedLines.itemErrors) {
        Object.assign(errors, parsedLines.itemErrors);
      }
    } else {
      dto.lineItems = parsedLines.items;
    }
  }

  if (raw.discountAmount !== undefined) {
    const parsed = parseNonNegativeCharge(
      raw.discountAmount,
      'Discount amount',
    );
    if (parsed.error) {
      errors.discountAmount = parsed.error;
    } else {
      dto.discountAmount = parsed.value;
    }
  }

  if (raw.taxAmount !== undefined) {
    const parsed = parseNonNegativeCharge(raw.taxAmount, 'Tax amount');
    if (parsed.error) {
      errors.taxAmount = parsed.error;
    } else {
      dto.taxAmount = parsed.value;
    }
  }

  if (raw.otherCharges !== undefined) {
    const parsed = parseNonNegativeCharge(raw.otherCharges, 'Other charges');
    if (parsed.error) {
      errors.otherCharges = parsed.error;
    } else {
      dto.otherCharges = parsed.value;
    }
  }

  if (raw.notes !== undefined) {
    if (raw.notes === null || raw.notes === '') {
      dto.notes = '';
    } else if (typeof raw.notes !== 'string') {
      errors.notes = 'Notes must be a string.';
    } else if (raw.notes.trim().length > 1000) {
      errors.notes = 'Notes cannot exceed 1000 characters.';
    } else {
      dto.notes = raw.notes.trim();
    }
  }

  if (raw.removeAttachmentIds !== undefined) {
    let listCandidate: unknown = raw.removeAttachmentIds;
    if (typeof raw.removeAttachmentIds === 'string') {
      const trimmed = raw.removeAttachmentIds.trim();
      if (!trimmed) {
        listCandidate = [];
      } else {
        try {
          listCandidate = JSON.parse(trimmed);
        } catch {
          listCandidate = [trimmed];
        }
      }
    }

    if (!Array.isArray(listCandidate)) {
      errors.removeAttachmentIds = 'removeAttachmentIds must be an array of IDs.';
    } else {
      dto.removeAttachmentIds = listCandidate
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  if (Object.keys(dto).length === 0 && !hasUploadedFiles) {
    return {
      isValid: false,
      errors: {
        body: 'Provide at least one updated field or bill attachment.',
      },
    };
  }

  return {
    isValid: true,
    value: dto,
  };
}
