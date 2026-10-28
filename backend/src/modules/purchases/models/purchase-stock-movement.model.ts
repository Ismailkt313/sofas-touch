import mongoose, { Model, Schema } from 'mongoose';
import { RAW_MATERIAL_UNITS } from '../../raw-materials/models/raw-material.model';
import { IPurchaseStockMovement, PurchaseStockMovementType } from '../types';

export const PURCHASE_STOCK_MOVEMENT_TYPES: readonly PurchaseStockMovementType[] =
  ['purchase_created', 'purchase_revised', 'purchase_cancelled'] as const;

const PurchaseStockMovementSchema = new Schema<IPurchaseStockMovement>(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    voucherId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    voucherNumber: {
      type: String,
      required: true,
      trim: true,
    },
    revision: {
      type: Number,
      required: true,
      min: 1,
    },
    movementType: {
      type: String,
      enum: PURCHASE_STOCK_MOVEMENT_TYPES,
      required: true,
    },
    materialId: {
      type: String,
      required: true,
      index: true,
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
    quantityDelta: {
      type: Number,
      required: true,
    },
    resultingQuantityOnHand: {
      type: Number,
      required: true,
      min: 0,
    },
    performedBy: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  {
    versionKey: false,
  },
);

PurchaseStockMovementSchema.index({ voucherId: 1, createdAt: 1 });

export const PurchaseStockMovementModel: Model<IPurchaseStockMovement> =
  mongoose.models.PurchaseStockMovement ||
  mongoose.model<IPurchaseStockMovement>(
    'PurchaseStockMovement',
    PurchaseStockMovementSchema,
  );

export const sharedPurchaseStockMovementMemoryStore: Map<
  string,
  IPurchaseStockMovement
> = new Map();

export default PurchaseStockMovementModel;
