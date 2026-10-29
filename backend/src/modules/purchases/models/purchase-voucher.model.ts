import mongoose, { Model, Schema } from 'mongoose';
import { EXPENSE_HEAD_CATEGORIES } from '../../expense-heads/models/expense-head.model';
import {
  RAW_MATERIAL_CATEGORIES,
  RAW_MATERIAL_UNITS,
} from '../../raw-materials/models/raw-material.model';
import {
  BillStorageProvider,
  IPurchaseAppliedStockLine,
  IPurchaseBillAttachment,
  IPurchaseLineItem,
  IPurchasePrintedInvoiceSummary,
  IPurchaseStockSyncState,
  IPurchaseVoucher,
  PurchaseEntryMethod,
  PurchaseLineItemType,
  PurchaseTaxMode,
  PurchaseVoucherStatus,
  SupportedBillMimeType,
} from '../types';

export const PURCHASE_VOUCHER_STATUSES: readonly PurchaseVoucherStatus[] = [
  'active',
  'cancelled',
] as const;

export const PURCHASE_ENTRY_METHODS: readonly PurchaseEntryMethod[] = [
  'upload_bill',
  'manual',
] as const;

export const PURCHASE_LINE_ITEM_TYPES: readonly PurchaseLineItemType[] = [
  'material',
  'expense',
] as const;

export const PURCHASE_TAX_MODES: readonly PurchaseTaxMode[] = [
  'bill_amount',
  'percentage',
] as const;

export const SUPPORTED_BILL_MIME_TYPES: readonly SupportedBillMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const BILL_STORAGE_PROVIDERS: readonly BillStorageProvider[] = [
  'local_protected',
  's3',
  'cloudinary',
] as const;

export function normalizePurchaseText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizePurchaseKey(value: string): string {
  return normalizePurchaseText(value).toLowerCase();
}

const PurchaseLineItemSchema = new Schema<IPurchaseLineItem>(
  {
    itemType: {
      type: String,
      enum: PURCHASE_LINE_ITEM_TYPES,
      required: true,
      default: 'material',
    },
    materialId: {
      type: String,
      default: null,
      trim: true,
    },
    materialName: {
      type: String,
      default: '',
      trim: true,
    },
    materialCategory: {
      type: String,
      enum: [...RAW_MATERIAL_CATEGORIES, null],
      default: null,
    },
    expenseHeadId: {
      type: String,
      default: null,
      trim: true,
    },
    expenseHeadName: {
      type: String,
      default: '',
      trim: true,
    },
    expenseHeadCategory: {
      type: String,
      enum: [...EXPENSE_HEAD_CATEGORIES, null],
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240,
    },
    unit: {
      type: String,
      default: null,
      trim: true,
      maxlength: 40,
    },
    quantity: {
      type: Number,
      default: null,
    },
    unitPrice: {
      type: Number,
      default: null,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0.01,
    },
    taxRate: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
  },
  { _id: false },
);

const PurchasePrintedInvoiceSummarySchema =
  new Schema<IPurchasePrintedInvoiceSummary>(
    {
      printedSubtotal: {
        type: Number,
        default: null,
      },
      printedDiscountAmount: {
        type: Number,
        default: null,
      },
      printedTaxAmount: {
        type: Number,
        default: null,
      },
      printedOtherCharges: {
        type: Number,
        default: null,
      },
      printedGrandTotal: {
        type: Number,
        default: null,
      },
    },
    { _id: false },
  );

const PurchaseBillAttachmentSchema = new Schema<IPurchaseBillAttachment>(
  {
    attachmentId: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      enum: SUPPORTED_BILL_MIME_TYPES,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    storageProvider: {
      type: String,
      enum: BILL_STORAGE_PROVIDERS,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
    },
    checksum: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedBy: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedByName: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  { _id: false },
);

const PurchaseAppliedStockLineSchema = new Schema<IPurchaseAppliedStockLine>(
  {
    materialId: {
      type: String,
      required: true,
      trim: true,
    },
    materialName: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      enum: RAW_MATERIAL_UNITS,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const PurchaseStockSyncSchema = new Schema<IPurchaseStockSyncState>(
  {
    applied: {
      type: Boolean,
      required: true,
      default: false,
    },
    appliedRevision: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    appliedLines: {
      type: [PurchaseAppliedStockLineSchema],
      default: [],
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const PurchaseVoucherSchema = new Schema<IPurchaseVoucher>(
  {
    voucherNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    normalizedSupplierName: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    supplierInvoiceNumber: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100,
    },
    normalizedInvoiceNumber: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
      index: true,
    },
    projectRecordId: {
      type: String,
      default: null,
      index: true,
    },
    projectCode: {
      type: String,
      default: null,
      index: true,
    },
    projectName: {
      type: String,
      default: null,
    },
    entryMethod: {
      type: String,
      enum: PURCHASE_ENTRY_METHODS,
      required: true,
      default: 'manual',
    },
    lineItems: {
      type: [PurchaseLineItemSchema],
      required: true,
      validate: {
        validator: (items: IPurchaseLineItem[]) =>
          Array.isArray(items) && items.length > 0,
        message: 'At least one purchase line item is required.',
      },
    },
    materialSubtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    expenseSubtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    taxableSubtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    taxMode: {
      type: String,
      enum: PURCHASE_TAX_MODES,
      required: true,
      default: 'bill_amount',
    },
    taxRatePercent: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    cgstAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    sgstAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    igstAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    otherCharges: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    finalTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    materialAllocatedTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    expenseAllocatedTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    printedInvoiceSummary: {
      type: PurchasePrintedInvoiceSummarySchema,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    attachments: {
      type: [PurchaseBillAttachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: PURCHASE_VOUCHER_STATUSES,
      required: true,
      default: 'active',
      index: true,
    },
    revision: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    stockSync: {
      type: PurchaseStockSyncSchema,
      required: true,
      default: () => ({
        applied: false,
        appliedRevision: 0,
        appliedLines: [],
        lastSyncedAt: null,
      }),
    },
    clientRequestId: {
      type: String,
      default: null,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
    createdByName: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      required: true,
      trim: true,
    },
    updatedByName: {
      type: String,
      required: true,
      trim: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: String,
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

PurchaseVoucherSchema.index({ status: 1, purchaseDate: -1, createdAt: -1 });
PurchaseVoucherSchema.index({ projectRecordId: 1, status: 1, purchaseDate: -1 });
PurchaseVoucherSchema.index(
  { normalizedSupplierName: 1, normalizedInvoiceNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'active',
      normalizedInvoiceNumber: { $gt: '' },
    },
  },
);
PurchaseVoucherSchema.index(
  { clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientRequestId: { $type: 'string', $gt: '' },
    },
  },
);

export const PurchaseVoucherModel: Model<IPurchaseVoucher> =
  mongoose.models.PurchaseVoucher ||
  mongoose.model<IPurchaseVoucher>('PurchaseVoucher', PurchaseVoucherSchema);

export const sharedPurchaseVoucherMemoryStore: Map<string, IPurchaseVoucher> =
  new Map();

export default PurchaseVoucherModel;
