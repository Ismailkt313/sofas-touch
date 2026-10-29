import mongoose, { Model } from 'mongoose';
import {
  DEFAULT_EXPENSE_HEAD_SEEDS,
  ExpenseHeadModel,
  IExpenseHead,
  isValidExpenseHeadObjectId,
  normalizeExpenseHeadDisplayName,
  normalizeExpenseHeadNameKey,
  seedSharedExpenseHeadMemoryStore,
  sharedExpenseHeadMemoryStore,
} from '../models/expense-head.model';
import {
  IExpenseHeadsRepository,
  ListExpenseHeadsQueryDto,
  PaginatedExpenseHeadsResult,
} from '../types';

export class DuplicateExpenseHeadKeyError extends Error {
  public readonly statusCode = 409;

  constructor(message = 'An expense head with this name already exists.') {
    super(message);
    this.name = 'DuplicateExpenseHeadKeyError';
  }
}

function isMongoDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const candidate = err as { code?: number; message?: string };
  return (
    candidate.code === 11000 ||
    (typeof candidate.message === 'string' &&
      candidate.message.includes('E11000'))
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cloneExpenseHead(item: IExpenseHead): IExpenseHead {
  return {
    ...item,
    createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
  };
}

export class ExpenseHeadsRepository implements IExpenseHeadsRepository {
  private indexSyncPromise: Promise<void> | null = null;
  private dbSeededOnce = false;
  private memorySeededOnce = false;

  constructor(
    private readonly model: Model<IExpenseHead> = ExpenseHeadModel,
    private readonly memoryStore: Map<
      string,
      IExpenseHead
    > = sharedExpenseHeadMemoryStore,
  ) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  private ensureMemorySeeded(): void {
    if (!this.memorySeededOnce && this.memoryStore.size === 0) {
      seedSharedExpenseHeadMemoryStore(this.memoryStore);
    }
    this.memorySeededOnce = true;
  }

  private async ensureReady(): Promise<void> {
    if (!this.isDbConnected()) {
      this.indexSyncPromise = null;
      this.ensureMemorySeeded();
      return;
    }

    if (!this.indexSyncPromise) {
      this.indexSyncPromise = this.model
        .createIndexes()
        .then(() => undefined)
        .catch(() => {
          this.indexSyncPromise = null;
        });
    }
    await this.indexSyncPromise;

    if (!this.dbSeededOnce) {
      this.dbSeededOnce = true;
      const existingCount = await this.model
        .countDocuments()
        .exec()
        .catch(() => 1);
      if (existingCount === 0) {
        const seedDocs = DEFAULT_EXPENSE_HEAD_SEEDS.map((s) => ({
          _id: new mongoose.Types.ObjectId(s._id),
          name: s.name,
          normalizedName: normalizeExpenseHeadNameKey(s.name),
          category: s.category,
          description: s.description,
          isActive: true,
          createdBy: 'system',
        }));
        await this.model
          .insertMany(seedDocs, { ordered: false })
          .catch(() => null);
      }
    }
  }

  async create(
    data: Omit<IExpenseHead, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IExpenseHead> {
    await this.ensureReady();
    const displayName = normalizeExpenseHeadDisplayName(data.name);
    const normalizedName = normalizeExpenseHeadNameKey(displayName);

    if (this.isDbConnected()) {
      try {
        const doc = new this.model({
          ...data,
          name: displayName,
          normalizedName,
        });
        const saved = await doc.save();
        return saved.toObject() as unknown as IExpenseHead;
      } catch (err: unknown) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicateExpenseHeadKeyError();
        }
        throw err;
      }
    }

    for (const existing of this.memoryStore.values()) {
      if (existing.normalizedName === normalizedName) {
        throw new DuplicateExpenseHeadKeyError();
      }
    }

    const now = new Date();
    const generatedId = new mongoose.Types.ObjectId().toHexString();
    const stored: IExpenseHead = {
      ...data,
      _id: generatedId,
      name: displayName,
      normalizedName,
      createdAt: now,
      updatedAt: now,
    };
    this.memoryStore.set(generatedId, stored);
    return cloneExpenseHead(stored);
  }

  async findById(id: string): Promise<IExpenseHead | null> {
    await this.ensureReady();
    if (!isValidExpenseHeadObjectId(id)) {
      return null;
    }
    const cleanId = id.trim();

    if (this.isDbConnected()) {
      const doc = await this.model
        .findById(new mongoose.Types.ObjectId(cleanId))
        .lean()
        .exec();
      return doc ? (doc as unknown as IExpenseHead) : null;
    }

    const direct = this.memoryStore.get(cleanId);
    if (direct) {
      return cloneExpenseHead(direct);
    }

    const lower = cleanId.toLowerCase();
    for (const item of this.memoryStore.values()) {
      if (String(item._id).toLowerCase() === lower) {
        return cloneExpenseHead(item);
      }
    }
    return null;
  }

  async findByNormalizedName(
    normalizedName: string,
    excludeId?: string,
  ): Promise<IExpenseHead | null> {
    await this.ensureReady();
    const key = normalizeExpenseHeadNameKey(normalizedName);
    if (!key) {
      return null;
    }

    if (this.isDbConnected()) {
      const filter: Record<string, unknown> = { normalizedName: key };
      if (excludeId && isValidExpenseHeadObjectId(excludeId)) {
        filter._id = { $ne: new mongoose.Types.ObjectId(excludeId.trim()) };
      }
      const doc = await this.model.findOne(filter).lean().exec();
      return doc ? (doc as unknown as IExpenseHead) : null;
    }

    const excludeLower = excludeId ? excludeId.trim().toLowerCase() : '';
    for (const item of this.memoryStore.values()) {
      if (
        item.normalizedName === key &&
        String(item._id).toLowerCase() !== excludeLower
      ) {
        return cloneExpenseHead(item);
      }
    }
    return null;
  }

  async findMany(
    query: ListExpenseHeadsQueryDto,
  ): Promise<PaginatedExpenseHeadsResult<IExpenseHead>> {
    await this.ensureReady();
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    if (this.isDbConnected()) {
      const filter: Record<string, unknown> = {};
      if (query.status === 'active') {
        filter.isActive = true;
      } else if (query.status === 'inactive') {
        filter.isActive = false;
      }
      if (query.category) {
        filter.category = query.category;
      }
      if (query.search) {
        const rx = new RegExp(escapeRegex(query.search), 'i');
        filter.$or = [{ name: rx }, { description: rx }, { category: rx }];
      }

      const [docs, total] = await Promise.all([
        this.model
          .find(filter)
          .sort({ name: 1, _id: 1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.model.countDocuments(filter).exec(),
      ]);

      return {
        items: docs as unknown as IExpenseHead[],
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    let items = Array.from(this.memoryStore.values());
    if (query.status === 'active') {
      items = items.filter((item) => item.isActive);
    } else if (query.status === 'inactive') {
      items = items.filter((item) => !item.isActive);
    }
    if (query.category) {
      items = items.filter((item) => item.category === query.category);
    }
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      items = items.filter(
        (item) =>
          rx.test(item.name) ||
          rx.test(item.description || '') ||
          rx.test(item.category || ''),
      );
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    const total = items.length;
    const paged = items.slice(skip, skip + limit).map(cloneExpenseHead);

    return {
      items: paged,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async updateById(
    id: string,
    updates: Partial<IExpenseHead>,
  ): Promise<IExpenseHead | null> {
    await this.ensureReady();
    if (!isValidExpenseHeadObjectId(id)) {
      return null;
    }
    const cleanId = id.trim();

    if (this.isDbConnected()) {
      try {
        const sanitized = { ...updates };
        delete sanitized._id;
        delete sanitized.createdAt;
        if (typeof sanitized.name === 'string') {
          sanitized.name = normalizeExpenseHeadDisplayName(sanitized.name);
          sanitized.normalizedName = normalizeExpenseHeadNameKey(
            sanitized.name,
          );
        }
        const updated = await this.model
          .findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(cleanId) },
            { $set: sanitized },
            { returnDocument: 'after', runValidators: true },
          )
          .lean()
          .exec();
        return updated ? (updated as unknown as IExpenseHead) : null;
      } catch (err: unknown) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicateExpenseHeadKeyError();
        }
        throw err;
      }
    }

    let targetKey: string | null = null;
    let current: IExpenseHead | null = null;
    for (const [k, item] of this.memoryStore.entries()) {
      if (String(item._id).toLowerCase() === cleanId.toLowerCase()) {
        targetKey = k;
        current = item;
        break;
      }
    }
    if (!current || !targetKey) {
      return null;
    }

    const nextName =
      typeof updates.name === 'string'
        ? normalizeExpenseHeadDisplayName(updates.name)
        : current.name;
    const nextNormalizedName = normalizeExpenseHeadNameKey(nextName);

    for (const [k, item] of this.memoryStore.entries()) {
      if (k !== targetKey && item.normalizedName === nextNormalizedName) {
        throw new DuplicateExpenseHeadKeyError();
      }
    }

    const nextItem: IExpenseHead = {
      ...current,
      ...updates,
      _id: current._id,
      name: nextName,
      normalizedName: nextNormalizedName,
      createdAt: current.createdAt,
      updatedAt: new Date(),
    };
    this.memoryStore.set(targetKey, nextItem);
    return cloneExpenseHead(nextItem);
  }
}
