import { PROJECT_STATUSES, ProjectStatus } from '../../projects';
import { ReportSortField, ReportSortOrder } from '../../reports/types';
import {
  DashboardMonthlyExpensesQueryDto,
  DashboardOverviewQueryDto,
} from '../types';

export interface DashboardValidationResult<T> {
  isValid: boolean;
  value?: T;
  errors?: Record<string, string>;
}

const VALID_SORT_FIELDS: ReadonlySet<ReportSortField> = new Set([
  'contractValue',
  'totalCost',
  'estimatedProfit',
  'profitMargin',
  'createdAt',
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseUtcDate(raw: string, endOfDay: boolean): Date | null {
  if (!ISO_DATE_RE.test(raw)) {
    return null;
  }
  const [y, m, d] = raw.split('-').map(Number);
  const dt = endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

export function validateDashboardMonthlyExpensesQuery(
  query: Record<string, unknown>,
): DashboardValidationResult<DashboardMonthlyExpensesQueryDto> {
  const errors: Record<string, string> = {};

  let months = 6;
  if (query.months !== undefined && query.months !== '') {
    const parsed = Number(query.months);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 24) {
      errors.months = 'Months window must be an integer between 1 and 24.';
    } else {
      months = parsed;
    }
  }

  let fromDate: Date | undefined;
  let fromDateStr: string | null = null;
  if (typeof query.fromDate === 'string' && query.fromDate.trim()) {
    const clean = query.fromDate.trim();
    const parsed = parseUtcDate(clean, false);
    if (!parsed) {
      errors.fromDate = 'fromDate must be a valid YYYY-MM-DD date.';
    } else {
      fromDate = parsed;
      fromDateStr = clean;
    }
  }

  let toDate: Date | undefined;
  let toDateStr: string | null = null;
  if (typeof query.toDate === 'string' && query.toDate.trim()) {
    const clean = query.toDate.trim();
    const parsed = parseUtcDate(clean, true);
    if (!parsed) {
      errors.toDate = 'toDate must be a valid YYYY-MM-DD date.';
    } else {
      toDate = parsed;
      toDateStr = clean;
    }
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    errors.dateRange = 'fromDate cannot be later than toDate.';
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      months,
      fromDate,
      toDate,
      fromDateStr,
      toDateStr,
    },
  };
}

export function validateDashboardOverviewQuery(
  query: Record<string, unknown>,
): DashboardValidationResult<DashboardOverviewQueryDto> {
  const errors: Record<string, string> = {};

  let projectStatus: ProjectStatus | 'all' = 'all';
  if (
    typeof query.projectStatus === 'string' &&
    query.projectStatus.trim() &&
    query.projectStatus.trim() !== 'all'
  ) {
    const candidate = query.projectStatus.trim() as ProjectStatus;
    if (!(PROJECT_STATUSES as readonly string[]).includes(candidate)) {
      errors.projectStatus = 'Invalid project status filter.';
    } else {
      projectStatus = candidate;
    }
  }

  let projectSearch: string | undefined;
  if (typeof query.projectSearch === 'string' && query.projectSearch.trim()) {
    projectSearch = query.projectSearch.trim().slice(0, 120);
  }

  let projectSortBy: ReportSortField = 'totalCost';
  if (typeof query.projectSortBy === 'string' && query.projectSortBy.trim()) {
    const candidate = query.projectSortBy.trim() as ReportSortField;
    if (!VALID_SORT_FIELDS.has(candidate)) {
      errors.projectSortBy = 'Invalid project sort field.';
    } else {
      projectSortBy = candidate;
    }
  }

  let projectSortOrder: ReportSortOrder = 'desc';
  if (
    typeof query.projectSortOrder === 'string' &&
    query.projectSortOrder.trim()
  ) {
    const rawOrd = query.projectSortOrder.trim().toLowerCase();
    if (rawOrd !== 'asc' && rawOrd !== 'desc') {
      errors.projectSortOrder = 'Sort order must be asc or desc.';
    } else {
      projectSortOrder = rawOrd;
    }
  }

  const monthlyCheck = validateDashboardMonthlyExpensesQuery({
    months: query.expenseMonths,
    fromDate: query.expenseFromDate,
    toDate: query.expenseToDate,
  });

  if (!monthlyCheck.isValid && monthlyCheck.errors) {
    Object.assign(errors, monthlyCheck.errors);
  }

  let recentLimit = 8;
  if (query.recentLimit !== undefined && query.recentLimit !== '') {
    const parsed = Number(query.recentLimit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      errors.recentLimit = 'recentLimit must be an integer between 1 and 20.';
    } else {
      recentLimit = parsed;
    }
  }

  if (Object.keys(errors).length > 0 || !monthlyCheck.value) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      projectStatus,
      projectSearch,
      projectSortBy,
      projectSortOrder,
      expenseMonths: monthlyCheck.value.months,
      expenseFromDate: monthlyCheck.value.fromDate,
      expenseToDate: monthlyCheck.value.toDate,
      expenseFromDateStr: monthlyCheck.value.fromDateStr,
      expenseToDateStr: monthlyCheck.value.toDateStr,
      recentLimit,
    },
  };
}
