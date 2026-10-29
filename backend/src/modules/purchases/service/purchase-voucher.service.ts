import {
  ExpenseHeadsRepository,
  IExpenseHead,
  IExpenseHeadsRepository,
  isValidExpenseHeadObjectId,
} from '../../expense-heads';
import {
  IProjectRepository,
  IProjectService,
  IVoucherTotalsProvider,
  ProjectVoucherAggregationTotals,
  VoucherMutationEvent,
} from '../../projects';
import {
  DuplicateRawMaterialKeyError,
  InsufficientRawMaterialStockError,
  IRawMaterial,
  IRawMaterialsRepository,
  isValidRawMaterialObjectId,
  RawMaterialNotFoundError,
  RawMaterialUnitConflictError,
  RawMaterialsService,
} from '../../raw-materials';
import {
  normalizeMaterialDisplayName,
  normalizeMaterialNameKey,
  RawMaterialUnit,
} from '../../raw-materials/models/raw-material.model';
import {
  roundPurchaseMoney,
  roundPurchasePercentage,
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
  IBillAttachmentStorage,
  IPurchaseAppliedStockLine,
  IPurchaseBillAttachment,
  IPurchaseLineItem,
  IPurchasePrintedInvoiceSummary,
  IPurchaseVoucher,
  IPurchaseVoucherRepository,
  ListPurchaseVouchersDto,
  PaginatedResult,
  PurchaseBillAttachmentResponseDto,
  PurchaseCallerIdentity,
  PurchaseInlineNewMaterialDto,
  PurchaseLineItemInputDto,
  PurchaseLineItemType,
  PurchaseStockMovementResponseDto,
  PurchaseStockMovementType,
  PurchaseTaxMode,
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
  public readonly errors?: Record<string, string>;

  constructor(message: string, errors?: Record<string, string>) {
    super(message);
    this.name = 'PurchaseConflictError';
    if (errors && Object.keys(errors).length > 0) {
      this.errors = errors;
    }
  }
}

type PreparedPurchaseLine =
  | {
      kind: 'existing_material';
      index: number;
      lineItem: IPurchaseLineItem;
    }
  | {
      kind: 'new_material';
      index: number;
      nameKey: string;
      spec: PurchaseInlineNewMaterialDto;
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      taxRate: number | null;
      remarks: string;
    }
  | {
      kind: 'expense';
      index: number;
      lineItem: IPurchaseLineItem;
    };

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

export interface ComputedPurchaseVoucherFinancials {
  materialSubtotal: number;
  expenseSubtotal: number;
  subtotal: number;
  discountAmount: number;
  taxableSubtotal: number;
  taxMode: PurchaseTaxMode;
  taxRatePercent: number | null;
  taxAmount: number;
  otherCharges: number;
  finalTotal: number;
  materialAllocatedTotal: number;
  expenseAllocatedTotal: number;
}

export function computePurchaseVoucherFinancials(params: {
  lines: ReadonlyArray<{
    itemType: PurchaseLineItemType;
    lineTotal: number;
    taxRate?: number | null;
  }>;
  discountAmount: number;
  taxMode: PurchaseTaxMode;
  taxRatePercent: number | null;
  taxAmount: number;
  otherCharges: number;
}): ComputedPurchaseVoucherFinancials {
  let materialSubtotal = 0;
  let expenseSubtotal = 0;

  for (const line of params.lines) {
    const cleanLineTotal = roundPurchaseMoney(line.lineTotal);
    if (line.itemType === 'expense') {
      expenseSubtotal = roundPurchaseMoney(expenseSubtotal + cleanLineTotal);
    } else {
      materialSubtotal = roundPurchaseMoney(materialSubtotal + cleanLineTotal);
    }
  }

  const subtotal = roundPurchaseMoney(materialSubtotal + expenseSubtotal);
  const discountAmount = roundPurchaseMoney(params.discountAmount || 0);
  const otherCharges = roundPurchaseMoney(params.otherCharges || 0);

  if (discountAmount > subtotal) {
    throw new PurchaseValidationError(
      {
        discountAmount:
          'Discount amount cannot exceed the voucher line items subtotal.',
      },
      'Discount amount cannot exceed the voucher line items subtotal.',
    );
  }

  const taxableSubtotal = roundPurchaseMoney(
    Math.max(0, subtotal - discountAmount),
  );

  let resolvedTaxMode: PurchaseTaxMode =
    params.taxMode === 'percentage' ? 'percentage' : 'bill_amount';
  let resolvedTaxRatePercent: number | null = null;
  let resolvedTaxAmount = 0;

  if (resolvedTaxMode === 'percentage') {
    if (
      params.taxRatePercent === null ||
      params.taxRatePercent === undefined ||
      !Number.isFinite(params.taxRatePercent) ||
      params.taxRatePercent < 0 ||
      params.taxRatePercent > 100
    ) {
      throw new PurchaseValidationError(
        {
          taxRatePercent:
            'Enter a valid tax percentage between 0% and 100%.',
        },
        'Enter a valid tax percentage between 0% and 100%.',
      );
    }
    resolvedTaxRatePercent = roundPurchasePercentage(params.taxRatePercent);
    resolvedTaxAmount = roundPurchaseMoney(
      (taxableSubtotal * resolvedTaxRatePercent) / 100,
    );
  } else {
    resolvedTaxMode = 'bill_amount';
    resolvedTaxAmount = roundPurchaseMoney(params.taxAmount || 0);
    resolvedTaxRatePercent =
      params.taxRatePercent !== null &&
      params.taxRatePercent !== undefined &&
      Number.isFinite(params.taxRatePercent)
        ? roundPurchasePercentage(params.taxRatePercent)
        : null;
  }

  const finalTotal = roundPurchaseMoney(
    taxableSubtotal + resolvedTaxAmount + otherCharges,
  );
  if (finalTotal < 0) {
    throw new PurchaseValidationError(
      { finalTotal: 'Final voucher total cannot be negative.' },
      'Final voucher total cannot be negative.',
    );
  }

  let materialAllocatedTotal = 0;
  let expenseAllocatedTotal = 0;

  if (expenseSubtotal <= 0) {
    materialAllocatedTotal = finalTotal;
    expenseAllocatedTotal = 0;
  } else if (materialSubtotal <= 0) {
    materialAllocatedTotal = 0;
    expenseAllocatedTotal = finalTotal;
  } else if (subtotal > 0) {
    const materialShare = materialSubtotal / subtotal;
    const discountMat = discountAmount * materialShare;
    const otherChargesMat = otherCharges * materialShare;

    const allLinesCarryTaxRate =
      params.lines.length > 0 &&
      params.lines.every(
        (l) =>
          typeof l.taxRate === 'number' &&
          Number.isFinite(l.taxRate) &&
          l.taxRate >= 0,
      );

    let taxMat = resolvedTaxAmount * materialShare;
    if (allLinesCarryTaxRate && resolvedTaxAmount > 0) {
      const postDiscountFactor =
        subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0;
      let theoreticalMatTax = 0;
      let theoreticalExpTax = 0;
      for (const l of params.lines) {
        const rate = Number(l.taxRate || 0);
        const lineTax = l.lineTotal * postDiscountFactor * (rate / 100);
        if (l.itemType === 'expense') {
          theoreticalExpTax += lineTax;
        } else {
          theoreticalMatTax += lineTax;
        }
      }
      const theoreticalSum = theoreticalMatTax + theoreticalExpTax;
      if (theoreticalSum > 0) {
        taxMat = resolvedTaxAmount * (theoreticalMatTax / theoreticalSum);
      }
    }

    const rawMatAlloc = roundPurchaseMoney(
      materialSubtotal - discountMat + taxMat + otherChargesMat,
    );
    materialAllocatedTotal = Math.min(finalTotal, Math.max(0, rawMatAlloc));
    expenseAllocatedTotal = roundPurchaseMoney(
      finalTotal - materialAllocatedTotal,
    );
  }

  return {
    materialSubtotal,
    expenseSubtotal,
    subtotal,
    discountAmount,
    taxableSubtotal,
    taxMode: resolvedTaxMode,
    taxRatePercent: resolvedTaxRatePercent,
    taxAmount: resolvedTaxAmount,
    otherCharges,
    finalTotal,
    materialAllocatedTotal,
    expenseAllocatedTotal,
  };
}

export function computePrintedInvoiceWarnings(
  financials: {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    otherCharges: number;
    finalTotal: number;
  },
  printed: IPurchasePrintedInvoiceSummary | null | undefined,
  tolerance = 0.5,
): string[] {
  if (!printed) {
    return [];
  }
  const warnings: string[] = [];

  if (
    typeof printed.printedSubtotal === 'number' &&
    Math.abs(financials.subtotal - printed.printedSubtotal) > tolerance
  ) {
    warnings.push(
      `Calculated items subtotal (₹${financials.subtotal.toFixed(2)}) differs from printed bill subtotal (₹${printed.printedSubtotal.toFixed(2)}).`,
    );
  }

  if (
    typeof printed.printedDiscountAmount === 'number' &&
    Math.abs(financials.discountAmount - printed.printedDiscountAmount) >
      tolerance
  ) {
    warnings.push(
      `Voucher discount (₹${financials.discountAmount.toFixed(2)}) differs from printed bill discount (₹${printed.printedDiscountAmount.toFixed(2)}).`,
    );
  }

  if (
    typeof printed.printedTaxAmount === 'number' &&
    Math.abs(financials.taxAmount - printed.printedTaxAmount) > tolerance
  ) {
    warnings.push(
      `Voucher GST/tax (₹${financials.taxAmount.toFixed(2)}) differs from printed bill tax (₹${printed.printedTaxAmount.toFixed(2)}).`,
    );
  }

  if (
    typeof printed.printedOtherCharges === 'number' &&
    Math.abs(financials.otherCharges - printed.printedOtherCharges) > tolerance
  ) {
    warnings.push(
      `Voucher other charges (₹${financials.otherCharges.toFixed(2)}) differs from printed bill charges (₹${printed.printedOtherCharges.toFixed(2)}).`,
    );
  }

  if (
    typeof printed.printedGrandTotal === 'number' &&
    Math.abs(financials.finalTotal - printed.printedGrandTotal) > tolerance
  ) {
    warnings.push(
      `Calculated final total (₹${financials.finalTotal.toFixed(2)}) differs from printed bill grand total (₹${printed.printedGrandTotal.toFixed(2)}).`,
    );
  }

  return warnings;
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

export function aggregateStockByMaterial(
  lines: IPurchaseLineItem[],
): IPurchaseAppliedStockLine[] {
  const byMaterial = new Map<string, IPurchaseAppliedStockLine>();

  for (const line of lines) {
    const itemType = line.itemType || 'material';
    if (itemType !== 'material' || !line.materialId || !line.quantity) {
      continue;
    }

    const existing = byMaterial.get(line.materialId);
    if (existing) {
      existing.quantity = roundPurchaseQuantity(
        existing.quantity + line.quantity,
      );
    } else {
      byMaterial.set(line.materialId, {
        materialId: line.materialId,
        materialName: line.materialName,
        unit: line.unit as RawMaterialUnit,
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

    const matAmount =
      typeof purchases.materialAmount === 'number'
        ? purchases.materialAmount
        : purchases.totalAmount;
    const expAmount =
      typeof purchases.expenseAmount === 'number' ? purchases.expenseAmount : 0;

    return {
      totalPurchases: roundPurchaseMoney(
        matAmount + (delegated.totalPurchases || 0),
      ),
      totalOtherExpenses: roundPurchaseMoney(
        expAmount + (delegated.totalOtherExpenses || 0),
      ),
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
    private readonly expenseHeadsRepository: IExpenseHeadsRepository = new ExpenseHeadsRepository(),
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

    const normalizedLines: IPurchaseLineItem[] = (voucher.lineItems || []).map(
      (item) => {
        const itemType: PurchaseLineItemType =
          item.itemType === 'expense' ? 'expense' : 'material';
        return {
          itemType,
          materialId: item.materialId || null,
          materialName: item.materialName || '',
          materialCategory: item.materialCategory || null,
          expenseHeadId: item.expenseHeadId || null,
          expenseHeadName: item.expenseHeadName || '',
          expenseHeadCategory: item.expenseHeadCategory || null,
          description: item.description || '',
          unit: item.unit || null,
          quantity:
            item.quantity !== null && item.quantity !== undefined
              ? roundPurchaseQuantity(item.quantity)
              : null,
          unitPrice:
            item.unitPrice !== null && item.unitPrice !== undefined
              ? roundPurchaseMoney(item.unitPrice)
              : null,
          lineTotal: roundPurchaseMoney(item.lineTotal),
          taxRate:
            item.taxRate !== null && item.taxRate !== undefined
              ? roundPurchasePercentage(item.taxRate)
              : null,
          remarks: item.remarks || '',
        };
      },
    );

    const computedMaterialSub = roundPurchaseMoney(
      normalizedLines
        .filter((l) => l.itemType === 'material')
        .reduce((acc, l) => acc + l.lineTotal, 0),
    );
    const computedExpenseSub = roundPurchaseMoney(
      normalizedLines
        .filter((l) => l.itemType === 'expense')
        .reduce((acc, l) => acc + l.lineTotal, 0),
    );

    const subtotal = roundPurchaseMoney(voucher.subtotal);
    const discountAmount = roundPurchaseMoney(voucher.discountAmount);
    const taxAmount = roundPurchaseMoney(voucher.taxAmount);
    const otherCharges = roundPurchaseMoney(voucher.otherCharges);
    const finalTotal = roundPurchaseMoney(voucher.finalTotal);
    const materialSubtotal =
      typeof voucher.materialSubtotal === 'number'
        ? roundPurchaseMoney(voucher.materialSubtotal)
        : computedMaterialSub;
    const expenseSubtotal =
      typeof voucher.expenseSubtotal === 'number'
        ? roundPurchaseMoney(voucher.expenseSubtotal)
        : computedExpenseSub;
    const taxableSubtotal =
      typeof voucher.taxableSubtotal === 'number'
        ? roundPurchaseMoney(voucher.taxableSubtotal)
        : roundPurchaseMoney(Math.max(0, subtotal - discountAmount));
    const taxMode: PurchaseTaxMode =
      voucher.taxMode === 'percentage' ? 'percentage' : 'bill_amount';
    const taxRatePercent =
      voucher.taxRatePercent !== null && voucher.taxRatePercent !== undefined
        ? roundPurchasePercentage(voucher.taxRatePercent)
        : null;

    const materialAllocatedTotal =
      typeof voucher.materialAllocatedTotal === 'number'
        ? roundPurchaseMoney(voucher.materialAllocatedTotal)
        : expenseSubtotal <= 0
          ? finalTotal
          : 0;
    const expenseAllocatedTotal =
      typeof voucher.expenseAllocatedTotal === 'number'
        ? roundPurchaseMoney(voucher.expenseAllocatedTotal)
        : roundPurchaseMoney(finalTotal - materialAllocatedTotal);

    const printedInvoiceSummary = voucher.printedInvoiceSummary || null;
    const reconciliationWarnings = computePrintedInvoiceWarnings(
      {
        subtotal,
        discountAmount,
        taxAmount,
        otherCharges,
        finalTotal,
      },
      printedInvoiceSummary,
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
      lineItems: normalizedLines,
      materialSubtotal,
      expenseSubtotal,
      subtotal,
      discountAmount,
      taxableSubtotal,
      taxMode,
      taxRatePercent,
      cgstAmount:
        voucher.cgstAmount !== null && voucher.cgstAmount !== undefined
          ? roundPurchaseMoney(voucher.cgstAmount)
          : null,
      sgstAmount:
        voucher.sgstAmount !== null && voucher.sgstAmount !== undefined
          ? roundPurchaseMoney(voucher.sgstAmount)
          : null,
      igstAmount:
        voucher.igstAmount !== null && voucher.igstAmount !== undefined
          ? roundPurchaseMoney(voucher.igstAmount)
          : null,
      taxAmount,
      otherCharges,
      finalTotal,
      materialAllocatedTotal,
      expenseAllocatedTotal,
      printedInvoiceSummary,
      reconciliationWarnings,
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

  private async prepareLineItemsBeforeSave(
    lineInputs: PurchaseLineItemInputDto[],
    previouslyIncludedMaterialIds: Set<string> = new Set(),
    previouslyIncludedExpenseHeadIds: Set<string> = new Set(),
  ): Promise<{
    preparedLines: PreparedPurchaseLine[];
    lineFinancialRefs: Array<{
      itemType: PurchaseLineItemType;
      lineTotal: number;
      taxRate: number | null;
    }>;
    newMaterialNameKeys: string[];
  }> {
    const fieldErrors: Record<string, string> = {};
    const conflictErrors: Record<string, string> = {};
    const materialCache = new Map<string, IRawMaterial>();
    const existingByNameCache = new Map<string, IRawMaterial>();
    const expenseHeadCache = new Map<string, IExpenseHead>();

    const uniqueMatIds = Array.from(
      new Set(
        lineInputs
          .map((item) =>
            item.itemType === 'material' && item.materialId
              ? item.materialId.trim()
              : '',
          )
          .filter((id) => isValidRawMaterialObjectId(id)),
      ),
    );
    const uniqueNewNameKeys = Array.from(
      new Set(
        lineInputs
          .map((item) =>
            item.itemType === 'material' && item.newMaterial?.name
              ? normalizeMaterialNameKey(item.newMaterial.name)
              : '',
          )
          .filter(Boolean),
      ),
    );
    const uniqueExpenseHeadIds = Array.from(
      new Set(
        lineInputs
          .map((item) =>
            item.itemType === 'expense' && item.expenseHeadId
              ? item.expenseHeadId.trim()
              : '',
          )
          .filter((id) => isValidExpenseHeadObjectId(id)),
      ),
    );

    await Promise.all([
      ...uniqueMatIds.map(async (matId) => {
        const found = await this.rawMaterialsRepository.findById(matId);
        if (found) {
          materialCache.set(matId, found);
        }
      }),
      ...uniqueNewNameKeys.map(async (nameKey) => {
        const found =
          await this.rawMaterialsRepository.findByNormalizedName(nameKey);
        if (found) {
          existingByNameCache.set(nameKey, found);
        }
      }),
      ...uniqueExpenseHeadIds.map(async (headId) => {
        const found = await this.expenseHeadsRepository.findById(headId);
        if (found) {
          expenseHeadCache.set(headId, found);
        }
      }),
    ]);

    const preparedLines: PreparedPurchaseLine[] = [];
    const lineFinancialRefs: Array<{
      itemType: PurchaseLineItemType;
      lineTotal: number;
      taxRate: number | null;
    }> = [];

    lineInputs.forEach((input, idx) => {
      const prefix = `lineItems[${idx}]`;

      if (input.itemType === 'expense') {
        const headId = input.expenseHeadId ? input.expenseHeadId.trim() : '';
        if (!isValidExpenseHeadObjectId(headId)) {
          fieldErrors[`${prefix}.expenseHeadId`] =
            `Line item #${idx + 1}: selected Expense Head does not exist.`;
          return;
        }

        const expenseHead = expenseHeadCache.get(headId);
        if (!expenseHead) {
          fieldErrors[`${prefix}.expenseHeadId`] =
            `Line item #${idx + 1}: selected Expense Head does not exist.`;
          return;
        }

        const canonicalHeadId = String(expenseHead._id);
        if (
          !expenseHead.isActive &&
          !previouslyIncludedExpenseHeadIds.has(canonicalHeadId)
        ) {
          fieldErrors[`${prefix}.expenseHeadId`] =
            `Line item #${idx + 1}: Expense Head '${expenseHead.name}' is inactive and cannot be added to new vouchers.`;
          return;
        }

        const hasQtyAndPrice =
          input.quantity !== null &&
          input.quantity !== undefined &&
          input.unitPrice !== null &&
          input.unitPrice !== undefined;

        const quantity =
          input.quantity !== null && input.quantity !== undefined
            ? roundPurchaseQuantity(input.quantity)
            : null;
        const unitPrice =
          input.unitPrice !== null && input.unitPrice !== undefined
            ? roundPurchaseMoney(input.unitPrice)
            : null;
        const lineTotal = hasQtyAndPrice
          ? roundPurchaseMoney((quantity as number) * (unitPrice as number))
          : roundPurchaseMoney(Number(input.amount || 0));

        if (lineTotal <= 0) {
          fieldErrors[`${prefix}.amount`] =
            `Line item #${idx + 1}: expense amount must be greater than zero.`;
          return;
        }

        const taxRate =
          input.taxRate !== null && input.taxRate !== undefined
            ? roundPurchasePercentage(input.taxRate)
            : null;

        lineFinancialRefs.push({
          itemType: 'expense',
          lineTotal,
          taxRate,
        });

        preparedLines.push({
          kind: 'expense',
          index: idx,
          lineItem: {
            itemType: 'expense',
            materialId: null,
            materialName: '',
            materialCategory: null,
            expenseHeadId: canonicalHeadId,
            expenseHeadName: expenseHead.name,
            expenseHeadCategory: expenseHead.category || 'General',
            description: input.description || expenseHead.name,
            unit: input.unit || null,
            quantity,
            unitPrice,
            lineTotal,
            taxRate,
            remarks: input.remarks || '',
          },
        });
        return;
      }

      const quantity = roundPurchaseQuantity(Number(input.quantity || 0));
      const unitPrice = roundPurchaseMoney(Number(input.unitPrice || 0));
      const lineTotal = roundPurchaseMoney(quantity * unitPrice);
      const taxRate =
        input.taxRate !== null && input.taxRate !== undefined
          ? roundPurchasePercentage(input.taxRate)
          : null;

      if (lineTotal <= 0) {
        fieldErrors[`${prefix}.lineTotal`] =
          `Line item #${idx + 1}: calculated line total must be greater than zero.`;
        return;
      }

      if (input.newMaterial && !input.materialId) {
        const cleanName = normalizeMaterialDisplayName(input.newMaterial.name);
        const nameKey = normalizeMaterialNameKey(cleanName);
        const existingMatch = existingByNameCache.get(nameKey);

        if (existingMatch) {
          const existingId = String(existingMatch._id);
          if (existingMatch.unit !== input.newMaterial.unit) {
            conflictErrors[`${prefix}.unit`] =
              `Line item #${idx + 1}: material '${existingMatch.name}' already exists with unit '${existingMatch.unit}', which conflicts with '${input.newMaterial.unit}'. Select the existing material or use a distinct material name.`;
            return;
          }
          if (
            !existingMatch.isActive &&
            !previouslyIncludedMaterialIds.has(existingId)
          ) {
            conflictErrors[`${prefix}.materialId`] =
              `Line item #${idx + 1}: an inactive raw material named '${existingMatch.name}' already exists. Reactivate it in Raw Materials or use a distinct material name.`;
            return;
          }
        }

        lineFinancialRefs.push({
          itemType: 'material',
          lineTotal,
          taxRate,
        });

        preparedLines.push({
          kind: 'new_material',
          index: idx,
          nameKey,
          spec: {
            name: cleanName,
            unit: input.newMaterial.unit,
            category: input.newMaterial.category ?? null,
            description: input.newMaterial.description || '',
          },
          description: input.description || cleanName,
          quantity,
          unitPrice,
          lineTotal,
          taxRate,
          remarks: input.remarks || '',
        });
        return;
      }

      const materialId = input.materialId ? input.materialId.trim() : '';
      const material = materialCache.get(materialId);

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

      lineFinancialRefs.push({
        itemType: 'material',
        lineTotal,
        taxRate,
      });

      preparedLines.push({
        kind: 'existing_material',
        index: idx,
        lineItem: {
          itemType: 'material',
          materialId: canonicalMaterialId,
          materialName: material.name,
          materialCategory: material.category || null,
          expenseHeadId: null,
          expenseHeadName: '',
          expenseHeadCategory: null,
          description: input.description || material.name,
          unit: material.unit,
          quantity,
          unitPrice,
          lineTotal,
          taxRate,
          remarks: input.remarks || '',
        },
      });
    });

    if (Object.keys(fieldErrors).length > 0) {
      const firstError = Object.values(fieldErrors)[0];
      throw new PurchaseValidationError(fieldErrors, firstError);
    }

    if (Object.keys(conflictErrors).length > 0) {
      const firstConflict = Object.values(conflictErrors)[0];
      throw new PurchaseConflictError(firstConflict, conflictErrors);
    }

    return {
      preparedLines,
      lineFinancialRefs,
      newMaterialNameKeys: uniqueNewNameKeys,
    };
  }

  private async cleanupNewlyCreatedMaterials(
    materialIds: Iterable<string>,
  ): Promise<void> {
    for (const id of materialIds) {
      try {
        await this.rawMaterialsRepository.deleteById(id);
      } catch {
        void 0;
      }
    }
  }

  private async materializePreparedLinesUnderNameLocks(
    preparedLines: PreparedPurchaseLine[],
    callerId: string,
    previouslyIncludedMaterialIds: Set<string> = new Set(),
  ): Promise<{
    lineItems: IPurchaseLineItem[];
    newlyCreatedMaterialIds: Set<string>;
  }> {
    const newlyCreatedMaterialIds = new Set<string>();
    const groupedNewSpecs = new Map<
      string,
      {
        firstIndex: number;
        spec: PurchaseInlineNewMaterialDto;
      }
    >();

    for (const entry of preparedLines) {
      if (entry.kind !== 'new_material') {
        continue;
      }
      if (!groupedNewSpecs.has(entry.nameKey)) {
        groupedNewSpecs.set(entry.nameKey, {
          firstIndex: entry.index,
          spec: entry.spec,
        });
      }
    }

    const resolvedNewByNameKey = new Map<string, IRawMaterial>();

    const validateMatchedExisting = (
      existingMat: IRawMaterial,
      spec: PurchaseInlineNewMaterialDto,
      firstIndex: number,
    ): IRawMaterial => {
      const prefix = `lineItems[${firstIndex}]`;
      const existingId = String(existingMat._id);

      if (existingMat.unit !== spec.unit) {
        const msg = `Line item #${firstIndex + 1}: material '${existingMat.name}' already exists with unit '${existingMat.unit}', which conflicts with '${spec.unit}'. Select the existing material or use a distinct material name.`;
        throw new PurchaseConflictError(msg, { [`${prefix}.unit`]: msg });
      }

      if (
        !existingMat.isActive &&
        !previouslyIncludedMaterialIds.has(existingId)
      ) {
        const msg = `Line item #${firstIndex + 1}: an inactive raw material named '${existingMat.name}' already exists. Reactivate it in Raw Materials or use a distinct material name.`;
        throw new PurchaseConflictError(msg, { [`${prefix}.materialId`]: msg });
      }

      return existingMat;
    };

    try {
      for (const [nameKey, group] of groupedNewSpecs.entries()) {
        const existingMat =
          await this.rawMaterialsRepository.findByNormalizedName(nameKey);
        if (existingMat) {
          resolvedNewByNameKey.set(
            nameKey,
            validateMatchedExisting(existingMat, group.spec, group.firstIndex),
          );
          continue;
        }

        try {
          const created = await this.rawMaterialsRepository.create({
            name: group.spec.name,
            normalizedName: nameKey,
            category: group.spec.category ?? null,
            unit: group.spec.unit,
            quantityOnHand: 0,
            description: group.spec.description || '',
            isActive: true,
            createdBy: callerId,
          });
          const createdId = String(created._id);
          newlyCreatedMaterialIds.add(createdId);
          resolvedNewByNameKey.set(nameKey, created);
        } catch (err) {
          if (err instanceof DuplicateRawMaterialKeyError) {
            const raced =
              await this.rawMaterialsRepository.findByNormalizedName(nameKey);
            if (raced) {
              resolvedNewByNameKey.set(
                nameKey,
                validateMatchedExisting(raced, group.spec, group.firstIndex),
              );
              continue;
            }
          }
          throw err;
        }
      }

      const lineItems: IPurchaseLineItem[] = preparedLines.map((entry) => {
        if (entry.kind === 'existing_material' || entry.kind === 'expense') {
          return entry.lineItem;
        }
        const resolved = resolvedNewByNameKey.get(entry.nameKey);
        if (!resolved || !resolved._id) {
          throw new Error('Failed to resolve newly created raw material.');
        }
        return {
          itemType: 'material',
          materialId: String(resolved._id),
          materialName: resolved.name,
          materialCategory: resolved.category || null,
          expenseHeadId: null,
          expenseHeadName: '',
          expenseHeadCategory: null,
          description: entry.description || resolved.name,
          unit: resolved.unit,
          quantity: entry.quantity,
          unitPrice: entry.unitPrice,
          lineTotal: entry.lineTotal,
          taxRate: entry.taxRate,
          remarks: entry.remarks,
        };
      });

      return { lineItems, newlyCreatedMaterialIds };
    } catch (err) {
      await this.cleanupNewlyCreatedMaterials(newlyCreatedMaterialIds);
      throw err;
    }
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

          await this.repository
            .deleteStockMovementsForVoucherRevision(
              params.voucherId,
              params.revision,
            )
            .catch(() => undefined);

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
    skipMaterialIds?: ReadonlySet<string>;
    voucherId?: string;
    revision?: number;
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
    )
      .filter((id) => !params.skipMaterialIds?.has(id))
      .sort();

    if (allMaterialIds.length > 0) {
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

    if (params.voucherId && params.revision !== undefined) {
      await this.repository
        .deleteStockMovementsForVoucherRevision(
          params.voucherId,
          params.revision,
        )
        .catch(() => undefined);
    }
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

      const [projectRef, prepared] = await Promise.all([
        this.resolveAndValidateProject(dto.projectId),
        this.prepareLineItemsBeforeSave(dto.lineItems),
      ]);

      const financials = computePurchaseVoucherFinancials({
        lines: prepared.lineFinancialRefs,
        discountAmount: dto.discountAmount,
        taxMode: dto.taxMode,
        taxRatePercent: dto.taxRatePercent,
        taxAmount: dto.taxAmount,
        otherCharges: dto.otherCharges,
      });

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

        const persistedResult =
          await this.rawMaterialsService.withMaterialNameLocks(
            prepared.newMaterialNameKeys,
            async () => {
              const materialized =
                await this.materializePreparedLinesUnderNameLocks(
                  prepared.preparedLines,
                  caller.id,
                );

              let createdVoucher: IPurchaseVoucher | null = null;
              let stockApplied = false;
              let desiredAppliedLines: IPurchaseAppliedStockLine[] = [];

              try {
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
                        savedAttachments.length > 0 &&
                        dto.entryMethod === 'upload_bill'
                          ? 'upload_bill'
                          : dto.entryMethod,
                      lineItems: materialized.lineItems,
                      materialSubtotal: financials.materialSubtotal,
                      expenseSubtotal: financials.expenseSubtotal,
                      subtotal: financials.subtotal,
                      discountAmount: financials.discountAmount,
                      taxableSubtotal: financials.taxableSubtotal,
                      taxMode: financials.taxMode,
                      taxRatePercent: financials.taxRatePercent,
                      cgstAmount:
                        financials.taxMode === 'bill_amount'
                          ? dto.cgstAmount
                          : null,
                      sgstAmount:
                        financials.taxMode === 'bill_amount'
                          ? dto.sgstAmount
                          : null,
                      igstAmount:
                        financials.taxMode === 'bill_amount'
                          ? dto.igstAmount
                          : null,
                      taxAmount: financials.taxAmount,
                      otherCharges: financials.otherCharges,
                      finalTotal: financials.finalTotal,
                      materialAllocatedTotal: financials.materialAllocatedTotal,
                      expenseAllocatedTotal: financials.expenseAllocatedTotal,
                      printedInvoiceSummary: dto.printedInvoiceSummary,
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
                        const replayed =
                          await this.repository.findByClientRequestId(
                            dto.clientRequestId,
                          );
                        if (replayed) {
                          await this.cleanupNewlyCreatedMaterials(
                            materialized.newlyCreatedMaterialIds,
                          );
                          for (const att of savedAttachments) {
                            await this.billStorage.deleteBillFile(
                              att.storageKey,
                            );
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
                desiredAppliedLines = aggregateStockByMaterial(
                  materialized.lineItems,
                );

                await this.applyStockTransition({
                  voucherId,
                  voucherNumber: createdVoucher.voucherNumber,
                  revision: 1,
                  movementType: 'purchase_created',
                  previousAppliedLines: [],
                  desiredAppliedLines,
                  performedBy: caller.id,
                });
                stockApplied = true;

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

                if (!syncedVoucher) {
                  throw new Error(
                    'Failed to finalize purchase voucher stock sync state.',
                  );
                }

                return {
                  voucher: this.toSafePurchaseVoucher(syncedVoucher),
                  created: true,
                };
              } catch (innerErr) {
                if (createdVoucher && createdVoucher._id) {
                  const failedVoucherId = String(createdVoucher._id);
                  if (stockApplied) {
                    await this.rollbackStockTransition({
                      previousAppliedLines: [],
                      desiredAppliedLines,
                      voucherId: failedVoucherId,
                      revision: 1,
                    });
                  } else {
                    await this.repository
                      .deleteStockMovementsForVoucherRevision(
                        failedVoucherId,
                        1,
                      )
                      .catch(() => undefined);
                  }

                  const deleted = await this.repository
                    .deleteByRecordId(failedVoucherId)
                    .catch(() => false);
                  if (!deleted) {
                    await this.repository
                      .updateByRecordId(failedVoucherId, {
                        status: 'cancelled',
                        cancelledAt: new Date(),
                        cancelledBy: caller.id,
                        cancelReason:
                          'Automatic rollback after stock synchronization failure.',
                      })
                      .catch(() => undefined);
                  }
                }

                await this.cleanupNewlyCreatedMaterials(
                  materialized.newlyCreatedMaterialIds,
                );
                throw innerErr;
              }
            },
          );

        if (persistedResult.created) {
          await this.syncProjectsQuietly(
            [projectRef.projectRecordId],
            'created',
          );
        }

        return persistedResult;
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

      const hasFinancialEdit =
        dto.lineItems !== undefined ||
        dto.discountAmount !== undefined ||
        dto.taxMode !== undefined ||
        dto.taxRatePercent !== undefined ||
        dto.cgstAmount !== undefined ||
        dto.sgstAmount !== undefined ||
        dto.igstAmount !== undefined ||
        dto.taxAmount !== undefined ||
        dto.otherCharges !== undefined;

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
        if (currentProj && currentProj.status === 'Completed' && hasFinancialEdit) {
          throw new PurchaseConflictError(
            `Project '${currentProj.projectId}' is marked Completed. Reopen the project before modifying financial amounts on linked voucher ${existing.voucherNumber}.`,
          );
        }
      }

      const previousMaterialIds = new Set(
        existing.lineItems
          .map((li) => li.materialId || '')
          .filter(Boolean),
      );
      const previousExpenseHeadIds = new Set(
        existing.lineItems
          .map((li) => li.expenseHeadId || '')
          .filter(Boolean),
      );

      let preparedUpdate: Awaited<
        ReturnType<PurchaseVoucherService['prepareLineItemsBeforeSave']>
      > | null = null;

      let lineFinancialRefs: Array<{
        itemType: PurchaseLineItemType;
        lineTotal: number;
        taxRate: number | null;
      }> = existing.lineItems.map((li) => ({
        itemType: li.itemType === 'expense' ? 'expense' : 'material',
        lineTotal: li.lineTotal,
        taxRate: li.taxRate ?? null,
      }));

      if (dto.lineItems !== undefined) {
        preparedUpdate = await this.prepareLineItemsBeforeSave(
          dto.lineItems,
          previousMaterialIds,
          previousExpenseHeadIds,
        );
        lineFinancialRefs = preparedUpdate.lineFinancialRefs;
      }

      const nextDiscount =
        dto.discountAmount !== undefined
          ? dto.discountAmount
          : existing.discountAmount;
      const nextTaxMode: PurchaseTaxMode =
        dto.taxMode !== undefined
          ? dto.taxMode
          : existing.taxMode === 'percentage'
            ? 'percentage'
            : 'bill_amount';
      const nextTaxRatePercent =
        dto.taxRatePercent !== undefined
          ? dto.taxRatePercent
          : (existing.taxRatePercent ?? null);

      const nextCgst =
        nextTaxMode === 'percentage'
          ? null
          : dto.cgstAmount !== undefined
            ? dto.cgstAmount
            : (existing.cgstAmount ?? null);
      const nextSgst =
        nextTaxMode === 'percentage'
          ? null
          : dto.sgstAmount !== undefined
            ? dto.sgstAmount
            : (existing.sgstAmount ?? null);
      const nextIgst =
        nextTaxMode === 'percentage'
          ? null
          : dto.igstAmount !== undefined
            ? dto.igstAmount
            : (existing.igstAmount ?? null);

      let nextBillTaxAmount =
        dto.taxAmount !== undefined ? dto.taxAmount : existing.taxAmount;

      if (
        nextTaxMode === 'bill_amount' &&
        (nextCgst !== null || nextSgst !== null || nextIgst !== null)
      ) {
        const compSum = roundPurchaseMoney(
          (nextCgst || 0) + (nextSgst || 0) + (nextIgst || 0),
        );
        if (dto.taxAmount === undefined &&
          (dto.cgstAmount !== undefined ||
            dto.sgstAmount !== undefined ||
            dto.igstAmount !== undefined)) {
          nextBillTaxAmount = compSum;
        } else if (Math.abs(nextBillTaxAmount - compSum) > 0.05) {
          throw new PurchaseValidationError(
            {
              taxAmount:
                'Combined tax amount conflicts with CGST + SGST + IGST components — ensure tax is not counted twice.',
            },
            'Combined tax amount conflicts with CGST + SGST + IGST components — ensure tax is not counted twice.',
          );
        }
      }

      const nextOtherCharges =
        dto.otherCharges !== undefined
          ? dto.otherCharges
          : existing.otherCharges;
      const nextPrintedSummary =
        dto.printedInvoiceSummary !== undefined
          ? dto.printedInvoiceSummary
          : (existing.printedInvoiceSummary ?? null);

      const financials = computePurchaseVoucherFinancials({
        lines: lineFinancialRefs,
        discountAmount: nextDiscount,
        taxMode: nextTaxMode,
        taxRatePercent: nextTaxRatePercent,
        taxAmount: nextBillTaxAmount,
        otherCharges: nextOtherCharges,
      });

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

        const updatedVoucher =
          await this.rawMaterialsService.withMaterialNameLocks(
            preparedUpdate ? preparedUpdate.newMaterialNameKeys : [],
            async () => {
              let nextLineItems = existing.lineItems;
              let newlyCreatedMaterialIds = new Set<string>();

              if (preparedUpdate) {
                const materialized =
                  await this.materializePreparedLinesUnderNameLocks(
                    preparedUpdate.preparedLines,
                    caller.id,
                    previousMaterialIds,
                  );
                nextLineItems = materialized.lineItems;
                newlyCreatedMaterialIds = materialized.newlyCreatedMaterialIds;
              }

              const nextRevision = (existing.revision || 1) + 1;
              const previousAppliedLines = existing.stockSync?.applied
                ? existing.stockSync.appliedLines
                : [];
              const desiredAppliedLines =
                aggregateStockByMaterial(nextLineItems);

              let stockApplied = false;

              try {
                await this.applyStockTransition({
                  voucherId: recordId,
                  voucherNumber: existing.voucherNumber,
                  revision: nextRevision,
                  movementType: 'purchase_revised',
                  previousAppliedLines,
                  desiredAppliedLines,
                  performedBy: caller.id,
                });
                stockApplied = true;

                const combinedAttachments = [
                  ...retainedAttachments,
                  ...newSavedAttachments,
                ];

                const updated = await this.repository.updateByRecordId(
                  recordId,
                  {
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
                    materialSubtotal: financials.materialSubtotal,
                    expenseSubtotal: financials.expenseSubtotal,
                    subtotal: financials.subtotal,
                    discountAmount: financials.discountAmount,
                    taxableSubtotal: financials.taxableSubtotal,
                    taxMode: financials.taxMode,
                    taxRatePercent: financials.taxRatePercent,
                    cgstAmount: nextCgst,
                    sgstAmount: nextSgst,
                    igstAmount: nextIgst,
                    taxAmount: financials.taxAmount,
                    otherCharges: financials.otherCharges,
                    finalTotal: financials.finalTotal,
                    materialAllocatedTotal: financials.materialAllocatedTotal,
                    expenseAllocatedTotal: financials.expenseAllocatedTotal,
                    printedInvoiceSummary: nextPrintedSummary,
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
                  },
                );

                if (!updated) {
                  throw new PurchaseNotFoundError();
                }

                return updated;
              } catch (persistErr) {
                if (stockApplied) {
                  await this.rollbackStockTransition({
                    previousAppliedLines,
                    desiredAppliedLines,
                    voucherId: recordId,
                    revision: nextRevision,
                  });
                } else {
                  await this.repository
                    .deleteStockMovementsForVoucherRevision(
                      recordId,
                      nextRevision,
                    )
                    .catch(() => undefined);
                }

                await this.cleanupNewlyCreatedMaterials(
                  newlyCreatedMaterialIds,
                );

                if (persistErr instanceof DuplicatePurchaseVoucherError) {
                  throw new DuplicateSupplierInvoiceError(
                    nextSupplierName,
                    nextInvoiceNumber,
                  );
                }
                throw persistErr;
              }
            },
          );

        for (const removed of removedAttachments) {
          await this.billStorage.deleteBillFile(removed.storageKey);
        }

        await this.syncProjectsQuietly(
          [existing.projectRecordId, projectRef.projectRecordId],
          'updated',
        );

        return this.toSafePurchaseVoucher(updatedVoucher);
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
          voucherId: recordId,
          revision: nextRevision,
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
