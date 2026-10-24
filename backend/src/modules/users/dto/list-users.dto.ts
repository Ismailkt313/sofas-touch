export interface ListUsersDto {
  page: number;
  limit: number;
  search?: string;
  role?: 'admin' | 'data_entry';
  status?: 'active' | 'inactive';
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

export function validateListUsersDto(
  query: Record<string, unknown>,
): ValidationResult<ListUsersDto> {
  const errors: Record<string, string> = {};

  // Page validation
  let page = 1;
  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      errors.page = 'Page must be a positive integer starting from 1.';
    } else {
      page = parsedPage;
    }
  }

  // Limit validation (default 10, max 100)
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

  // Search validation
  let search: string | undefined;
  if (
    query.search !== undefined &&
    query.search !== null &&
    typeof query.search === 'string'
  ) {
    const trimmed = query.search.trim();
    if (trimmed.length > 100) {
      errors.search = 'Search query cannot exceed 100 characters.';
    } else if (trimmed.length > 0) {
      search = trimmed;
    }
  }

  // Role filter validation
  let role: 'admin' | 'data_entry' | undefined;
  if (query.role !== undefined && query.role !== null && query.role !== '') {
    if (typeof query.role === 'string') {
      const normalizedRole = query.role.trim().toLowerCase().replace(/\s+/g, '_');
      if (normalizedRole === 'all') {
        role = undefined;
      } else if (normalizedRole === 'admin' || normalizedRole === 'data_entry') {
        role = normalizedRole as 'admin' | 'data_entry';
      } else {
        errors.role = "Role filter must be either 'admin' or 'data_entry'.";
      }
    } else {
      errors.role = 'Role filter must be a string.';
    }
  }

  // Status filter validation
  let status: 'active' | 'inactive' | undefined;
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (typeof query.status === 'string') {
      const normalizedStatus = query.status.trim().toLowerCase();
      if (normalizedStatus === 'all') {
        status = undefined;
      } else if (normalizedStatus === 'active' || normalizedStatus === 'true') {
        status = 'active';
      } else if (normalizedStatus === 'inactive' || normalizedStatus === 'false') {
        status = 'inactive';
      } else {
        errors.status = "Status filter must be either 'active' or 'inactive'.";
      }
    } else {
      errors.status = 'Status filter must be a string.';
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
      page,
      limit,
      search,
      role,
      status,
    },
  };
}
