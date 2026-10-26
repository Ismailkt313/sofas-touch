import { env } from '../../../config/env';
import {
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  ProjectCategory,
  ProjectStatus,
} from '../models/project.model';

export interface CreateProjectDto {
  name: string;
  clientName: string;
  category: ProjectCategory;
  status: ProjectStatus;
  description: string;
  contractValue: number;
  costAlertThresholdPercent: number;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

const FORBIDDEN_MANUAL_ID_KEYS = [
  'projectId',
  'projectCode',
  'project_id',
  'project_code',
  'code',
  'id',
  '_id',
] as const;

export function validateCreateProjectDto(
  body: unknown,
): ValidationResult<CreateProjectDto> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      isValid: false,
      errors: {
        body: 'Request body must be a valid JSON object.',
      },
    };
  }

  const raw = body as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of FORBIDDEN_MANUAL_ID_KEYS) {
    if (raw[key] !== undefined) {
      errors.projectId =
        'Project ID is generated automatically and cannot be provided manually.';
      break;
    }
  }

  let name = '';
  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    errors.name = 'Project name is required.';
  } else if (raw.name.trim().length > 200) {
    errors.name = 'Project name cannot exceed 200 characters.';
  } else {
    name = raw.name.trim();
  }

  let clientName = '';
  if (typeof raw.clientName !== 'string' || !raw.clientName.trim()) {
    errors.clientName = 'Client name is required.';
  } else if (raw.clientName.trim().length > 200) {
    errors.clientName = 'Client name cannot exceed 200 characters.';
  } else {
    clientName = raw.clientName.trim();
  }

  let category: ProjectCategory = 'Modular Sofa';
  if (raw.category !== undefined && raw.category !== null && raw.category !== '') {
    if (
      typeof raw.category === 'string' &&
      (PROJECT_CATEGORIES as readonly string[]).includes(raw.category.trim())
    ) {
      category = raw.category.trim() as ProjectCategory;
    } else {
      errors.category = `Category must be one of: ${PROJECT_CATEGORIES.join(', ')}.`;
    }
  }

  let status: ProjectStatus = 'In Progress';
  if (raw.status !== undefined && raw.status !== null && raw.status !== '') {
    if (
      typeof raw.status === 'string' &&
      (PROJECT_STATUSES as readonly string[]).includes(raw.status.trim())
    ) {
      status = raw.status.trim() as ProjectStatus;
    } else {
      errors.status = `Status must be one of: ${PROJECT_STATUSES.join(', ')}.`;
    }
  }

  let description = '';
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') {
      errors.description = 'Description must be a string.';
    } else if (raw.description.trim().length > 2000) {
      errors.description = 'Description cannot exceed 2000 characters.';
    } else {
      description = raw.description.trim();
    }
  }

  let contractValue = 0;
  if (raw.contractValue !== undefined && raw.contractValue !== null && raw.contractValue !== '') {
    const parsedContractValue =
      typeof raw.contractValue === 'number'
        ? raw.contractValue
        : typeof raw.contractValue === 'string' && raw.contractValue.trim() !== ''
          ? Number(raw.contractValue)
          : Number.NaN;

    if (!Number.isFinite(parsedContractValue) || parsedContractValue < 0) {
      errors.contractValue = 'Contract value must be a finite number greater than or equal to 0.';
    } else {
      contractValue = Math.round((parsedContractValue + Number.EPSILON) * 100) / 100;
    }
  }

  let costAlertThresholdPercent = env.PROJECT_COST_WARNING_THRESHOLD_PERCENT;
  if (
    raw.costAlertThresholdPercent !== undefined &&
    raw.costAlertThresholdPercent !== null &&
    raw.costAlertThresholdPercent !== ''
  ) {
    const parsedThreshold =
      typeof raw.costAlertThresholdPercent === 'number'
        ? raw.costAlertThresholdPercent
        : typeof raw.costAlertThresholdPercent === 'string' &&
            raw.costAlertThresholdPercent.trim() !== ''
          ? Number(raw.costAlertThresholdPercent)
          : Number.NaN;

    if (
      !Number.isFinite(parsedThreshold) ||
      parsedThreshold <= 0 ||
      parsedThreshold >= 100
    ) {
      errors.costAlertThresholdPercent =
        'Cost alert warning threshold must be greater than 0 and less than 100.';
    } else {
      costAlertThresholdPercent =
        Math.round((parsedThreshold + Number.EPSILON) * 100) / 100;
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    value: {
      name,
      clientName,
      category,
      status,
      description,
      contractValue,
      costAlertThresholdPercent,
    },
  };
}
