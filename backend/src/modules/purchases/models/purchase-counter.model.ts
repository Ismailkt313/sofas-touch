import mongoose, { Model, Schema } from 'mongoose';

export interface IPurchaseCounter {
  _id: string;
  seq: number;
  updatedAt?: Date;
}

const PurchaseCounterSchema = new Schema<IPurchaseCounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false,
  },
);

export const PURCHASE_VOUCHER_COUNTER_ID = 'purchase_voucher_code';

export const PurchaseCounterModel: Model<IPurchaseCounter> =
  mongoose.models.PurchaseCounter ||
  mongoose.model<IPurchaseCounter>('PurchaseCounter', PurchaseCounterSchema);

export const sharedPurchaseCounterMemoryStore: Map<string, number> = new Map();

export function formatPurchaseVoucherCode(sequenceNumber: number): string {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
    throw new Error('Purchase voucher sequence number must be a positive integer.');
  }
  return `PV-${String(sequenceNumber).padStart(4, '0')}`;
}

export function extractPurchaseVoucherSequence(
  voucherNumber: string,
): number | null {
  if (typeof voucherNumber !== 'string') {
    return null;
  }
  const match = /^PV-(\d+)$/i.exec(voucherNumber.trim());
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default PurchaseCounterModel;
