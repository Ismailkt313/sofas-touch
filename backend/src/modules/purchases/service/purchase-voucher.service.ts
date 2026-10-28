import {
  IProjectRepository,
  IProjectService,
  IVoucherTotalsProvider,
  ProjectVoucherAggregationTotals,
  VoucherMutationEvent,
} from '../../projects';
import {
  InsufficientRawMaterialStockError,
  IRawMaterial,
  IRawMaterialsRepository,
  RawMaterialNotFoundError,
  RawMaterialUnitConflictError,
  RawMaterialsService,
} from '../../raw-materials';
import { RawMaterialUnit } from '../../raw-materials/models/raw-material.model';
import {
  roundPurchaseMoney,
  roundPurchaseQuantity,
  validateCreatePurchaseVoucherDto,
} from '../dto/create-purchase-voucher.dto';
import { validateListPurchaseVouchersDto } from '../dto/list-purchase-vouchers.dto';
import { validateUpdatePurchaseVoucherDto } from '../dto/update-purchase-voucher.dto';
import { normalizePurchaseKey } from '../models/purchase-voucher.model';
import {
  DuplicatePurchaseVoucherError,
  PurchaseVoucherRepository,
} from '../repository/purchase-voucher.repository';
import {
  BillAttachmentNotFoundError,
  LocalProtectedBillStorageService,
} from '../storage/bill-storage.service';
import {
  BillStorageProvider,
  CreatePurchaseVoucherDto,
  IBillAttachmentStorage,
  IPurchaseAppliedStockLine,
  IPurchaseBillAttachment,
  IPurchaseLineItem,
  IPurchaseVoucher,
  IPurchaseVoucherRepository,
  ListPurchaseVouchersDto,
  PaginatedResult,
  PurchaseBillAttachmentResponseDto,
  PurchaseCallerIdentity,
  PurchaseStockMovementResponseDto,
  PurchaseStockMovementType,
  PurchaseVoucherListSummary,
  PurchaseVoucherResponseDto,
  UpdatePurchaseVoucherDto,
  UploadedBillInputFile,
} from '../types';

export class PurchaseValidationError extends Error {
  public readonly statusCode = 400;
  public readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>, message = 'Validation failed.') {
    super(message);
    this.name = 'PurchaseValidationError';
    this.errors = errors;
  }
}

export class PurchaseNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message = 'Purchase voucher not found.') {
    super(message);
    this.name = 'PurchaseNotFoundError';
  }
}

export class PurchaseConflictError extends Error {
  public readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'PurchaseConflictError';
  }
}

export class DuplicateSupplierInvoiceError extends PurchaseConflictError {
  constructor(
    supplierName: string,
    invoiceNumber: string,
    existingVoucherNumber?: string,
  ) {
    super(
      existingVoucherNumber
        ? `Supplier invoice '${invoiceNumber}' from '${supplierName}' is already recorded under active voucher ${existingVoucherNumber}.`
        : `Supplier invoice '${invoiceNumber}' from '${supplierName}' has already been recorded.`,
    );
    this.name = 'DuplicateSupplierInvoiceError';
  }
}

const voucherOperationLocks = new Map<string, Promise<void>>();

async function withSerializedKey<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = voucherOperationLocks.get(key) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  voucherOperationLocks.set(key, chained);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (voucherOperationLocks.get(key) === chained) {
      voucherOperationLocks.delete(key);
    }
  }
}

function aggregateStockByMaterial(
  lines: IPurchaseLineItem[],
): IPurchaseAppliedStockLine[] {
  const byMaterial = new Map<string, IPurchaseAppliedStockLine>();

  for (const line of lines) {
    const existing = byMaterial.get(line.materialId);
    if (existing) {
      existing.quantity = roundPurchaseQuantity(
        existing.quantity + line.quantity,
      );
    } else {
      byMaterial.set(line.materialId, {
        materialId: line.materialId,
        materialName: line.materialName,
        unit: line.unit,
        quantity: roundPurchaseQuantity(line.quantity),
      });
    }
  }

  return Array.from(byMaterial.values()).sort((a, b) =>
    a.materialId.localeCompare(b.materialId),
  );
}

export class PurchaseVoucherTotalsProvider implements IVoucherTotalsProvider {
  constructor(
    private readonly purchaseRepository: IPurchaseVoucherRepository,
    private readonly expenseDelegate?: IVoucherTotalsProvider,
  ) {}

  isPurchaseIntegrationActive(): boolean {
    return true;
  }

  isExpenseIntegrationActive(): boolean {
    return this.expenseDelegate
      ? this.expenseDelegate.isExpenseIntegrationActive()
      : false;
  }

  async aggregateProjectVouchers(
    projectRecordId: string,
    projectCode: string,
  ): Promise<ProjectVoucherAggregationTotals> {
    const [purchases, delegated] = await Promise.all([
      this.purchaseRepository.aggregateActivePurchasesForProject(
        projectRecordId,
        projectCode,
      ),
      this.expenseDelegate
        ? this.expenseDelegate.aggregateProjectVouchers(
            projectRecordId,
            projectCode,
          )
        : Promise.resolve<ProjectVoucherAggregationTotals>({
            totalPurchases: 0,
            totalOtherExpenses: 0,
            latestVoucherActivityAt: null,
          }),
    ]);

    const candidateDates = [
      purchases.latestActivityAt,
      delegated.latestVoucherActivityAt,
    ].filter(
      (dt): dt is Date => dt instanceof Date && !Number.isNaN(dt.getTime()),
    );

    const latestVoucherActivityAt =
      candidateDates.length > 0
        ? candidateDates.reduce((latest, cur) =>
            cur.getTime() > latest.getTime() ? cur : latest,
          )
        : null;

    return {
      totalPurchases: roundPurchaseMoney(purchases.totalAmount),
      totalOtherExpenses: roundPurchaseMoney(delegated.totalOtherExpenses),
      latestVoucherActivityAt,
    };
  }
}

export class PurchaseVoucherService {
  constructor(
    private readonly repository: IPurchaseVoucherRepository = new PurchaseVoucherRepository(),
    private readonly rawMaterialsRepository: IRawMaterialsRepository,
    private readonly rawMaterialsService: RawMaterialsService,
    private readonly projectRepository: IProjectRepository,
    private readonly projectService: IProjectService,
    private readonly billStorage: IBillAttachmentStorage = new LocalProtectedBillStorageService(),
  ) {}

  toSafeAttachment(
    voucherId: string,
    attachment: IPurchaseBillAttachment,
  ): PurchaseBillAttachmentResponseDto {
    const cleanVoucherId = encodeURIComponent(voucherId);
    const cleanAttId = encodeURIComponent(attachment.attachmentId);
    const baseUrl = `/api/purchases/${cleanVoucherId}/attachments/${cleanAttId}`;

    return {
      attachmentId: attachment.attachmentId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      storageProvider: attachment.storageProvider,
      uploadedBy: attachment.uploadedBy,
      uploadedByName: attachment.uploadedByName,
      uploadedAt: attachment.uploadedAt,
      viewUrl: baseUrl,
      downloadUrl: `${baseUrl}?download=1`,
    };
  }

  toSafePurchaseVoucher(voucher: IPurchaseVoucher): PurchaseVoucherResponseDto {
    const id = String(voucher._id || '');
    const attachments = (voucher.attachments || []).map((att) =>
      this.toSafeAttachment(id, att),
    );

    return {
      id,
      voucherNumber: voucher.voucherNumber,
      purchaseDate: voucher.purchaseDate,
      supplierName: voucher.supplierName,
      supplierInvoiceNumber: voucher.supplierInvoiceNumber || '',
      projectRecordId: voucher.projectRecordId || null,
      projectCode: voucher.projectCode || null,
      projectName: voucher.projectName || null,
      entryMethod: voucher.entryMethod,
      lineItems: (voucher.lineItems || []).map((item) => ({
        materialId: item.materialId,
        materialName: item.materialName,
        materialCategory: item.materialCategory || null,
        unit: item.unit,
        quantity: roundPurchaseQuantity(item.quantity),
        unitPrice: roundPurchaseMoney(item.unitPrice),
        lineTotal: roundPurchaseMoney(item.lineTotal),
        remarks: item.remarks || '',
      })),
      subtotal: roundPurchaseMoney(voucher.subtotal),
      discountAmount: roundPurchaseMoney(voucher.discountAmount),
      taxAmount: roundPurchaseMoney(voucher.taxAmount),
      otherCharges: roundPurchaseMoney(voucher.otherCharges),
      finalTotal: roundPurchaseMoney(voucher.finalTotal),
      notes: voucher.notes || '',
      attachments,
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      status: voucher.status,
      revision: voucher.revision,
      stockSynchronized: Boolean(voucher.stockSync?.applied),
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
    if (!project) {
      throw new PurchaseValidationError(
        { projectId: 'Selected project was not found.' },
        'Selected project was not found.',
      );
    }

    const recordId = String(project._id);
    if (
      project.status === 'Completed' &&
      recordId !== allowSameCompletedProjectRecordId
    ) {
      throw new PurchaseConflictError(
        `Project '${project.projectId}' (${project.name}) is marked Completed and cannot receive new purchase vouchers unless reopened.`,
      );
    }

    return {
      projectRecordId: recordId,
      projectCode: project.projectId,
      projectName: project.name,
    };
  }

  private async resolveAndCalculateLineItems(
    lineInputs: CreatePurchaseVoucherDto['lineItems'],
    previouslyIncludedMaterialIds: Set<string> = new Set(),
  ): Promise<{
    lineItems: IPurchaseLineItem[];
    subtotal: number;
  }> {
    const fieldErrors: Record<string, string> = {};
    const materialCache = new Map<string, IRawMaterial>();

    const uniqueIds = Array.from(
      new Set(lineInputs.map((item) => item.materialId)),
    );
    await Promise.all(
      uniqueIds.map(async (matId) => {
        const found = await this.rawMaterialsRepository.findById(matId);
        if (found) {
          materialCache.set(matId, found);
        }
      }),
    );

    const calculatedLines: IPurchaseLineItem[] = [];
    let runningSubtotal = 0;

    lineInputs.forEach((input, idx) => {
      const prefix = `lineItems[${idx}]`;
      const material = materialCache.get(input.materialId);

      if (!material) {
        fieldErrors[`${prefix}.materialId`] =
          `Line item #${idx + 1}: selected raw material does not exist.`;
        return;
      }

      const canonicalMaterialId = String(material._id);
      if (
        !material.isActive &&
        !previouslyIncludedMaterialIds.has(canonicalMaterialId)
      ) {
        fieldErrors[`${prefix}.materialId`] =
          `Line item #${idx + 1}: raw material '${material.name}' is inactive and cannot be added to new purchases.`;
        return;
      }

      if (input.unit && input.unit !== material.unit) {
        fieldErrors[`${prefix}.unit`] =
          `Line item #${idx + 1}: material '${material.name}' uses unit '${material.unit}', not '${input.unit}'.`;
        return;
      }

      const quantity = roundPurchaseQuantity(input.quantity);
      const unitPrice = roundPurchaseMoney(input.unitPrice);
      const lineTotal = roundPurchaseMoney(quantity * unitPrice);

      if (lineTotal <= 0) {
        fieldErrors[`${prefix}.lineTotal`] =
          `Line item #${idx + 1}: calculated line total must be greater than zero.`;
        return;
      }

      runningSubtotal = roundPurchaseMoney(runningSubtotal + lineTotal);

      calculatedLines.push({
        materialId: canonicalMaterialId,
        materialName: material.name,
        materialCategory: material.category || null,
        unit: material.unit,
        quantity,
        unitPrice,
        lineTotal,
        remarks: input.remarks || '',
      });
    });

    if (Object.keys(fieldErrors).length > 0) {
      const firstError = Object.values(fieldErrors)[0];
      throw new PurchaseValidationError(fieldErrors, firstError);
    }

    return {
      lineItems: calculatedLines,
      subtotal: runningSubtotal,
    };
  }

  private computeFinalTotal(
    subtotal: number,
    discountAmount: number,
    taxAmount: number,
    otherCharges: number,
  ): number {
    if (discountAmount > subtotal) {
      throw new PurchaseValidationError(
        {
          discountAmount:
            'Discount amount cannot exceed the material line items subtotal.',
        },
        'Discount amount cannot exceed the material line items subtotal.',
      );
    }

    const finalTotal = roundPurchaseMoney(
      subtotal - discountAmount + taxAmount + otherCharges,
    );
    if (finalTotal < 0) {
      throw new PurchaseValidationError(
        { finalTotal: 'Final voucher total cannot be negative.' },
        'Final voucher total cannot be negative.',
      );
    }

    return finalTotal;
  }

  private async applyStockTransition(params: {
    voucherId: string;
    voucherNumber: string;
    revision: number;
    movementType: PurchaseStockMovementType;
    previousAppliedLines: IPurchaseAppliedStockLine[];
    desiredAppliedLines: IPurchaseAppliedStockLine[];
    performedBy: string;
  }): Promise<void> {
    const prevMap = new Map<string, IPurchaseAppliedStockLine>();
    for (const line of params.previousAppliedLines) {
      prevMap.set(line.materialId, line);
    }

    const nextMap = new Map<string, IPurchaseAppliedStockLine>();
    for (const line of params.desiredAppliedLines) {
      nextMap.set(line.materialId, line);
    }

    const allMaterialIds = Array.from(
      new Set([...prevMap.keys(), ...nextMap.keys()]),
    ).sort();

    if (allMaterialIds.length === 0) {
      return;
    }

    await this.rawMaterialsService.withMaterialStockLocks(
      allMaterialIds,
      async () => {
        const appliedInRun: Array<{
          materialId: string;
          unit: RawMaterialUnit;
          delta: number;
        }> = [];

        try {
          for (const materialId of allMaterialIds) {
            const prevLine = prevMap.get(materialId);
            const nextLine = nextMap.get(materialId);

            const prevQty = prevLine ? prevLine.quantity : 0;
            const nextQty = nextLine ? nextLine.quantity : 0;
            const delta = roundPurchaseQuantity(nextQty - prevQty);

            if (delta === 0) {
              continue;
            }

            const expectedUnit = (nextLine?.unit ||
              prevLine?.unit) as RawMaterialUnit;
            const materialName =
              nextLine?.materialName || prevLine?.materialName || materialId;
            const idempotencyKey = `${params.voucherId}:rev:${params.revision}:mat:${materialId}`;

            const existingMovement =
              await this.repository.findStockMovementByKey(idempotencyKey);
            if (existingMovement) {
              continue;
            }

            const stockResult =
              await this.rawMaterialsService.adjustStockForPurchaseUnlocked(
                materialId,
                expectedUnit,
                delta,
              );

            appliedInRun.push({
              materialId,
              unit: expectedUnit,
              delta,
            });

            await this.repository.recordStockMovement({
              idempotencyKey,
              voucherId: params.voucherId,
              voucherNumber: params.voucherNumber,
              revision: params.revision,
              movementType: params.movementType,
              materialId,
              materialName,
              unit: expectedUnit,
              quantityDelta: delta,
              resultingQuantityOnHand: stockResult.quantityOnHand,
              performedBy: params.performedBy,
              createdAt: new Date(),
            });
          }
        } catch (err) {
          for (let i = appliedInRun.length - 1; i >= 0; i -= 1) {
            const step = appliedInRun[i];
            try {
              await this.rawMaterialsService.adjustStockForPurchaseUnlocked(
                step.materialId,
                step.unit,
                roundPurchaseQuantity(-step.delta),
              );
            } catch {
              void 0;
            }
          }

          if (err instanceof InsufficientRawMaterialStockError) {
            throw new PurchaseConflictError(err.message);
          }
          if (
            err instanceof RawMaterialNotFoundError ||
            err instanceof RawMaterialUnitConflictError
          ) {
            throw new PurchaseValidationError(
              { lineItems: err.message },
              err.message,
            );
          }
          throw err;
        }
      },
    );
  }

  private async rollbackStockTransition(params: {
    previousAppliedLines: IPurchaseAppliedStockLine[];
    desiredAppliedLines: IPurchaseAppliedStockLine[];
  }): Promise<void> {
    const prevMap = new Map<string, IPurchaseAppliedStockLine>();
    for (const line of params.previousAppliedLines) {
      prevMap.set(line.materialId, line);
    }
    const nextMap = new Map<string, IPurchaseAppliedStockLine>();
    for (const line of params.desiredAppliedLines) {
      nextMap.set(line.materialId, line);
    }
    const allMaterialIds = Array.from(
      new Set([...prevMap.keys(), ...nextMap.keys()]),
    ).sort();

    if (allMaterialIds.length === 0) {
      return;
    }

    await this.rawMaterialsService.withMaterialStockLocks(
      allMaterialIds,
      async () => {
        for (const materialId of allMaterialIds) {
          const prevLine = prevMap.get(materialId);
          const nextLine = nextMap.get(materialId);
          const delta = roundPurchaseQuantity(
            (nextLine?.quantity ?? 0) - (prevLine?.quantity ?? 0),
          );
          if (delta === 0) {
            continue;
          }
          const unit = (nextLine?.unit || prevLine?.unit) as RawMaterialUnit;
          try {
            await this.rawMaterialsService.adjustStockForPurchaseUnlocked(
              materialId,
              unit,
              roundPurchaseQuantity(-delta),
            );
          } catch {
            void 0;
          }
        }
      },
    );
  }

  private async syncProjectsQuietly(
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
          voucherType: 'purchase',
          action,
        });
      }),
    );
  }

  async createPurchaseVoucher(
    rawBody: unknown,
    uploadedFiles: UploadedBillInputFile[],
    caller: PurchaseCallerIdentity,
    headerIdempotencyKey?: string,
  ): Promise<{ voucher: PurchaseVoucherResponseDto; created: boolean }> {
    const validation = validateCreatePurchaseVoucherDto(
      rawBody,
      headerIdempotencyKey,
    );
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Validation failed.';
      throw new PurchaseValidationError(
        validation.errors || { body: 'Invalid request payload.' },
        firstError,
      );
    }

    if (uploadedFiles.length > 5) {
      throw new PurchaseValidationError(
        { attachments: 'You can attach up to 5 bill files per voucher.' },
        'You can attach up to 5 bill files per voucher.',
      );
    }

    const dto = validation.value;
    const normalizedSupplierName = normalizePurchaseKey(dto.supplierName);
    const normalizedInvoiceNumber = normalizePurchaseKey(
      dto.supplierInvoiceNumber,
    );

    const serializationKey = dto.clientRequestId
      ? `req:${dto.clientRequestId}`
      : normalizedInvoiceNumber
        ? `inv:${normalizedSupplierName}:${normalizedInvoiceNumber}`
        : `create:${caller.id}:${Date.now()}:${Math.random()}`;

    return withSerializedKey(serializationKey, async () => {
      if (dto.clientRequestId) {
        const existingByReq = await this.repository.findByClientRequestId(
          dto.clientRequestId,
        );
        if (existingByReq) {
          return {
            voucher: this.toSafePurchaseVoucher(existingByReq),
            created: false,
          };
        }
      }

      if (normalizedInvoiceNumber) {
        const duplicateInvoice =
          await this.repository.findActiveBySupplierInvoice(
            normalizedSupplierName,
            normalizedInvoiceNumber,
          );
        if (duplicateInvoice) {
          throw new DuplicateSupplierInvoiceError(
            dto.supplierName,
            dto.supplierInvoiceNumber,
            duplicateInvoice.voucherNumber,
          );
        }
      }

      const [projectRef, calculated] = await Promise.all([
        this.resolveAndValidateProject(dto.projectId),
        this.resolveAndCalculateLineItems(dto.lineItems),
      ]);

      const finalTotal = this.computeFinalTotal(
        calculated.subtotal,
        dto.discountAmount,
        dto.taxAmount,
        dto.otherCharges,
      );

      const actorName = caller.name || caller.email || caller.id;
      const savedAttachments: IPurchaseBillAttachment[] = [];

      try {
        for (const file of uploadedFiles) {
          const stored = await this.billStorage.saveBillFile(file);
          savedAttachments.push({
            ...stored,
            uploadedBy: caller.id,
            uploadedByName: actorName,
            uploadedAt: new Date(),
          });
        }

        let createdVoucher: IPurchaseVoucher | null = null;
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const voucherNumber =
            await this.repository.generateNextVoucherNumber();
          try {
            createdVoucher = await this.repository.create({
              voucherNumber,
              purchaseDate: dto.purchaseDate,
              supplierName: dto.supplierName,
              normalizedSupplierName,
              supplierInvoiceNumber: dto.supplierInvoiceNumber,
              normalizedInvoiceNumber,
              projectRecordId: projectRef.projectRecordId,
              projectCode: projectRef.projectCode,
              projectName: projectRef.projectName,
              entryMethod:
                savedAttachments.length > 0 && dto.entryMethod === 'upload_bill'
                  ? 'upload_bill'
                  : dto.entryMethod,
              lineItems: calculated.lineItems,
              subtotal: calculated.subtotal,
              discountAmount: dto.discountAmount,
              taxAmount: dto.taxAmount,
              otherCharges: dto.otherCharges,
              finalTotal,
              notes: dto.notes,
              attachments: savedAttachments,
              status: 'active',
              revision: 1,
              stockSync: {
                applied: false,
                appliedRevision: 0,
                appliedLines: [],
                lastSyncedAt: null,
              },
              clientRequestId: dto.clientRequestId,
              createdBy: caller.id,
              createdByName: actorName,
              updatedBy: caller.id,
              updatedByName: actorName,
              cancelledAt: null,
              cancelledBy: null,
              cancelReason: null,
            });
            break;
          } catch (err) {
            if (err instanceof DuplicatePurchaseVoucherError) {
              if (dto.clientRequestId) {
                const replayed = await this.repository.findByClientRequestId(
                  dto.clientRequestId,
                );
                if (replayed) {
                  for (const att of savedAttachments) {
                    await this.billStorage.deleteBillFile(att.storageKey);
                  }
                  return {
                    voucher: this.toSafePurchaseVoucher(replayed),
                    created: false,
                  };
                }
              }

              if (normalizedInvoiceNumber) {
                const dupInv =
                  await this.repository.findActiveBySupplierInvoice(
                    normalizedSupplierName,
                    normalizedInvoiceNumber,
                  );
                if (dupInv) {
                  throw new DuplicateSupplierInvoiceError(
                    dto.supplierName,
                    dto.supplierInvoiceNumber,
                    dupInv.voucherNumber,
                  );
                }
              }

              if (attempt === 3) {
                throw new PurchaseConflictError(err.message);
              }
              continue;
            }
            throw err;
          }
        }

        if (!createdVoucher || !createdVoucher._id) {
          throw new Error('Failed to persist purchase voucher.');
        }

        const voucherId = String(createdVoucher._id);
        const desiredAppliedLines = aggregateStockByMaterial(
          calculated.lineItems,
        );

        try {
          await this.applyStockTransition({
            voucherId,
            voucherNumber: createdVoucher.voucherNumber,
            revision: 1,
            movementType: 'purchase_created',
            previousAppliedLines: [],
            desiredAppliedLines,
            performedBy: caller.id,
          });
        } catch (stockErr) {
          await this.repository.updateByRecordId(voucherId, {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: caller.id,
            cancelReason:
              'Automatic rollback after stock synchronization failure.',
          });
          throw stockErr;
        }

        const syncedVoucher = await this.repository.updateByRecordId(
          voucherId,
          {
            stockSync: {
              applied: true,
              appliedRevision: 1,
              appliedLines: desiredAppliedLines,
              lastSyncedAt: new Date(),
            },
          },
        );

        await this.syncProjectsQuietly([projectRef.projectRecordId], 'created');

        return {
          voucher: this.toSafePurchaseVoucher(syncedVoucher || createdVoucher),
          created: true,
        };
      } catch (err) {
        for (const att of savedAttachments) {
          await this.billStorage.deleteBillFile(att.storageKey);
        }
        throw err;
      }
    });
  }

  async updatePurchaseVoucher(
    identifier: string,
    rawBody: unknown,
    uploadedFiles: UploadedBillInputFile[],
    caller: PurchaseCallerIdentity,
  ): Promise<PurchaseVoucherResponseDto> {
    const validation = validateUpdatePurchaseVoucherDto(
      rawBody,
      uploadedFiles.length > 0,
    );
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Validation failed.';
      throw new PurchaseValidationError(
        validation.errors || { body: 'Invalid update payload.' },
        firstError,
      );
    }

    const existingInitial =
      await this.repository.findByIdOrVoucherNumber(identifier);
    if (!existingInitial || !existingInitial._id) {
      throw new PurchaseNotFoundError();
    }

    const recordId = String(existingInitial._id);

    return withSerializedKey(`voucher:${recordId}`, async () => {
      const existing = await this.repository.findByIdOrVoucherNumber(recordId);
      if (!existing || !existing._id) {
        throw new PurchaseNotFoundError();
      }

      if (existing.status === 'cancelled') {
        throw new PurchaseConflictError(
          `Voucher ${existing.voucherNumber} has been cancelled and cannot be edited.`,
        );
      }

      const dto: UpdatePurchaseVoucherDto = validation.value!;
      const nextSupplierName =
        dto.supplierName !== undefined
          ? dto.supplierName
          : existing.supplierName;
      const nextInvoiceNumber =
        dto.supplierInvoiceNumber !== undefined
          ? dto.supplierInvoiceNumber
          : existing.supplierInvoiceNumber;

      const normalizedSupplierName = normalizePurchaseKey(nextSupplierName);
      const normalizedInvoiceNumber = normalizePurchaseKey(nextInvoiceNumber);

      if (normalizedInvoiceNumber) {
        const duplicate = await this.repository.findActiveBySupplierInvoice(
          normalizedSupplierName,
          normalizedInvoiceNumber,
          recordId,
        );
        if (duplicate) {
          throw new DuplicateSupplierInvoiceError(
            nextSupplierName,
            nextInvoiceNumber,
            duplicate.voucherNumber,
          );
        }
      }

      const removeSet = new Set(dto.removeAttachmentIds || []);
      const retainedAttachments = (existing.attachments || []).filter(
        (att) => !removeSet.has(att.attachmentId),
      );
      const removedAttachments = (existing.attachments || []).filter((att) =>
        removeSet.has(att.attachmentId),
      );

      if (retainedAttachments.length + uploadedFiles.length > 5) {
        throw new PurchaseValidationError(
          { attachments: 'Total attached bill files cannot exceed 5.' },
          'Total attached bill files cannot exceed 5.',
        );
      }

      let projectRef = {
        projectRecordId: existing.projectRecordId,
        projectCode: existing.projectCode,
        projectName: existing.projectName,
      };
      if (dto.projectId !== undefined) {
        projectRef = await this.resolveAndValidateProject(
          dto.projectId,
          existing.projectRecordId,
        );
      } else if (existing.projectRecordId) {
        const currentProj = await this.projectRepository.findByIdOrCode(
          existing.projectRecordId,
        );
        if (
          currentProj &&
          currentProj.status === 'Completed' &&
          (dto.lineItems !== undefined ||
            dto.discountAmount !== undefined ||
            dto.taxAmount !== undefined ||
            dto.otherCharges !== undefined)
        ) {
          throw new PurchaseConflictError(
            `Project '${currentProj.projectId}' is marked Completed. Reopen the project before modifying financial amounts on linked voucher ${existing.voucherNumber}.`,
          );
        }
      }

      let nextLineItems = existing.lineItems;
      let nextSubtotal = existing.subtotal;

      if (dto.lineItems !== undefined) {
        const previousMaterialIds = new Set(
          existing.lineItems.map((li) => li.materialId),
        );
        const resolved = await this.resolveAndCalculateLineItems(
          dto.lineItems,
          previousMaterialIds,
        );
        nextLineItems = resolved.lineItems;
        nextSubtotal = resolved.subtotal;
      }

      const nextDiscount =
        dto.discountAmount !== undefined
          ? dto.discountAmount
          : existing.discountAmount;
      const nextTax =
        dto.taxAmount !== undefined ? dto.taxAmount : existing.taxAmount;
      const nextOtherCharges =
        dto.otherCharges !== undefined
          ? dto.otherCharges
          : existing.otherCharges;

      const nextFinalTotal = this.computeFinalTotal(
        nextSubtotal,
        nextDiscount,
        nextTax,
        nextOtherCharges,
      );

      const actorName = caller.name || caller.email || caller.id;
      const newSavedAttachments: IPurchaseBillAttachment[] = [];

      try {
        for (const file of uploadedFiles) {
          const saved = await this.billStorage.saveBillFile(file);
          newSavedAttachments.push({
            ...saved,
            uploadedBy: caller.id,
            uploadedByName: actorName,
            uploadedAt: new Date(),
          });
        }

        const nextRevision = (existing.revision || 1) + 1;
        const previousAppliedLines = existing.stockSync?.applied
          ? existing.stockSync.appliedLines
          : [];
        const desiredAppliedLines = aggregateStockByMaterial(nextLineItems);

        await this.applyStockTransition({
          voucherId: recordId,
          voucherNumber: existing.voucherNumber,
          revision: nextRevision,
          movementType: 'purchase_revised',
          previousAppliedLines,
          desiredAppliedLines,
          performedBy: caller.id,
        });

        try {
          const combinedAttachments = [
            ...retainedAttachments,
            ...newSavedAttachments,
          ];

          const updated = await this.repository.updateByRecordId(recordId, {
            purchaseDate:
              dto.purchaseDate !== undefined
                ? dto.purchaseDate
                : existing.purchaseDate,
            supplierName: nextSupplierName,
            normalizedSupplierName,
            supplierInvoiceNumber: nextInvoiceNumber,
            normalizedInvoiceNumber,
            projectRecordId: projectRef.projectRecordId,
            projectCode: projectRef.projectCode,
            projectName: projectRef.projectName,
            entryMethod:
              dto.entryMethod !== undefined
                ? dto.entryMethod
                : existing.entryMethod,
            lineItems: nextLineItems,
            subtotal: nextSubtotal,
            discountAmount: nextDiscount,
            taxAmount: nextTax,
            otherCharges: nextOtherCharges,
            finalTotal: nextFinalTotal,
            notes: dto.notes !== undefined ? dto.notes : existing.notes,
            attachments: combinedAttachments,
            revision: nextRevision,
            stockSync: {
              applied: true,
              appliedRevision: nextRevision,
              appliedLines: desiredAppliedLines,
              lastSyncedAt: new Date(),
            },
            updatedBy: caller.id,
            updatedByName: actorName,
          });

          if (!updated) {
            throw new PurchaseNotFoundError();
          }

          for (const removed of removedAttachments) {
            await this.billStorage.deleteBillFile(removed.storageKey);
          }

          await this.syncProjectsQuietly(
            [existing.projectRecordId, projectRef.projectRecordId],
            'updated',
          );

          return this.toSafePurchaseVoucher(updated);
        } catch (persistErr) {
          await this.rollbackStockTransition({
            previousAppliedLines,
            desiredAppliedLines,
          });

          if (persistErr instanceof DuplicatePurchaseVoucherError) {
            throw new DuplicateSupplierInvoiceError(
              nextSupplierName,
              nextInvoiceNumber,
            );
          }
          throw persistErr;
        }
      } catch (err) {
        for (const att of newSavedAttachments) {
          await this.billStorage.deleteBillFile(att.storageKey);
        }
        throw err;
      }
    });
  }

  async cancelPurchaseVoucher(
    identifier: string,
    cancelReasonRaw: unknown,
    caller: PurchaseCallerIdentity,
  ): Promise<PurchaseVoucherResponseDto> {
    const existingInitial =
      await this.repository.findByIdOrVoucherNumber(identifier);
    if (!existingInitial || !existingInitial._id) {
      throw new PurchaseNotFoundError();
    }

    const recordId = String(existingInitial._id);
    const cancelReason =
      typeof cancelReasonRaw === 'string' && cancelReasonRaw.trim()
        ? cancelReasonRaw.trim().slice(0, 500)
        : null;

    return withSerializedKey(`voucher:${recordId}`, async () => {
      const existing = await this.repository.findByIdOrVoucherNumber(recordId);
      if (!existing || !existing._id) {
        throw new PurchaseNotFoundError();
      }

      if (existing.status === 'cancelled') {
        throw new PurchaseConflictError(
          `Voucher ${existing.voucherNumber} is already cancelled.`,
        );
      }

      if (existing.projectRecordId) {
        const linkedProject = await this.projectRepository.findByIdOrCode(
          existing.projectRecordId,
        );
        if (linkedProject && linkedProject.status === 'Completed') {
          throw new PurchaseConflictError(
            `Project '${linkedProject.projectId}' is marked Completed. Reopen the project before cancelling linked purchase voucher ${existing.voucherNumber}.`,
          );
        }
      }

      const nextRevision = (existing.revision || 1) + 1;
      const previousAppliedLines = existing.stockSync?.applied
        ? existing.stockSync.appliedLines
        : [];

      await this.applyStockTransition({
        voucherId: recordId,
        voucherNumber: existing.voucherNumber,
        revision: nextRevision,
        movementType: 'purchase_cancelled',
        previousAppliedLines,
        desiredAppliedLines: [],
        performedBy: caller.id,
      });

      const actorName = caller.name || caller.email || caller.id;

      try {
        const cancelled = await this.repository.updateByRecordId(recordId, {
          status: 'cancelled',
          revision: nextRevision,
          stockSync: {
            applied: false,
            appliedRevision: nextRevision,
            appliedLines: [],
            lastSyncedAt: new Date(),
          },
          cancelledAt: new Date(),
          cancelledBy: caller.id,
          cancelReason,
          updatedBy: caller.id,
          updatedByName: actorName,
        });

        if (!cancelled) {
          throw new PurchaseNotFoundError();
        }

        await this.syncProjectsQuietly([existing.projectRecordId], 'deleted');

        return this.toSafePurchaseVoucher(cancelled);
      } catch (err) {
        await this.rollbackStockTransition({
          previousAppliedLines,
          desiredAppliedLines: [],
        });
        throw err;
      }
    });
  }

  async getPurchaseVoucherById(identifier: string): Promise<{
    voucher: PurchaseVoucherResponseDto;
    stockMovements: PurchaseStockMovementResponseDto[];
  }> {
    const voucher = await this.repository.findByIdOrVoucherNumber(identifier);
    if (!voucher || !voucher._id) {
      throw new PurchaseNotFoundError();
    }

    const movements = await this.repository.listStockMovementsForVoucher(
      String(voucher._id),
    );

    return {
      voucher: this.toSafePurchaseVoucher(voucher),
      stockMovements: movements.map((m) => ({
        id: String(m._id || m.idempotencyKey),
        voucherId: m.voucherId,
        voucherNumber: m.voucherNumber,
        revision: m.revision,
        movementType: m.movementType,
        materialId: m.materialId,
        materialName: m.materialName,
        unit: m.unit,
        quantityDelta: roundPurchaseQuantity(m.quantityDelta),
        resultingQuantityOnHand: roundPurchaseQuantity(
          m.resultingQuantityOnHand,
        ),
        performedBy: m.performedBy,
        createdAt: m.createdAt,
      })),
    };
  }

  async listPurchaseVouchers(rawQuery: Record<string, unknown>): Promise<
    PaginatedResult<PurchaseVoucherResponseDto> & {
      vouchers: PurchaseVoucherResponseDto[];
      summary: PurchaseVoucherListSummary;
      storageInfo: {
        provider: BillStorageProvider;
        persistentExternalConfigured: boolean;
      };
    }
  > {
    const validation = validateListPurchaseVouchersDto(rawQuery);
    if (!validation.isValid || !validation.value) {
      const firstError = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Invalid query parameters.';
      throw new PurchaseValidationError(
        validation.errors || { query: 'Invalid query parameters.' },
        firstError,
      );
    }

    const query: ListPurchaseVouchersDto = validation.value;
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

    const mapped = result.items.map((v) => this.toSafePurchaseVoucher(v));

    return {
      items: mapped,
      vouchers: mapped,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      summary,
      storageInfo: {
        provider: this.billStorage.getProviderName(),
        persistentExternalConfigured:
          this.billStorage.isPersistentExternalStorage(),
      },
    };
  }

  async openVoucherAttachment(
    identifier: string,
    attachmentId: string,
  ): Promise<{
    attachment: IPurchaseBillAttachment;
    buffer: Buffer;
  }> {
    const voucher = await this.repository.findByIdOrVoucherNumber(identifier);
    if (!voucher) {
      throw new PurchaseNotFoundError();
    }

    const cleanAttId = String(attachmentId || '').trim();
    const attachment = (voucher.attachments || []).find(
      (att) => att.attachmentId === cleanAttId,
    );
    if (!attachment) {
      throw new PurchaseNotFoundError(
        'Requested bill attachment was not found.',
      );
    }

    try {
      const { buffer } = await this.billStorage.readBillBuffer(
        attachment.storageKey,
      );
      return { attachment, buffer };
    } catch (err) {
      if (err instanceof BillAttachmentNotFoundError) {
        throw new PurchaseNotFoundError(err.message);
      }
      throw new PurchaseNotFoundError(
        'Bill attachment file could not be read from storage.',
      );
    }
  }
}
