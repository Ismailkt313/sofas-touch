export interface LoginDto {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function validateLoginDto(input: unknown): ValidationResult<LoginDto> {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object.' },
    };
  }

  const raw = input as Record<string, unknown>;

  if (
    raw.email === undefined ||
    raw.email === null ||
    typeof raw.email !== 'string' ||
    !raw.email.trim()
  ) {
    errors.email = 'Please provide an email address.';
  } else {
    const trimmedEmail = raw.email.trim();
    if (trimmedEmail.length > 254 || !EMAIL_REGEX.test(trimmedEmail)) {
      errors.email = 'Please provide a valid email address format.';
    }
  }

  if (
    raw.password === undefined ||
    raw.password === null ||
    typeof raw.password !== 'string' ||
    raw.password.length === 0
  ) {
    errors.password = 'Please provide your password.';
  } else if (raw.password.length > 256) {
    errors.password = 'Password exceeds maximum allowable length.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  const sanitized: LoginDto = {
    email: (raw.email as string).trim().toLowerCase(),
    password: raw.password as string,
    rememberMe: Boolean(raw.rememberMe),
  };

  return {
    isValid: true,
    value: sanitized,
  };
}
