import { IActivity } from '../models/activity.model';
import { ActivityRepository } from '../repository/activity.repository';
import {
  ACTIVITY_ACTION_TYPES,
  ACTIVITY_ENTITY_TYPES,
  ActivityActionType,
  ActivityCallerIdentity,
  ActivityEntityType,
  ActivityResponseDto,
  ListActivitiesQueryDto,
  PaginatedActivitiesResponseDto,
  RecordActivityInput,
} from '../types';

const ADMIN_ONLY_ACTION_PREFIX = 'user.';

function sanitizeSafeText(value: string, maxLen: number): string {
  return String(value || '')
    .replace(/\b(Bearer\s+[A-Za-z0-9\-._~+/]+=*)\b/gi, '[redacted]')
    .replace(/\b(password\s*[:=]\s*\S+)/gi, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function resolveAuthorizedTargetPath(
  item: IActivity,
  callerRole: 'admin' | 'data_entry',
): string | null {
  if (!item.targetPath) {
    return null;
  }

  if (item.actionType === 'project.deleted') {
    return null;
  }

  if (callerRole !== 'admin') {
    if (
      item.targetPath.startsWith('/users') ||
      item.targetPath.startsWith('/user-approvals') ||
      item.targetPath.startsWith('/reports')
    ) {
      return null;
    }

    if (
      item.entityType === 'material' &&
      item.actionType === 'material.status_changed' &&
      item.description.toLowerCase().includes('deactivated')
    ) {
      return '/raw-materials';
    }
  }

  return item.targetPath;
}

export class ActivityService {
  constructor(
    private readonly repository: ActivityRepository = new ActivityRepository(),
  ) {}

  toResponseDto(
    item: IActivity,
    callerRole: 'admin' | 'data_entry',
  ): ActivityResponseDto {
    return {
      id: String(item._id || ''),
      actionType: item.actionType,
      entityType: item.entityType,
      entityId: item.entityId,
      entityLabel: item.entityLabel,
      description: item.description,
      actorId: item.actorId,
      actorName: item.actorName,
      actorRole: item.actorRole,
      projectRecordId: item.projectRecordId || null,
      projectCode: item.projectCode || null,
      projectName: item.projectName || null,
      targetPath: resolveAuthorizedTargetPath(item, callerRole),
      timestamp: item.timestamp,
    };
  }

  async recordSafe(input: RecordActivityInput): Promise<void> {
    try {
      const entityLabel = sanitizeSafeText(
        input.entityLabel || input.entityId,
        220,
      );
      const description = sanitizeSafeText(input.description, 400);
      const actorName = sanitizeSafeText(
        input.actorName || 'Workspace User',
        140,
      );
      const actorId = sanitizeSafeText(input.actorId || 'system', 120);

      if (!entityLabel || !description) {
        return;
      }

      const defaultVisibility =
        input.entityType === 'user' ||
        input.actionType.startsWith(ADMIN_ONLY_ACTION_PREFIX)
          ? 'admin_only'
          : 'all';

      await this.repository.create({
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: sanitizeSafeText(input.entityId, 120) || 'unknown',
        entityLabel,
        description,
        actorId,
        actorName,
        actorRole: input.actorRole,
        projectRecordId: input.projectRecordId || null,
        projectCode: input.projectCode || null,
        projectName: input.projectName || null,
        visibility: input.visibility || defaultVisibility,
        targetPath: input.targetPath ? input.targetPath.slice(0, 260) : null,
        timestamp: input.timestamp || new Date(),
      });
    } catch {
      void 0;
    }
  }

  async listRecent(
    limit: number,
    caller: ActivityCallerIdentity,
  ): Promise<{ items: ActivityResponseDto[]; limit: number }> {
    const isAdmin = caller.role === 'admin';
    const records = await this.repository.findRecent({
      limit,
      includeAdminOnly: isAdmin,
    });

    return {
      items: records.map((r) => this.toResponseDto(r, caller.role)),
      limit,
    };
  }

  async listPaginated(
    query: ListActivitiesQueryDto,
    caller: ActivityCallerIdentity,
  ): Promise<PaginatedActivitiesResponseDto> {
    const isAdmin = caller.role === 'admin';
    const result = await this.repository.findPaginated({
      query,
      includeAdminOnly: isAdmin,
    });

    const totalPages = Math.max(1, Math.ceil(result.total / query.limit));

    const allowedActionTypes: ActivityActionType[] = isAdmin
      ? [...ACTIVITY_ACTION_TYPES]
      : ACTIVITY_ACTION_TYPES.filter(
          (t) => !t.startsWith(ADMIN_ONLY_ACTION_PREFIX),
        );

    const allowedEntityTypes: ActivityEntityType[] = isAdmin
      ? [...ACTIVITY_ENTITY_TYPES]
      : ACTIVITY_ENTITY_TYPES.filter((t) => t !== 'user');

    return {
      items: result.items.map((r) => this.toResponseDto(r, caller.role)),
      total: result.total,
      page: query.page,
      limit: query.limit,
      totalPages,
      filterOptions: {
        actors: result.actors,
        actionTypes: allowedActionTypes,
        entityTypes: allowedEntityTypes,
      },
    };
  }
}
