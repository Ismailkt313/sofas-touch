import { env } from '../../../config/env';
import {
  AlertLifecycleStatus,
  CostThresholdAlertType,
} from '../models/project-alert.model';
import {
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  ProjectCategory,
  ProjectStatus,
} from '../models/project.model';
import { ValidationResult } from './create-project.dto';

export interface ListProjectsDto {
  page: number;
  limit: number;
  search?: string;
  status?: ProjectStatus;
  category?: ProjectCategory;
}

export interface ListProjectAlertsDto {
  page: number;
  limit: number;
  projectId?: string;
  status?: AlertLifecycleStatus;
  thresholdType?: CostThresholdAlertType;
}

export interface ListActivityWarningsDto {
  page: number;
  limit: number;
  projectId?: string;
  status?: AlertLifecycleStatus;
  evaluate: boolean;
  inactivityDays: number;
}

export interface EvaluateActivityWarningsDto {
  inactivityDays: number;
}

function parsePagination(
  query: Record<string, unknown>,
  errors: Record<string, string>,
): { page: number; limit: number } {
  let page = 1;
  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      errors.page = 'Page must be a positive integer starting from 1.';
    } else {
      page = parsedPage;
    }
  }

  let limit = 10;
  if (query.limit !== undefined && query.limit !== null && query.limit !== '') {
    const parsedLimit = Number(query.limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      errors.limit = 'Limit must be a positive integer.';
    } else if (parsedLimit > 100) {
      errors.limit = 'Limit cannot exceed maximum of 100.';
    } else {
      limit = parsedLimit;
    }
  }

  return { page, limit };
}

export function validateListProjectsDto(
  query: Record<string, unknown>,
): ValidationResult<ListProjectsDto> {
  const errors: Record<string, string> = {};
  const { page, limit } = parsePagination(query, errors);

  let search: string | undefined;
  if (query.search !== undefined && query.search !== null) {
    if (typeof query.search !== 'string') {
      errors.search = 'Search query must be a string.';
    } else {
      const trimmed = query.search.trim();
      if (trimmed.length > 100) {
        errors.search = 'Search query cannot exceed 100 characters.';
      } else if (trimmed.length > 0) {
        search = trimmed;
      }
    }
  }

  let status: ProjectStatus | undefined;
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (typeof query.status === 'string') {
      const trimmed = query.status.trim();
      if (trimmed.toLowerCase() === 'all') {
        status = undefined;
      } else if ((PROJECT_STATUSES as readonly string[]).includes(trimmed)) {
        status = trimmed as ProjectStatus;
      } else {
        errors.status = `Status filter must be one of: ${PROJECT_STATUSES.join(', ')}.`;
      }
    } else {
      errors.status = 'Status filter must be a string.';
    }
  }

  let category: ProjectCategory | undefined;
  if (
    query.category !== undefined &&
    query.category !== null &&
    query.category !== ''
  ) {
    if (typeof query.category === 'string') {
      const trimmed = query.category.trim();
      if (trimmed.toLowerCase() === 'all') {
        category = undefined;
      } else if ((PROJECT_CATEGORIES as readonly string[]).includes(trimmed)) {
        category = trimmed as ProjectCategory;
      } else {
        errors.category = `Category filter must be one of: ${PROJECT_CATEGORIES.join(', ')}.`;
      }
    } else {
      errors.category = 'Category filter must be a string.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      page,
      limit,
      search,
      status,
      category,
    },
  };
}

export function validateListProjectAlertsDto(
  query: Record<string, unknown>,
): ValidationResult<ListProjectAlertsDto> {
  const errors: Record<string, string> = {};
  const { page, limit } = parsePagination(query, errors);

  let projectId: string | undefined;
  if (
    query.projectId !== undefined &&
    query.projectId !== null &&
    query.projectId !== ''
  ) {
    if (typeof query.projectId !== 'string') {
      errors.projectId = 'projectId filter must be a string.';
    } else {
      projectId = query.projectId.trim();
    }
  }

  let status: AlertLifecycleStatus | undefined;
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (typeof query.status === 'string') {
      const normalized = query.status.trim().toLowerCase();
      if (normalized === 'all') {
        status = undefined;
      } else if (normalized === 'active' || normalized === 'resolved') {
        status = normalized;
      } else {
        errors.status = "Alert status filter must be 'active', 'resolved', or 'all'.";
      }
    } else {
      errors.status = 'Alert status filter must be a string.';
    }
  }

  let thresholdType: CostThresholdAlertType | undefined;
  if (
    query.thresholdType !== undefined &&
    query.thresholdType !== null &&
    query.thresholdType !== ''
  ) {
    if (typeof query.thresholdType === 'string') {
      const normalized = query.thresholdType.trim().toLowerCase();
      if (normalized === 'all') {
        thresholdType = undefined;
      } else if (normalized === 'warning' || normalized === 'critical') {
        thresholdType = normalized;
      } else {
        errors.thresholdType =
          "Threshold type filter must be 'warning', 'critical', or 'all'.";
      }
    } else {
      errors.thresholdType = 'Threshold type filter must be a string.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      page,
      limit,
      projectId,
      status,
      thresholdType,
    },
  };
}

export function validateListActivityWarningsDto(
  query: Record<string, unknown>,
): ValidationResult<ListActivityWarningsDto> {
  const errors: Record<string, string> = {};
  const { page, limit } = parsePagination(query, errors);

  let projectId: string | undefined;
  if (
    query.projectId !== undefined &&
    query.projectId !== null &&
    query.projectId !== ''
  ) {
    if (typeof query.projectId !== 'string') {
      errors.projectId = 'projectId filter must be a string.';
    } else {
      projectId = query.projectId.trim();
    }
  }

  let status: AlertLifecycleStatus | undefined = 'active';
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (typeof query.status === 'string') {
      const normalized = query.status.trim().toLowerCase();
      if (normalized === 'all') {
        status = undefined;
      } else if (normalized === 'active' || normalized === 'resolved') {
        status = normalized;
      } else {
        errors.status = "Warning status filter must be 'active', 'resolved', or 'all'.";
      }
    } else {
      errors.status = 'Warning status filter must be a string.';
    }
  }

  let evaluate = true;
  if (
    query.evaluate !== undefined &&
    query.evaluate !== null &&
    query.evaluate !== ''
  ) {
    if (query.evaluate === true || query.evaluate === 'true') {
      evaluate = true;
    } else if (query.evaluate === false || query.evaluate === 'false') {
      evaluate = false;
    } else {
      errors.evaluate = "evaluate query parameter must be 'true' or 'false'.";
    }
  }

  let inactivityDays = env.PROJECT_INACTIVITY_THRESHOLD_DAYS;
  if (
    query.inactivityDays !== undefined &&
    query.inactivityDays !== null &&
    query.inactivityDays !== ''
  ) {
    const parsedDays = Number(query.inactivityDays);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0 || parsedDays > 3650) {
      errors.inactivityDays =
        'inactivityDays must be a positive number up to 3650.';
    } else {
      inactivityDays = parsedDays;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      page,
      limit,
      projectId,
      status,
      evaluate,
      inactivityDays,
    },
  };
}

export function validateEvaluateActivityWarningsDto(
  body: unknown,
): ValidationResult<EvaluateActivityWarningsDto> {
  if (body === undefined || body === null) {
    return {
      isValid: true,
      value: {
        inactivityDays: env.PROJECT_INACTIVITY_THRESHOLD_DAYS,
      },
    };
  }

  if (typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: {
        body: 'Request body must be a valid JSON object.',
      },
    };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  let inactivityDays = env.PROJECT_INACTIVITY_THRESHOLD_DAYS;

  if (
    raw.inactivityDays !== undefined &&
    raw.inactivityDays !== null &&
    raw.inactivityDays !== ''
  ) {
    const parsedDays = Number(raw.inactivityDays);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0 || parsedDays > 3650) {
      errors.inactivityDays =
        'inactivityDays must be a positive number up to 3650.';
    } else {
      inactivityDays = parsedDays;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      inactivityDays,
    },
  };
}
