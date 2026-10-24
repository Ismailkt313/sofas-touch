import mongoose, { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../../../config/env';
import { IUser, UserModel } from '../../auth/models/user.model';
import { ListUsersDto } from '../dto/list-users.dto';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IUserRepository {
  findUsers(filters: ListUsersDto): Promise<PaginatedResult<IUser>>;
  findById(id: string): Promise<IUser | null>;
  findByEmail(email: string, includePassword?: boolean): Promise<IUser | null>;
  create(userData: Partial<IUser>): Promise<IUser>;
  update(id: string, updateData: Partial<IUser>): Promise<IUser | null>;
  updateStatus(id: string, isActive: boolean): Promise<IUser | null>;
  count(): Promise<number>;
}

export class UserRepository implements IUserRepository {
  private memoryStore: Map<string, IUser> = new Map();

  constructor(private userModel: Model<IUser> = UserModel) {
    this.seedMemoryStore();
  }

  private seedMemoryStore(): void {
    const salt = bcrypt.genSaltSync(10);

    const adminUser: IUser = {
      _id: 'usr_admin_001',
      name: env.DEFAULT_ADMIN.name,
      email: env.DEFAULT_ADMIN.email.toLowerCase().trim(),
      role: 'admin',
      password: bcrypt.hashSync(env.DEFAULT_ADMIN.password, salt),
      isActive: true,
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
      image: '',
      phone: '+44 20 7946 0913',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.memoryStore.set(adminUser.email, adminUser);
    this.memoryStore.set(dataEntryUser.email, dataEntryUser);
  }

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async findUsers(filters: ListUsersDto): Promise<PaginatedResult<IUser>> {
    const { page, limit, search, role, status } = filters;

    if (this.isDbConnected()) {
      const mongoFilter: Record<string, unknown> = {};

      if (role) {
        mongoFilter.role = role;
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

      // If database contains users, return paginated results
      if (total > 0 || !this.memoryStore.size) {
        const totalPages = Math.ceil(total / limit) || 1;
        return {
          items: docs as unknown as IUser[],
          total,
          page,
          limit,
          totalPages,
        };
      }
    }

    // In-memory fallback
    let list = Array.from(this.memoryStore.values());

    if (role) {
      list = list.filter((u) => u.role === role);
    }

    if (status) {
      const targetActive = status === 'active';
      list = list.filter((u) => u.isActive === targetActive);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q)),
      );
    }

    list.sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tB - tA;
    });

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;
    const items = list.slice(skip, skip + limit).map((u) => {
      const { password: _p, ...withoutPassword } = u;
      return withoutPassword as IUser;
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findById(id: string): Promise<IUser | null> {
    if (this.isDbConnected()) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const doc = await this.userModel.findById(id).lean().exec();
          if (doc) {
            return doc as unknown as IUser;
          }
        } else {
          const doc = await this.userModel
            .findOne({ _id: id })
            .lean()
            .exec()
            .catch(() => null);
          if (doc) {
            return doc as unknown as IUser;
          }
        }
      } catch {
        // Ignore cast errors
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

    if (this.isDbConnected()) {
      const doc = new this.userModel({
        ...userData,
        email: normalizedEmail,
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

        let updated: unknown = null;
        if (mongoose.isValidObjectId(id)) {
          updated = await this.userModel
            .findByIdAndUpdate(
              id,
              { $set: updatePayload },
              { returnDocument: 'after', runValidators: true },
            )
            .lean()
            .exec();
        } else {
          updated = await this.userModel
            .findOneAndUpdate(
              { _id: id },
              { $set: updatePayload },
              { returnDocument: 'after', runValidators: true },
            )
            .lean()
            .exec()
            .catch(() => null);
        }

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
      if (String(user._id) === id) {
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

  async count(): Promise<number> {
    if (this.isDbConnected()) {
      return this.userModel.countDocuments().exec();
    }
    return this.memoryStore.size;
  }
}
