import mongoose, { Model, Schema } from 'mongoose';
import { IExpenseCategory } from '../types';

export const DEFAULT_EXPENSE_CATEGORIES: ReadonlyArray<{
  name: string;
  description: string;
}> = Object.freeze([
  {
    name: 'Transportation',
    description: 'Delivery tempo, freight, fuel, and local transport charges',
  },
  {
    name: 'Labour',
    description: 'Daily workshop, upholstery, carpentry, and helper wages',
  },
  {
    name: 'Installation',
    description: 'On-site sofa, curtain rod, track, and fitting charges',
  },
  {
    name: 'Repairs',
    description: 'Machine servicing, tool maintenance, and workshop repairs',
  },
  {
    name: 'Miscellaneous',
    description: 'General workshop consumables, packing, and sundry expenses',
  },
]);

export function normalizeExpenseCategoryName(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.trim().replace(/\s+/g, ' ');
}

export function normalizeExpenseCategoryKey(raw: unknown): string {
  return normalizeExpenseCategoryName(raw).toLowerCase();
}

export const sharedExpenseCategoryMemoryStore = new Map<
  string,
  IExpenseCategory
>();

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

ExpenseCategorySchema.pre('validate', function () {
  if (this.name) {
    this.name = normalizeExpenseCategoryName(this.name);
    this.normalizedName = normalizeExpenseCategoryKey(this.name);
  }
});

export const ExpenseCategoryModel: Model<IExpenseCategory> =
  (mongoose.models.ExpenseCategory as Model<IExpenseCategory>) ||
  mongoose.model<IExpenseCategory>('ExpenseCategory', ExpenseCategorySchema);
