import crypto from 'crypto';
import mongoose, { Model } from 'mongoose';
import {
  AlertLifecycleStatus,
  CostThresholdAlertType,
  IProjectActivityWarning,
  IProjectCostAlert,
  ProjectActivityWarningModel,
  ProjectCostAlertModel,
  sharedProjectActivityWarningMemoryStore,
  sharedProjectCostAlertMemoryStore,
} from '../models/project-alert.model';
import {
  extractProjectSequenceNumber,
  formatProjectSequenceCode,
  IProjectCounter,
  PROJECT_SEQUENCE_COUNTER_ID,
  ProjectCounterModel,
  sharedProjectCounterMemoryStore,
} from '../models/project-counter.model';
import {
  IProject,
  ProjectModel,
  sharedProjectMemoryStore,
} from '../models/project.model';
import {
  ListProjectAlertsDto,
  ListProjectsDto,
} from '../dto/list-projects.dto';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class ProjectPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectPersistenceError';
  }
}

export interface IProjectRepository {
  allocateNextProjectCode(): Promise<string>;
  createWithGeneratedCode(
    buildProject: (projectId: string) => Omit<IProject, '_id'>,
  ): Promise<IProject>;
  findProjects(filters: ListProjectsDto): Promise<PaginatedResult<IProject>>;
  findAllProjects(): Promise<IProject[]>;
  findAllNonCompletedProjects(): Promise<IProject[]>;
  findByIdOrCode(identifier: string): Promise<IProject | null>;
  updateByRecordId(
    recordId: string,
    updateData: Partial<IProject>,
  ): Promise<IProject | null>;
  deleteByRecordId(recordId: string): Promise<IProject | null>;
  createCostAlert(
    alertData: Omit<IProjectCostAlert, '_id'>,
  ): Promise<IProjectCostAlert>;
  resolveActiveCostAlerts(
    projectRecordId: string,
    thresholdType: CostThresholdAlertType,
    reason: string,
    resolvedAt?: Date,
  ): Promise<number>;
  findCostAlerts(
    filters: ListProjectAlertsDto,
  ): Promise<PaginatedResult<IProjectCostAlert>>;
  findCostAlertsByProject(projectRecordId: string): Promise<IProjectCostAlert[]>;
  createActivityWarning(
    warningData: Omit<IProjectActivityWarning, '_id'>,
  ): Promise<IProjectActivityWarning>;
  resolveActiveActivityWarnings(
    projectRecordId: string,
    reason: string,
    resolvedAt?: Date,
  ): Promise<number>;
  findActivityWarnings(filters: {
    page: number;
    limit: number;
    projectId?: string;
    status?: AlertLifecycleStatus;
  }): Promise<PaginatedResult<IProjectActivityWarning>>;
}

function cloneProject(project: IProject): IProject {
  return {
    ...project,
    financialSummaryUpdatedAt: new Date(project.financialSummaryUpdatedAt),
    lastActivityAt: new Date(project.lastActivityAt),
    costThresholdState: {
      ...project.costThresholdState,
    },
    inactivityWarningState: {
      activeWarningId: project.inactivityWarningState?.activeWarningId ?? null,
      warnedForLastActivityAt: project.inactivityWarningState
        ?.warnedForLastActivityAt
        ? new Date(project.inactivityWarningState.warnedForLastActivityAt)
        : null,
    },
    createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
    updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export class ProjectRepository implements IProjectRepository {
  private projectMemory: Map<string, IProject> = sharedProjectMemoryStore;
  private counterMemory: Map<string, number> = sharedProjectCounterMemoryStore;
  private costAlertMemory: Map<string, IProjectCostAlert> =
    sharedProjectCostAlertMemoryStore;
  private activityWarningMemory: Map<string, IProjectActivityWarning> =
    sharedProjectActivityWarningMemoryStore;
  private dbFloorSyncPromise: Promise<void> | null = null;
  private beforePersistHook: ((project: Omit<IProject, '_id'>) => Promise<void> | void) | null =
    null;

  constructor(
    private projectModel: Model<IProject> = ProjectModel,
    private counterModel: Model<IProjectCounter> = ProjectCounterModel,
    private costAlertModel: Model<IProjectCostAlert> = ProjectCostAlertModel,
    private activityWarningModel: Model<IProjectActivityWarning> = ProjectActivityWarningModel,
  ) {}

  setBeforePersistHook(
    hook: ((project: Omit<IProject, '_id'>) => Promise<void> | void) | null,
  ): void {
    this.beforePersistHook = hook;
  }

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  private async ensureDbCounterFloorSynced(force = false): Promise<void> {
    if (!this.isDbConnected()) {
      return;
    }

    if (force) {
      this.dbFloorSyncPromise = null;
    }

    if (!this.dbFloorSyncPromise) {
      this.dbFloorSyncPromise = (async () => {
        const docs = await this.projectModel
          .find({}, { projectId: 1 })
          .lean()
          .exec();

        let maxSeq = 0;
        for (const doc of docs) {
          const seq = extractProjectSequenceNumber(doc.projectId);
          if (seq !== null && seq > maxSeq) {
            maxSeq = seq;
          }
        }

        if (maxSeq > 0) {
          await this.counterModel
            .findOneAndUpdate(
              { _id: PROJECT_SEQUENCE_COUNTER_ID },
              { $max: { seq: maxSeq } },
              { upsert: true, new: true },
            )
            .exec();
        }
      })().catch((err) => {
        this.dbFloorSyncPromise = null;
        throw err;
      });
    }

    await this.dbFloorSyncPromise;
  }

  async allocateNextProjectCode(): Promise<string> {
    if (this.isDbConnected()) {
      await this.ensureDbCounterFloorSynced(false);
      const updatedCounter = await this.counterModel
        .findOneAndUpdate(
          { _id: PROJECT_SEQUENCE_COUNTER_ID },
          { $inc: { seq: 1 } },
          { upsert: true, new: true },
        )
        .lean()
        .exec();

      if (!updatedCounter || typeof updatedCounter.seq !== 'number') {
        throw new ProjectPersistenceError(
          'Failed to allocate atomic project sequence number.',
        );
      }

      return formatProjectSequenceCode(updatedCounter.seq);
    }

    let maxExisting = 0;
    for (const existing of this.projectMemory.values()) {
      const seq = extractProjectSequenceNumber(existing.projectId);
      if (seq !== null && seq > maxExisting) {
        maxExisting = seq;
      }
    }

    const currentCounter =
      this.counterMemory.get(PROJECT_SEQUENCE_COUNTER_ID) || 0;
    const nextSequence = Math.max(currentCounter, maxExisting) + 1;
    this.counterMemory.set(PROJECT_SEQUENCE_COUNTER_ID, nextSequence);
    return formatProjectSequenceCode(nextSequence);
  }

  async createWithGeneratedCode(
    buildProject: (projectId: string) => Omit<IProject, '_id'>,
  ): Promise<IProject> {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const projectCode = await this.allocateNextProjectCode();
      const payload = buildProject(projectCode);

      if (this.beforePersistHook) {
        await this.beforePersistHook(payload);
      }

      if (this.isDbConnected()) {
        try {
          const createdDoc = await this.projectModel.create({
            ...payload,
            projectId: projectCode,
          });
          return createdDoc.toObject() as unknown as IProject;
        } catch (err: unknown) {
          const mongoError = err as { code?: number };
          if (mongoError?.code === 11000 && attempt < maxAttempts) {
            await this.ensureDbCounterFloorSynced(true);
            continue;
          }
          throw err;
        }
      }

      const duplicateInMemory = Array.from(this.projectMemory.values()).some(
        (p) => p.projectId.toUpperCase() === projectCode.toUpperCase(),
      );

      if (duplicateInMemory) {
        if (attempt < maxAttempts) {
          continue;
        }
        throw new ProjectPersistenceError(
          `Duplicate project code collision detected for ${projectCode}.`,
        );
      }

      const now = new Date();
      const recordId = `prj_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const stored: IProject = cloneProject({
        ...payload,
        _id: recordId,
        projectId: projectCode,
        createdAt: payload.createdAt || now,
        updatedAt: payload.updatedAt || now,
      });

      this.projectMemory.set(recordId, stored);
      return cloneProject(stored);
    }

    throw new ProjectPersistenceError(
      'Unable to allocate a unique project ID after multiple attempts.',
    );
  }

  async findProjects(filters: ListProjectsDto): Promise<PaginatedResult<IProject>> {
    const { page, limit, search, status, category } = filters;

    if (this.isDbConnected()) {
      const mongoFilter: Record<string, unknown> = {};

      if (status) {
        mongoFilter.status = status;
      }

      if (category) {
        mongoFilter.category = category;
      }

      if (search) {
        const searchRegex = new RegExp(escapeRegex(search), 'i');
        mongoFilter.$or = [
          { projectId: searchRegex },
          { name: searchRegex },
          { clientName: searchRegex },
        ];
      }

      const skip = (page - 1) * limit;
      const [total, docs] = await Promise.all([
        this.projectModel.countDocuments(mongoFilter).exec(),
        this.projectModel
          .find(mongoFilter)
          .sort({ createdAt: -1, projectId: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
      ]);

      return {
        items: docs as unknown as IProject[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    let items = Array.from(this.projectMemory.values()).map(cloneProject);

    if (status) {
      items = items.filter((p) => p.status === status);
    }

    if (category) {
      items = items.filter((p) => p.category === category);
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (p) =>
          p.projectId.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.clientName.toLowerCase().includes(q),
      );
    }

    items.sort((a, b) => {
      const timeDiff =
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      return b.projectId.localeCompare(a.projectId);
    });

    const total = items.length;
    const skip = (page - 1) * limit;
    const paged = items.slice(skip, skip + limit);

    return {
      items: paged,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findAllProjects(): Promise<IProject[]> {
    if (this.isDbConnected()) {
      const docs = await this.projectModel
        .find({})
        .sort({ createdAt: -1, projectId: -1 })
        .lean()
        .exec();
      return docs as unknown as IProject[];
    }

    return Array.from(this.projectMemory.values())
      .map(cloneProject)
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
  }

  async findAllNonCompletedProjects(): Promise<IProject[]> {
    if (this.isDbConnected()) {
      const docs = await this.projectModel
        .find({ status: { $ne: 'Completed' } })
        .sort({ lastActivityAt: 1 })
        .lean()
        .exec();
      return docs as unknown as IProject[];
    }

    return Array.from(this.projectMemory.values())
      .filter((p) => p.status !== 'Completed')
      .map(cloneProject)
      .sort(
        (a, b) =>
          new Date(a.lastActivityAt).getTime() -
          new Date(b.lastActivityAt).getTime(),
      );
  }

  async findByIdOrCode(identifier: string): Promise<IProject | null> {
    const trimmed = identifier.trim();
    if (!trimmed) {
      return null;
    }

    const normalizedUpper = trimmed.toUpperCase();

    if (this.isDbConnected()) {
      if (mongoose.isValidObjectId(trimmed)) {
        const byObjectId = await this.projectModel
          .findById(trimmed)
          .lean()
          .exec();
        if (byObjectId) {
          return byObjectId as unknown as IProject;
        }
      }

      const byCode = await this.projectModel
        .findOne({ projectId: normalizedUpper })
        .lean()
        .exec();
      return (byCode as unknown as IProject) || null;
    }

    const direct = this.projectMemory.get(trimmed);
    if (direct) {
      return cloneProject(direct);
    }

    for (const project of this.projectMemory.values()) {
      if (
        String(project._id) === trimmed ||
        project.projectId.toUpperCase() === normalizedUpper
      ) {
        return cloneProject(project);
      }
    }

    return null;
  }

  async updateByRecordId(
    recordId: string,
    updateData: Partial<IProject>,
  ): Promise<IProject | null> {
    const sanitizedUpdate: Partial<IProject> = { ...updateData };
    delete (sanitizedUpdate as Record<string, unknown>)._id;
    delete (sanitizedUpdate as Record<string, unknown>).projectId;
    delete (sanitizedUpdate as Record<string, unknown>).createdAt;

    if (this.isDbConnected()) {
      if (!mongoose.isValidObjectId(recordId)) {
        return null;
      }

      const updated = await this.projectModel
        .findByIdAndUpdate(
          recordId,
          { $set: sanitizedUpdate },
          { new: true, runValidators: true },
        )
        .lean()
        .exec();

      return (updated as unknown as IProject) || null;
    }

    const existing = this.projectMemory.get(recordId);
    if (!existing) {
      return null;
    }

    const merged: IProject = cloneProject({
      ...existing,
      ...sanitizedUpdate,
      _id: existing._id,
      projectId: existing.projectId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    this.projectMemory.set(recordId, merged);
    return cloneProject(merged);
  }

  async deleteByRecordId(recordId: string): Promise<IProject | null> {
    if (this.isDbConnected()) {
      if (!mongoose.isValidObjectId(recordId)) {
        return null;
      }

      const deleted = await this.projectModel
        .findByIdAndDelete(recordId)
        .lean()
        .exec();

      if (deleted) {
        await Promise.all([
          this.costAlertModel.deleteMany({ projectRecordId: recordId }).exec(),
          this.activityWarningModel
            .deleteMany({ projectRecordId: recordId })
            .exec(),
        ]);
      }

      return (deleted as unknown as IProject) || null;
    }

    const existing = this.projectMemory.get(recordId);
    if (!existing) {
      return null;
    }

    this.projectMemory.delete(recordId);

    for (const [alertId, alert] of this.costAlertMemory.entries()) {
      if (alert.projectRecordId === recordId) {
        this.costAlertMemory.delete(alertId);
      }
    }

    for (const [warningId, warning] of this.activityWarningMemory.entries()) {
      if (warning.projectRecordId === recordId) {
        this.activityWarningMemory.delete(warningId);
      }
    }

    return cloneProject(existing);
  }

  async createCostAlert(
    alertData: Omit<IProjectCostAlert, '_id'>,
  ): Promise<IProjectCostAlert> {
    if (this.isDbConnected()) {
      const created = await this.costAlertModel.create(alertData);
      return created.toObject() as unknown as IProjectCostAlert;
    }

    const now = new Date();
    const id = `alt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const record: IProjectCostAlert = {
      ...alertData,
      _id: id,
      triggeredAt: new Date(alertData.triggeredAt || now),
      resolvedAt: alertData.resolvedAt ? new Date(alertData.resolvedAt) : null,
      resolvedReason: alertData.resolvedReason ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.costAlertMemory.set(id, record);
    return { ...record };
  }

  async resolveActiveCostAlerts(
    projectRecordId: string,
    thresholdType: CostThresholdAlertType,
    reason: string,
    resolvedAt: Date = new Date(),
  ): Promise<number> {
    if (this.isDbConnected()) {
      const result = await this.costAlertModel
        .updateMany(
          {
            projectRecordId,
            thresholdType,
            status: 'active',
          },
          {
            $set: {
              status: 'resolved',
              resolvedAt,
              resolvedReason: reason,
            },
          },
        )
        .exec();

      return result.modifiedCount || 0;
    }

    let resolvedCount = 0;
    for (const [id, alert] of this.costAlertMemory.entries()) {
      if (
        alert.projectRecordId === projectRecordId &&
        alert.thresholdType === thresholdType &&
        alert.status === 'active'
      ) {
        this.costAlertMemory.set(id, {
          ...alert,
          status: 'resolved',
          resolvedAt: new Date(resolvedAt),
          resolvedReason: reason,
          updatedAt: new Date(),
        });
        resolvedCount += 1;
      }
    }

    return resolvedCount;
  }

  async findCostAlerts(
    filters: ListProjectAlertsDto,
  ): Promise<PaginatedResult<IProjectCostAlert>> {
    const { page, limit, projectId, status, thresholdType } = filters;

    if (this.isDbConnected()) {
      const mongoFilter: Record<string, unknown> = {};

      if (projectId) {
        const upper = projectId.trim().toUpperCase();
        mongoFilter.$or = [
          { projectId: upper },
          { projectRecordId: projectId.trim() },
        ];
      }

      if (status) {
        mongoFilter.status = status;
      }

      if (thresholdType) {
        mongoFilter.thresholdType = thresholdType;
      }

      const skip = (page - 1) * limit;
      const [total, docs] = await Promise.all([
        this.costAlertModel.countDocuments(mongoFilter).exec(),
        this.costAlertModel
          .find(mongoFilter)
          .sort({ triggeredAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
      ]);

      return {
        items: docs as unknown as IProjectCostAlert[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    let items = Array.from(this.costAlertMemory.values()).map((a) => ({ ...a }));

    if (projectId) {
      const trimmed = projectId.trim();
      const upper = trimmed.toUpperCase();
      items = items.filter(
        (a) => a.projectId === upper || a.projectRecordId === trimmed,
      );
    }

    if (status) {
      items = items.filter((a) => a.status === status);
    }

    if (thresholdType) {
      items = items.filter((a) => a.thresholdType === thresholdType);
    }

    items.sort(
      (a, b) =>
        new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
    );

    const total = items.length;
    const skip = (page - 1) * limit;

    return {
      items: items.slice(skip, skip + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findCostAlertsByProject(
    projectRecordId: string,
  ): Promise<IProjectCostAlert[]> {
    if (this.isDbConnected()) {
      const docs = await this.costAlertModel
        .find({ projectRecordId })
        .sort({ triggeredAt: -1 })
        .lean()
        .exec();
      return docs as unknown as IProjectCostAlert[];
    }

    return Array.from(this.costAlertMemory.values())
      .filter((a) => a.projectRecordId === projectRecordId)
      .map((a) => ({ ...a }))
      .sort(
        (a, b) =>
          new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
      );
  }

  async createActivityWarning(
    warningData: Omit<IProjectActivityWarning, '_id'>,
  ): Promise<IProjectActivityWarning> {
    if (this.isDbConnected()) {
      const created = await this.activityWarningModel.create(warningData);
      return created.toObject() as unknown as IProjectActivityWarning;
    }

    const now = new Date();
    const id = `wrn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const record: IProjectActivityWarning = {
      ...warningData,
      _id: id,
      lastActivityAt: new Date(warningData.lastActivityAt),
      triggeredAt: new Date(warningData.triggeredAt || now),
      resolvedAt: warningData.resolvedAt ? new Date(warningData.resolvedAt) : null,
      resolvedReason: warningData.resolvedReason ?? null,
      createdAt: now,
      updatedAt: now,
    };

    this.activityWarningMemory.set(id, record);
    return { ...record };
  }

  async resolveActiveActivityWarnings(
    projectRecordId: string,
    reason: string,
    resolvedAt: Date = new Date(),
  ): Promise<number> {
    if (this.isDbConnected()) {
      const result = await this.activityWarningModel
        .updateMany(
          {
            projectRecordId,
            status: 'active',
          },
          {
            $set: {
              status: 'resolved',
              resolvedAt,
              resolvedReason: reason,
            },
          },
        )
        .exec();

      return result.modifiedCount || 0;
    }

    let resolvedCount = 0;
    for (const [id, warning] of this.activityWarningMemory.entries()) {
      if (
        warning.projectRecordId === projectRecordId &&
        warning.status === 'active'
      ) {
        this.activityWarningMemory.set(id, {
          ...warning,
          status: 'resolved',
          resolvedAt: new Date(resolvedAt),
          resolvedReason: reason,
          updatedAt: new Date(),
        });
        resolvedCount += 1;
      }
    }

    return resolvedCount;
  }

  async findActivityWarnings(filters: {
    page: number;
    limit: number;
    projectId?: string;
    status?: AlertLifecycleStatus;
  }): Promise<PaginatedResult<IProjectActivityWarning>> {
    const { page, limit, projectId, status } = filters;

    if (this.isDbConnected()) {
      const mongoFilter: Record<string, unknown> = {};

      if (projectId) {
        const upper = projectId.trim().toUpperCase();
        mongoFilter.$or = [
          { projectId: upper },
          { projectRecordId: projectId.trim() },
        ];
      }

      if (status) {
        mongoFilter.status = status;
      }

      const skip = (page - 1) * limit;
      const [total, docs] = await Promise.all([
        this.activityWarningModel.countDocuments(mongoFilter).exec(),
        this.activityWarningModel
          .find(mongoFilter)
          .sort({ triggeredAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
      ]);

      return {
        items: docs as unknown as IProjectActivityWarning[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    let items = Array.from(this.activityWarningMemory.values()).map((w) => ({
      ...w,
    }));

    if (projectId) {
      const trimmed = projectId.trim();
      const upper = trimmed.toUpperCase();
      items = items.filter(
        (w) => w.projectId === upper || w.projectRecordId === trimmed,
      );
    }

    if (status) {
      items = items.filter((w) => w.status === status);
    }

    items.sort(
      (a, b) =>
        new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
    );

    const total = items.length;
    const skip = (page - 1) * limit;

    return {
      items: items.slice(skip, skip + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
}
