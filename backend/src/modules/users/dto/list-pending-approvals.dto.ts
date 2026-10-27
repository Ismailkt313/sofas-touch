export interface ListPendingApprovalsDto {
  page: number;
  limit: number;
  search?: string;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

export function validateListPendingApprovalsDto(
  query: Record<string, unknown>,
): ValidationResult<ListPendingApprovalsDto> {
  const errors: Record<string, string> = {};

  let page = 1;
  if (query.page !== undefined && query.page !== null && query.page !== '') {
    const parsedPage = Number(query.page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      errors.page = 'Page must be a positive integer starting from 1.';
    } else {
      page = parsedPage;
    }
  }

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
    },
  };
}
