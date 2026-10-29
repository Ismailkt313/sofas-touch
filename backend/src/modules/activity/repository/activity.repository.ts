import mongoose, { Model } from 'mongoose';
import {
  ActivityModel,
  IActivity,
  sharedActivityMemoryStore,
} from '../models/activity.model';
import {
  ActivityActorOptionDto,
  ListActivitiesQueryDto,
} from '../types';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let lastActivityTs = 0;

function nextActivityTimestamp(explicit?: Date): Date {
  if (explicit && !Number.isNaN(explicit.getTime())) {
    return explicit;
  }
  const now = Date.now();
  lastActivityTs = now > lastActivityTs ? now : lastActivityTs + 1;
  return new Date(lastActivityTs);
}

export class ActivityRepository {
  private indexPromise: Promise<void> | null = null;

  constructor(
    private readonly model: Model<IActivity> = ActivityModel,
    private readonly memoryStore: Map<string, IActivity> = sharedActivityMemoryStore,
  ) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.isDbConnected()) {
      this.indexPromise = null;
      return;
    }
    if (!this.indexPromise) {
      this.indexPromise = this.model
        .createIndexes()
        .then(() => undefined)
        .catch(() => {
          this.indexPromise = null;
        });
    }
    await this.indexPromise;
  }

  async create(record: Omit<IActivity, '_id' | 'createdAt'>): Promise<IActivity> {
    const ts = nextActivityTimestamp(record.timestamp);

    if (this.isDbConnected()) {
      await this.ensureIndexes();
      const doc = await this.model.create({
        ...record,
        timestamp: ts,
      });
      return doc.toObject() as unknown as IActivity;
    }

    const generatedId = new mongoose.Types.ObjectId().toHexString();
    const stored: IActivity = {
      ...record,
      _id: generatedId,
      timestamp: ts,
      createdAt: ts,
    };
    this.memoryStore.set(generatedId, stored);
    return stored;
  }

  async findRecent(params: {
    limit: number;
    includeAdminOnly: boolean;
  }): Promise<IActivity[]> {
    const safeLimit = Math.min(50, Math.max(1, params.limit));

    if (this.isDbConnected()) {
      const filter: Record<string, unknown> = params.includeAdminOnly
        ? {}
        : { visibility: 'all', entityType: { $ne: 'user' } };

      const docs = await this.model
        .find(filter)
        .sort({ timestamp: -1, _id: -1 })
        .limit(safeLimit)
        .lean()
        .exec();

      return docs as unknown as IActivity[];
    }

    let items = Array.from(this.memoryStore.values());
    if (!params.includeAdminOnly) {
      items = items.filter(
        (item) => item.visibility === 'all' && item.entityType !== 'user',
      );
    }

    items.sort((a, b) => {
      const diff =
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (diff !== 0) return diff;
      return String(b._id || '').localeCompare(String(a._id || ''));
    });

    return items.slice(0, safeLimit);
  }

  async findPaginated(params: {
    query: ListActivitiesQueryDto;
    includeAdminOnly: boolean;
  }): Promise<{
    items: IActivity[];
    total: number;
    actors: ActivityActorOptionDto[];
  }> {
    const { query, includeAdminOnly } = params;
    const skip = (query.page - 1) * query.limit;

    if (this.isDbConnected()) {
      const filter: Record<string, unknown> = {};
      if (!includeAdminOnly) {
        filter.visibility = 'all';
        filter.entityType = query.entityType
          ? query.entityType === 'user'
            ? '__forbidden__'
            : query.entityType
          : { $ne: 'user' };
      } else if (query.entityType) {
        filter.entityType = query.entityType;
      }

      if (query.actionType) {
        filter.actionType = query.actionType;
      }

      if (query.actorId) {
        filter.actorId = query.actorId;
      }

      if (query.fromDate || query.toDate) {
        const range: Record<string, Date> = {};
        if (query.fromDate) range.$gte = query.fromDate;
        if (query.toDate) range.$lte = query.toDate;
        filter.timestamp = range;
      }

      const andClauses: Array<Record<string, unknown>> = [];

      if (query.projectId) {
        const upperCode = query.projectId.toUpperCase();
        andClauses.push({
          $or: [
            { projectRecordId: query.projectId },
            { projectCode: upperCode },
            { entityType: 'project', entityId: query.projectId },
          ],
        });
      }

      if (query.search) {
        const rx = { $regex: escapeRegex(query.search), $options: 'i' };
        andClauses.push({
          $or: [
            { description: rx },
            { entityLabel: rx },
            { actorName: rx },
            { projectCode: rx },
            { projectName: rx },
          ],
        });
      }

      if (andClauses.length > 0) {
        filter.$and = andClauses;
      }

      const actorScopeFilter: Record<string, unknown> = includeAdminOnly
        ? {}
        : { visibility: 'all', entityType: { $ne: 'user' } };

      const [docs, total, actorAgg] = await Promise.all([
        this.model
          .find(filter)
          .sort({ timestamp: -1, _id: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean()
          .exec(),
        this.model.countDocuments(filter).exec(),
        this.model
          .aggregate<{ _id: string; actorName: string }>([
            { $match: actorScopeFilter },
            {
              $group: {
                _id: '$actorId',
                actorName: { $first: '$actorName' },
              },
            },
            { $sort: { actorName: 1 } },
            { $limit: 100 },
          ])
          .exec(),
      ]);

      return {
        items: docs as unknown as IActivity[],
        total,
        actors: actorAgg
          .filter((a) => Boolean(a._id))
          .map((a) => ({
            actorId: String(a._id),
            actorName: String(a.actorName || a._id),
          })),
      };
    }

    let scopedItems = Array.from(this.memoryStore.values());
    if (!includeAdminOnly) {
      scopedItems = scopedItems.filter(
        (item) => item.visibility === 'all' && item.entityType !== 'user',
      );
    }

    const actorMap = new Map<string, string>();
    for (const item of scopedItems) {
      if (item.actorId && !actorMap.has(item.actorId)) {
        actorMap.set(item.actorId, item.actorName || item.actorId);
      }
    }
    const actors = Array.from(actorMap.entries())
      .map(([actorId, actorName]) => ({ actorId, actorName }))
      .sort((a, b) => a.actorName.localeCompare(b.actorName));

    let filtered = scopedItems;

    if (query.entityType) {
      filtered = filtered.filter((item) => item.entityType === query.entityType);
    }

    if (query.actionType) {
      filtered = filtered.filter((item) => item.actionType === query.actionType);
    }

    if (query.actorId) {
      filtered = filtered.filter((item) => item.actorId === query.actorId);
    }

    if (query.fromDate) {
      const fromMs = query.fromDate.getTime();
      filtered = filtered.filter(
        (item) => new Date(item.timestamp).getTime() >= fromMs,
      );
    }

    if (query.toDate) {
      const toMs = query.toDate.getTime();
      filtered = filtered.filter(
        (item) => new Date(item.timestamp).getTime() <= toMs,
      );
    }

    if (query.projectId) {
      const needle = query.projectId.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.projectRecordId &&
            item.projectRecordId.toLowerCase() === needle) ||
          (item.projectCode && item.projectCode.toLowerCase() === needle) ||
          (item.entityType === 'project' &&
            item.entityId.toLowerCase() === needle),
      );
    }

    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filtered = filtered.filter(
        (item) =>
          rx.test(item.description) ||
          rx.test(item.entityLabel) ||
          rx.test(item.actorName) ||
          (item.projectCode ? rx.test(item.projectCode) : false) ||
          (item.projectName ? rx.test(item.projectName) : false),
      );
    }

    filtered.sort((a, b) => {
      const diff =
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (diff !== 0) return diff;
      return String(b._id || '').localeCompare(String(a._id || ''));
    });

    const total = filtered.length;
    const items = filtered.slice(skip, skip + query.limit);

    return { items, total, actors };
  }
}
