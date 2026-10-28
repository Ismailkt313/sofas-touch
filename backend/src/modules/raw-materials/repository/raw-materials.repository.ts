import mongoose, { Model } from 'mongoose';
import {
  IRawMaterial,
  RawMaterialModel,
  isValidRawMaterialObjectId,
  normalizeMaterialDisplayName,
  normalizeMaterialNameKey,
  sharedRawMaterialMemoryStore,
} from '../models/raw-material.model';
import {
  CreateRawMaterialRecordInput,
  FindRawMaterialsQuery,
  IRawMaterialsRepository,
  PaginatedResult,
  UpdateRawMaterialRecordInput,
} from '../types';

export class DuplicateRawMaterialKeyError extends Error {
  public readonly statusCode = 409;

  constructor(materialName?: string) {
    super(
      materialName
        ? `A raw material named '${materialName}' already exists.`
        : 'A raw material with this name already exists.',
    );
    this.name = 'DuplicateRawMaterialKeyError';
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMongoDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const candidate = err as { code?: number; name?: string; message?: string };
  return (
    candidate.code === 11000 ||
    (typeof candidate.message === 'string' &&
      candidate.message.includes('E11000'))
  );
}

function cloneMaterial(material: IRawMaterial): IRawMaterial {
  return {
    ...material,
    createdAt: material.createdAt ? new Date(material.createdAt) : undefined,
    updatedAt: material.updatedAt ? new Date(material.updatedAt) : undefined,
  };
}

let lastMemoryTimestampMs = 0;

function nextMonotonicDate(): Date {
  const now = Date.now();
  lastMemoryTimestampMs = now > lastMemoryTimestampMs ? now : lastMemoryTimestampMs + 1;
  return new Date(lastMemoryTimestampMs);
}

export class RawMaterialsRepository implements IRawMaterialsRepository {
  private readonly materialModel: Model<IRawMaterial>;
  private readonly memoryStore: Map<string, IRawMaterial>;
  private indexSyncPromise: Promise<void> | null = null;

  constructor(
    materialModel: Model<IRawMaterial> = RawMaterialModel,
    memoryStore: Map<string, IRawMaterial> = sharedRawMaterialMemoryStore,
  ) {
    this.materialModel = materialModel;
    this.memoryStore = memoryStore;
  }

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  private async ensureDbIndexes(): Promise<void> {
    if (!this.isDbConnected()) {
      this.indexSyncPromise = null;
      return;
    }
    if (!this.indexSyncPromise) {
      this.indexSyncPromise = this.materialModel
        .createIndexes()
        .then(() => undefined)
        .catch(() => {
          this.indexSyncPromise = null;
        });
    }
    await this.indexSyncPromise;
  }

  async create(input: CreateRawMaterialRecordInput): Promise<IRawMaterial> {
    const cleanName = normalizeMaterialDisplayName(input.name);
    const normalizedName = normalizeMaterialNameKey(cleanName);

    if (this.isDbConnected()) {
      await this.ensureDbIndexes();
      try {
        const doc = new this.materialModel({
          name: cleanName,
          normalizedName,
          category: input.category ?? null,
          unit: input.unit,
          description: input.description || '',
          isActive: input.isActive,
          createdBy: input.createdBy || '',
        });
        const saved = await doc.save();
        return saved.toObject() as unknown as IRawMaterial;
      } catch (err: unknown) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicateRawMaterialKeyError(cleanName);
        }
        throw new Error('Failed to persist raw material record.');
      }
    }

    for (const existing of this.memoryStore.values()) {
      if (existing.normalizedName === normalizedName) {
        throw new DuplicateRawMaterialKeyError(cleanName);
      }
    }

    const timestamp = nextMonotonicDate();
    const generatedId = new mongoose.Types.ObjectId().toHexString();
    const record: IRawMaterial = {
      _id: generatedId,
      name: cleanName,
      normalizedName,
      category: input.category ?? null,
      unit: input.unit,
      description: input.description || '',
      isActive: input.isActive,
      createdBy: input.createdBy || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.memoryStore.set(generatedId, record);
    return cloneMaterial(record);
  }

  async findMaterials(
    query: FindRawMaterialsQuery,
  ): Promise<PaginatedResult<IRawMaterial>> {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    if (this.isDbConnected()) {
      const mongoFilter: Record<string, unknown> = {};

      if (query.isActive !== undefined) {
        mongoFilter.isActive = query.isActive;
      }

      if (query.category) {
        mongoFilter.category = query.category;
      }

      if (query.search) {
        mongoFilter.name = {
          $regex: escapeRegex(query.search),
          $options: 'i',
        };
      }

      const [docs, total] = await Promise.all([
        this.materialModel
          .find(mongoFilter)
          .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.materialModel.countDocuments(mongoFilter).exec(),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        items: docs as unknown as IRawMaterial[],
        total,
        page,
        limit,
        totalPages,
      };
    }

    let items = Array.from(this.memoryStore.values());

    if (query.isActive !== undefined) {
      items = items.filter((item) => item.isActive === query.isActive);
    }

    if (query.category) {
      items = items.filter((item) => item.category === query.category);
    }

    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), 'i');
      items = items.filter((item) => pattern.test(item.name));
    }

    items.sort((a, b) => {
      const updatedDiff =
        (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) -
        (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      if (updatedDiff !== 0) {
        return updatedDiff;
      }
      const createdDiff =
        (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
        (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      if (createdDiff !== 0) {
        return createdDiff;
      }
      return String(b._id || '').localeCompare(String(a._id || ''));
    });

    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pagedItems = items.slice(skip, skip + limit).map(cloneMaterial);

    return {
      items: pagedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findById(id: string): Promise<IRawMaterial | null> {
    const trimmedId = id.trim();
    if (!isValidRawMaterialObjectId(trimmedId)) {
      return null;
    }

    if (this.isDbConnected()) {
      const doc = await this.materialModel
        .findById(new mongoose.Types.ObjectId(trimmedId))
        .lean()
        .exec();
      return doc ? (doc as unknown as IRawMaterial) : null;
    }

    const found = this.memoryStore.get(trimmedId.toLowerCase());
    if (found) {
      return cloneMaterial(found);
    }

    for (const item of this.memoryStore.values()) {
      if (String(item._id).toLowerCase() === trimmedId.toLowerCase()) {
        return cloneMaterial(item);
      }
    }

    return null;
  }

  async findByIds(ids: string[]): Promise<IRawMaterial[]> {
    const validIds = Array.from(
      new Set(
        ids
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter((id) => isValidRawMaterialObjectId(id)),
      ),
    );

    if (validIds.length === 0) {
      return [];
    }

    if (this.isDbConnected()) {
      const objectIds = validIds.map((id) => new mongoose.Types.ObjectId(id));
      const docs = await this.materialModel
        .find({ _id: { $in: objectIds } })
        .lean()
        .exec();
      return docs as unknown as IRawMaterial[];
    }

    const idSet = new Set(validIds.map((id) => id.toLowerCase()));
    const results: IRawMaterial[] = [];
    for (const item of this.memoryStore.values()) {
      if (idSet.has(String(item._id).toLowerCase())) {
        results.push(cloneMaterial(item));
      }
    }
    return results;
  }

  async findByNormalizedName(normalizedName: string): Promise<IRawMaterial | null> {
    const key = normalizeMaterialNameKey(normalizedName);
    if (!key) {
      return null;
    }

    if (this.isDbConnected()) {
      const doc = await this.materialModel
        .findOne({ normalizedName: key })
        .lean()
        .exec();
      return doc ? (doc as unknown as IRawMaterial) : null;
    }

    for (const item of this.memoryStore.values()) {
      if (item.normalizedName === key) {
        return cloneMaterial(item);
      }
    }
    return null;
  }

  async updateById(
    id: string,
    updates: UpdateRawMaterialRecordInput,
  ): Promise<IRawMaterial | null> {
    const trimmedId = id.trim();
    if (!isValidRawMaterialObjectId(trimmedId)) {
      return null;
    }

    const sanitizedSet: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      const cleanName = normalizeMaterialDisplayName(updates.name);
      sanitizedSet.name = cleanName;
      sanitizedSet.normalizedName =
        updates.normalizedName !== undefined
          ? normalizeMaterialNameKey(updates.normalizedName)
          : normalizeMaterialNameKey(cleanName);
    }

    if (updates.category !== undefined) {
      sanitizedSet.category = updates.category;
    }

    if (updates.unit !== undefined) {
      sanitizedSet.unit = updates.unit;
    }

    if (updates.description !== undefined) {
      sanitizedSet.description = updates.description;
    }

    if (updates.isActive !== undefined) {
      sanitizedSet.isActive = updates.isActive;
    }

    if (this.isDbConnected()) {
      await this.ensureDbIndexes();
      try {
        const updated = await this.materialModel
          .findOneAndUpdate(
            { _id: new mongoose.Types.ObjectId(trimmedId) },
            { $set: sanitizedSet },
            { returnDocument: 'after', runValidators: true },
          )
          .lean()
          .exec();

        return updated ? (updated as unknown as IRawMaterial) : null;
      } catch (err: unknown) {
        if (isMongoDuplicateKeyError(err)) {
          throw new DuplicateRawMaterialKeyError(
            typeof sanitizedSet.name === 'string'
              ? sanitizedSet.name
              : undefined,
          );
        }
        throw new Error('Failed to update raw material record.');
      }
    }

    let targetKey: string | null = null;
    let existingRecord: IRawMaterial | null = null;

    for (const [key, item] of this.memoryStore.entries()) {
      if (String(item._id).toLowerCase() === trimmedId.toLowerCase()) {
        targetKey = key;
        existingRecord = item;
        break;
      }
    }

    if (!existingRecord || !targetKey) {
      return null;
    }

    if (typeof sanitizedSet.normalizedName === 'string') {
      for (const item of this.memoryStore.values()) {
        if (
          String(item._id).toLowerCase() !== trimmedId.toLowerCase() &&
          item.normalizedName === sanitizedSet.normalizedName
        ) {
          throw new DuplicateRawMaterialKeyError(
            typeof sanitizedSet.name === 'string'
              ? sanitizedSet.name
              : undefined,
          );
        }
      }
    }

    const updatedRecord: IRawMaterial = {
      ...existingRecord,
      ...(sanitizedSet.name !== undefined
        ? {
            name: sanitizedSet.name as string,
            normalizedName: sanitizedSet.normalizedName as string,
          }
        : {}),
      ...(sanitizedSet.category !== undefined
        ? { category: sanitizedSet.category as IRawMaterial['category'] }
        : {}),
      ...(sanitizedSet.unit !== undefined
        ? { unit: sanitizedSet.unit as IRawMaterial['unit'] }
        : {}),
      ...(sanitizedSet.description !== undefined
        ? { description: sanitizedSet.description as string }
        : {}),
      ...(sanitizedSet.isActive !== undefined
        ? { isActive: sanitizedSet.isActive as boolean }
        : {}),
      updatedAt: nextMonotonicDate(),
    };

    this.memoryStore.set(targetKey, updatedRecord);
    return cloneMaterial(updatedRecord);
  }
}
