export const ACTIVITY_ENTITY_TYPES = [
  'project',
  'purchase',
  'expense',
  'material',
  'user',
  'permission',
  'settings',
] as const;

export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[number];

export const ACTIVITY_ACTION_TYPES = [
  'project.created',
  'project.updated',
  'project.status_changed',
  'project.deleted',
  'purchase.created',
  'purchase.updated',
  'purchase.attachment_added',
  'purchase.cancelled',
  'expense.created',
  'expense.updated',
  'expense.cancelled',
  'expense.category_created',
  'expense.category_updated',
  'material.created',
  'material.updated',
  'material.stock_adjusted',
  'material.status_changed',
  'user.registered',
  'user.created',
  'user.updated',
  'user.status_changed',
  'user.approved',
  'user.rejected',
  'permissions.updated',
  'permissions.reset',
  'permissions.user_overridden',
  'settings.updated',
] as const;

export type ActivityActionType = (typeof ACTIVITY_ACTION_TYPES)[number];

export type ActivityVisibility = 'all' | 'admin_only';
export type ActivityActorRole = 'admin' | 'data_entry' | 'public';

export interface ActivityCallerIdentity {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'data_entry';
  permissions: string[];
  assignedProjectIds?: string[] | null;
}

export interface RecordActivityInput {
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  description: string;
  actorId: string;
  actorName: string;
  actorRole: ActivityActorRole;
  projectRecordId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  visibility?: ActivityVisibility;
  targetPath?: string | null;
  timestamp?: Date;
}

export interface ActivityResponseDto {
  id: string;
  actionType: ActivityActionType;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  description: string;
  actorId: string;
  actorName: string;
  actorRole: ActivityActorRole;
  projectRecordId: string | null;
  projectCode: string | null;
  projectName: string | null;
  targetPath: string | null;
  timestamp: Date;
}

export interface ListActivitiesQueryDto {
  page: number;
  limit: number;
  fromDate?: Date;
  toDate?: Date;
  fromDateStr: string | null;
  toDateStr: string | null;
  actorId?: string;
  actionType?: ActivityActionType;
  entityType?: ActivityEntityType;
  projectId?: string;
  search?: string;
}

export interface ActivityActorOptionDto {
  actorId: string;
  actorName: string;
}

export interface PaginatedActivitiesResponseDto {
  items: ActivityResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  scope: 'all' | 'own';
  filterOptions: {
    actors: ActivityActorOptionDto[];
    actionTypes: ActivityActionType[];
    entityTypes: ActivityEntityType[];
  };
}
