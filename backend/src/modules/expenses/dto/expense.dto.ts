import { normalizeExpenseCategoryName } from '../models/expense-category.model';
import { normalizeExpenseText } from '../models/expense-voucher.model';
import {
  CreateExpenseCategoryDto,
  CreateExpenseVoucherDto,
  ListExpenseVouchersDto,
  UpdateExpenseCategoryDto,
  UpdateExpenseVoucherDto,
  ValidationResult,
} from '../types';

const MAX_EXPENSE_AMOUNT = 100_000_000;

const SYSTEM_MANAGED_EXPENSE_FIELDS = new Set([
  '_id',
  'id',
  'voucherNumber',
  'categoryName',
  'projectRecordId',
  'projectCode',
  'projectName',
  'attachments',
  'status',
  'createdBy',
  'createdByName',
  'updatedBy',
  'updatedByName',
  'cancelledAt',
  'cancelledBy',
  'cancelReason',
  'createdAt',
  'updatedAt',
  '__v',
]);

const ALLOWED_CREATE_EXPENSE_FIELDS = new Set([
  'expenseDate',
  'categoryId',
  'newCategoryName',
  'amount',
  'description',
  'projectId',
  'clientRequestId',
]);

const ALLOWED_UPDATE_EXPENSE_FIELDS = new Set([
  'expenseDate',
  'categoryId',
  'newCategoryName',
  'amount',
  'description',
  'projectId',
  'removeAttachmentIds',
]);

const ALLOWED_CREATE_CATEGORY_FIELDS = new Set(['name', 'description']);
const ALLOWED_UPDATE_CATEGORY_FIELDS = new Set([
  'name',
  'description',
  'isActive',
]);

export function roundExpenseMoney(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function parseExpenseDateInput(raw: unknown): Date | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
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
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    if (
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() !== month - 1 ||
      utcDate.getUTCDate() !== day
    ) {
      return null;
    }
    return utcDate;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const year = parsed.getUTCFullYear();
  if (year < 1990 || year > 2100) {
    return null;
  }
  return parsed;
}

function parseMonetaryAmount(
  raw: unknown,
): { value: number; error?: string } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: 0, error: 'Expense amount is required.' };
  }
  if (typeof raw === 'boolean' || typeof raw === 'object') {
    return { value: 0, error: 'Expense amount must be a valid positive number.' };
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    return { value: 0, error: 'Expense amount must be greater than ₹0.00.' };
  }
  if (num > MAX_EXPENSE_AMOUNT) {
    return {
      value: 0,
      error: 'Expense amount exceeds the maximum permitted limit.',
    };
  }
  const rounded = roundExpenseMoney(num);
  if (rounded <= 0) {
    return { value: 0, error: 'Expense amount must be at least ₹0.01.' };
  }
  return { value: rounded };
}

function unwrapMultipartOrJsonBody(
  rawBody: unknown,
): { body: Record<string, unknown> | null; parseError?: string } {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { body: null, parseError: 'Request body must be a valid object.' };
  }

  const container = rawBody as Record<string, unknown>;
  if (typeof container.payload === 'string') {
    try {
      const parsed = JSON.parse(container.payload);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          body: null,
          parseError: 'Multipart payload field must be a JSON object.',
        };
      }
      return { body: parsed as Record<string, unknown> };
    } catch {
      return {
        body: null,
        parseError: 'Invalid JSON inside multipart payload field.',
      };
    }
  }

  return { body: container };
}

export function validateCreateExpenseCategoryDto(
  rawBody: unknown,
): ValidationResult<CreateExpenseCategoryDto> {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return {
      isValid: false,
      errors: { body: 'Category details must be a valid JSON object.' },
    };
  }

  const body = rawBody as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED_CREATE_CATEGORY_FIELDS.has(key)) {
      errors[key] = `Field '${key}' is not permitted when creating a category.`;
    }
  }

  const name = normalizeExpenseCategoryName(body.name);
  if (!name) {
    errors.name = 'Category name is required.';
  } else if (name.length < 2) {
    errors.name = 'Category name must be at least 2 characters.';
  } else if (name.length > 80) {
    errors.name = 'Category name cannot exceed 80 characters.';
  }

  const description =
    body.description === undefined || body.description === null
      ? ''
      : normalizeExpenseText(body.description);
  if (description.length > 240) {
    errors.description = 'Category description cannot exceed 240 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      name,
      description,
    },
  };
}

export function validateUpdateExpenseCategoryDto(
  rawBody: unknown,
): ValidationResult<UpdateExpenseCategoryDto> {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return {
      isValid: false,
      errors: { body: 'Category update payload must be a valid JSON object.' },
    };
  }

  const body = rawBody as Record<string, unknown>;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(body)) {
    if (!ALLOWED_UPDATE_CATEGORY_FIELDS.has(key)) {
      errors[key] = `Field '${key}' is not permitted when updating a category.`;
    }
  }

  const dto: UpdateExpenseCategoryDto = {};
  let hasField = false;

  if (body.name !== undefined) {
    hasField = true;
    const name = normalizeExpenseCategoryName(body.name);
    if (!name) {
      errors.name = 'Category name cannot be empty.';
    } else if (name.length < 2) {
      errors.name = 'Category name must be at least 2 characters.';
    } else if (name.length > 80) {
      errors.name = 'Category name cannot exceed 80 characters.';
    } else {
      dto.name = name;
    }
  }

  if (body.description !== undefined) {
    hasField = true;
    if (body.description !== null && typeof body.description !== 'string') {
      errors.description = 'Category description must be text.';
    } else {
      const desc = normalizeExpenseText(body.description || '');
      if (desc.length > 240) {
        errors.description =
          'Category description cannot exceed 240 characters.';
      } else {
        dto.description = desc;
      }
    }
  }

  if (body.isActive !== undefined) {
    hasField = true;
    if (typeof body.isActive !== 'boolean') {
      errors.isActive = 'Category status must be a boolean.';
    } else {
      dto.isActive = body.isActive;
    }
  }

  if (!hasField && Object.keys(errors).length === 0) {
    errors.body = 'Provide at least one category field to update.';
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return { isValid: true, value: dto };
}

export function validateCreateExpenseVoucherDto(
  rawInput: unknown,
  headerIdempotencyKey?: string,
): ValidationResult<CreateExpenseVoucherDto> {
  const unwrapped = unwrapMultipartOrJsonBody(rawInput);
  if (!unwrapped.body) {
    return {
      isValid: false,
      errors: { body: unwrapped.parseError || 'Invalid request payload.' },
    };
  }

  const body = unwrapped.body;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(body)) {
    if (SYSTEM_MANAGED_EXPENSE_FIELDS.has(key)) {
      errors[key] = `Field '${key}' is system-managed and cannot be set manually.`;
    } else if (!ALLOWED_CREATE_EXPENSE_FIELDS.has(key)) {
      errors[key] = `Unknown field '${key}' is not permitted.`;
    }
  }

  const expenseDate = parseExpenseDateInput(body.expenseDate);
  if (!expenseDate) {
    errors.expenseDate = 'A valid expense date is required.';
  }

  const categoryId =
    typeof body.categoryId === 'string' && body.categoryId.trim()
      ? body.categoryId.trim()
      : null;

  const newCategoryName =
    typeof body.newCategoryName === 'string' &&
    normalizeExpenseCategoryName(body.newCategoryName)
      ? normalizeExpenseCategoryName(body.newCategoryName)
      : null;

  if (!categoryId && !newCategoryName) {
    errors.categoryId = 'Please select an expense category.';
  } else if (newCategoryName) {
    if (newCategoryName.length < 2) {
      errors.newCategoryName =
        'New category name must be at least 2 characters.';
    } else if (newCategoryName.length > 80) {
      errors.newCategoryName =
        'New category name cannot exceed 80 characters.';
    }
  }

  const amountCheck = parseMonetaryAmount(body.amount);
  if (amountCheck.error) {
    errors.amount = amountCheck.error;
  }

  const description = normalizeExpenseText(body.description);
  if (!description) {
    errors.description = 'Expense description is required.';
  } else if (description.length < 2) {
    errors.description = 'Description must be at least 2 characters.';
  } else if (description.length > 500) {
    errors.description = 'Description cannot exceed 500 characters.';
  }

  let projectId: string | null = null;
  if (body.projectId !== undefined && body.projectId !== null && body.projectId !== '') {
    if (typeof body.projectId !== 'string') {
      errors.projectId = 'Project identifier must be a string.';
    } else {
      projectId = body.projectId.trim() || null;
    }
  }

  let clientRequestId: string | null = null;
  const rawReqId = body.clientRequestId ?? headerIdempotencyKey ?? null;
  if (rawReqId !== null && rawReqId !== undefined && rawReqId !== '') {
    if (typeof rawReqId !== 'string' || rawReqId.trim().length > 120) {
      errors.clientRequestId = 'Invalid client request identifier.';
    } else {
      clientRequestId = rawReqId.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: {
      expenseDate: expenseDate as Date,
      categoryId,
      newCategoryName,
      amount: amountCheck.value,
      description,
      projectId,
      clientRequestId,
    },
  };
}

export function validateUpdateExpenseVoucherDto(
  rawInput: unknown,
): ValidationResult<UpdateExpenseVoucherDto> {
  const unwrapped = unwrapMultipartOrJsonBody(rawInput);
  if (!unwrapped.body) {
    return {
      isValid: false,
      errors: { body: unwrapped.parseError || 'Invalid request payload.' },
    };
  }

  const body = unwrapped.body;
  const errors: Record<string, string> = {};

  for (const key of Object.keys(body)) {
    if (SYSTEM_MANAGED_EXPENSE_FIELDS.has(key)) {
      errors[key] = `Field '${key}' is system-managed and cannot be modified.`;
    } else if (!ALLOWED_UPDATE_EXPENSE_FIELDS.has(key)) {
      errors[key] = `Unknown field '${key}' is not permitted.`;
    }
  }

  const dto: UpdateExpenseVoucherDto = {};
  let hasField = false;

  if (body.expenseDate !== undefined) {
    hasField = true;
    const parsedDate = parseExpenseDateInput(body.expenseDate);
    if (!parsedDate) {
      errors.expenseDate = 'A valid expense date is required.';
    } else {
      dto.expenseDate = parsedDate;
    }
  }

  if (body.categoryId !== undefined) {
    hasField = true;
    if (body.categoryId === null || body.categoryId === '') {
      dto.categoryId = null;
    } else if (typeof body.categoryId !== 'string') {
      errors.categoryId = 'Expense category ID must be a string.';
    } else {
      dto.categoryId = body.categoryId.trim();
    }
  }

  if (body.newCategoryName !== undefined) {
    hasField = true;
    if (body.newCategoryName === null || body.newCategoryName === '') {
      dto.newCategoryName = null;
    } else if (typeof body.newCategoryName !== 'string') {
      errors.newCategoryName = 'New category name must be text.';
    } else {
      const cleanCat = normalizeExpenseCategoryName(body.newCategoryName);
      if (cleanCat.length < 2) {
        errors.newCategoryName =
          'New category name must be at least 2 characters.';
      } else if (cleanCat.length > 80) {
        errors.newCategoryName =
          'New category name cannot exceed 80 characters.';
      } else {
        dto.newCategoryName = cleanCat;
      }
    }
  }

  if (
    dto.categoryId === null &&
    !dto.newCategoryName &&
    body.categoryId !== undefined
  ) {
    errors.categoryId = 'Please select an expense category.';
  }

  if (body.amount !== undefined) {
    hasField = true;
    const amountCheck = parseMonetaryAmount(body.amount);
    if (amountCheck.error) {
      errors.amount = amountCheck.error;
    } else {
      dto.amount = amountCheck.value;
    }
  }

  if (body.description !== undefined) {
    hasField = true;
    const description = normalizeExpenseText(body.description);
    if (!description) {
      errors.description = 'Expense description is required.';
    } else if (description.length < 2) {
      errors.description = 'Description must be at least 2 characters.';
    } else if (description.length > 500) {
      errors.description = 'Description cannot exceed 500 characters.';
    } else {
      dto.description = description;
    }
  }

  if (body.projectId !== undefined) {
    hasField = true;
    if (body.projectId === null || body.projectId === '') {
      dto.projectId = null;
    } else if (typeof body.projectId !== 'string') {
      errors.projectId = 'Project identifier must be a string.';
    } else {
      dto.projectId = body.projectId.trim() || null;
    }
  }

  if (body.removeAttachmentIds !== undefined) {
    hasField = true;
    let parsedRemoveIds: unknown = body.removeAttachmentIds;
    if (typeof parsedRemoveIds === 'string') {
      try {
        parsedRemoveIds = JSON.parse(parsedRemoveIds);
      } catch {
        parsedRemoveIds = [parsedRemoveIds];
      }
    }
    if (!Array.isArray(parsedRemoveIds)) {
      errors.removeAttachmentIds = 'removeAttachmentIds must be an array.';
    } else {
      dto.removeAttachmentIds = parsedRemoveIds
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(Boolean);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    value: hasField ? dto : {},
  };
}

export function validateListExpenseVouchersDto(
  rawQuery: Record<string, unknown>,
): ValidationResult<ListExpenseVouchersDto> {
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

  const categoryId =
    typeof rawQuery.categoryId === 'string' &&
    rawQuery.categoryId.trim() &&
    rawQuery.categoryId.trim().toLowerCase() !== 'all'
      ? rawQuery.categoryId.trim()
      : undefined;

  const projectId =
    typeof rawQuery.projectId === 'string' &&
    rawQuery.projectId.trim() &&
    rawQuery.projectId.trim().toLowerCase() !== 'all'
      ? rawQuery.projectId.trim()
      : undefined;

  let fromDate: Date | undefined;
  if (rawQuery.fromDate !== undefined && rawQuery.fromDate !== '') {
    const parsed = parseExpenseDateInput(rawQuery.fromDate);
    if (!parsed) {
      errors.fromDate = 'Invalid fromDate filter.';
    } else {
      parsed.setUTCHours(0, 0, 0, 0);
      fromDate = parsed;
    }
  }

  let toDate: Date | undefined;
  if (rawQuery.toDate !== undefined && rawQuery.toDate !== '') {
    const parsed = parseExpenseDateInput(rawQuery.toDate);
    if (!parsed) {
      errors.toDate = 'Invalid toDate filter.';
    } else {
      parsed.setUTCHours(23, 59, 59, 999);
      toDate = parsed;
    }
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    errors.fromDate = 'From date cannot be later than To date.';
  }

  let status: 'active' | 'cancelled' | 'all' = 'active';
  if (rawQuery.status !== undefined && rawQuery.status !== '') {
    const normalized = String(rawQuery.status).trim().toLowerCase();
    if (
      normalized === 'active' ||
      normalized === 'cancelled' ||
      normalized === 'all'
    ) {
      status = normalized;
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
      categoryId,
      projectId,
      fromDate,
      toDate,
      status,
    },
  };
}
