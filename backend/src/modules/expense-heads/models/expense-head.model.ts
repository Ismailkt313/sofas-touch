import mongoose, { Model, Schema } from 'mongoose';

export const EXPENSE_HEAD_CATEGORIES = [
  'Transportation',
  'Delivery',
  'Equipment Rental',
  'Labour & Handling',
  'Packaging',
  'Site Installation',
  'Workshop Overhead',
  'General',
] as const;

export type ExpenseHeadCategory = (typeof EXPENSE_HEAD_CATEGORIES)[number];

const CATEGORY_LOOKUP: ReadonlyMap<string, ExpenseHeadCategory> = new Map(
  EXPENSE_HEAD_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

export function normalizeExpenseHeadDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeExpenseHeadNameKey(value: string): string {
  return normalizeExpenseHeadDisplayName(value).toLowerCase();
}

export function normalizeExpenseHeadCategory(
  value: unknown,
): ExpenseHeadCategory | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) {
    return null;
  }
  return CATEGORY_LOOKUP.get(normalized) || null;
}

export function isValidExpenseHeadObjectId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    /^[a-fA-F0-9]{24}$/.test(id.trim()) &&
    mongoose.Types.ObjectId.isValid(id.trim())
  );
}

export interface IExpenseHead {
  _id?: string | mongoose.Types.ObjectId;
  name: string;
  normalizedName: string;
  category: ExpenseHeadCategory;
  description: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const DEFAULT_EXPENSE_HEAD_SEEDS: ReadonlyArray<{
  _id: string;
  name: string;
  category: ExpenseHeadCategory;
  description: string;
}> = [
  {
    _id: '67200000000000000000e101',
    name: 'Transportation Charges',
    category: 'Transportation',
    description: 'Inbound supplier freight, tempo hire, and material transport.',
  },
  {
    _id: '67200000000000000000e102',
    name: 'Delivery Charges',
    category: 'Delivery',
    description: 'Doorstep supplier delivery and courier charges on bills.',
  },
  {
    _id: '67200000000000000000e103',
    name: 'Equipment Rental',
    category: 'Equipment Rental',
    description: 'Temporary hire of scaffolding, compressors, or lifting gear.',
  },
  {
    _id: '67200000000000000000e104',
    name: 'Loading & Unloading',
    category: 'Labour & Handling',
    description: 'Hamali, unloading, and workshop material handling charges.',
  },
  {
    _id: '67200000000000000000e105',
    name: 'Packing & Forwarding',
    category: 'Packaging',
    description: 'Supplier crating, wrapping, and forwarding fees.',
  },
  {
    _id: '67200000000000000000e106',
    name: 'Site Installation & Fitting',
    category: 'Site Installation',
    description: 'On-site curtain track fitting and upholstery installation.',
  },
  {
    _id: '67200000000000000000e107',
    name: 'Workshop Miscellaneous',
    category: 'General',
    description: 'Other non-stock workshop or supplier bill expenses.',
  },
] as const;

const ExpenseHeadSchema = new Schema<IExpenseHead>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 150,
    },
    category: {
      type: String,
      enum: EXPENSE_HEAD_CATEGORIES,
      required: true,
      default: 'General',
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

ExpenseHeadSchema.index({ isActive: 1, updatedAt: -1 });
ExpenseHeadSchema.index({ category: 1, isActive: 1, updatedAt: -1 });

ExpenseHeadSchema.pre('validate', function () {
  if (typeof this.name === 'string' && this.name.trim()) {
    this.name = normalizeExpenseHeadDisplayName(this.name);
    this.normalizedName = normalizeExpenseHeadNameKey(this.name);
  }
});

export const ExpenseHeadModel: Model<IExpenseHead> =
  mongoose.models.ExpenseHead ||
  mongoose.model<IExpenseHead>('ExpenseHead', ExpenseHeadSchema);

export const sharedExpenseHeadMemoryStore: Map<string, IExpenseHead> = new Map();

export function seedSharedExpenseHeadMemoryStore(
  store: Map<string, IExpenseHead> = sharedExpenseHeadMemoryStore,
): void {
  if (store.size > 0) {
    return;
  }
  const now = new Date();
  for (const seed of DEFAULT_EXPENSE_HEAD_SEEDS) {
    store.set(seed._id, {
      _id: seed._id,
      name: seed.name,
      normalizedName: normalizeExpenseHeadNameKey(seed.name),
      category: seed.category,
      description: seed.description,
      isActive: true,
      createdBy: 'system',
      createdAt: now,
      updatedAt: now,
    });
  }
}

seedSharedExpenseHeadMemoryStore();
