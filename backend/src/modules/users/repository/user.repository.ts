import mongoose, { Model } from 'mongoose';
import { IUser, UserModel, sharedUserMemoryStore } from '../../auth/models/user.model';
import { ListUsersDto } from '../dto/list-users.dto';
import { ListPendingApprovalsDto } from '../dto/list-pending-approvals.dto';

import { IUserRepository, PaginatedResult } from '../types';

export { IUserRepository, PaginatedResult };

export class UserRepository implements IUserRepository {
  private memoryStore: Map<string, IUser> = sharedUserMemoryStore;

  constructor(private userModel: Model<IUser> = UserModel) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async findUsers(filters: ListUsersDto): Promise<PaginatedResult<IUser>> {
    const { page, limit, search, role, status } = filters;

    if (this.isDbConnected()) {
      const mongoFilter: Record<string, unknown> = {};

      if (role) {
        const canonicalRole = role.toLowerCase().replace(/\s+/g, '_');
        mongoFilter.role = {
          $in: [
            canonicalRole,
            canonicalRole === 'data_entry' ? 'Data Entry' : 'Admin',
            canonicalRole === 'data_entry' ? 'data entry' : 'admin',
          ],
        };
      }

      if (status) {
        mongoFilter.isActive = status === 'active';
      }

      if (search) {
        const escaped = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const searchRegex = new RegExp(escaped, 'i');
        mongoFilter.$or = [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ];
      }

      const skip = (page - 1) * limit;

      const [total, docs] = await Promise.all([
        this.userModel.countDocuments(mongoFilter).exec(),
        this.userModel
          .find(mongoFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
      ]);

      return {
        items: docs as unknown as IUser[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    let items = Array.from(this.memoryStore.values());

    if (role) {
      items = items.filter(
        (u) =>
          u.role.toLowerCase().replace(/\s+/g, '_') ===
          role.toLowerCase().replace(/\s+/g, '_'),
      );
    }

    if (status) {
      const activeBool = status === 'active';
      items = items.filter((u) => u.isActive === activeBool);
    }

    if (search) {
      const s = search.toLowerCase();
      items = items.filter(
        (u) =>
          u.name.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s) ||
          (u.phone && u.phone.toLowerCase().includes(s)),
      );
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

    const total = items.length;
    const skip = (page - 1) * limit;
    const pagedItems = items.slice(skip, skip + limit).map((user) => {
      const { password: _p, ...safe } = user;
      return safe as IUser;
    });

    return {
      items: pagedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findPendingApprovals(
    filters: ListPendingApprovalsDto,
  ): Promise<PaginatedResult<IUser>> {
    const { page, limit, search } = filters;

    if (this.isDbConnected()) {
      const mongoFilter: Record<string, unknown> = {
        approvalStatus: { $in: ['pending', 'Pending'] },
      };

      if (search) {
        const escaped = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const searchRegex = new RegExp(escaped, 'i');
        mongoFilter.$or = [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
        ];
      }

      const skip = (page - 1) * limit;

      const [total, docs] = await Promise.all([
        this.userModel.countDocuments(mongoFilter).exec(),
        this.userModel
          .find(mongoFilter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
      ]);

      return {
        items: docs as unknown as IUser[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    let items = Array.from(this.memoryStore.values()).filter(
      (u) => (u.approvalStatus || '').toLowerCase() === 'pending',
    );

    if (search) {
      const s = search.toLowerCase();
      items = items.filter(
        (u) =>
          u.name.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s) ||
          (u.phone && u.phone.toLowerCase().includes(s)),
      );
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime(),
    );

    const total = items.length;
    const skip = (page - 1) * limit;
    const pagedItems = items.slice(skip, skip + limit).map((user) => {
      const { password: _p, ...safe } = user;
      return safe as IUser;
    });

    return {
      items: pagedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id: string): Promise<IUser | null> {
    if (this.isDbConnected() && mongoose.isValidObjectId(id)) {
      try {
        const doc = await this.userModel.findById(id).lean().exec();
        if (doc) {
          return doc as unknown as IUser;
        }
      } catch {
      }
    }

    for (const user of this.memoryStore.values()) {
      if (String(user._id) === id || user.email.toLowerCase() === id.toLowerCase()) {
        const { password: _p, ...withoutPassword } = user;
        return withoutPassword as IUser;
      }
    }
    return null;
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

  async update(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    if (this.isDbConnected()) {
      try {
        const updatePayload: Record<string, unknown> = {
          ...updateData,
          updatedAt: new Date(),
        };

        const filter = mongoose.isValidObjectId(id)
          ? { _id: new mongoose.Types.ObjectId(id) }
          : { _id: id };

        const updated = await this.userModel
          .findOneAndUpdate(
            filter,
            { $set: updatePayload },
            { returnDocument: 'after', runValidators: true },
          )
          .lean()
          .exec();

        if (updated) {
          return updated as unknown as IUser;
        }
      } catch (err: unknown) {
        const error = err as { code?: number | string; name?: string };
        if (
          error &&
          (error.code === 11000 ||
            error.code === '11000' ||
            (error.name === 'MongoServerError' && error.code === 11000))
        ) {
          throw err;
        }
      }
    }

    for (const [key, user] of this.memoryStore.entries()) {
      if (String(user._id) === id || user.email.toLowerCase() === id.toLowerCase()) {
        if (
          updateData.email &&
          updateData.email.toLowerCase() !== user.email.toLowerCase()
        ) {
          if (this.memoryStore.has(updateData.email.toLowerCase())) {
            const err = new Error('E11000 duplicate key error') as Error & {
              code: number;
            };
            err.code = 11000;
            throw err;
          }
        }

        const updatedUser: IUser = {
          ...user,
          ...updateData,
          updatedAt: new Date(),
        };

        if (updateData.email) {
          this.memoryStore.delete(key);
          this.memoryStore.set(updateData.email.toLowerCase(), updatedUser);
        } else {
          this.memoryStore.set(key, updatedUser);
        }

        const { password: _p, ...safe } = updatedUser;
        return safe as IUser;
      }
    }

    return null;
  }

  async updateStatus(id: string, isActive: boolean): Promise<IUser | null> {
    return this.update(id, { isActive });
  }

  async approveUser(id: string, adminId: string): Promise<IUser | null> {
    const approvedAt = new Date();

    if (this.isDbConnected() && mongoose.isValidObjectId(id)) {
      try {
        const filter = {
          _id: new mongoose.Types.ObjectId(id),
          approvalStatus: 'pending',
        };

        const adminRef = mongoose.isValidObjectId(adminId)
          ? new mongoose.Types.ObjectId(adminId)
          : adminId;

        const updated = await this.userModel
          .findOneAndUpdate(
            filter as any,
            {
              $set: {
                approvalStatus: 'approved',
                approvedBy: adminRef,
                approvedAt,
                rejectionReason: null,
                updatedAt: approvedAt,
              },
            },
            { returnDocument: 'after' },
          )
          .lean()
          .exec();

        if (updated) {
          return updated as unknown as IUser;
        }
      } catch {
      }
    }

    for (const [key, user] of this.memoryStore.entries()) {
      if (String(user._id) === id) {
        if (user.approvalStatus !== 'pending') {
          return null;
        }

        const updatedUser: IUser = {
          ...user,
          approvalStatus: 'approved',
          approvedBy: adminId,
          approvedAt,
          rejectionReason: undefined,
          updatedAt: approvedAt,
        };

        this.memoryStore.set(key, updatedUser);
        const { password: _p, ...safe } = updatedUser;
        return safe as IUser;
      }
    }

    return null;
  }

  async rejectUser(
    id: string,
    adminId: string,
    reason?: string,
  ): Promise<IUser | null> {
    const rejectedAt = new Date();
    const trimmedReason = reason && reason.trim() ? reason.trim() : null;

    if (this.isDbConnected() && mongoose.isValidObjectId(id)) {
      try {
        const filter = {
          _id: new mongoose.Types.ObjectId(id),
          approvalStatus: 'pending',
        };

        const adminRef = mongoose.isValidObjectId(adminId)
          ? new mongoose.Types.ObjectId(adminId)
          : adminId;

        const updated = await this.userModel
          .findOneAndUpdate(
            filter as any,
            {
              $set: {
                approvalStatus: 'rejected',
                approvedBy: adminRef,
                approvedAt: rejectedAt,
                rejectionReason: trimmedReason,
                updatedAt: rejectedAt,
              },
            },
            { returnDocument: 'after' },
          )
          .lean()
          .exec();

        if (updated) {
          return updated as unknown as IUser;
        }
      } catch {
      }
    }

    for (const [key, user] of this.memoryStore.entries()) {
      if (String(user._id) === id) {
        if (user.approvalStatus !== 'pending') {
          return null;
        }

        const updatedUser: IUser = {
          ...user,
          approvalStatus: 'rejected',
          approvedBy: adminId,
          approvedAt: rejectedAt,
          rejectionReason: trimmedReason || undefined,
          updatedAt: rejectedAt,
        };

        this.memoryStore.set(key, updatedUser);
        const { password: _p, ...safe } = updatedUser;
        return safe as IUser;
      }
    }

    return null;
  }

  async count(): Promise<number> {
    if (this.isDbConnected()) {
      return this.userModel.countDocuments().exec();
    }
    return this.memoryStore.size;
  }
}
