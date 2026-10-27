import mongoose, { Schema, Model } from 'mongoose';
import { ProjectStatus, PROJECT_STATUSES } from './project.model';

export type CostThresholdAlertType = 'warning' | 'critical';
export type AlertLifecycleStatus = 'active' | 'resolved';

export interface IProjectCostAlert {
  _id?: string | mongoose.Types.ObjectId;
  projectRecordId: string;
  projectId: string;
  projectName: string;
  thresholdType: CostThresholdAlertType;
  thresholdPercent: number;
  contractValue: number;
  totalCost: number;
  costPercentage: number;
  message: string;
  status: AlertLifecycleStatus;
  triggeredAt: Date;
  resolvedAt?: Date | null;
  resolvedReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProjectCostAlertSchema = new Schema<IProjectCostAlert>(
  {
    projectRecordId: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    thresholdType: {
      type: String,
      enum: ['warning', 'critical'],
      required: true,
      index: true,
    },
    thresholdPercent: {
      type: Number,
      required: true,
    },
    contractValue: {
      type: Number,
      required: true,
    },
    totalCost: {
      type: Number,
      required: true,
    },
    costPercentage: {
      type: Number,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'resolved'],
      required: true,
      default: 'active',
      index: true,
    },
    triggeredAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export interface IProjectActivityWarning {
  _id?: string | mongoose.Types.ObjectId;
  projectRecordId: string;
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  lastActivityAt: Date;
  inactiveDays: number;
  inactivityThresholdDays: number;
  message: string;
  status: AlertLifecycleStatus;
  triggeredAt: Date;
  resolvedAt?: Date | null;
  resolvedReason?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProjectActivityWarningSchema = new Schema<IProjectActivityWarning>(
  {
    projectRecordId: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
      trim: true,
      uppercase: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
    },
    projectStatus: {
      type: String,
      enum: PROJECT_STATUSES,
      required: true,
    },
    lastActivityAt: {
      type: Date,
      required: true,
    },
    inactiveDays: {
      type: Number,
      required: true,
      min: 0,
    },
    inactivityThresholdDays: {
      type: Number,
      required: true,
      min: 0.01,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'resolved'],
      required: true,
      default: 'active',
      index: true,
    },
    triggeredAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

ProjectCostAlertSchema.index(
  { projectRecordId: 1, thresholdType: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  },
);

ProjectActivityWarningSchema.index(
  { projectRecordId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  },
);

export const ProjectCostAlertModel: Model<IProjectCostAlert> =
  mongoose.models.ProjectCostAlert ||
  mongoose.model<IProjectCostAlert>('ProjectCostAlert', ProjectCostAlertSchema);

export const ProjectActivityWarningModel: Model<IProjectActivityWarning> =
  mongoose.models.ProjectActivityWarning ||
  mongoose.model<IProjectActivityWarning>(
    'ProjectActivityWarning',
    ProjectActivityWarningSchema,
  );

export const sharedProjectCostAlertMemoryStore: Map<string, IProjectCostAlert> =
  new Map();

export const sharedProjectActivityWarningMemoryStore: Map<
  string,
  IProjectActivityWarning
> = new Map();
