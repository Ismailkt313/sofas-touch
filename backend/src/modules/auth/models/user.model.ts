import mongoose, { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../../../config/env';

export type UserRole = 'admin' | 'data_entry';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface IUser {
  _id?: string | mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  image?: string;
  password?: string;
  isActive: boolean;
  approvalStatus: ApprovalStatus;
  approvedBy?: string | mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'data_entry'],
      required: true,
      default: 'data_entry',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
    approvedBy: {
      type: Schema.Types.Mixed,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

// Shared in-memory fallback store used across Auth and User Management modules
export const sharedUserMemoryStore: Map<string, IUser> = new Map();

export function seedSharedUserMemoryStore(): void {
  if (sharedUserMemoryStore.size > 0) {
    return;
  }

  const salt = bcrypt.genSaltSync(10);

  const adminUser: IUser = {
    _id: 'usr_admin_001',
    name: env.DEFAULT_ADMIN.name,
    email: env.DEFAULT_ADMIN.email.toLowerCase().trim(),
    role: 'admin',
    password: bcrypt.hashSync(env.DEFAULT_ADMIN.password, salt),
    isActive: true,
    approvalStatus: 'approved',
    approvedAt: new Date(),
    image: '',
    phone: '+44 20 7946 0912',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dataEntryUser: IUser = {
    _id: 'usr_data_entry_002',
    name: env.DEFAULT_DATA_ENTRY.name,
    email: env.DEFAULT_DATA_ENTRY.email.toLowerCase().trim(),
    role: 'data_entry',
    password: bcrypt.hashSync(env.DEFAULT_DATA_ENTRY.password, salt),
    isActive: true,
    approvalStatus: 'approved',
    approvedAt: new Date(),
    image: '',
    phone: '+44 20 7946 0913',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  sharedUserMemoryStore.set(adminUser.email, adminUser);
  sharedUserMemoryStore.set(dataEntryUser.email, dataEntryUser);
}

seedSharedUserMemoryStore();

export default UserModel;
