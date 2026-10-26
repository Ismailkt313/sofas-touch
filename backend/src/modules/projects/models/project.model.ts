import mongoose, { Schema, Model } from 'mongoose';
import { env } from '../../../config/env';

export const PROJECT_CATEGORIES = [
  'Modular Sofa',
  'Curtains',
  'Armchair',
  'Bespoke Interior',
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_STATUSES = [
  'In Progress',
  'Under Review',
  'Completed',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectActivityEventType =
  | 'project_created'
  | 'project_updated'
  | 'purchase_voucher_created'
  | 'purchase_voucher_updated'
  | 'purchase_voucher_deleted'
  | 'expense_voucher_created'
  | 'expense_voucher_updated'
  | 'expense_voucher_deleted';

export interface IProjectCostThresholdState {
  warningCrossed: boolean;
  exceededCrossed: boolean;
  warningThresholdPercent: number;
}

export interface IProjectInactivityWarningState {
  activeWarningId: string | null;
  warnedForLastActivityAt: Date | null;
}

export interface IProject {
  _id?: string | mongoose.Types.ObjectId;
  projectId: string;
  name: string;
  clientName: string;
  category: ProjectCategory;
  status: ProjectStatus;
  description?: string;
  contractValue: number;
  costAlertThresholdPercent: number;
  totalPurchases: number;
  totalOtherExpenses: number;
  totalCost: number;
  estimatedProfit: number;
  costPercentage: number;
  estimatedProfitMargin: number;
  financialSummaryUpdatedAt: Date;
  costThresholdState: IProjectCostThresholdState;
  lastActivityAt: Date;
  lastActivityType: ProjectActivityEventType;
  inactivityWarningState: IProjectInactivityWarningState;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: PROJECT_CATEGORIES,
      required: true,
      default: 'Modular Sofa',
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      required: true,
      default: 'In Progress',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    contractValue: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    costAlertThresholdPercent: {
      type: Number,
      required: true,
      default: () => env.PROJECT_COST_WARNING_THRESHOLD_PERCENT,
      min: 0.01,
    },
    totalPurchases: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalOtherExpenses: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    estimatedProfit: {
      type: Number,
      required: true,
      default: 0,
    },
    costPercentage: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    estimatedProfitMargin: {
      type: Number,
      required: true,
      default: 0,
    },
    financialSummaryUpdatedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    costThresholdState: {
      warningCrossed: {
        type: Boolean,
        required: true,
        default: false,
      },
      exceededCrossed: {
        type: Boolean,
        required: true,
        default: false,
      },
      warningThresholdPercent: {
        type: Number,
        required: true,
        default: () => env.PROJECT_COST_WARNING_THRESHOLD_PERCENT,
      },
    },
    lastActivityAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    lastActivityType: {
      type: String,
      enum: [
        'project_created',
        'project_updated',
        'purchase_voucher_created',
        'purchase_voucher_updated',
        'purchase_voucher_deleted',
        'expense_voucher_created',
        'expense_voucher_updated',
        'expense_voucher_deleted',
      ],
      required: true,
      default: 'project_created',
    },
    inactivityWarningState: {
      activeWarningId: {
        type: String,
        default: null,
      },
      warnedForLastActivityAt: {
        type: Date,
        default: null,
      },
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

export const ProjectModel: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);

export const sharedProjectMemoryStore: Map<string, IProject> = new Map();

export default ProjectModel;
