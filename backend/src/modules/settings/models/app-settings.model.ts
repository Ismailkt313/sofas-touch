import mongoose, { Model, Schema } from 'mongoose';
import { env } from '../../../config/env';

export interface IAppSettings {
  _id?: string | mongoose.Types.ObjectId;
  singletonKey: 'workspace';
  companyName: string;
  workshopLocation: string;
  supportEmail: string;
  currencyCode: 'INR';
  defaultCostWarningPercent: number;
  defaultCostCriticalPercent: number;
  projectInactivityThresholdDays: number;
  operatorGuidanceBanner: string;
  updatedBy?: string | null;
  updatedByName?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    singletonKey: {
      type: String,
      enum: ['workspace'],
      required: true,
      unique: true,
      default: 'workspace',
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      default: 'Soft Touch Sofas',
    },
    workshopLocation: {
      type: String,
      trim: true,
      maxlength: 180,
      default: 'Kochi Manufacturing & Upholstery Atelier',
    },
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: () => env.DEFAULT_ADMIN.email,
    },
    currencyCode: {
      type: String,
      enum: ['INR'],
      default: 'INR',
    },
    defaultCostWarningPercent: {
      type: Number,
      min: 10,
      max: 100,
      default: () => env.PROJECT_COST_WARNING_THRESHOLD_PERCENT,
    },
    defaultCostCriticalPercent: {
      type: Number,
      min: 50,
      max: 200,
      default: () => env.PROJECT_COST_CRITICAL_THRESHOLD_PERCENT,
    },
    projectInactivityThresholdDays: {
      type: Number,
      min: 1,
      max: 365,
      default: () => env.PROJECT_INACTIVITY_THRESHOLD_DAYS,
    },
    operatorGuidanceBanner: {
      type: String,
      trim: true,
      maxlength: 300,
      default:
        'Attach supplier invoices on purchase vouchers and link expenses to the active project code whenever applicable.',
    },
    updatedBy: {
      type: String,
      default: null,
    },
    updatedByName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const AppSettingsModel: Model<IAppSettings> =
  mongoose.models.AppSettings ||
  mongoose.model<IAppSettings>('AppSettings', AppSettingsSchema);

export const sharedAppSettingsMemoryStore: Map<string, IAppSettings> =
  new Map();
