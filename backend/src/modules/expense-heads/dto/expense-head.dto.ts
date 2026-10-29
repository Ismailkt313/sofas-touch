import {
  EXPENSE_HEAD_CATEGORIES,
  ExpenseHeadCategory,
  normalizeExpenseHeadCategory,
  normalizeExpenseHeadDisplayName,
} from '../models/expense-head.model';
import {
  CreateExpenseHeadDto,
  ExpenseHeadCallerRole,
  ExpenseHeadValidationResult,
  ListExpenseHeadsQueryDto,
  UpdateExpenseHeadDto,
} from '../types';

const ALLOWED_CREATE_FIELDS = new Set(['name', 'category', 'description']);
const SYSTEM_FIELDS = new Set([
  '_id',
  'id',
  'normalizedName',
  'isActive',
  'status',
  'createdBy',
  'createdAt',
  'updatedAt',
  '__v',
]);

export function validateCreateExpenseHeadDto(
  rawBody: unknown,
): ExpenseHeadValidationResult<CreateExpenseHeadDto> {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const body = rawBody as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(body)) {
    if (SYSTEM_FIELDS.has(key)) {
      errors[key] = `Field '${key}' is system-managed and cannot be supplied.`;
    } else if (!ALLOWED_CREATE_FIELDS.has(key)) {
      errors[key] = `Field '${key}' is not allowed.`;
    }
  }

  let name = '';
  if (typeof body.name !== 'string') {
    errors.name = 'Expense head name is required.';
  } else {
    const clean = normalizeExpenseHeadDisplayName(body.name);
    if (!clean) {
      errors.name = 'Expense head name is required.';
    } else if (clean.length > 150) {
      errors.name = 'Expense head name cannot exceed 150 characters.';
    } else {
      name = clean;
    }
  }

  let category: ExpenseHeadCategory = 'General';
  if (
    body.category !== undefined &&
    body.category !== null &&
    body.category !== ''
  ) {
    const normalizedCat = normalizeExpenseHeadCategory(body.category);
    if (!normalizedCat) {
      errors.category = `Category must be one of ${EXPENSE_HEAD_CATEGORIES.join(', ')}.`;
    } else {
      category = normalizedCat;
    }
  }

  let description = '';
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.description = 'Description must be text.';
    } else if (body.description.trim().length > 1000) {
      errors.description = 'Description cannot exceed 1000 characters.';
    } else {
      description = body.description.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      name,
      category,
      description,
    },
  };
}

export function validateUpdateExpenseHeadDto(
  rawBody: unknown,
): ExpenseHeadValidationResult<UpdateExpenseHeadDto> {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return {
      isValid: false,
      errors: { body: 'Request body must be a JSON object.' },
    };
  }

  const body = rawBody as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(body)) {
    if (SYSTEM_FIELDS.has(key)) {
      errors[key] = `Field '${key}' is system-managed and cannot be modified here.`;
    } else if (!ALLOWED_CREATE_FIELDS.has(key)) {
      errors[key] = `Field '${key}' is not allowed.`;
    }
  }

  const updates: UpdateExpenseHeadDto = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      errors.name = 'Expense head name must be text.';
    } else {
      const clean = normalizeExpenseHeadDisplayName(body.name);
      if (!clean) {
        errors.name = 'Expense head name cannot be empty.';
      } else if (clean.length > 150) {
        errors.name = 'Expense head name cannot exceed 150 characters.';
      } else {
        updates.name = clean;
      }
    }
  }

  if (body.category !== undefined) {
    const normalizedCat = normalizeExpenseHeadCategory(body.category);
    if (!normalizedCat) {
      errors.category = `Category must be one of ${EXPENSE_HEAD_CATEGORIES.join(', ')}.`;
    } else {
      updates.category = normalizedCat;
    }
  }

  if (body.description !== undefined) {
    if (body.description === null) {
      updates.description = '';
    } else if (typeof body.description !== 'string') {
      errors.description = 'Description must be text.';
    } else if (body.description.trim().length > 1000) {
      errors.description = 'Description cannot exceed 1000 characters.';
    } else {
      updates.description = body.description.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  if (Object.keys(updates).length === 0) {
    return {
      isValid: false,
      errors: { body: 'At least one updatable field is required.' },
    };
  }

  return { isValid: true, value: updates };
}

export function validateListExpenseHeadsDto(
  rawQuery: Record<string, unknown>,
  callerRole: ExpenseHeadCallerRole,
): ExpenseHeadValidationResult<ListExpenseHeadsQueryDto> {
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

  let limit = 50;
  if (rawQuery.limit !== undefined && rawQuery.limit !== '') {
    const parsed = Number(rawQuery.limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
      errors.limit = 'Limit must be an integer between 1 and 100.';
    } else {
      limit = parsed;
    }
  }

  let search: string | undefined;
  if (typeof rawQuery.search === 'string' && rawQuery.search.trim()) {
    search = rawQuery.search.trim().slice(0, 120);
  }

  let category: ExpenseHeadCategory | undefined;
  if (
    typeof rawQuery.category === 'string' &&
    rawQuery.category.trim() &&
    rawQuery.category.trim().toLowerCase() !== 'all'
  ) {
    const normalizedCat = normalizeExpenseHeadCategory(rawQuery.category);
    if (!normalizedCat) {
      errors.category = `Category must be one of ${EXPENSE_HEAD_CATEGORIES.join(', ')}.`;
    } else {
      category = normalizedCat;
    }
  }

  let status: 'active' | 'inactive' | 'all' =
    callerRole === 'admin' ? 'all' : 'active';
  if (typeof rawQuery.status === 'string' && rawQuery.status.trim()) {
    const lower = rawQuery.status.trim().toLowerCase();
    if (lower !== 'active' && lower !== 'inactive' && lower !== 'all') {
      errors.status = "Status must be 'active', 'inactive', or 'all'.";
    } else if (callerRole !== 'admin' && lower !== 'active') {
      status = 'active';
    } else {
      status = lower;
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
      category,
      status,
    },
  };
}
