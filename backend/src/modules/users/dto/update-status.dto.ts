export interface UpdateStatusDto {
  isActive: boolean;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

export function validateUpdateStatusDto(input: unknown): ValidationResult<UpdateStatusDto> {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object.' },
    };
  }

  const raw = input as Record<string, unknown>;
  let isActive: boolean | undefined;

  if (typeof raw.isActive === 'boolean') {
    isActive = raw.isActive;
  } else if (raw.isActive === 'true') {
    isActive = true;
  } else if (raw.isActive === 'false') {
    isActive = false;
  } else if (typeof raw.status === 'string') {
    const normalized = raw.status.trim().toLowerCase();
    if (normalized === 'active') {
      isActive = true;
    } else if (normalized === 'inactive') {
      isActive = false;
    } else {
      errors.status = "Status must be either 'active' or 'inactive'.";
    }
  } else {
    errors.isActive = "Field 'isActive' (boolean) or 'status' ('active' | 'inactive') is required.";
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
      isActive: isActive as boolean,
    },
  };
}
