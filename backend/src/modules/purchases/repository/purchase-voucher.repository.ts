import mongoose, { Model } from 'mongoose';
import {
  extractPurchaseVoucherSequence,
  formatPurchaseVoucherCode,
  IPurchaseCounter,
  PURCHASE_VOUCHER_COUNTER_ID,
  PurchaseCounterModel,
  sharedPurchaseCounterMemoryStore,
} from '../models/purchase-counter.model';
import {
  PurchaseStockMovementModel,
  sharedPurchaseStockMovementMemoryStore,
} from '../models/purchase-stock-movement.model';
import {
  PurchaseVoucherModel,
  sharedPurchaseVoucherMemoryStore,
} from '../models/purchase-voucher.model';
import { roundPurchaseMoney } from '../dto/create-purchase-voucher.dto';
import {
  IPurchaseProjectAggregationResult,
  IPurchaseStockMovement,
  IPurchaseVoucher,
  IPurchaseVoucherRepository,
  ListPurchaseVouchersDto,
  PaginatedResult,
  PurchaseVoucherListSummary,
} from '../types';

export class DuplicatePurchaseVoucherError extends Error {
  public readonly statusCode = 409;

  constructor(message = 'A duplicate purchase voucher conflict occurred.') {
    super(message);
    this.name = 'DuplicatePurchaseVoucherError';
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

function cloneVoucher(voucher: IPurchaseVoucher): IPurchaseVoucher {
  return {
    ...voucher,
    purchaseDate: new Date(voucher.purchaseDate),
    lineItems: (voucher.lineItems || []).map((item) => ({ ...item })),
    printedInvoiceSummary: voucher.printedInvoiceSummary
      ? { ...voucher.printedInvoiceSummary }
      : null,
    attachments: (voucher.attachments || []).map((att) => ({
      ...att,
      uploadedAt: new Date(att.uploadedAt),
    })),
    stockSync: {
      applied: Boolean(voucher.stockSync?.applied),
      appliedRevision: Number(voucher.stockSync?.appliedRevision ?? 0),
      appliedLines: (voucher.stockSync?.appliedLines || []).map((l) => ({
        ...l,
      })),
      lastSyncedAt: voucher.stockSync?.lastSyncedAt
        ? new Date(voucher.stockSync.lastSyncedAt)
        : null,
    },
    cancelledAt: voucher.cancelledAt ? new Date(voucher.cancelledAt) : null,
    createdAt: voucher.createdAt ? new Date(voucher.createdAt) : undefined,
    updatedAt: voucher.updatedAt ? new Date(voucher.updatedAt) : undefined,
  };
}

function cloneStockMovement(
  entry: IPurchaseStockMovement,
): IPurchaseStockMovement {
  return {
    ...entry,
    createdAt: new Date(entry.createdAt),
  };
}

let lastMonotonicMs = 0;
function nextMonotonicDate(): Date {
  const now = Date.now();
  lastMonotonicMs = now > lastMonotonicMs ? now : lastMonotonicMs + 1;
  return new Date(lastMonotonicMs);
}

export class PurchaseVoucherRepository implements IPurchaseVoucherRepository {
  private indexSyncPromise: Promise<void> | null = null;
  private counterFloorSynced = false;

  constructor(
    private readonly voucherModel: Model<IPurchaseVoucher> = PurchaseVoucherModel,
    private readonly counterModel: Model<IPurchaseCounter> = PurchaseCounterModel,
    private readonly movementModel: Model<IPurchaseStockMovement> = PurchaseStockMovementModel,
    private readonly voucherMemory: Map<
      string,
      IPurchaseVoucher
    > = sharedPurchaseVoucherMemoryStore,
    private readonly counterMemory: Map<
      string,
      number
    > = sharedPurchaseCounterMemoryStore,
    private readonly movementMemory: Map<
      string,
      IPurchaseStockMovement
    > = sharedPurchaseStockMovementMemoryStore,
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
        this.voucherModel.createIndexes(),
        this.movementModel.createIndexes(),
      ])
        .then(() => undefined)
        .catch(() => {
          this.indexSyncPromise = null;
        });
    }
    await this.indexSyncPromise;
  }

  private async syncCounterFloorFromDb(): Promise<void> {
    if (!this.isDbConnected() || this.counterFloorSynced) {
      return;
    }
    const existing = await this.voucherModel
      .find({}, { voucherNumber: 1 })
      .lean()
      .exec();
    let maxSeq = 0;
    for (const row of existing) {
      const seq = extractPurchaseVoucherSequence(row.voucherNumber);
      if (seq && seq > maxSeq) {
        maxSeq = seq;
      }
    }
    if (maxSeq > 0) {
      await this.counterModel
        .findOneAndUpdate(
          { _id: PURCHASE_VOUCHER_COUNTER_ID },
          { $max: { seq: maxSeq } },
          { upsert: true },
        )
        .exec();
    }
    this.counterFloorSynced = true;
  }

  async generateNextVoucherNumber(): Promise<string> {
    if (this.isDbConnected()) {
      await this.syncCounterFloorFromDb();
      const updated = await this.counterModel
        .findOneAndUpdate(
          { _id: PURCHASE_VOUCHER_COUNTER_ID },
          { $inc: { seq: 1 } },
          { upsert: true, returnDocument: 'after' },
        )
        .lean()
        .exec();
      const seq = Number(updated?.seq || 1);
      return formatPurchaseVoucherCode(seq);
    }

    let floor = this.counterMemory.get(PURCHASE_VOUCHER_COUNTER_ID) || 0;
    for (const item of this.voucherMemory.values()) {
      const seq = extractPurchaseVoucherSequence(item.voucherNumber);
      if (seq && seq > floor) {
        floor = seq;
      }
    }
    const nextSeq = floor + 1;
    this.counterMemory.set(PURCHASE_VOUCHER_COUNTER_ID, nextSeq);
    return formatPurchaseVoucherCode(nextSeq);
  }

  async create(
    record: Omit<IPurchaseVoucher, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IPurchaseVoucher> {
    if (this.isDbConnected()) {
      await this.ensureIndexes();
      try {
        const doc = new this.voucherModel(record);
        const saved = await doc.save();
        return saved.toObject() as unknown as IPurchaseVoucher;
      } catch (err: unknown) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicatePurchaseVoucherError();
        }
        throw err;
      }
    }

    for (const existing of this.voucherMemory.values()) {
      if (
        existing.voucherNumber.toUpperCase() ===
        record.voucherNumber.toUpperCase()
      ) {
        throw new DuplicatePurchaseVoucherError(
          `Voucher number '${record.voucherNumber}' already exists.`,
        );
      }
      if (
        record.clientRequestId &&
        existing.clientRequestId === record.clientRequestId
      ) {
        throw new DuplicatePurchaseVoucherError(
          'Duplicate purchase submission detected.',
        );
      }
      if (
        record.status === 'active' &&
        existing.status === 'active' &&
        record.normalizedInvoiceNumber &&
        existing.normalizedSupplierName === record.normalizedSupplierName &&
        existing.normalizedInvoiceNumber === record.normalizedInvoiceNumber
      ) {
        throw new DuplicatePurchaseVoucherError(
          `Supplier invoice '${record.supplierInvoiceNumber}' for '${record.supplierName}' is already recorded on voucher ${existing.voucherNumber}.`,
        );
      }
    }

    const timestamp = nextMonotonicDate();
    const generatedId = new mongoose.Types.ObjectId().toHexString();
    const stored: IPurchaseVoucher = cloneVoucher({
      ...record,
      _id: generatedId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.voucherMemory.set(generatedId, stored);
    return cloneVoucher(stored);
  }

  async findByIdOrVoucherNumber(
    identifier: string,
  ): Promise<IPurchaseVoucher | null> {
    const clean = typeof identifier === 'string' ? identifier.trim() : '';
    if (!clean) {
      return null;
    }

    if (this.isDbConnected()) {
      if (mongoose.isValidObjectId(clean) && /^[a-fA-F0-9]{24}$/.test(clean)) {
        const byId = await this.voucherModel
          .findById(clean)
          .lean()
          .exec();
        if (byId) {
          return byId as unknown as IPurchaseVoucher;
        }
      }

      const byCode = await this.voucherModel
        .findOne({ voucherNumber: clean.toUpperCase() })
        .lean()
        .exec();
      return byCode ? (byCode as unknown as IPurchaseVoucher) : null;
    }

    const direct = this.voucherMemory.get(clean);
    if (direct) {
      return cloneVoucher(direct);
    }

    const upper = clean.toUpperCase();
    const lower = clean.toLowerCase();
    for (const item of this.voucherMemory.values()) {
      if (
        String(item._id).toLowerCase() === lower ||
        item.voucherNumber.toUpperCase() === upper
      ) {
        return cloneVoucher(item);
      }
    }

    return null;
  }

  async findByClientRequestId(
    clientRequestId: string,
  ): Promise<IPurchaseVoucher | null> {
    const clean = typeof clientRequestId === 'string' ? clientRequestId.trim() : '';
    if (!clean) {
      return null;
    }

    if (this.isDbConnected()) {
      const doc = await this.voucherModel
        .findOne({ clientRequestId: clean })
        .lean()
        .exec();
      return doc ? (doc as unknown as IPurchaseVoucher) : null;
    }

    for (const item of this.voucherMemory.values()) {
      if (item.clientRequestId === clean) {
        return cloneVoucher(item);
      }
    }
    return null;
  }

  async findActiveBySupplierInvoice(
    normalizedSupplierName: string,
    normalizedInvoiceNumber: string,
    excludeRecordId?: string,
  ): Promise<IPurchaseVoucher | null> {
    if (!normalizedSupplierName || !normalizedInvoiceNumber) {
      return null;
    }

    if (this.isDbConnected()) {
      const filter: Record<string, unknown> = {
        status: 'active',
        normalizedSupplierName,
        normalizedInvoiceNumber,
      };
      if (excludeRecordId && mongoose.isValidObjectId(excludeRecordId)) {
        filter._id = { $ne: new mongoose.Types.ObjectId(excludeRecordId) };
      }
      const doc = await this.voucherModel.findOne(filter).lean().exec();
      return doc ? (doc as unknown as IPurchaseVoucher) : null;
    }

    const excludeLower = excludeRecordId ? excludeRecordId.toLowerCase() : '';
    for (const item of this.voucherMemory.values()) {
      if (
        item.status === 'active' &&
        item.normalizedSupplierName === normalizedSupplierName &&
        item.normalizedInvoiceNumber === normalizedInvoiceNumber &&
        String(item._id).toLowerCase() !== excludeLower
      ) {
        return cloneVoucher(item);
      }
    }

    return null;
  }

  async findVouchers(
    query: ListPurchaseVouchersDto & {
      resolvedProjectRecordId?: string | null;
      filterUnassignedProject?: boolean;
    },
  ): Promise<PaginatedResult<IPurchaseVoucher>> {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    if (this.isDbConnected()) {
      const filter: Record<string, unknown> = {};

      if (query.status !== 'all') {
        filter.status = query.status;
      }

      if (query.filterUnassignedProject) {
        filter.projectRecordId = null;
      } else if (query.resolvedProjectRecordId) {
        filter.projectRecordId = query.resolvedProjectRecordId;
      } else if (query.projectId) {
        filter.$or = [
          { projectRecordId: query.projectId },
          { projectCode: query.projectId.toUpperCase() },
        ];
      }

      if (query.fromDate || query.toDate) {
        const dateCond: Record<string, Date> = {};
        if (query.fromDate) dateCond.$gte = query.fromDate;
        if (query.toDate) dateCond.$lte = query.toDate;
        filter.purchaseDate = dateCond;
      }

      if (query.search) {
        const rx = new RegExp(escapeRegex(query.search), 'i');
        const searchOr = [
          { voucherNumber: rx },
          { supplierName: rx },
          { supplierInvoiceNumber: rx },
          { projectCode: rx },
          { projectName: rx },
          { 'lineItems.materialName': rx },
          { 'lineItems.expenseHeadName': rx },
          { 'lineItems.description': rx },
        ];
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or as unknown[] }, { $or: searchOr }];
          delete filter.$or;
        } else {
          filter.$or = searchOr;
        }
      }

      const [docs, total] = await Promise.all([
        this.voucherModel
          .find(filter)
          .sort({ purchaseDate: -1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.voucherModel.countDocuments(filter).exec(),
      ]);

      return {
        items: docs as unknown as IPurchaseVoucher[],
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    let items = Array.from(this.voucherMemory.values());

    if (query.status !== 'all') {
      items = items.filter((v) => v.status === query.status);
    }

    if (query.filterUnassignedProject) {
      items = items.filter((v) => !v.projectRecordId);
    } else if (query.resolvedProjectRecordId) {
      items = items.filter(
        (v) => v.projectRecordId === query.resolvedProjectRecordId,
      );
    } else if (query.projectId) {
      const targetUpper = query.projectId.toUpperCase();
      items = items.filter(
        (v) =>
          v.projectRecordId === query.projectId ||
          (v.projectCode || '').toUpperCase() === targetUpper,
      );
    }

    if (query.fromDate) {
      const minMs = query.fromDate.getTime();
      items = items.filter((v) => new Date(v.purchaseDate).getTime() >= minMs);
    }

    if (query.toDate) {
      const maxMs = query.toDate.getTime();
      items = items.filter((v) => new Date(v.purchaseDate).getTime() <= maxMs);
    }

    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      items = items.filter(
        (v) =>
          rx.test(v.voucherNumber) ||
          rx.test(v.supplierName) ||
          rx.test(v.supplierInvoiceNumber || '') ||
          rx.test(v.projectCode || '') ||
          rx.test(v.projectName || '') ||
          v.lineItems.some(
            (li) =>
              rx.test(li.materialName || '') ||
              rx.test(li.expenseHeadName || '') ||
              rx.test(li.description || ''),
          ),
      );
    }

    items.sort((a, b) => {
      const pDiff =
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
      if (pDiff !== 0) return pDiff;
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

  async computeSummaryCounts(): Promise<PurchaseVoucherListSummary> {
    if (this.isDbConnected()) {
      const rows = await this.voucherModel
        .aggregate<{
          _id: string;
          count: number;
          totalAmount: number;
          withAttachments: number;
        }>([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$finalTotal' },
              withAttachments: {
                $sum: {
                  $cond: [
                    {
                      $gt: [
                        { $size: { $ifNull: ['$attachments', []] } },
                        0,
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .exec();

      let activeCount = 0;
      let cancelledCount = 0;
      let activeTotalAmount = 0;
      let withAttachmentCount = 0;

      for (const r of rows) {
        if (r._id === 'active') {
          activeCount = r.count;
          activeTotalAmount = roundPurchaseMoney(r.totalAmount || 0);
          withAttachmentCount += r.withAttachments || 0;
        } else if (r._id === 'cancelled') {
          cancelledCount = r.count;
        }
      }

      return {
        activeCount,
        cancelledCount,
        activeTotalAmount,
        withAttachmentCount,
      };
    }

    let activeCount = 0;
    let cancelledCount = 0;
    let activeTotalAmount = 0;
    let withAttachmentCount = 0;

    for (const v of this.voucherMemory.values()) {
      if (v.status === 'active') {
        activeCount += 1;
        activeTotalAmount = roundPurchaseMoney(
          activeTotalAmount + Number(v.finalTotal || 0),
        );
        if (Array.isArray(v.attachments) && v.attachments.length > 0) {
          withAttachmentCount += 1;
        }
      } else if (v.status === 'cancelled') {
        cancelledCount += 1;
      }
    }

    return {
      activeCount,
      cancelledCount,
      activeTotalAmount,
      withAttachmentCount,
    };
  }

  async updateByRecordId(
    recordId: string,
    updates: Partial<IPurchaseVoucher>,
  ): Promise<IPurchaseVoucher | null> {
    const cleanId = recordId.trim();
    if (!cleanId) {
      return null;
    }

    if (this.isDbConnected()) {
      await this.ensureIndexes();
      try {
        const sanitizedUpdates = { ...updates };
        delete sanitizedUpdates._id;
        delete sanitizedUpdates.voucherNumber;
        delete sanitizedUpdates.createdAt;
        const updated = await this.voucherModel
          .findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(cleanId) },
            { $set: sanitizedUpdates },
            { returnDocument: 'after', runValidators: true },
          )
          .lean()
          .exec();
        return updated ? (updated as unknown as IPurchaseVoucher) : null;
      } catch (err: unknown) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicatePurchaseVoucherError();
        }
        throw err;
      }
    }

    let targetKey: string | null = null;
    let current: IPurchaseVoucher | null = null;
    for (const [k, item] of this.voucherMemory.entries()) {
      if (String(item._id).toLowerCase() === cleanId.toLowerCase()) {
        targetKey = k;
        current = item;
        break;
      }
    }

    if (!current || !targetKey) {
      return null;
    }

    const nextCandidate: IPurchaseVoucher = cloneVoucher({
      ...current,
      ...updates,
      _id: current._id,
      voucherNumber: current.voucherNumber,
      createdAt: current.createdAt,
      updatedAt: nextMonotonicDate(),
    });

    if (
      nextCandidate.status === 'active' &&
      nextCandidate.normalizedInvoiceNumber
    ) {
      for (const item of this.voucherMemory.values()) {
        if (
          String(item._id).toLowerCase() !== cleanId.toLowerCase() &&
          item.status === 'active' &&
          item.normalizedSupplierName === nextCandidate.normalizedSupplierName &&
          item.normalizedInvoiceNumber === nextCandidate.normalizedInvoiceNumber
        ) {
          throw new DuplicatePurchaseVoucherError();
        }
      }
    }

    this.voucherMemory.set(targetKey, nextCandidate);
    return cloneVoucher(nextCandidate);
  }

  async aggregateActivePurchasesForProject(
    projectRecordId: string,
    projectCode: string,
  ): Promise<IPurchaseProjectAggregationResult> {
    const cleanRecordId = String(projectRecordId || '').trim();
    const cleanCode = String(projectCode || '').trim().toUpperCase();

    if (this.isDbConnected()) {
      const orClauses: Record<string, unknown>[] = [];
      if (cleanRecordId) {
        orClauses.push({ projectRecordId: cleanRecordId });
      }
      if (cleanCode) {
        orClauses.push({ projectCode: cleanCode });
      }
      if (orClauses.length === 0) {
        return {
          totalAmount: 0,
          materialAmount: 0,
          expenseAmount: 0,
          latestActivityAt: null,
        };
      }

      const rows = await this.voucherModel
        .aggregate<{
          totalAmount: number;
          materialAmount: number;
          expenseAmount: number;
          latestAt: Date | null;
        }>([
          {
            $match: {
              status: 'active',
              $or: orClauses,
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$finalTotal' },
              materialAmount: {
                $sum: {
                  $ifNull: ['$materialAllocatedTotal', '$finalTotal'],
                },
              },
              expenseAmount: {
                $sum: {
                  $ifNull: ['$expenseAllocatedTotal', 0],
                },
              },
              latestAt: { $max: '$updatedAt' },
            },
          },
        ])
        .exec();

      if (!rows.length) {
        return {
          totalAmount: 0,
          materialAmount: 0,
          expenseAmount: 0,
          latestActivityAt: null,
        };
      }

      const materialAmount = roundPurchaseMoney(
        Number(rows[0].materialAmount || 0),
      );
      const expenseAmount = roundPurchaseMoney(
        Number(rows[0].expenseAmount || 0),
      );
      return {
        totalAmount: roundPurchaseMoney(
          Number(rows[0].totalAmount ?? materialAmount + expenseAmount),
        ),
        materialAmount,
        expenseAmount,
        latestActivityAt: rows[0].latestAt ? new Date(rows[0].latestAt) : null,
      };
    }

    let totalSum = 0;
    let materialSum = 0;
    let expenseSum = 0;
    let latestMs: number | null = null;

    for (const v of this.voucherMemory.values()) {
      if (v.status !== 'active') {
        continue;
      }
      const matchesRecord =
        cleanRecordId && v.projectRecordId === cleanRecordId;
      const matchesCode =
        cleanCode && (v.projectCode || '').toUpperCase() === cleanCode;

      if (matchesRecord || matchesCode) {
        const finalTot = roundPurchaseMoney(Number(v.finalTotal || 0));
        const matAlloc =
          typeof v.materialAllocatedTotal === 'number' &&
          Number.isFinite(v.materialAllocatedTotal)
            ? roundPurchaseMoney(v.materialAllocatedTotal)
            : finalTot;
        const expAlloc =
          typeof v.expenseAllocatedTotal === 'number' &&
          Number.isFinite(v.expenseAllocatedTotal)
            ? roundPurchaseMoney(v.expenseAllocatedTotal)
            : 0;

        totalSum = roundPurchaseMoney(totalSum + finalTot);
        materialSum = roundPurchaseMoney(materialSum + matAlloc);
        expenseSum = roundPurchaseMoney(expenseSum + expAlloc);

        const ts = v.updatedAt
          ? new Date(v.updatedAt).getTime()
          : new Date(v.purchaseDate).getTime();
        if (latestMs === null || ts > latestMs) {
          latestMs = ts;
        }
      }
    }

    return {
      totalAmount: totalSum,
      materialAmount: materialSum,
      expenseAmount: expenseSum,
      latestActivityAt: latestMs !== null ? new Date(latestMs) : null,
    };
  }

  async findStockMovementByKey(
    idempotencyKey: string,
  ): Promise<IPurchaseStockMovement | null> {
    const key = idempotencyKey.trim();
    if (!key) {
      return null;
    }

    if (this.isDbConnected()) {
      const doc = await this.movementModel
        .findOne({ idempotencyKey: key })
        .lean()
        .exec();
      return doc ? (doc as unknown as IPurchaseStockMovement) : null;
    }

    const hit = this.movementMemory.get(key);
    return hit ? cloneStockMovement(hit) : null;
  }

  async recordStockMovement(
    entry: Omit<IPurchaseStockMovement, '_id'>,
  ): Promise<IPurchaseStockMovement> {
    if (this.isDbConnected()) {
      await this.ensureIndexes();
      try {
        const doc = new this.movementModel(entry);
        const saved = await doc.save();
        return saved.toObject() as unknown as IPurchaseStockMovement;
      } catch (err: unknown) {
        if (isMongoDuplicateKeyError(err)) {
          const existing = await this.findStockMovementByKey(
            entry.idempotencyKey,
          );
          if (existing) {
            return existing;
          }
        }
        throw err;
      }
    }

    const existing = this.movementMemory.get(entry.idempotencyKey);
    if (existing) {
      return cloneStockMovement(existing);
    }

    const stored: IPurchaseStockMovement = cloneStockMovement({
      ...entry,
      _id: new mongoose.Types.ObjectId().toHexString(),
    });
    this.movementMemory.set(entry.idempotencyKey, stored);
    return cloneStockMovement(stored);
  }

  async listStockMovementsForVoucher(
    voucherId: string,
  ): Promise<IPurchaseStockMovement[]> {
    const clean = voucherId.trim();
    if (!clean) {
      return [];
    }

    if (this.isDbConnected()) {
      const docs = await this.movementModel
        .find({ voucherId: clean })
        .sort({ createdAt: 1, _id: 1 })
        .lean()
        .exec();
      return docs as unknown as IPurchaseStockMovement[];
    }

    const list: IPurchaseStockMovement[] = [];
    for (const item of this.movementMemory.values()) {
      if (item.voucherId === clean) {
        list.push(cloneStockMovement(item));
      }
    }
    list.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return list;
  }

  async deleteByRecordId(recordId: string): Promise<boolean> {
    const clean = typeof recordId === 'string' ? recordId.trim() : '';
    if (!clean) {
      return false;
    }

    if (this.isDbConnected()) {
      if (!mongoose.isValidObjectId(clean)) {
        return false;
      }
      const res = await this.voucherModel
        .deleteOne({ _id: new mongoose.Types.ObjectId(clean) })
        .exec();
      return Number(res.deletedCount || 0) > 0;
    }

    for (const [key, item] of this.voucherMemory.entries()) {
      if (String(item._id).toLowerCase() === clean.toLowerCase()) {
        this.voucherMemory.delete(key);
        return true;
      }
    }

    return false;
  }

  async deleteStockMovementsForVoucherRevision(
    voucherId: string,
    revision: number,
  ): Promise<void> {
    const cleanVoucherId = typeof voucherId === 'string' ? voucherId.trim() : '';
    if (!cleanVoucherId) {
      return;
    }

    if (this.isDbConnected()) {
      await this.movementModel
        .deleteMany({ voucherId: cleanVoucherId, revision })
        .exec();
      return;
    }

    for (const [key, item] of this.movementMemory.entries()) {
      if (item.voucherId === cleanVoucherId && item.revision === revision) {
        this.movementMemory.delete(key);
      }
    }
  }
}
