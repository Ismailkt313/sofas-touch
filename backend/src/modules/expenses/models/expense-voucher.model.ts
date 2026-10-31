import mongoose, { Model, Schema } from 'mongoose';
import {
  IExpenseReceiptAttachment,
  IExpenseVoucher,
} from '../types';

export function normalizeExpenseText(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.trim().replace(/\s+/g, ' ');
}

export const sharedExpenseVoucherMemoryStore = new Map<
  string,
  IExpenseVoucher
>();

const ExpenseReceiptAttachmentSchema = new Schema<IExpenseReceiptAttachment>(
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
      maxlength: 200,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    storageProvider: {
      type: String,
      required: true,
      enum: ['local_protected', 's3', 'cloudinary'],
      default: 'local_protected',
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
      default: '',
      trim: true,
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
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
  {
    _id: false,
  },
);

const ExpenseVoucherSchema = new Schema<IExpenseVoucher>(
  {
    voucherNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    expenseDate: {
      type: Date,
      required: true,
      index: true,
    },
    categoryId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
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
    attachments: {
      type: [ExpenseReceiptAttachmentSchema],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'cancelled'],
      default: 'active',
      index: true,
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
      default: '',
      trim: true,
    },
    updatedBy: {
      type: String,
      default: '',
      trim: true,
    },
    updatedByName: {
      type: String,
      default: '',
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

ExpenseVoucherSchema.index({ projectRecordId: 1, status: 1, expenseDate: -1 });

export const ExpenseVoucherModel: Model<IExpenseVoucher> =
  (mongoose.models.ExpenseVoucher as Model<IExpenseVoucher>) ||
  mongoose.model<IExpenseVoucher>('ExpenseVoucher', ExpenseVoucherSchema);
