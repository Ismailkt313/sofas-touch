import {
  IProjectRepository,
  IProjectService,
  IVoucherTotalsProvider,
  ProjectVoucherAggregationTotals,
  VoucherMutationEvent,
} from '../../projects';
import {
  BillAttachmentNotFoundError,
  IBillAttachmentStorage,
  LocalProtectedBillStorageService,
} from '../../purchases';
import {
  roundExpenseMoney,
  validateCreateExpenseCategoryDto,
  validateCreateExpenseVoucherDto,
  validateListExpenseVouchersDto,
  validateUpdateExpenseCategoryDto,
  validateUpdateExpenseVoucherDto,
} from '../dto/expense.dto';
import { normalizeExpenseText } from '../models/expense-voucher.model';
import {
  DuplicateExpenseCategoryError,
  ExpenseRepository,
} from '../repository/expense.repository';
import {
  ExpenseCallerIdentity,
  ExpenseCategoryResponseDto,
  ExpenseReceiptAttachmentResponseDto,
  ExpenseStorageProvider,
  ExpenseVoucherListSummary,
  ExpenseVoucherResponseDto,
  IExpenseCategory,
  IExpenseReceiptAttachment,
  IExpenseRepository,
  IExpenseVoucher,
  ListExpenseVouchersDto,
  PaginatedResult,
  UploadedReceiptInputFile,
} from '../types';

export class ExpenseValidationError extends Error {
  public readonly statusCode = 400;
  public readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>, message = 'Validation failed.') {
    super(message);
    this.name = 'ExpenseValidationError';
    this.errors = errors;
  }
}

export class ExpenseForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(
    message = 'Access denied. Administrator privileges are required for this action.',
  ) {
    super(message);
    this.name = 'ExpenseForbiddenError';
  }
}

export class ExpenseNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message = 'Expense record not found.') {
    super(message);
    this.name = 'ExpenseNotFoundError';
  }
}

export class ExpenseConflictError extends Error {
  public readonly statusCode = 409;
  public readonly errors?: Record<string, string>;

  constructor(message: string, errors?: Record<string, string>) {
    super(message);
    this.name = 'ExpenseConflictError';
    if (errors && Object.keys(errors).length > 0) {
      this.errors = errors;
    }
  }
}

const MAX_RECEIPT_ATTACHMENTS = 5;
const expenseOperationLocks = new Map<string, Promise<void>>();

async function withSerializedExpenseKey<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = expenseOperationLocks.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  expenseOperationLocks.set(key, chained);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (expenseOperationLocks.get(key) === chained) {
      expenseOperationLocks.delete(key);
    }
  }
}

export class ExpenseVoucherTotalsProvider implements IVoucherTotalsProvider {
  constructor(private readonly expenseRepository: IExpenseRepository) {}

  isPurchaseIntegrationActive(): boolean {
    return false;
  }

  isExpenseIntegrationActive(): boolean {
    return true;
  }

  async aggregateProjectVouchers(
    projectRecordId: string,
    projectCode: string,
  ): Promise<ProjectVoucherAggregationTotals> {
    const result =
      await this.expenseRepository.aggregateActiveExpensesForProject(
        projectRecordId,
        projectCode,
      );

    return {
      totalPurchases: 0,
      totalOtherExpenses: roundExpenseMoney(result.totalAmount),
      latestVoucherActivityAt: result.latestActivityAt,
    };
  }
}

export class ExpenseService {
  constructor(
    private readonly repository: IExpenseRepository = new ExpenseRepository(),
    private readonly projectRepository: IProjectRepository,
    private readonly projectService: IProjectService,
    private readonly receiptStorage: IBillAttachmentStorage = new LocalProtectedBillStorageService(),
  ) {}

  private assertPermission(
    caller: ExpenseCallerIdentity,
    requiredPermission: 'expenses.edit' | 'expenses.delete',
    actionLabel: string,
  ): void {
    const allowed =
      caller.role === 'admin' ||
      (Array.isArray(caller.permissions) &&
        caller.permissions.includes(requiredPermission));
    if (!allowed) {
      throw new ExpenseForbiddenError(
        `Access denied. You do not have permission to ${actionLabel}.`,
      );
    }
  }

  toSafeCategory(category: IExpenseCategory): ExpenseCategoryResponseDto {
    return {
      id: String(category._id),
      name: category.name,
      description: category.description || '',
      isDefault: Boolean(category.isDefault),
      isActive: category.isActive !== false,
      createdBy: category.createdBy,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  toSafeAttachment(
    voucherId: string,
    attachment: IExpenseReceiptAttachment,
  ): ExpenseReceiptAttachmentResponseDto {
    const encodedVoucherId = encodeURIComponent(voucherId);
    const encodedAttId = encodeURIComponent(attachment.attachmentId);
    const baseUrl = `/api/expenses/${encodedVoucherId}/attachments/${encodedAttId}`;

    return {
      attachmentId: attachment.attachmentId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      storageProvider: attachment.storageProvider,
      uploadedBy: attachment.uploadedBy,
      uploadedByName: attachment.uploadedByName || '',
      uploadedAt: attachment.uploadedAt,
      viewUrl: baseUrl,
      downloadUrl: `${baseUrl}?download=1`,
    };
  }

  toSafeVoucher(voucher: IExpenseVoucher): ExpenseVoucherResponseDto {
    const voucherId = String(voucher._id);
    const attachments = (voucher.attachments || []).map((att) =>
      this.toSafeAttachment(voucherId, att),
    );

    return {
      id: voucherId,
      voucherNumber: voucher.voucherNumber,
      expenseDate: voucher.expenseDate,
      categoryId: voucher.categoryId,
      categoryName: voucher.categoryName,
      amount: roundExpenseMoney(voucher.amount),
      description: voucher.description,
      projectRecordId: voucher.projectRecordId || null,
      projectCode: voucher.projectCode || null,
      projectName: voucher.projectName || null,
      attachments,
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      status: voucher.status,
      createdBy: voucher.createdBy,
      createdByName: voucher.createdByName || '',
      updatedBy: voucher.updatedBy || '',
      updatedByName: voucher.updatedByName || '',
      cancelledAt: voucher.cancelledAt || null,
      cancelledBy: voucher.cancelledBy || null,
      cancelReason: voucher.cancelReason || null,
      createdAt: voucher.createdAt,
      updatedAt: voucher.updatedAt,
    };
  }

  private async resolveAndValidateProject(
    projectId: string | null | undefined,
    allowSameCompletedProjectRecordId?: string | null,
  ): Promise<{
    projectRecordId: string | null;
    projectCode: string | null;
    projectName: string | null;
  }> {
    if (!projectId || !projectId.trim()) {
      return {
        projectRecordId: null,
        projectCode: null,
        projectName: null,
      };
    }

    const project = await this.projectRepository.findByIdOrCode(
      projectId.trim(),
    );
    if (!project || !project._id) {
      throw new ExpenseValidationError(
        { projectId: 'Selected project was not found.' },
        'Selected project was not found.',
      );
    }

    const recordId = String(project._id);
    if (
      project.status === 'Completed' &&
      recordId !== allowSameCompletedProjectRecordId
    ) {
      throw new ExpenseConflictError(
        `Project '${project.projectId}' (${project.name}) is marked Completed and cannot receive new expense vouchers unless reopened.`,
        {
          projectId: `Project '${project.projectId}' is Completed.`,
        },
      );
    }

    return {
      projectRecordId: recordId,
      projectCode: project.projectId,
      projectName: project.name,
    };
  }

  private async resolveOrCreateCategory(params: {
    categoryId: string | null | undefined;
    newCategoryName: string | null | undefined;
    caller: ExpenseCallerIdentity;
    allowExistingInactiveCategoryId?: string | null;
  }): Promise<IExpenseCategory> {
    if (params.newCategoryName) {
      this.assertPermission(
        params.caller,
        'expenses.edit',
        'create expense categories',
      );
      return withSerializedExpenseKey(
        `cat:${params.newCategoryName.toLowerCase()}`,
        async () => {
          try {
            return await this.repository.createCategory({
              name: params.newCategoryName as string,
              normalizedName: (params.newCategoryName as string).toLowerCase(),
              description: '',
              isDefault: false,
              isActive: true,
              createdBy: params.caller.email || params.caller.id,
            });
          } catch (err) {
            if (err instanceof DuplicateExpenseCategoryError) {
              throw new ExpenseConflictError(err.message, {
                newCategoryName: err.message,
              });
            }
            throw err;
          }
        },
      );
    }

    const cleanId = params.categoryId ? params.categoryId.trim() : '';
    if (!cleanId) {
      throw new ExpenseValidationError(
        { categoryId: 'Please select an expense category.' },
        'Please select an expense category.',
      );
    }

    const category = await this.repository.findCategoryById(cleanId);
    if (!category || !category._id) {
      throw new ExpenseValidationError(
        { categoryId: 'Selected expense category was not found.' },
        'Selected expense category was not found.',
      );
    }

    if (
      category.isActive === false &&
      String(category._id) !== params.allowExistingInactiveCategoryId
    ) {
      throw new ExpenseValidationError(
        {
          categoryId: `Category '${category.name}' is currently inactive. Please select an active category.`,
        },
        `Category '${category.name}' is currently inactive.`,
      );
    }

    return category;
  }

  private async syncProjectsAfterExpenseMutation(
    projectRecordIds: Array<string | null | undefined>,
    action: VoucherMutationEvent['action'],
  ): Promise<void> {
    const uniqueIds = Array.from(
      new Set(
        projectRecordIds
          .map((id) => (typeof id === 'string' ? id.trim() : ''))
          .filter(Boolean),
      ),
    );

    await Promise.all(
      uniqueIds.map(async (projectId) => {
        await this.projectService.syncAfterVoucherMutation({
          projectId,
          voucherType: 'expense',
          action,
        });
      }),
    );
  }

  async listCategories(
    caller: ExpenseCallerIdentity,
    options?: { includeInactive?: boolean },
  ): Promise<ExpenseCategoryResponseDto[]> {
    const canManageCategories =
      caller.role === 'admin' ||
      (Array.isArray(caller.permissions) &&
        caller.permissions.includes('expenses.edit'));
    const canSeeInactive =
      canManageCategories && Boolean(options?.includeInactive);
    const categories = await this.repository.listCategories({
      includeInactive: canSeeInactive,
    });
    return categories.map((cat) => this.toSafeCategory(cat));
  }

  async createCategory(
    rawBody: unknown,
    caller: ExpenseCallerIdentity,
  ): Promise<ExpenseCategoryResponseDto> {
    this.assertPermission(caller, 'expenses.edit', 'create expense categories');

    const validation = validateCreateExpenseCategoryDto(rawBody);
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Invalid category details.';
      throw new ExpenseValidationError(
        validation.errors || { name: 'Invalid category details.' },
        firstError,
      );
    }

    const dto = validation.value;

    return withSerializedExpenseKey(
      `cat:${dto.name.toLowerCase()}`,
      async () => {
        try {
          const created = await this.repository.createCategory({
            name: dto.name,
            normalizedName: dto.name.toLowerCase(),
            description: dto.description,
            isDefault: false,
            isActive: true,
            createdBy: caller.email || caller.id,
          });
          return this.toSafeCategory(created);
        } catch (err) {
          if (err instanceof DuplicateExpenseCategoryError) {
            throw new ExpenseConflictError(err.message, {
              name: err.message,
            });
          }
          throw err;
        }
      },
    );
  }

  async updateCategory(
    categoryId: string,
    rawBody: unknown,
    caller: ExpenseCallerIdentity,
  ): Promise<ExpenseCategoryResponseDto> {
    this.assertPermission(caller, 'expenses.edit', 'manage expense categories');

    const cleanId = String(categoryId || '').trim();
    if (!cleanId) {
      throw new ExpenseValidationError(
        { categoryId: 'Category ID is required.' },
        'Category ID is required.',
      );
    }

    const validation = validateUpdateExpenseCategoryDto(rawBody);
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Invalid category update payload.';
      throw new ExpenseValidationError(
        validation.errors || { body: 'Invalid category update payload.' },
        firstError,
      );
    }

    const dto = validation.value;

    return withSerializedExpenseKey(`cat-edit:${cleanId}`, async () => {
      const existing = await this.repository.findCategoryById(cleanId);
      if (!existing || !existing._id) {
        throw new ExpenseNotFoundError('Expense category was not found.');
      }

      try {
        const updated = await this.repository.updateCategoryById(cleanId, dto);
        if (!updated) {
          throw new ExpenseNotFoundError('Expense category was not found.');
        }

        if (dto.name && dto.name !== existing.name) {
          await this.repository.syncCategoryNameOnVouchers(cleanId, updated.name);
        }

        return this.toSafeCategory(updated);
      } catch (err) {
        if (err instanceof DuplicateExpenseCategoryError) {
          throw new ExpenseConflictError(err.message, {
            name: err.message,
          });
        }
        throw err;
      }
    });
  }

  async createExpenseVoucher(
    rawBody: unknown,
    uploadedFiles: UploadedReceiptInputFile[],
    caller: ExpenseCallerIdentity,
    headerIdempotencyKey?: string,
  ): Promise<{ voucher: ExpenseVoucherResponseDto; created: boolean }> {
    const validation = validateCreateExpenseVoucherDto(
      rawBody,
      headerIdempotencyKey,
    );
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Validation failed for expense voucher.';
      throw new ExpenseValidationError(
        validation.errors || { body: 'Validation failed.' },
        firstError,
      );
    }

    if (uploadedFiles.length > MAX_RECEIPT_ATTACHMENTS) {
      throw new ExpenseValidationError(
        {
          attachments: `You can attach up to ${MAX_RECEIPT_ATTACHMENTS} receipt files per expense voucher.`,
        },
        `You can attach up to ${MAX_RECEIPT_ATTACHMENTS} receipt files per expense voucher.`,
      );
    }

    const dto = validation.value;
    const lockKey = dto.clientRequestId
      ? `exp-req:${dto.clientRequestId}`
      : `exp-create:${caller.id}:${Date.now()}:${Math.random()}`;

    return withSerializedExpenseKey(lockKey, async () => {
      if (dto.clientRequestId) {
        const existingByReq =
          await this.repository.findVoucherByClientRequestId(
            dto.clientRequestId,
          );
        if (existingByReq) {
          return {
            voucher: this.toSafeVoucher(existingByReq),
            created: false,
          };
        }
      }

      const [projectRef, category] = await Promise.all([
        this.resolveAndValidateProject(dto.projectId),
        this.resolveOrCreateCategory({
          categoryId: dto.categoryId,
          newCategoryName: dto.newCategoryName,
          caller,
        }),
      ]);

      const actorName = caller.name || caller.email || caller.id;
      const savedReceipts: IExpenseReceiptAttachment[] = [];

      try {
        for (const file of uploadedFiles) {
          const stored = await this.receiptStorage.saveBillFile(file);
          savedReceipts.push({
            ...stored,
            uploadedBy: caller.id,
            uploadedByName: actorName,
            uploadedAt: new Date(),
          });
        }

        const voucherNumber = await this.repository.nextVoucherNumber();
        const created = await this.repository.createVoucher({
          voucherNumber,
          expenseDate: dto.expenseDate,
          categoryId: String(category._id),
          categoryName: category.name,
          amount: roundExpenseMoney(dto.amount),
          description: dto.description,
          projectRecordId: projectRef.projectRecordId,
          projectCode: projectRef.projectCode,
          projectName: projectRef.projectName,
          attachments: savedReceipts,
          status: 'active',
          clientRequestId: dto.clientRequestId,
          createdBy: caller.id,
          createdByName: actorName,
          updatedBy: caller.id,
          updatedByName: actorName,
          cancelledAt: null,
          cancelledBy: null,
          cancelReason: null,
        });

        await this.syncProjectsAfterExpenseMutation(
          [created.projectRecordId],
          'created',
        );

        return {
          voucher: this.toSafeVoucher(created),
          created: true,
        };
      } catch (err) {
        await Promise.all(
          savedReceipts.map((att) =>
            this.receiptStorage
              .deleteBillFile(att.storageKey)
              .catch(() => undefined),
          ),
        );
        throw err;
      }
    });
  }

  async updateExpenseVoucher(
    identifier: string,
    rawBody: unknown,
    uploadedFiles: UploadedReceiptInputFile[],
    caller: ExpenseCallerIdentity,
  ): Promise<ExpenseVoucherResponseDto> {
    this.assertPermission(caller, 'expenses.edit', 'edit expense records');

    const validation = validateUpdateExpenseVoucherDto(rawBody);
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Validation failed for expense update.';
      throw new ExpenseValidationError(
        validation.errors || { body: 'Validation failed.' },
        firstError,
      );
    }

    const dto = validation.value;

    return withSerializedExpenseKey(`exp-update:${identifier}`, async () => {
      const existing = await this.repository.findVoucherByIdOrNumber(identifier);
      if (!existing || !existing._id) {
        throw new ExpenseNotFoundError();
      }

      if (existing.status === 'cancelled') {
        throw new ExpenseConflictError(
          `Expense voucher ${existing.voucherNumber} has been cancelled and can no longer be edited.`,
        );
      }

      const removeSet = new Set(dto.removeAttachmentIds || []);
      const retainedAttachments = (existing.attachments || []).filter(
        (att) => !removeSet.has(att.attachmentId),
      );
      const removedAttachments = (existing.attachments || []).filter((att) =>
        removeSet.has(att.attachmentId),
      );

      if (
        retainedAttachments.length + uploadedFiles.length >
        MAX_RECEIPT_ATTACHMENTS
      ) {
        throw new ExpenseValidationError(
          {
            attachments: `An expense voucher can hold at most ${MAX_RECEIPT_ATTACHMENTS} receipt attachments.`,
          },
          `An expense voucher can hold at most ${MAX_RECEIPT_ATTACHMENTS} receipt attachments.`,
        );
      }

      const nextProjectRef =
        dto.projectId !== undefined
          ? await this.resolveAndValidateProject(
              dto.projectId,
              existing.projectRecordId,
            )
          : {
              projectRecordId: existing.projectRecordId,
              projectCode: existing.projectCode,
              projectName: existing.projectName,
            };

      let nextCategoryId = existing.categoryId;
      let nextCategoryName = existing.categoryName;

      if (dto.newCategoryName || dto.categoryId !== undefined) {
        const resolvedCat = await this.resolveOrCreateCategory({
          categoryId: dto.categoryId ?? existing.categoryId,
          newCategoryName: dto.newCategoryName,
          caller,
          allowExistingInactiveCategoryId: existing.categoryId,
        });
        nextCategoryId = String(resolvedCat._id);
        nextCategoryName = resolvedCat.name;
      }

      const actorName = caller.name || caller.email || caller.id;
      const newlySavedReceipts: IExpenseReceiptAttachment[] = [];

      try {
        for (const file of uploadedFiles) {
          const stored = await this.receiptStorage.saveBillFile(file);
          newlySavedReceipts.push({
            ...stored,
            uploadedBy: caller.id,
            uploadedByName: actorName,
            uploadedAt: new Date(),
          });
        }

        const updated = await this.repository.updateVoucherById(
          String(existing._id),
          {
            expenseDate: dto.expenseDate ?? existing.expenseDate,
            categoryId: nextCategoryId,
            categoryName: nextCategoryName,
            amount:
              dto.amount !== undefined
                ? roundExpenseMoney(dto.amount)
                : existing.amount,
            description: dto.description ?? existing.description,
            projectRecordId: nextProjectRef.projectRecordId,
            projectCode: nextProjectRef.projectCode,
            projectName: nextProjectRef.projectName,
            attachments: [...retainedAttachments, ...newlySavedReceipts],
            updatedBy: caller.id,
            updatedByName: actorName,
          },
        );

        if (!updated) {
          throw new ExpenseNotFoundError();
        }

        await Promise.all(
          removedAttachments.map((att) =>
            this.receiptStorage
              .deleteBillFile(att.storageKey)
              .catch(() => undefined),
          ),
        );

        await this.syncProjectsAfterExpenseMutation(
          [existing.projectRecordId, updated.projectRecordId],
          'updated',
        );

        return this.toSafeVoucher(updated);
      } catch (err) {
        await Promise.all(
          newlySavedReceipts.map((att) =>
            this.receiptStorage
              .deleteBillFile(att.storageKey)
              .catch(() => undefined),
          ),
        );
        throw err;
      }
    });
  }

  async cancelExpenseVoucher(
    identifier: string,
    rawReason: unknown,
    caller: ExpenseCallerIdentity,
  ): Promise<ExpenseVoucherResponseDto> {
    this.assertPermission(
      caller,
      'expenses.delete',
      'cancel or delete expense records',
    );

    const cleanReason =
      typeof rawReason === 'string'
        ? normalizeExpenseText(rawReason).slice(0, 300)
        : '';

    return withSerializedExpenseKey(`exp-cancel:${identifier}`, async () => {
      const existing = await this.repository.findVoucherByIdOrNumber(identifier);
      if (!existing || !existing._id) {
        throw new ExpenseNotFoundError();
      }

      if (existing.status === 'cancelled') {
        return this.toSafeVoucher(existing);
      }

      const actorName = caller.name || caller.email || caller.id;
      const cancelled = await this.repository.updateVoucherById(
        String(existing._id),
        {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: actorName,
          cancelReason: cleanReason || 'Voided by Administrator',
          updatedBy: caller.id,
          updatedByName: actorName,
        },
      );

      if (!cancelled) {
        throw new ExpenseNotFoundError();
      }

      await this.syncProjectsAfterExpenseMutation(
        [existing.projectRecordId],
        'deleted',
      );

      return this.toSafeVoucher(cancelled);
    });
  }

  async getExpenseVoucherById(
    identifier: string,
  ): Promise<ExpenseVoucherResponseDto> {
    const voucher = await this.repository.findVoucherByIdOrNumber(identifier);
    if (!voucher || !voucher._id) {
      throw new ExpenseNotFoundError();
    }
    return this.toSafeVoucher(voucher);
  }

  async listExpenseVouchers(rawQuery: Record<string, unknown>): Promise<
    PaginatedResult<ExpenseVoucherResponseDto> & {
      expenses: ExpenseVoucherResponseDto[];
      summary: ExpenseVoucherListSummary;
      storageInfo: {
        provider: ExpenseStorageProvider;
        persistentExternalConfigured: boolean;
      };
    }
  > {
    const validation = validateListExpenseVouchersDto(rawQuery);
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Invalid query parameters.';
      throw new ExpenseValidationError(
        validation.errors || { query: 'Invalid query parameters.' },
        firstError,
      );
    }

    const query: ListExpenseVouchersDto = validation.value;
    let resolvedProjectRecordId: string | null = null;
    let filterUnassignedProject = false;

    if (query.projectId) {
      if (query.projectId.toLowerCase() === 'unassigned') {
        filterUnassignedProject = true;
      } else {
        const proj = await this.projectRepository.findByIdOrCode(
          query.projectId,
        );
        if (proj && proj._id) {
          resolvedProjectRecordId = String(proj._id);
        }
      }
    }

    const [result, summary] = await Promise.all([
      this.repository.findVouchers({
        ...query,
        resolvedProjectRecordId,
        filterUnassignedProject,
      }),
      this.repository.computeSummaryCounts(),
    ]);

    const mapped = result.items.map((v) => this.toSafeVoucher(v));

    return {
      items: mapped,
      expenses: mapped,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      summary,
      storageInfo: {
        provider: this.receiptStorage.getProviderName(),
        persistentExternalConfigured:
          this.receiptStorage.isPersistentExternalStorage(),
      },
    };
  }

  async openExpenseAttachment(
    identifier: string,
    attachmentId: string,
  ): Promise<{
    attachment: IExpenseReceiptAttachment;
    buffer: Buffer;
  }> {
    const voucher = await this.repository.findVoucherByIdOrNumber(identifier);
    if (!voucher) {
      throw new ExpenseNotFoundError();
    }

    const cleanAttId = String(attachmentId || '').trim();
    const attachment = (voucher.attachments || []).find(
      (att) => att.attachmentId === cleanAttId,
    );
    if (!attachment) {
      throw new ExpenseNotFoundError('Requested receipt attachment was not found.');
    }

    try {
      const { buffer } = await this.receiptStorage.readBillBuffer(
        attachment.storageKey,
      );
      return { attachment, buffer };
    } catch (err) {
      if (err instanceof BillAttachmentNotFoundError) {
        throw new ExpenseNotFoundError(err.message);
      }
      throw new ExpenseNotFoundError(
        'Receipt attachment file could not be read from storage.',
      );
    }
  }
}
