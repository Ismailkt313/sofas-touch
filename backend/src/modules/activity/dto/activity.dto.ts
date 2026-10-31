import {
  ACTIVITY_ACTION_TYPES,
  ACTIVITY_ENTITY_TYPES,
  ActivityActionType,
  ActivityEntityType,
  ListActivitiesQueryDto,
} from '../types';

export interface ActivityValidationResult<T> {
  isValid: boolean;
  value?: T;
  errors?: Record<string, string>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcDateBound(raw: string, endOfDay: boolean): Date | null {
  if (!ISO_DATE_RE.test(raw)) {
    return null;
  }
  const [y, m, d] = raw.split('-').map(Number);
  const dt = endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function validateRecentActivitiesQuery(
  query: Record<string, unknown>,
): ActivityValidationResult<{ limit: number }> {
  const errors: Record<string, string> = {};
  let limit = 50;

  if (query.limit !== undefined && query.limit !== '') {
    const parsed = Number(query.limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      errors.limit = 'Limit must be an integer between 1 and 50.';
    } else {
      limit = parsed;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, value: { limit } };
}

export function validateListActivitiesQuery(
  query: Record<string, unknown>,
): ActivityValidationResult<ListActivitiesQueryDto> {
  const errors: Record<string, string> = {};

  let page = 1;
  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const parsed = Number(query.page);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1) {
      page = Math.min(parsed, 10000);
    } else {
      page = 1;
    }
  }

  let limit = 10;
  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const parsed = Number(query.limit);
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1) {
      limit = Math.min(Math.max(parsed, 1), 100);
    } else {
      limit = 10;
    }
  }

  let fromDate: Date | undefined;
  let fromDateStr: string | null = null;
  if (typeof query.fromDate === 'string' && query.fromDate.trim()) {
    const clean = query.fromDate.trim();
    const parsed = parseUtcDateBound(clean, false);
    if (!parsed) {
      errors.fromDate = 'fromDate must be a valid YYYY-MM-DD date.';
    } else {
      fromDate = parsed;
      fromDateStr = clean;
    }
  }

  let toDate: Date | undefined;
  let toDateStr: string | null = null;
  if (typeof query.toDate === 'string' && query.toDate.trim()) {
    const clean = query.toDate.trim();
    const parsed = parseUtcDateBound(clean, true);
    if (!parsed) {
      errors.toDate = 'toDate must be a valid YYYY-MM-DD date.';
    } else {
      toDate = parsed;
      toDateStr = clean;
    }
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    errors.dateRange = 'fromDate cannot be later than toDate.';
  }

  let actorId: string | undefined;
  if (typeof query.actorId === 'string' && query.actorId.trim() && query.actorId.trim() !== 'all') {
    actorId = query.actorId.trim().slice(0, 120);
  }

  let actionType: ActivityActionType | undefined;
  if (
    typeof query.actionType === 'string' &&
    query.actionType.trim() &&
    query.actionType.trim() !== 'all'
  ) {
    const candidate = query.actionType.trim() as ActivityActionType;
    if (!(ACTIVITY_ACTION_TYPES as readonly string[]).includes(candidate)) {
      errors.actionType = 'Invalid activity action type filter.';
    } else {
      actionType = candidate;
    }
  }

  let entityType: ActivityEntityType | undefined;
  if (
    typeof query.entityType === 'string' &&
    query.entityType.trim() &&
    query.entityType.trim() !== 'all'
  ) {
    const candidate = query.entityType.trim() as ActivityEntityType;
    if (!(ACTIVITY_ENTITY_TYPES as readonly string[]).includes(candidate)) {
      errors.entityType = 'Invalid activity entity type filter.';
    } else {
      entityType = candidate;
    }
  }

  let projectId: string | undefined;
  if (
    typeof query.projectId === 'string' &&
    query.projectId.trim() &&
    query.projectId.trim() !== 'all'
  ) {
    projectId = query.projectId.trim().slice(0, 100);
  }

  let search: string | undefined;
  if (typeof query.search === 'string' && query.search.trim()) {
    search = query.search.trim().slice(0, 120);
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      page,
      limit,
      fromDate,
      toDate,
      fromDateStr,
      toDateStr,
      actorId,
      actionType,
      entityType,
      projectId,
      search,
    },
  };
}
