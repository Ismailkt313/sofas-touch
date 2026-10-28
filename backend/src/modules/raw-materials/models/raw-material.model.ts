import mongoose, { Model, Schema } from 'mongoose';

export const RAW_MATERIAL_CATEGORIES = [
  'Sofa',
  'Curtain',
  'Upholstery',
  'Timber',
  'Foam',
  'Hardware',
  'General',
] as const;

export type RawMaterialCategory = (typeof RAW_MATERIAL_CATEGORIES)[number];

export const RAW_MATERIAL_UNITS = [
  'Piece',
  'Meter',
  'Kilogram',
  'Sheet',
  'Roll',
  'Set',
  'Box',
  'Litre',
  'Square Feet',
  'Running Feet',
  'Pair',
  'Yard',
] as const;

export type RawMaterialUnit = (typeof RAW_MATERIAL_UNITS)[number];

const CATEGORY_LOOKUP: ReadonlyMap<string, RawMaterialCategory> = new Map(
  RAW_MATERIAL_CATEGORIES.map((category) => [category.toLowerCase(), category]),
);

const UNIT_LOOKUP: ReadonlyMap<string, RawMaterialUnit> = new Map([
  ...RAW_MATERIAL_UNITS.map(
    (unit) => [unit.toLowerCase(), unit] as [string, RawMaterialUnit],
  ),
  ['pcs', 'Piece'],
  ['pc', 'Piece'],
  ['pieces', 'Piece'],
  ['m', 'Meter'],
  ['mtr', 'Meter'],
  ['meters', 'Meter'],
  ['metre', 'Meter'],
  ['metres', 'Meter'],
  ['kg', 'Kilogram'],
  ['kgs', 'Kilogram'],
  ['kilograms', 'Kilogram'],
  ['sheets', 'Sheet'],
  ['rolls', 'Roll'],
  ['sets', 'Set'],
  ['boxes', 'Box'],
  ['l', 'Litre'],
  ['ltr', 'Litre'],
  ['liter', 'Litre'],
  ['liters', 'Litre'],
  ['litres', 'Litre'],
  ['sqft', 'Square Feet'],
  ['sq ft', 'Square Feet'],
  ['sq. ft.', 'Square Feet'],
  ['rft', 'Running Feet'],
  ['running ft', 'Running Feet'],
  ['pairs', 'Pair'],
  ['yd', 'Yard'],
  ['yds', 'Yard'],
  ['yards', 'Yard'],
]);

export function normalizeMaterialDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeMaterialNameKey(value: string): string {
  return normalizeMaterialDisplayName(value).toLowerCase();
}

export function normalizeRawMaterialCategory(
  value: unknown,
): RawMaterialCategory | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) {
    return null;
  }
  return CATEGORY_LOOKUP.get(normalized) || null;
}

export function normalizeRawMaterialUnit(value: unknown): RawMaterialUnit | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized) {
    return null;
  }
  return UNIT_LOOKUP.get(normalized) || null;
}

export function isValidRawMaterialObjectId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    /^[a-fA-F0-9]{24}$/.test(id.trim()) &&
    mongoose.Types.ObjectId.isValid(id.trim())
  );
}

export interface IRawMaterial {
  _id?: string | mongoose.Types.ObjectId;
  name: string;
  normalizedName: string;
  category?: RawMaterialCategory | null;
  unit: RawMaterialUnit;
  quantityOnHand?: number;
  description?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const RawMaterialSchema = new Schema<IRawMaterial>(
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
      enum: RAW_MATERIAL_CATEGORIES,
      default: null,
    },
    unit: {
      type: String,
      enum: RAW_MATERIAL_UNITS,
      required: true,
      trim: true,
    },
    quantityOnHand: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Quantity on hand cannot be negative.'],
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

RawMaterialSchema.index({ isActive: 1, updatedAt: -1 });
RawMaterialSchema.index({ category: 1, isActive: 1, updatedAt: -1 });

RawMaterialSchema.pre('validate', function () {
  if (typeof this.name === 'string' && this.name.trim()) {
    this.name = normalizeMaterialDisplayName(this.name);
    this.normalizedName = normalizeMaterialNameKey(this.name);
  }
  if (this.quantityOnHand === undefined || this.quantityOnHand === null || Number.isNaN(this.quantityOnHand)) {
    this.quantityOnHand = 0;
  }
});

export const RawMaterialModel: Model<IRawMaterial> =
  mongoose.models.RawMaterial ||
  mongoose.model<IRawMaterial>('RawMaterial', RawMaterialSchema);

export const sharedRawMaterialMemoryStore: Map<string, IRawMaterial> =
  new Map();

export default RawMaterialModel;
