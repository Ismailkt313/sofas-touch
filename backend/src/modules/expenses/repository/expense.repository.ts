import mongoose, { Model } from 'mongoose';
import { roundExpenseMoney } from '../dto/expense.dto';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  ExpenseCategoryModel,
  normalizeExpenseCategoryKey,
  normalizeExpenseCategoryName,
  sharedExpenseCategoryMemoryStore,
} from '../models/expense-category.model';
import {
  EXPENSE_VOUCHER_COUNTER_ID,
  ExpenseCounterModel,
  extractExpenseVoucherSequence,
  formatExpenseVoucherCode,
  sharedExpenseCounterMemoryStore,
} from '../models/expense-counter.model';
import {
  ExpenseVoucherModel,
  sharedExpenseVoucherMemoryStore,
} from '../models/expense-voucher.model';
import {
  ExpenseVoucherListSummary,
  IExpenseCategory,
  IExpenseCounter,
  IExpenseRepository,
  IExpenseVoucher,
  ListExpenseVouchersDto,
  PaginatedResult,
} from '../types';

export class DuplicateExpenseCategoryError extends Error {
  public readonly statusCode = 409;

  constructor(categoryName: string) {
    super(`An expense category named '${categoryName}' already exists.`);
    this.name = 'DuplicateExpenseCategoryError';
  }
}

export class DuplicateExpenseVoucherError extends Error {
  public readonly statusCode = 409;

  constructor(message = 'A duplicate expense voucher conflict occurred.') {
    super(message);
    this.name = 'DuplicateExpenseVoucherError';
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

function cloneCategory(category: IExpenseCategory): IExpenseCategory {
  return {
    ...category,
    createdAt: category.createdAt ? new Date(category.createdAt) : undefined,
    updatedAt: category.updatedAt ? new Date(category.updatedAt) : undefined,
  };
}

function cloneVoucher(voucher: IExpenseVoucher): IExpenseVoucher {
  return {
    ...voucher,
    expenseDate: new Date(voucher.expenseDate),
    attachments: (voucher.attachments || []).map((att) => ({
      ...att,
      uploadedAt: new Date(att.uploadedAt),
    })),
    cancelledAt: voucher.cancelledAt ? new Date(voucher.cancelledAt) : null,
    createdAt: voucher.createdAt ? new Date(voucher.createdAt) : undefined,
    updatedAt: voucher.updatedAt ? new Date(voucher.updatedAt) : undefined,
  };
}

let lastMonotonicMs = 0;
function nextMonotonicDate(): Date {
  const now = Date.now();
  lastMonotonicMs = now > lastMonotonicMs ? now : lastMonotonicMs + 1;
  return new Date(lastMonotonicMs);
}

export class ExpenseRepository implements IExpenseRepository {
  private indexSyncPromise: Promise<void> | null = null;
  private counterFloorSynced = false;
  private seedPromise: Promise<void> | null = null;

  constructor(
    private readonly categoryModel: Model<IExpenseCategory> = ExpenseCategoryModel,
    private readonly voucherModel: Model<IExpenseVoucher> = ExpenseVoucherModel,
    private readonly counterModel: Model<IExpenseCounter> = ExpenseCounterModel,
    private readonly categoryMemory: Map<
      string,
      IExpenseCategory
    > = sharedExpenseCategoryMemoryStore,
    private readonly voucherMemory: Map<
      string,
      IExpenseVoucher
    > = sharedExpenseVoucherMemoryStore,
    private readonly counterMemory: Map<
      string,
      number
    > = sharedExpenseCounterMemoryStore,
  ) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.isDbConnected()) {
      this.indexSyncPromise = null;
      this.counterFloorSynced = false;
      return;
    }
    if (!this.indexSyncPromise) {
      this.indexSyncPromise = Promise.all([
        this.categoryModel.createIndexes(),
        this.voucherModel.createIndexes(),
      ])
        .then(() => undefined)
        .catch(() => {
          this.indexSyncPromise = null;
        });
    }
    await this.indexSyncPromise;
  }

  async ensureDefaultCategories(): Promise<void> {
    if (this.seedPromise) {
      await this.seedPromise;
      return;
    }

    this.seedPromise = (async () => {
      if (this.isDbConnected()) {
        await this.ensureIndexes();
        const existingCount = await this.categoryModel.countDocuments().exec();
        if (existingCount > 0) {
          return;
        }
        for (const def of DEFAULT_EXPENSE_CATEGORIES) {
          const normalizedName = normalizeExpenseCategoryKey(def.name);
          await this.categoryModel
            .findOneAndUpdate(
              { normalizedName },
              {
                $setOnInsert: {
                  name: def.name,
                  normalizedName,
                  description: def.description,
                  isDefault: true,
                  isActive: true,
                  createdBy: 'system',
                },
              },
              { upsert: true, new: true },
            )
            .exec();
        }
        return;
      }

      if (this.categoryMemory.size > 0) {
        return;
      }

      for (const def of DEFAULT_EXPENSE_CATEGORIES) {
        const id = new mongoose.Types.ObjectId().toHexString();
        const now = nextMonotonicDate();
        this.categoryMemory.set(id, {
          _id: id,
          name: def.name,
          normalizedName: normalizeExpenseCategoryKey(def.name),
          description: def.description,
          isDefault: true,
          isActive: true,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
        });
      }
    })().finally(() => {
      this.seedPromise = null;
    });

    await this.seedPromise;
  }

  async listCategories(options?: {
    includeInactive?: boolean;
  }): Promise<IExpenseCategory[]> {
    await this.ensureDefaultCategories();
    const includeInactive = Boolean(options?.includeInactive);

    if (this.isDbConnected()) {
      const filter = includeInactive ? {} : { isActive: true };
      const docs = await this.categoryModel
        .find(filter)
        .sort({ isDefault: -1, name: 1 })
        .lean()
        .exec();
      return (docs as unknown as IExpenseCategory[]).map((doc) => ({
        ...doc,
        _id: String(doc._id),
      }));
    }

    const items = Array.from(this.categoryMemory.values()).filter((cat) =>
      includeInactive ? true : cat.isActive !== false,
    );

    items.sort((a, b) => {
      if (a.isDefault !== b.isDefault) {
        return a.isDefault ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return items.map(cloneCategory);
  }

  async findCategoryById(id: string): Promise<IExpenseCategory | null> {
    await this.ensureDefaultCategories();
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      return null;
    }

    if (this.isDbConnected()) {
      if (!mongoose.isValidObjectId(cleanId)) {
        return null;
      }
      const doc = await this.categoryModel.findById(cleanId).lean().exec();
      if (!doc) {
        return null;
      }
      const typed = doc as unknown as IExpenseCategory;
      return { ...typed, _id: String(typed._id) };
    }

    const found = this.categoryMemory.get(cleanId);
    return found ? cloneCategory(found) : null;
  }

  async findCategoryByNormalizedName(
    normalizedName: string,
  ): Promise<IExpenseCategory | null> {
    await this.ensureDefaultCategories();
    const key = normalizeExpenseCategoryKey(normalizedName);
    if (!key) {
      return null;
    }

    if (this.isDbConnected()) {
      const doc = await this.categoryModel
        .findOne({ normalizedName: key })
        .lean()
        .exec();
      if (!doc) {
        return null;
      }
      const typed = doc as unknown as IExpenseCategory;
      return { ...typed, _id: String(typed._id) };
    }

    for (const cat of this.categoryMemory.values()) {
      if (cat.normalizedName === key) {
        return cloneCategory(cat);
      }
    }
    return null;
  }

  async createCategory(
    data: Omit<IExpenseCategory, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IExpenseCategory> {
    await this.ensureDefaultCategories();
    const cleanName = normalizeExpenseCategoryName(data.name);
    const normalizedName = normalizeExpenseCategoryKey(cleanName);

    const existing = await this.findCategoryByNormalizedName(normalizedName);
    if (existing) {
      throw new DuplicateExpenseCategoryError(existing.name);
    }

    if (this.isDbConnected()) {
      await this.ensureIndexes();
      try {
        const created = await this.categoryModel.create({
          ...data,
          name: cleanName,
          normalizedName,
        });
        const plain = created.toObject() as unknown as IExpenseCategory;
        return { ...plain, _id: String(created._id) };
      } catch (err) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicateExpenseCategoryError(cleanName);
        }
        throw err;
      }
    }

    const id = new mongoose.Types.ObjectId().toHexString();
    const now = nextMonotonicDate();
    const record: IExpenseCategory = {
      ...data,
      _id: id,
      name: cleanName,
      normalizedName,
      createdAt: now,
      updatedAt: now,
    };
    this.categoryMemory.set(id, record);
    return cloneCategory(record);
  }

  async updateCategoryById(
    id: string,
    updates: Partial<IExpenseCategory>,
  ): Promise<IExpenseCategory | null> {
    await this.ensureDefaultCategories();
    const cleanId = String(id || '').trim();
    if (!cleanId) {
      return null;
    }

    const sanitizedUpdates: Partial<IExpenseCategory> = { ...updates };
    delete sanitizedUpdates._id;
    delete sanitizedUpdates.createdAt;

    if (sanitizedUpdates.name !== undefined) {
      const cleanName = normalizeExpenseCategoryName(sanitizedUpdates.name);
      const normalizedName = normalizeExpenseCategoryKey(cleanName);
      const conflict = await this.findCategoryByNormalizedName(normalizedName);
      if (conflict && String(conflict._id) !== cleanId) {
        throw new DuplicateExpenseCategoryError(conflict.name);
      }
      sanitizedUpdates.name = cleanName;
      sanitizedUpdates.normalizedName = normalizedName;
    }

    if (this.isDbConnected()) {
      if (!mongoose.isValidObjectId(cleanId)) {
        return null;
      }
      await this.ensureIndexes();
      try {
        const updated = await this.categoryModel
          .findByIdAndUpdate(
            cleanId,
            { $set: sanitizedUpdates },
            { new: true, runValidators: true },
          )
          .lean()
          .exec();
        if (!updated) {
          return null;
        }
        const typed = updated as unknown as IExpenseCategory;
        return { ...typed, _id: String(typed._id) };
      } catch (err) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicateExpenseCategoryError(
            sanitizedUpdates.name || 'category',
          );
        }
        throw err;
      }
    }

    const current = this.categoryMemory.get(cleanId);
    if (!current) {
      return null;
    }

    const merged: IExpenseCategory = {
      ...current,
      ...sanitizedUpdates,
      _id: cleanId,
      updatedAt: nextMonotonicDate(),
    };
    this.categoryMemory.set(cleanId, merged);
    return cloneCategory(merged);
  }

  async syncCategoryNameOnVouchers(
    categoryId: string,
    categoryName: string,
  ): Promise<void> {
    const cleanId = String(categoryId || '').trim();
    const cleanName = normalizeExpenseCategoryName(categoryName);
    if (!cleanId || !cleanName) {
      return;
    }

    if (this.isDbConnected()) {
      await this.voucherModel
        .updateMany({ categoryId: cleanId }, { $set: { categoryName: cleanName } })
        .exec();
      return;
    }

    for (const [key, voucher] of this.voucherMemory.entries()) {
      if (voucher.categoryId === cleanId) {
        this.voucherMemory.set(key, {
          ...voucher,
          categoryName: cleanName,
        });
      }
    }
  }

  private async syncCounterFloorFromDb(): Promise<void> {
    if (!this.isDbConnected() || this.counterFloorSynced) {
      return;
    }
    const latest = await this.voucherModel
      .findOne({}, { voucherNumber: 1 })
      .sort({ voucherNumber: -1 })
      .lean()
      .exec();
    const maxSeq = extractExpenseVoucherSequence(
      (latest as { voucherNumber?: string } | null)?.voucherNumber,
    );
    if (maxSeq > 0) {
      await this.counterModel
        .findOneAndUpdate(
          { _id: EXPENSE_VOUCHER_COUNTER_ID, seq: { $lt: maxSeq } },
          { $set: { seq: maxSeq } },
          { upsert: true },
        )
        .catch(() => undefined);
    }
    this.counterFloorSynced = true;
  }

  async nextVoucherNumber(): Promise<string> {
    if (this.isDbConnected()) {
      await this.syncCounterFloorFromDb();
      const updated = await this.counterModel
        .findOneAndUpdate(
          { _id: EXPENSE_VOUCHER_COUNTER_ID },
          { $inc: { seq: 1 } },
          { upsert: true, new: true },
        )
        .lean()
        .exec();
      const seq = Number((updated as IExpenseCounter | null)?.seq || 1);
      return formatExpenseVoucherCode(seq);
    }

    let current = this.counterMemory.get(EXPENSE_VOUCHER_COUNTER_ID) || 0;
    for (const v of this.voucherMemory.values()) {
      const seq = extractExpenseVoucherSequence(v.voucherNumber);
      if (seq > current) {
        current = seq;
      }
    }
    const next = current + 1;
    this.counterMemory.set(EXPENSE_VOUCHER_COUNTER_ID, next);
    return formatExpenseVoucherCode(next);
  }

  async createVoucher(
    data: Omit<IExpenseVoucher, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IExpenseVoucher> {
    if (this.isDbConnected()) {
      await this.ensureIndexes();
      try {
        const created = await this.voucherModel.create(data);
        const plain = created.toObject() as unknown as IExpenseVoucher;
        return { ...plain, _id: String(created._id) };
      } catch (err) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicateExpenseVoucherError();
        }
        throw err;
      }
    }

    for (const v of this.voucherMemory.values()) {
      if (v.voucherNumber === data.voucherNumber) {
        throw new DuplicateExpenseVoucherError();
      }
    }

    const id = new mongoose.Types.ObjectId().toHexString();
    const now = nextMonotonicDate();
    const record: IExpenseVoucher = {
      ...data,
      _id: id,
      expenseDate: new Date(data.expenseDate),
      attachments: (data.attachments || []).map((att) => ({
        ...att,
        uploadedAt: new Date(att.uploadedAt),
      })),
      createdAt: now,
      updatedAt: now,
    };
    this.voucherMemory.set(id, record);
    return cloneVoucher(record);
  }

  async findVoucherByIdOrNumber(
    identifier: string,
  ): Promise<IExpenseVoucher | null> {
    const clean = String(identifier || '').trim();
    if (!clean) {
      return null;
    }

    if (this.isDbConnected()) {
      let doc = null;
      if (mongoose.isValidObjectId(clean)) {
        doc = await this.voucherModel.findById(clean).lean().exec();
      }
      if (!doc) {
        doc = await this.voucherModel
          .findOne({
            voucherNumber: new RegExp(`^${escapeRegex(clean)}$`, 'i'),
          })
          .lean()
          .exec();
      }
      if (!doc) {
        return null;
      }
      const typed = doc as unknown as IExpenseVoucher;
      return { ...typed, _id: String(typed._id) };
    }

    const direct = this.voucherMemory.get(clean);
    if (direct) {
      return cloneVoucher(direct);
    }

    const upper = clean.toUpperCase();
    for (const v of this.voucherMemory.values()) {
      if (v.voucherNumber.toUpperCase() === upper) {
        return cloneVoucher(v);
      }
    }
    return null;
  }

  async findVoucherByClientRequestId(
    clientRequestId: string,
  ): Promise<IExpenseVoucher | null> {
    const clean = String(clientRequestId || '').trim();
    if (!clean) {
      return null;
    }

    if (this.isDbConnected()) {
      const doc = await this.voucherModel
        .findOne({ clientRequestId: clean })
        .lean()
        .exec();
      if (!doc) {
        return null;
      }
      const typed = doc as unknown as IExpenseVoucher;
      return { ...typed, _id: String(typed._id) };
    }

    for (const v of this.voucherMemory.values()) {
      if (v.clientRequestId === clean) {
        return cloneVoucher(v);
      }
    }
    return null;
  }

  async findVouchers(
    filters: ListExpenseVouchersDto & {
      resolvedProjectRecordId?: string | null;
      filterUnassignedProject?: boolean;
    },
  ): Promise<PaginatedResult<IExpenseVoucher>> {
    const page = Math.max(1, filters.page);
    const limit = Math.max(1, Math.min(100, filters.limit));
    const skip = (page - 1) * limit;

    if (this.isDbConnected()) {
      const query: Record<string, unknown> = {};

      if (filters.status !== 'all') {
        query.status = filters.status;
      }

      if (filters.categoryId) {
        query.categoryId = filters.categoryId;
      }

      if (filters.filterUnassignedProject) {
        query.projectRecordId = null;
      } else if (filters.resolvedProjectRecordId) {
        query.projectRecordId = filters.resolvedProjectRecordId;
      } else if (filters.projectId) {
        query.projectRecordId = '__no_matching_project__';
      }

      if (filters.fromDate || filters.toDate) {
        const range: Record<string, Date> = {};
        if (filters.fromDate) range.$gte = filters.fromDate;
        if (filters.toDate) range.$lte = filters.toDate;
        query.expenseDate = range;
      }

      if (filters.search) {
        const pattern = new RegExp(escapeRegex(filters.search), 'i');
        query.$or = [
          { voucherNumber: pattern },
          { description: pattern },
          { categoryName: pattern },
          { projectCode: pattern },
          { projectName: pattern },
        ];
      }

      const [docs, total] = await Promise.all([
        this.voucherModel
          .find(query)
          .sort({ expenseDate: -1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.voucherModel.countDocuments(query).exec(),
      ]);

      const items = (docs as unknown as IExpenseVoucher[]).map((doc) => ({
        ...doc,
        _id: String(doc._id),
      }));

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    let items = Array.from(this.voucherMemory.values());

    if (filters.status !== 'all') {
      items = items.filter((v) => v.status === filters.status);
    }

    if (filters.categoryId) {
      items = items.filter((v) => v.categoryId === filters.categoryId);
    }

    if (filters.filterUnassignedProject) {
      items = items.filter((v) => !v.projectRecordId);
    } else if (filters.resolvedProjectRecordId) {
      items = items.filter(
        (v) => v.projectRecordId === filters.resolvedProjectRecordId,
      );
    } else if (filters.projectId) {
      items = [];
    }

    if (filters.fromDate) {
      const fromMs = filters.fromDate.getTime();
      items = items.filter(
        (v) => new Date(v.expenseDate).getTime() >= fromMs,
      );
    }

    if (filters.toDate) {
      const toMs = filters.toDate.getTime();
      items = items.filter((v) => new Date(v.expenseDate).getTime() <= toMs);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (v) =>
          v.voucherNumber.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.categoryName.toLowerCase().includes(q) ||
          (v.projectCode || '').toLowerCase().includes(q) ||
          (v.projectName || '').toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => {
      const dDiff =
        new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime();
      if (dDiff !== 0) return dDiff;
      const cDiff =
        (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
        (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      if (cDiff !== 0) return cDiff;
      return String(b._id).localeCompare(String(a._id));
    });

    const total = items.length;
    const paged = items.slice(skip, skip + limit).map(cloneVoucher);

    return {
      items: paged,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async computeSummaryCounts(): Promise<ExpenseVoucherListSummary> {
    if (this.isDbConnected()) {
      const rows = await this.voucherModel
        .aggregate<{
          status: string;
          hasProject: boolean;
          hasReceipt: boolean;
          amount: number;
        }>([
          {
            $project: {
              status: 1,
              amount: 1,
              hasProject: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$projectRecordId', null] },
                      { $ne: ['$projectRecordId', ''] },
                    ],
                  },
                  true,
                  false,
                ],
              },
              hasReceipt: {
                $gt: [{ $size: { $ifNull: ['$attachments', []] } }, 0],
              },
            },
          },
        ])
        .exec();

      let activeCount = 0;
      let cancelledCount = 0;
      let activeTotalAmount = 0;
      let projectLinkedCount = 0;
      let projectLinkedTotalAmount = 0;
      let generalExpenseCount = 0;
      let generalTotalAmount = 0;
      let withReceiptCount = 0;

      for (const r of rows) {
        if (r.status === 'active') {
          const amt = roundExpenseMoney(Number(r.amount || 0));
          activeCount += 1;
          activeTotalAmount = roundExpenseMoney(activeTotalAmount + amt);
          if (r.hasProject) {
            projectLinkedCount += 1;
            projectLinkedTotalAmount = roundExpenseMoney(
              projectLinkedTotalAmount + amt,
            );
          } else {
            generalExpenseCount += 1;
            generalTotalAmount = roundExpenseMoney(generalTotalAmount + amt);
          }
          if (r.hasReceipt) {
            withReceiptCount += 1;
          }
        } else if (r.status === 'cancelled') {
          cancelledCount += 1;
        }
      }

      return {
        activeCount,
        cancelledCount,
        activeTotalAmount,
        projectLinkedCount,
        projectLinkedTotalAmount,
        generalExpenseCount,
        generalTotalAmount,
        withReceiptCount,
      };
    }

    let activeCount = 0;
    let cancelledCount = 0;
    let activeTotalAmount = 0;
    let projectLinkedCount = 0;
    let projectLinkedTotalAmount = 0;
    let generalExpenseCount = 0;
    let generalTotalAmount = 0;
    let withReceiptCount = 0;

    for (const v of this.voucherMemory.values()) {
      if (v.status === 'active') {
        const amt = roundExpenseMoney(Number(v.amount || 0));
        activeCount += 1;
        activeTotalAmount = roundExpenseMoney(activeTotalAmount + amt);
        if (v.projectRecordId) {
          projectLinkedCount += 1;
          projectLinkedTotalAmount = roundExpenseMoney(
            projectLinkedTotalAmount + amt,
          );
        } else {
          generalExpenseCount += 1;
          generalTotalAmount = roundExpenseMoney(generalTotalAmount + amt);
        }
        if (Array.isArray(v.attachments) && v.attachments.length > 0) {
          withReceiptCount += 1;
        }
      } else if (v.status === 'cancelled') {
        cancelledCount += 1;
      }
    }

    return {
      activeCount,
      cancelledCount,
      activeTotalAmount,
      projectLinkedCount,
      projectLinkedTotalAmount,
      generalExpenseCount,
      generalTotalAmount,
      withReceiptCount,
    };
  }

  async updateVoucherById(
    recordId: string,
    updates: Partial<IExpenseVoucher>,
  ): Promise<IExpenseVoucher | null> {
    const cleanId = String(recordId || '').trim();
    if (!cleanId) {
      return null;
    }

    const sanitizedUpdates = { ...updates };
    delete sanitizedUpdates._id;
    delete sanitizedUpdates.voucherNumber;
    delete sanitizedUpdates.createdAt;

    if (this.isDbConnected()) {
      if (!mongoose.isValidObjectId(cleanId)) {
        return null;
      }
      await this.ensureIndexes();
      const updated = await this.voucherModel
        .findByIdAndUpdate(
          cleanId,
          { $set: sanitizedUpdates },
          { new: true, runValidators: true },
        )
        .lean()
        .exec();
      if (!updated) {
        return null;
      }
      const typed = updated as unknown as IExpenseVoucher;
      return { ...typed, _id: String(typed._id) };
    }

    const existing = this.voucherMemory.get(cleanId);
    if (!existing) {
      return null;
    }

    const merged: IExpenseVoucher = {
      ...existing,
      ...sanitizedUpdates,
      _id: cleanId,
      voucherNumber: existing.voucherNumber,
      updatedAt: nextMonotonicDate(),
    };
    this.voucherMemory.set(cleanId, merged);
    return cloneVoucher(merged);
  }

  async aggregateActiveExpensesForProject(
    projectRecordId: string,
    projectCode: string,
  ): Promise<{ totalAmount: number; latestActivityAt: Date | null }> {
    const cleanRecordId = String(projectRecordId || '').trim();
    const cleanCode = String(projectCode || '').trim();

    if (this.isDbConnected()) {
      const orClauses: Array<Record<string, unknown>> = [];
      if (cleanRecordId) {
        orClauses.push({ projectRecordId: cleanRecordId });
      }
      if (cleanCode) {
        orClauses.push({
          projectCode: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i'),
        });
      }
      if (orClauses.length === 0) {
        return { totalAmount: 0, latestActivityAt: null };
      }

      const rows = await this.voucherModel
        .aggregate<{ totalAmount: number; latestAt: Date | null }>([
          {
            $match: {
              status: 'active',
              $or: orClauses,
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$amount' },
              latestAt: { $max: '$updatedAt' },
            },
          },
        ])
        .exec();

      if (!rows.length) {
        return { totalAmount: 0, latestActivityAt: null };
      }

      return {
        totalAmount: roundExpenseMoney(Number(rows[0].totalAmount || 0)),
        latestActivityAt: rows[0].latestAt ? new Date(rows[0].latestAt) : null,
      };
    }

    let sum = 0;
    let latestMs: number | null = null;
    const upperCode = cleanCode.toUpperCase();

    for (const v of this.voucherMemory.values()) {
      if (v.status !== 'active') {
        continue;
      }
      const matchesId = Boolean(
        cleanRecordId && v.projectRecordId === cleanRecordId,
      );
      const matchesCode = Boolean(
        upperCode && (v.projectCode || '').toUpperCase() === upperCode,
      );
      if (!matchesId && !matchesCode) {
        continue;
      }

      sum = roundExpenseMoney(sum + Number(v.amount || 0));
      const candidateTime = v.updatedAt
        ? new Date(v.updatedAt).getTime()
        : v.expenseDate
          ? new Date(v.expenseDate).getTime()
          : 0;
      if (candidateTime > 0 && (latestMs === null || candidateTime > latestMs)) {
        latestMs = candidateTime;
      }
    }

    return {
      totalAmount: sum,
      latestActivityAt: latestMs !== null ? new Date(latestMs) : null,
    };
  }
}
