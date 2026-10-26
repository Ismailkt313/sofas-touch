import mongoose, { Schema, Model } from 'mongoose';

export interface IProjectCounter {
  _id: string;
  seq: number;
  updatedAt?: Date;
}

const ProjectCounterSchema = new Schema<IProjectCounter>(
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

export const PROJECT_SEQUENCE_COUNTER_ID = 'project_code';

export const ProjectCounterModel: Model<IProjectCounter> =
  mongoose.models.ProjectCounter ||
  mongoose.model<IProjectCounter>('ProjectCounter', ProjectCounterSchema);

export const sharedProjectCounterMemoryStore: Map<string, number> = new Map();

export function formatProjectSequenceCode(sequenceNumber: number): string {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
    throw new Error('Project sequence number must be a positive integer.');
  }
  return `PRJ-${String(sequenceNumber).padStart(4, '0')}`;
}

export function extractProjectSequenceNumber(projectId: string): number | null {
  if (typeof projectId !== 'string') {
    return null;
  }
  const match = /^PRJ-(\d+)$/i.exec(projectId.trim());
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export default ProjectCounterModel;
