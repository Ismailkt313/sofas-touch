import mongoose, { Model, Schema } from 'mongoose';
import { IExpenseCounter } from '../types';

export const EXPENSE_VOUCHER_COUNTER_ID = 'expense_voucher_sequence';

export const sharedExpenseCounterMemoryStore = new Map<string, number>();

export function formatExpenseVoucherCode(sequence: number): string {
  const safeSeq = Math.max(1, Math.floor(Number(sequence) || 1));
  return `EXP-${String(safeSeq).padStart(4, '0')}`;
}

export function extractExpenseVoucherSequence(
  voucherNumber: string | null | undefined,
): number {
  if (!voucherNumber || typeof voucherNumber !== 'string') {
    return 0;
  }
  const match = /^EXP-(\d+)$/i.exec(voucherNumber.trim());
  if (!match) {
    return 0;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

const ExpenseCounterSchema = new Schema<IExpenseCounter>(
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
    versionKey: false,
  },
);

export const ExpenseCounterModel: Model<IExpenseCounter> =
  (mongoose.models.ExpenseCounter as Model<IExpenseCounter>) ||
  mongoose.model<IExpenseCounter>('ExpenseCounter', ExpenseCounterSchema);
