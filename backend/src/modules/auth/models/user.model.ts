import mongoose, { Schema, Model } from 'mongoose';

export type UserRole = 'admin' | 'data_entry';

export interface IUser {
  _id?: string | mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  image?: string;
  password?: string;
  isActive: boolean;
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
  },
  {
    timestamps: true,
  },
);

export const UserModel: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default UserModel;
