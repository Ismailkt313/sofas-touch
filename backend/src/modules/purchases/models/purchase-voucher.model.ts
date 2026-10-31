import mongoose, { Model, Schema } from 'mongoose';
import {
  RAW_MATERIAL_CATEGORIES,
  RAW_MATERIAL_UNITS,
} from '../../raw-materials/models/raw-material.model';
import {
  BillStorageProvider,
  IPurchaseAppliedStockLine,
  IPurchaseBillAttachment,
  IPurchaseLineItem,
  IPurchaseStockSyncState,
  IPurchaseVoucher,
  PurchaseEntryMethod,
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
    materialCategory: {
      type: String,
      enum: [...RAW_MATERIAL_CATEGORIES, null],
      default: null,
    },
    unit: {
      type: String,
      enum: RAW_MATERIAL_UNITS,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0.01,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
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
    secureUrl: {
      type: String,
      trim: true,
      default: null,
    },
    publicId: {
      type: String,
      trim: true,
      default: null,
    },
    resourceType: {
      type: String,
      trim: true,
      default: null,
    },
    format: {
      type: String,
      trim: true,
      default: null,
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
        message: 'At least one material line item is required.',
      },
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
