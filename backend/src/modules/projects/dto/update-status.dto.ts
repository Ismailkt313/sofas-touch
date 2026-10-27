import { PROJECT_STATUSES, ProjectStatus } from '../models/project.model';
import { ValidationResult } from './create-project.dto';

export interface UpdateProjectStatusDto {
  status: ProjectStatus;
}

export function normalizeStatusInput(input: unknown): ProjectStatus | null {
  if (typeof input !== 'string') {
    return null;
  }
  const clean = input.trim();
  if (!clean) {
    return null;
  }

  if ((PROJECT_STATUSES as readonly string[]).includes(clean)) {
    return clean as ProjectStatus;
  }

  const simplified = clean.toLowerCase().replace(/[\s_-]+/g, '');
  if (simplified === 'inprogress') {
    return 'In Progress';
  }
  if (simplified === 'underreview') {
    return 'Under Review';
  }
  if (simplified === 'completed') {
    return 'Completed';
  }

  return null;
}

export function validateUpdateProjectStatusDto(
  body: unknown,
): ValidationResult<UpdateProjectStatusDto> {
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

  if (!raw.status || typeof raw.status !== 'string' || !raw.status.trim()) {
    errors.status = `Field 'status' is required and must be one of: ${PROJECT_STATUSES.join(', ')}.`;
  } else {
    const normalized = normalizeStatusInput(raw.status);
    if (normalized) {
      return {
        isValid: true,
        value: {
          status: normalized,
        },
      };
    }
    errors.status = `Status must be one of: ${PROJECT_STATUSES.join(', ')}.`;
  }

  return {
    isValid: false,
    errors,
  };
}
