import { PROJECT_STATUSES, ProjectStatus } from '../models/project.model';
import { ValidationResult } from './create-project.dto';

export interface UpdateProjectStatusDto {
  status: ProjectStatus;
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

  if (typeof raw.status !== 'string' || !raw.status.trim()) {
    errors.status = `Field 'status' is required and must be one of: ${PROJECT_STATUSES.join(', ')}.`;
  } else {
    const trimmed = raw.status.trim();
    if ((PROJECT_STATUSES as readonly string[]).includes(trimmed)) {
      return {
        isValid: true,
        value: {
          status: trimmed as ProjectStatus,
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
