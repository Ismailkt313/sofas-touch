export interface SignupDto {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PHONE_ALLOWED_PATTERN = /^[+]?[\d\s()-]+$/;

export function validateSignupDto(input: unknown): ValidationResult<SignupDto> {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object.' },
    };
  }

  const raw = input as Record<string, unknown>;

  // Name validation: supports 'name' as well as 'fullName'
  const candidateName =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name
      : typeof raw.fullName === 'string'
        ? raw.fullName
        : raw.name;

  if (
    candidateName === undefined ||
    candidateName === null ||
    typeof candidateName !== 'string' ||
    !candidateName.trim()
  ) {
    errors.name = 'Please provide your full name.';
  } else {
    const trimmedName = candidateName.trim();
    if (trimmedName.length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Name must be 100 characters or fewer.';
    }
  }

  // Email validation
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

  // Phone validation (optional or required depending on submission, validated if non-empty)
  let sanitizedPhone = '';
  if (raw.phone !== undefined && raw.phone !== null && raw.phone !== '') {
    if (typeof raw.phone !== 'string') {
      errors.phone = 'Phone number must be a valid text string.';
    } else {
      const trimmedPhone = raw.phone.trim();
      if (!PHONE_ALLOWED_PATTERN.test(trimmedPhone)) {
        errors.phone = 'Please provide a valid phone number.';
      } else {
        const digitsOnly = trimmedPhone.replace(/\D/g, '');
        if (digitsOnly.length < 7 || digitsOnly.length > 15) {
          errors.phone = 'Please provide a valid phone number (7 to 15 digits).';
        } else {
          sanitizedPhone = trimmedPhone;
        }
      }
    }
  }

  // Password validation
  if (
    raw.password === undefined ||
    raw.password === null ||
    typeof raw.password !== 'string' ||
    raw.password.length === 0
  ) {
    errors.password = 'Please provide a password.';
  } else {
    if (raw.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (raw.password.length > 256) {
      errors.password = 'Password exceeds maximum allowable length.';
    } else if (!/[A-Za-z]/.test(raw.password) || !/\d/.test(raw.password)) {
      errors.password = 'Password must include at least one letter and one number.';
    }
  }

  // Confirm password validation (if provided in payload)
  if (
    raw.confirmPassword !== undefined &&
    raw.confirmPassword !== null &&
    typeof raw.confirmPassword === 'string'
  ) {
    if (raw.confirmPassword !== raw.password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  // Any role passed in request body is intentionally stripped to prevent privilege escalation
  const sanitized: SignupDto = {
    name: (candidateName as string).trim(),
    email: (raw.email as string).trim().toLowerCase(),
    phone: sanitizedPhone || undefined,
    password: raw.password as string,
  };

  return {
    isValid: true,
    value: sanitized,
  };
}
