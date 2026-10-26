export interface RejectUserDto {
  reason?: string;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

export function validateRejectUserDto(
  body: unknown,
): ValidationResult<RejectUserDto> {
  const errors: Record<string, string> = {};

  if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body))) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object.' },
    };
  }

  const raw = (body || {}) as Record<string, unknown>;
  let reason: string | undefined;

  if (raw.reason !== undefined && raw.reason !== null && raw.reason !== '') {
    if (typeof raw.reason !== 'string') {
      errors.reason = 'Rejection reason must be a text string.';
    } else {
      const trimmed = raw.reason.trim();
      if (trimmed.length > 500) {
        errors.reason = 'Rejection reason cannot exceed 500 characters.';
      } else if (trimmed.length > 0) {
        reason = trimmed;
      }
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
      reason,
    },
  };
}
