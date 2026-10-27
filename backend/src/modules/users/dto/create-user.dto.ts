export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'data_entry';
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PHONE_ALLOWED_PATTERN = /^[+]?[\d\s()-]+$/;

export function validateCreateUserDto(input: unknown): ValidationResult<CreateUserDto> {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object.' },
    };
  }

  const raw = input as Record<string, unknown>;

  if (
    raw.name === undefined ||
    raw.name === null ||
    typeof raw.name !== 'string' ||
    !raw.name.trim()
  ) {
    errors.name = 'Please provide the user full name.';
  } else {
    const trimmedName = raw.name.trim();
    if (trimmedName.length < 2) {
      errors.name = 'Name must be at least 2 characters.';
    } else if (trimmedName.length > 100) {
      errors.name = 'Name must be 100 characters or fewer.';
    }
  }

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
    errors.password = 'Please provide a temporary password.';
  } else {
    if (raw.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (raw.password.length > 256) {
      errors.password = 'Password exceeds maximum allowable length.';
    } else if (!/[A-Za-z]/.test(raw.password) || !/\d/.test(raw.password)) {
      errors.password = 'Password must include at least one letter and one number.';
    }
  }

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

  if (raw.role !== undefined && raw.role !== null && raw.role !== '') {
    if (typeof raw.role === 'string') {
      const normalizedRole = raw.role.trim().toLowerCase().replace(/\s+/g, '_');
      if (normalizedRole === 'admin') {
        errors.role =
          'This endpoint is restricted to creating Data Entry Operator accounts. Admin privilege escalation is prohibited.';
      } else if (normalizedRole !== 'data_entry') {
        errors.role = "Role must be 'data_entry'.";
      }
    } else {
      errors.role = 'Role must be a string.';
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
      name: (raw.name as string).trim(),
      email: (raw.email as string).trim().toLowerCase(),
      password: raw.password as string,
      phone: sanitizedPhone || undefined,
      role: 'data_entry',
    },
  };
}
