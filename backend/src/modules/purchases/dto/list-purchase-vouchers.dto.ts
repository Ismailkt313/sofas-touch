import { ListPurchaseVouchersDto, ValidationResult } from '../types';

function parseDateBound(raw: unknown, endOfDay: boolean): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  const trimmed = raw.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const dt = endOfDay
      ? new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    if (
      dt.getUTCFullYear() !== year ||
      dt.getUTCMonth() !== month - 1 ||
      dt.getUTCDate() !== day
    ) {
      return null;
    }
    return dt;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateListPurchaseVouchersDto(
  query: Record<string, unknown>,
): ValidationResult<ListPurchaseVouchersDto> {
  const errors: Record<string, string> = {};

  let page = 1;
  if (query.page !== undefined && query.page !== '') {
    const parsedPage = Number.parseInt(String(query.page), 10);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      errors.page = 'Page must be a positive integer.';
    } else {
      page = parsedPage;
    }
  }

  let limit = 10;
  if (query.limit !== undefined && query.limit !== '') {
    const parsedLimit = Number.parseInt(String(query.limit), 10);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.limit = 'Limit must be an integer between 1 and 100.';
    } else {
      limit = parsedLimit;
    }
  }

  let search: string | undefined;
  if (typeof query.search === 'string' && query.search.trim()) {
    search = query.search.trim().slice(0, 150);
  }

  let projectId: string | undefined;
  if (
    typeof query.projectId === 'string' &&
    query.projectId.trim() &&
    query.projectId.trim().toLowerCase() !== 'all'
  ) {
    projectId = query.projectId.trim();
  }

  let fromDate: Date | undefined;
  if (query.fromDate !== undefined && query.fromDate !== '') {
    const parsedFrom = parseDateBound(query.fromDate, false);
    if (!parsedFrom) {
      errors.fromDate = 'fromDate must be a valid YYYY-MM-DD date.';
    } else {
      fromDate = parsedFrom;
    }
  }

  let toDate: Date | undefined;
  if (query.toDate !== undefined && query.toDate !== '') {
    const parsedTo = parseDateBound(query.toDate, true);
    if (!parsedTo) {
      errors.toDate = 'toDate must be a valid YYYY-MM-DD date.';
    } else {
      toDate = parsedTo;
    }
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    errors.dateRange = 'fromDate cannot be after toDate.';
  }

  let status: ListPurchaseVouchersDto['status'] = 'active';
  if (query.status !== undefined && query.status !== '') {
    const normalizedStatus = String(query.status).trim().toLowerCase();
    if (
      normalizedStatus === 'active' ||
      normalizedStatus === 'cancelled' ||
      normalizedStatus === 'all'
    ) {
      status = normalizedStatus;
    } else {
      errors.status = "Status filter must be 'active', 'cancelled', or 'all'.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      page,
      limit,
      search,
      projectId,
      fromDate,
      toDate,
      status,
    },
  };
}
