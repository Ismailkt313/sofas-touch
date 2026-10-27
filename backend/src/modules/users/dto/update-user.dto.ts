export interface UpdateUserDto {
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  role?: 'admin' | 'data_entry';
  password?: string;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PHONE_ALLOWED_PATTERN = /^[+]?[\d\s()-]+$/;

export function validateUpdateUserDto(input: unknown): ValidationResult<UpdateUserDto> {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a valid JSON object.' },
    };
  }

  const raw = input as Record<string, unknown>;
  const sanitized: UpdateUserDto = {};
  let fieldCount = 0;

  if (raw.name !== undefined) {
    if (typeof raw.name !== 'string' || !raw.name.trim()) {
      errors.name = 'Name must be a non-empty string.';
    } else {
      const trimmed = raw.name.trim();
      if (trimmed.length < 2) {
        errors.name = 'Name must be at least 2 characters.';
      } else if (trimmed.length > 100) {
        errors.name = 'Name must be 100 characters or fewer.';
      } else {
        sanitized.name = trimmed;
        fieldCount++;
      }
    }
  }

  if (raw.email !== undefined) {
    if (typeof raw.email !== 'string' || !raw.email.trim()) {
      errors.email = 'Email must be a non-empty string.';
    } else {
      const trimmed = raw.email.trim();
      if (trimmed.length > 254 || !EMAIL_REGEX.test(trimmed)) {
        errors.email = 'Please provide a valid email address format.';
      } else {
        sanitized.email = trimmed.toLowerCase();
        fieldCount++;
      }
    }
  }

  if (raw.phone !== undefined) {
    if (raw.phone === '' || raw.phone === null) {
      sanitized.phone = '';
      fieldCount++;
    } else if (typeof raw.phone !== 'string') {
      errors.phone = 'Phone number must be a valid text string.';
    } else {
      const trimmedPhone = raw.phone.trim();
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      if (!PHONE_ALLOWED_PATTERN.test(trimmedPhone) || digitsOnly.length < 7 || digitsOnly.length > 15) {
        errors.phone = 'Please provide a valid phone number (7 to 15 digits).';
      } else {
        sanitized.phone = trimmedPhone;
        fieldCount++;
      }
    }
  }

  if (raw.image !== undefined) {
    if (typeof raw.image !== 'string') {
      errors.image = 'Image must be a string URL or path.';
    } else {
      sanitized.image = raw.image.trim();
      fieldCount++;
    }
  }

  if (raw.role !== undefined) {
    if (typeof raw.role !== 'string') {
      errors.role = 'Role must be a string.';
    } else {
      const normalizedRole = raw.role.trim().toLowerCase().replace(/\s+/g, '_');
      if (normalizedRole !== 'admin' && normalizedRole !== 'data_entry') {
        errors.role = "Role must be either 'admin' or 'data_entry'.";
      } else {
        sanitized.role = normalizedRole as 'admin' | 'data_entry';
        fieldCount++;
      }
    }
  }

  if (raw.password !== undefined) {
    if (typeof raw.password !== 'string' || raw.password.length === 0) {
      errors.password = 'Password must be a non-empty string.';
    } else if (raw.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (raw.password.length > 256) {
      errors.password = 'Password exceeds maximum allowable length.';
    } else if (!/[A-Za-z]/.test(raw.password) || !/\d/.test(raw.password)) {
      errors.password = 'Password must include at least one letter and one number.';
    } else {
      sanitized.password = raw.password;
      fieldCount++;
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  if (fieldCount === 0) {
    return {
      isValid: false,
      errors: { body: 'At least one field must be provided to update.' },
    };
  }

  return {
    isValid: true,
    value: sanitized,
  };
}
