import {
  IExpenseHead,
  isValidExpenseHeadObjectId,
  normalizeExpenseHeadDisplayName,
  normalizeExpenseHeadNameKey,
} from '../models/expense-head.model';
import {
  DuplicateExpenseHeadKeyError,
  ExpenseHeadsRepository,
} from '../repository/expense-heads.repository';
import {
  validateCreateExpenseHeadDto,
  validateListExpenseHeadsDto,
  validateUpdateExpenseHeadDto,
} from '../dto/expense-head.dto';
import {
  ExpenseHeadCallerRole,
  ExpenseHeadResponseDto,
  IExpenseHeadsRepository,
  PaginatedExpenseHeadsResult,
} from '../types';

export class ExpenseHeadValidationError extends Error {
  public readonly statusCode = 400;
  public readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>, message = 'Validation failed.') {
    super(message);
    this.name = 'ExpenseHeadValidationError';
    this.errors = errors;
  }
}

export class ExpenseHeadNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message = 'Expense head not found.') {
    super(message);
    this.name = 'ExpenseHeadNotFoundError';
  }
}

export class ExpenseHeadConflictError extends Error {
  public readonly statusCode = 409;

  constructor(message = 'An expense head with this name already exists.') {
    super(message);
    this.name = 'ExpenseHeadConflictError';
  }
}

export class ExpenseHeadForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(message = 'Access denied to inactive expense head.') {
    super(message);
    this.name = 'ExpenseHeadForbiddenError';
  }
}

export function mapExpenseHeadToResponse(
  head: IExpenseHead,
): ExpenseHeadResponseDto {
  return {
    id: String(head._id || ''),
    name: head.name,
    category: head.category || 'General',
    description: head.description || '',
    isActive: Boolean(head.isActive),
    status: head.isActive ? 'active' : 'inactive',
    createdAt: head.createdAt,
    updatedAt: head.updatedAt,
  };
}

export class ExpenseHeadsService {
  constructor(
    private readonly repository: IExpenseHeadsRepository = new ExpenseHeadsRepository(),
  ) {}

  async listExpenseHeads(
    rawQuery: Record<string, unknown>,
    callerRole: ExpenseHeadCallerRole,
  ): Promise<
    PaginatedExpenseHeadsResult<ExpenseHeadResponseDto> & {
      expenseHeads: ExpenseHeadResponseDto[];
    }
  > {
    const validation = validateListExpenseHeadsDto(rawQuery, callerRole);
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Invalid query parameters.';
      throw new ExpenseHeadValidationError(
        validation.errors || { query: 'Invalid query parameters.' },
        firstError,
      );
    }

    const result = await this.repository.findMany(validation.value);
    const mapped = result.items.map(mapExpenseHeadToResponse);

    return {
      items: mapped,
      expenseHeads: mapped,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getExpenseHeadById(
    id: string,
    callerRole: ExpenseHeadCallerRole,
  ): Promise<ExpenseHeadResponseDto> {
    if (!isValidExpenseHeadObjectId(id)) {
      throw new ExpenseHeadValidationError(
        { id: 'Invalid expense head ID format.' },
        'Invalid expense head ID format.',
      );
    }

    const head = await this.repository.findById(id);
    if (!head) {
      throw new ExpenseHeadNotFoundError();
    }

    if (!head.isActive && callerRole !== 'admin') {
      throw new ExpenseHeadForbiddenError();
    }

    return mapExpenseHeadToResponse(head);
  }

  async createExpenseHead(
    rawBody: unknown,
    callerId: string,
  ): Promise<ExpenseHeadResponseDto> {
    const validation = validateCreateExpenseHeadDto(rawBody);
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Validation failed.';
      throw new ExpenseHeadValidationError(
        validation.errors || { body: 'Invalid request payload.' },
        firstError,
      );
    }

    const dto = validation.value;
    const normalizedName = normalizeExpenseHeadNameKey(dto.name);
    const existing =
      await this.repository.findByNormalizedName(normalizedName);
    if (existing) {
      throw new ExpenseHeadConflictError(
        `An expense head named '${existing.name}' already exists.`,
      );
    }

    try {
      const created = await this.repository.create({
        name: normalizeExpenseHeadDisplayName(dto.name),
        normalizedName,
        category: dto.category,
        description: dto.description,
        isActive: true,
        createdBy: callerId,
      });
      return mapExpenseHeadToResponse(created);
    } catch (err) {
      if (err instanceof DuplicateExpenseHeadKeyError) {
        throw new ExpenseHeadConflictError(err.message);
      }
      throw err;
    }
  }

  async updateExpenseHead(
    id: string,
    rawBody: unknown,
  ): Promise<ExpenseHeadResponseDto> {
    if (!isValidExpenseHeadObjectId(id)) {
      throw new ExpenseHeadValidationError(
        { id: 'Invalid expense head ID format.' },
        'Invalid expense head ID format.',
      );
    }

    const validation = validateUpdateExpenseHeadDto(rawBody);
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Validation failed.';
      throw new ExpenseHeadValidationError(
        validation.errors || { body: 'Invalid request payload.' },
        firstError,
      );
    }

    const existing = await this.repository.findById(id);
    if (!existing || !existing._id) {
      throw new ExpenseHeadNotFoundError();
    }

    const dto = validation.value;
    if (dto.name !== undefined) {
      const dup = await this.repository.findByNormalizedName(
        normalizeExpenseHeadNameKey(dto.name),
        String(existing._id),
      );
      if (dup) {
        throw new ExpenseHeadConflictError(
          `An expense head named '${dup.name}' already exists.`,
        );
      }
    }

    try {
      const updated = await this.repository.updateById(String(existing._id), dto);
      if (!updated) {
        throw new ExpenseHeadNotFoundError();
      }
      return mapExpenseHeadToResponse(updated);
    } catch (err) {
      if (err instanceof DuplicateExpenseHeadKeyError) {
        throw new ExpenseHeadConflictError(err.message);
      }
      throw err;
    }
  }

  async updateExpenseHeadStatus(
    id: string,
    rawBody: unknown,
  ): Promise<ExpenseHeadResponseDto> {
    if (!isValidExpenseHeadObjectId(id)) {
      throw new ExpenseHeadValidationError(
        { id: 'Invalid expense head ID format.' },
        'Invalid expense head ID format.',
      );
    }

    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      throw new ExpenseHeadValidationError(
        { isActive: 'Field isActive (boolean) is required.' },
        'Field isActive (boolean) is required.',
      );
    }

    const body = rawBody as Record<string, unknown>;
    if (typeof body.isActive !== 'boolean') {
      throw new ExpenseHeadValidationError(
        { isActive: 'Field isActive must be a boolean.' },
        'Field isActive must be a boolean.',
      );
    }

    const updated = await this.repository.updateById(id, {
      isActive: body.isActive,
    });
    if (!updated) {
      throw new ExpenseHeadNotFoundError();
    }

    return mapExpenseHeadToResponse(updated);
  }
}
