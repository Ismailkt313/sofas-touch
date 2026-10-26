import mongoose, { Model } from 'mongoose';
import { IUser, UserModel, sharedUserMemoryStore } from '../models/user.model';

export interface IAuthRepository {
  findByEmail(email: string, includePassword?: boolean): Promise<IUser | null>;
  findById(id: string): Promise<IUser | null>;
  create(userData: Partial<IUser>): Promise<IUser>;
  count(): Promise<number>;
}

export class AuthRepository implements IAuthRepository {
  private memoryStore: Map<string, IUser> = sharedUserMemoryStore;

  constructor(private userModel: Model<IUser> = UserModel) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<IUser | null> {
    const normalized = email.toLowerCase().trim();

    if (this.isDbConnected()) {
      const query = this.userModel.findOne({ email: normalized });
      if (includePassword) {
        query.select('+password');
      }
      const doc = await query.lean().exec();
      if (doc) {
        return doc as unknown as IUser;
      }
    }

    const user = this.memoryStore.get(normalized);
    if (!user) {
      return null;
    }

    if (!includePassword) {
      const { password: _p, ...withoutPassword } = user;
      return withoutPassword as IUser;
    }

    return { ...user };
  }

  async findById(id: string): Promise<IUser | null> {
    if (this.isDbConnected()) {
      const doc = await this.userModel.findById(id).lean().exec();
      if (doc) {
        return doc as unknown as IUser;
      }
    }

    for (const user of this.memoryStore.values()) {
      if (String(user._id) === id) {
        const { password: _p, ...withoutPassword } = user;
        return withoutPassword as IUser;
      }
    }
    return null;
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    const normalizedEmail = (userData.email || '').toLowerCase().trim();
    const approvalStatus = userData.approvalStatus || 'pending';

    if (this.isDbConnected()) {
      const doc = new this.userModel({
        ...userData,
        email: normalizedEmail,
        approvalStatus,
      });
      const saved = await doc.save();
      return saved.toObject() as unknown as IUser;
    }

    if (this.memoryStore.has(normalizedEmail)) {
      const err = new Error(
        `E11000 duplicate key error collection: users index: email_1 dup key: { email: "${normalizedEmail}" }`,
      ) as Error & { code: number };
      err.code = 11000;
      throw err;
    }

    const newUser: IUser = {
      _id: `usr_${Date.now()}`,
      name: userData.name || '',
      email: normalizedEmail,
      role: userData.role || 'data_entry',
      password: userData.password,
      isActive: userData.isActive !== undefined ? userData.isActive : true,
      approvalStatus,
      approvedBy: userData.approvedBy,
      approvedAt: userData.approvedAt,
      rejectionReason: userData.rejectionReason,
      image: userData.image || '',
      phone: userData.phone || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.memoryStore.set(normalizedEmail, newUser);
    return { ...newUser };
  }

  async count(): Promise<number> {
    if (this.isDbConnected()) {
      return this.userModel.countDocuments().exec();
    }
    return this.memoryStore.size;
  }
}
