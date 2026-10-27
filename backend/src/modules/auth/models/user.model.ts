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

  const pendingApplicant1: IUser = {
    _id: 'usr_pending_003',
    name: 'Hamza Malik',
    email: 'hamza.malik@example.com',
    role: 'data_entry',
    password: bcrypt.hashSync('PendingApplicant123!', salt),
    isActive: true,
    approvalStatus: 'pending',
    image: '',
    phone: '+44 7700 900142',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  };

  const pendingApplicant2: IUser = {
    _id: 'usr_pending_004',
    name: 'Sara Khan',
    email: 'sara.khan@example.com',
    role: 'data_entry',
    password: bcrypt.hashSync('PendingApplicant123!', salt),
    isActive: true,
    approvalStatus: 'pending',
    image: '',
    phone: '+44 7700 900583',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  };

  const rejectedApplicant: IUser = {
    _id: 'usr_rejected_005',
    name: 'Zainab Ahmed',
    email: 'zainab.ahmed@example.com',
    role: 'data_entry',
    password: bcrypt.hashSync('PendingApplicant123!', salt),
    isActive: true,
    approvalStatus: 'rejected',
    rejectionReason: 'Incomplete contact information and showroom background.',
    approvedBy: 'usr_admin_001',
    approvedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
    image: '',
    phone: '+44 7700 900891',
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 36 * 60 * 60 * 1000),
  };

  sharedUserMemoryStore.set(adminUser.email, adminUser);
  sharedUserMemoryStore.set(dataEntryUser.email, dataEntryUser);
  sharedUserMemoryStore.set(pendingApplicant1.email, pendingApplicant1);
  sharedUserMemoryStore.set(pendingApplicant2.email, pendingApplicant2);
  sharedUserMemoryStore.set(rejectedApplicant.email, rejectedApplicant);
}

seedSharedUserMemoryStore();

export default UserModel;
