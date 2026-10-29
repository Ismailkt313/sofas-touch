import {
  PROJECT_STATUSES,
  ProjectStatus,
} from '../../projects/models/project.model';
import {
  ProjectReportDetailQueryDto,
  ProjectReportsQueryDto,
  ReportSortField,
  ReportSortOrder,
  ReportValidationResult,
} from '../types';

const VALID_SORT_FIELDS: ReadonlySet<ReportSortField> = new Set([
  'contractValue',
  'totalCost',
  'estimatedProfit',
  'profitMargin',
  'createdAt',
]);

function parseReportBoundaryDate(
  raw: unknown,
  boundary: 'start' | 'end',
): { date: Date; normalizedDateStr: string } | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!dateOnlyMatch) {
    return null;
  }

  const year = Number(dateOnlyMatch[1]);
  const month = Number(dateOnlyMatch[2]);
  const day = Number(dateOnlyMatch[3]);

  if (
    year < 1990 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date =
    boundary === 'start'
      ? new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      : new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    date,
    normalizedDateStr: trimmed,
  };
}

export function validateProjectReportDetailQueryDto(
  rawQuery: Record<string, unknown>,
): ReportValidationResult<ProjectReportDetailQueryDto> {
  const errors: Record<string, string> = {};

  let fromDate: Date | undefined;
  let fromDateStr: string | null = null;
  if (rawQuery.fromDate !== undefined && rawQuery.fromDate !== '') {
    const parsed = parseReportBoundaryDate(rawQuery.fromDate, 'start');
    if (!parsed) {
      errors.fromDate = 'fromDate must be a valid YYYY-MM-DD date.';
    } else {
      fromDate = parsed.date;
      fromDateStr = parsed.normalizedDateStr;
    }
  }

  let toDate: Date | undefined;
  let toDateStr: string | null = null;
  if (rawQuery.toDate !== undefined && rawQuery.toDate !== '') {
    const parsed = parseReportBoundaryDate(rawQuery.toDate, 'end');
    if (!parsed) {
      errors.toDate = 'toDate must be a valid YYYY-MM-DD date.';
    } else {
      toDate = parsed.date;
      toDateStr = parsed.normalizedDateStr;
    }
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    errors.fromDate = 'From date cannot be later than To date.';
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      fromDate,
      toDate,
      fromDateStr,
      toDateStr,
    },
  };
}

export function validateProjectReportsQueryDto(
  rawQuery: Record<string, unknown>,
): ReportValidationResult<ProjectReportsQueryDto> {
  const errors: Record<string, string> = {};

  let page = 1;
  if (rawQuery.page !== undefined && rawQuery.page !== '') {
    const parsed = Number(rawQuery.page);
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.page = 'Page must be a positive integer.';
    } else {
      page = parsed;
    }
  }

  let limit = 10;
  if (rawQuery.limit !== undefined && rawQuery.limit !== '') {
    const parsed = Number(rawQuery.limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      errors.limit = 'Limit must be an integer between 1 and 100.';
    } else {
      limit = parsed;
    }
  }

  const search =
    typeof rawQuery.search === 'string' && rawQuery.search.trim()
      ? rawQuery.search.trim().slice(0, 120)
      : undefined;

  let status: ProjectStatus | 'all' = 'all';
  if (rawQuery.status !== undefined && rawQuery.status !== '') {
    const cleanStatus = String(rawQuery.status).trim();
    if (cleanStatus.toLowerCase() === 'all') {
      status = 'all';
    } else if ((PROJECT_STATUSES as readonly string[]).includes(cleanStatus)) {
      status = cleanStatus as ProjectStatus;
    } else {
      errors.status = `Status must be 'all' or one of: ${PROJECT_STATUSES.join(', ')}.`;
    }
  }

  const dateCheck = validateProjectReportDetailQueryDto(rawQuery);
  if (!dateCheck.isValid && dateCheck.errors) {
    Object.assign(errors, dateCheck.errors);
  }

  let sortBy: ReportSortField = 'createdAt';
  if (rawQuery.sortBy !== undefined && rawQuery.sortBy !== '') {
    const candidate = String(rawQuery.sortBy).trim() as ReportSortField;
    if (VALID_SORT_FIELDS.has(candidate)) {
      sortBy = candidate;
    } else {
      errors.sortBy =
        'sortBy must be one of: contractValue, totalCost, estimatedProfit, profitMargin, createdAt.';
    }
  }

  let sortOrder: ReportSortOrder = 'desc';
  if (rawQuery.sortOrder !== undefined && rawQuery.sortOrder !== '') {
    const candidate = String(rawQuery.sortOrder).trim().toLowerCase();
    if (candidate === 'asc' || candidate === 'desc') {
      sortOrder = candidate;
    } else {
      errors.sortOrder = "sortOrder must be 'asc' or 'desc'.";
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
      status,
      fromDate: dateCheck.value?.fromDate,
      toDate: dateCheck.value?.toDate,
      fromDateStr: dateCheck.value?.fromDateStr || null,
      toDateStr: dateCheck.value?.toDateStr || null,
      sortBy,
      sortOrder,
    },
  };
}
