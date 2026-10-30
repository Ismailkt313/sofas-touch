import mongoose, { Model, Schema } from 'mongoose';
import {
  DEFAULT_DATA_ENTRY_PERMISSIONS,
  PermissionKey,
} from '../constants/permissions.constants';

export interface IRolePermissionConfig {
  _id?: string | mongoose.Types.ObjectId;
  role: 'data_entry';
  permissions: PermissionKey[];
  version: number;
  updatedBy?: string | null;
  updatedByName?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const RolePermissionSchema = new Schema<IRolePermissionConfig>(
  {
    role: {
      type: String,
      enum: ['data_entry'],
      required: true,
      unique: true,
      index: true,
    },
    permissions: {
      type: [String],
      required: true,
      default: () => [...DEFAULT_DATA_ENTRY_PERMISSIONS],
    },
    version: {
      type: Number,
      required: true,
      default: 1,
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

export const RolePermissionModel: Model<IRolePermissionConfig> =
  mongoose.models.RolePermissionConfig ||
  mongoose.model<IRolePermissionConfig>(
    'RolePermissionConfig',
    RolePermissionSchema,
  );

export const sharedRolePermissionMemoryStore: Map<
  string,
  IRolePermissionConfig
> = new Map();
