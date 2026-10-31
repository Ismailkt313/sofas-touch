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

const ADMIN_ONLY_ACTION_PREFIXES = ['user.', 'permissions.', 'settings.'];
const ADMIN_ONLY_ENTITIES = new Set<ActivityEntityType>([
  'user',
  'permission',
  'settings',
]);

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
  caller: ActivityCallerIdentity,
): string | null {
  if (!item.targetPath) {
    return null;
  }

  if (item.actionType === 'project.deleted') {
    return null;
  }

  const perms = new Set(caller.permissions || []);
  const p = item.targetPath;

  if (caller.role === 'admin') {
    return p;
  }

  if (p.startsWith('/users')) {
    return perms.has('users.view') ? p : null;
  }
  if (p.startsWith('/user-approvals')) {
    return perms.has('users.approve') ? p : null;
  }
  if (p.startsWith('/permissions')) {
    return perms.has('permissions.manage') ? p : null;
  }
  if (p.startsWith('/reports') || /^\/projects\/[^/]+\/report$/.test(p)) {
    return perms.has('reports.view') && perms.has('reports.viewProfitability')
      ? p
      : null;
  }
  if (p.startsWith('/projects')) {
    return perms.has('projects.view') ? p : null;
  }
  if (p.startsWith('/purchases')) {
    return perms.has('purchases.view') ? p : null;
  }
  if (p.startsWith('/expenses')) {
    return perms.has('expenses.view') ? p : null;
  }
  if (p.startsWith('/raw-materials')) {
    if (!perms.has('materials.view')) {
      return null;
    }
    if (
      !perms.has('materials.edit') &&
      item.entityType === 'material' &&
      item.actionType === 'material.status_changed' &&
      item.description.toLowerCase().includes('deactivated')
    ) {
      return '/raw-materials';
    }
    return p;
  }

  return p;
}

export class ActivityService {
  constructor(
    private readonly repository: ActivityRepository = new ActivityRepository(),
  ) {}

  toResponseDto(
    item: IActivity,
    caller: ActivityCallerIdentity,
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
      targetPath: resolveAuthorizedTargetPath(item, caller),
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

      const isAdminScoped =
        ADMIN_ONLY_ENTITIES.has(input.entityType) ||
        ADMIN_ONLY_ACTION_PREFIXES.some((prefix) =>
          input.actionType.startsWith(prefix),
        );

      const defaultVisibility = isAdminScoped ? 'admin_only' : 'all';

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
  ): Promise<{
    items: ActivityResponseDto[];
    limit: number;
    scope: 'all' | 'own';
  }> {
    const isAdmin = caller.role === 'admin';
    const canViewAll =
      isAdmin || (caller.permissions || []).includes('activity.viewAll');

    const records = await this.repository.findRecent({
      limit,
      includeAdminOnly: isAdmin,
      restrictToActorId: canViewAll ? null : caller.id,
      assignedProjectIds: isAdmin ? null : caller.assignedProjectIds,
    });

    return {
      items: records.map((r) => this.toResponseDto(r, caller)),
      limit,
      scope: canViewAll ? 'all' : 'own',
    };
  }

  async listPaginated(
    query: ListActivitiesQueryDto,
    caller: ActivityCallerIdentity,
  ): Promise<PaginatedActivitiesResponseDto> {
    const isAdmin = caller.role === 'admin';
    const canViewAll =
      isAdmin || (caller.permissions || []).includes('activity.viewAll');

    const result = await this.repository.findPaginated({
      query,
      includeAdminOnly: isAdmin,
      restrictToActorId: canViewAll ? null : caller.id,
      assignedProjectIds: isAdmin ? null : caller.assignedProjectIds,
    });

    const totalPages = Math.max(1, Math.ceil(result.total / query.limit));

    const allowedActionTypes: ActivityActionType[] = isAdmin
      ? [...ACTIVITY_ACTION_TYPES]
      : ACTIVITY_ACTION_TYPES.filter(
          (t) =>
            !ADMIN_ONLY_ACTION_PREFIXES.some((prefix) => t.startsWith(prefix)),
        );

    const allowedEntityTypes: ActivityEntityType[] = isAdmin
      ? [...ACTIVITY_ENTITY_TYPES]
      : ACTIVITY_ENTITY_TYPES.filter((t) => !ADMIN_ONLY_ENTITIES.has(t));

    return {
      items: result.items.map((r) => this.toResponseDto(r, caller)),
      total: result.total,
      page: query.page,
      limit: query.limit,
      totalPages,
      scope: canViewAll ? 'all' : 'own',
      summary: result.summary || {
        total: result.total,
        today: 0,
        projects: 0,
        financial: 0,
      },
      filterOptions: {
        actors: result.actors,
        actionTypes: allowedActionTypes,
        entityTypes: allowedEntityTypes,
      },
    };
  }
}
