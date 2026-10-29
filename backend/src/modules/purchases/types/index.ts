import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { ExpenseHeadCategory } from '../../expense-heads/models/expense-head.model';
import {
  RawMaterialCategory,
  RawMaterialUnit,
} from '../../raw-materials/models/raw-material.model';

export type PurchaseVoucherStatus = 'active' | 'cancelled';
export type PurchaseEntryMethod = 'upload_bill' | 'manual';
export type PurchaseLineItemType = 'material' | 'expense';
export type PurchaseTaxMode = 'bill_amount' | 'percentage';
export type BillStorageProvider = 'local_protected' | 's3' | 'cloudinary';
export type SupportedBillMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'application/pdf';

export type PurchaseStockMovementType =
  | 'purchase_created'
  | 'purchase_revised'
  | 'purchase_cancelled';

export type PurchaseCallerRole = 'admin' | 'data_entry';

export interface PurchaseCallerIdentity {
  id: string;
  email: string;
  name: string;
  role: PurchaseCallerRole;
}

export interface ValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IPurchaseLineItem {
  itemType: PurchaseLineItemType;
  materialId: string | null;
  materialName: string;
  materialCategory: RawMaterialCategory | null;
  expenseHeadId: string | null;
  expenseHeadName: string;
  expenseHeadCategory: ExpenseHeadCategory | null;
  description: string;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number;
  taxRate: number | null;
  remarks: string;
}

export interface IPurchasePrintedInvoiceSummary {
  printedSubtotal: number | null;
  printedDiscountAmount: number | null;
  printedTaxAmount: number | null;
  printedOtherCharges: number | null;
  printedGrandTotal: number | null;
}

export interface IPurchaseBillAttachment {
  attachmentId: string;
  originalName: string;
  mimeType: SupportedBillMimeType;
  sizeBytes: number;
  storageProvider: BillStorageProvider;
  storageKey: string;
  checksum: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Date;
}

export interface IPurchaseAppliedStockLine {
  materialId: string;
  materialName: string;
  unit: RawMaterialUnit;
  quantity: number;
}

export interface IPurchaseStockSyncState {
  applied: boolean;
  appliedRevision: number;
  appliedLines: IPurchaseAppliedStockLine[];
  lastSyncedAt: Date | null;
}

export interface IPurchaseVoucher {
  _id?: string | import('mongoose').Types.ObjectId;
  voucherNumber: string;
  purchaseDate: Date;
  supplierName: string;
  normalizedSupplierName: string;
  supplierInvoiceNumber: string;
  normalizedInvoiceNumber: string;
  projectRecordId: string | null;
  projectCode: string | null;
  projectName: string | null;
  entryMethod: PurchaseEntryMethod;
  lineItems: IPurchaseLineItem[];
  materialSubtotal: number;
  expenseSubtotal: number;
  subtotal: number;
  discountAmount: number;
  taxableSubtotal: number;
  taxMode: PurchaseTaxMode;
  taxRatePercent: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  taxAmount: number;
  otherCharges: number;
  finalTotal: number;
  materialAllocatedTotal: number;
  expenseAllocatedTotal: number;
  printedInvoiceSummary: IPurchasePrintedInvoiceSummary | null;
  notes: string;
  attachments: IPurchaseBillAttachment[];
  status: PurchaseVoucherStatus;
  revision: number;
  stockSync: IPurchaseStockSyncState;
  clientRequestId: string | null;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPurchaseStockMovement {
  _id?: string | import('mongoose').Types.ObjectId;
  idempotencyKey: string;
  voucherId: string;
  voucherNumber: string;
  revision: number;
  movementType: PurchaseStockMovementType;
  materialId: string;
  materialName: string;
  unit: RawMaterialUnit;
  quantityDelta: number;
  resultingQuantityOnHand: number;
  performedBy: string;
  createdAt: Date;
}

export interface UploadedBillInputFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredBillMetadata {
  attachmentId: string;
  originalName: string;
  mimeType: SupportedBillMimeType;
  sizeBytes: number;
  storageProvider: BillStorageProvider;
  storageKey: string;
  checksum: string;
}

export interface IBillAttachmentStorage {
  getProviderName(): BillStorageProvider;
  isPersistentExternalStorage(): boolean;
  saveBillFile(file: UploadedBillInputFile): Promise<StoredBillMetadata>;
  readBillBuffer(
    storageKey: string,
  ): Promise<{ buffer: Buffer; sizeBytes: number }>;
  deleteBillFile(storageKey: string): Promise<void>;
}

export interface PurchaseInlineNewMaterialDto {
  name: string;
  unit: RawMaterialUnit;
  category: RawMaterialCategory | null;
  description: string;
}

export interface PurchaseLineItemInputDto {
  itemType: PurchaseLineItemType;
  materialId?: string;
  newMaterial?: PurchaseInlineNewMaterialDto | null;
  expenseHeadId?: string;
  description?: string;
  unit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  amount?: number | null;
  taxRate?: number | null;
  remarks?: string;
}

export interface CreatePurchaseVoucherDto {
  purchaseDate: Date;
  supplierName: string;
  supplierInvoiceNumber: string;
  projectId: string | null;
  entryMethod: PurchaseEntryMethod;
  lineItems: PurchaseLineItemInputDto[];
  discountAmount: number;
  taxMode: PurchaseTaxMode;
  taxRatePercent: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  taxAmount: number;
  otherCharges: number;
  printedInvoiceSummary: IPurchasePrintedInvoiceSummary | null;
  notes: string;
  clientRequestId: string | null;
}

export interface UpdatePurchaseVoucherDto {
  purchaseDate?: Date;
  supplierName?: string;
  supplierInvoiceNumber?: string;
  projectId?: string | null;
  entryMethod?: PurchaseEntryMethod;
  lineItems?: PurchaseLineItemInputDto[];
  discountAmount?: number;
  taxMode?: PurchaseTaxMode;
  taxRatePercent?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  taxAmount?: number;
  otherCharges?: number;
  printedInvoiceSummary?: IPurchasePrintedInvoiceSummary | null;
  notes?: string;
  removeAttachmentIds?: string[];
}

export interface ListPurchaseVouchersDto {
  page: number;
  limit: number;
  search?: string;
  projectId?: string;
  fromDate?: Date;
  toDate?: Date;
  status: 'active' | 'cancelled' | 'all';
}

export interface PurchaseBillAttachmentResponseDto {
  attachmentId: string;
  originalName: string;
  mimeType: SupportedBillMimeType;
  sizeBytes: number;
  storageProvider: BillStorageProvider;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Date;
  viewUrl: string;
  downloadUrl: string;
}

export interface PurchaseStockMovementResponseDto {
  id: string;
  voucherId: string;
  voucherNumber: string;
  revision: number;
  movementType: PurchaseStockMovementType;
  materialId: string;
  materialName: string;
  unit: RawMaterialUnit;
  quantityDelta: number;
  resultingQuantityOnHand: number;
  performedBy: string;
  createdAt: Date;
}

export interface PurchaseVoucherResponseDto {
  id: string;
  voucherNumber: string;
  purchaseDate: Date;
  supplierName: string;
  supplierInvoiceNumber: string;
  projectRecordId: string | null;
  projectCode: string | null;
  projectName: string | null;
  entryMethod: PurchaseEntryMethod;
  lineItems: IPurchaseLineItem[];
  materialSubtotal: number;
  expenseSubtotal: number;
  subtotal: number;
  discountAmount: number;
  taxableSubtotal: number;
  taxMode: PurchaseTaxMode;
  taxRatePercent: number | null;
  cgstAmount: number | null;
  sgstAmount: number | null;
  igstAmount: number | null;
  taxAmount: number;
  otherCharges: number;
  finalTotal: number;
  materialAllocatedTotal: number;
  expenseAllocatedTotal: number;
  printedInvoiceSummary: IPurchasePrintedInvoiceSummary | null;
  reconciliationWarnings: string[];
  notes: string;
  attachments: PurchaseBillAttachmentResponseDto[];
  hasAttachments: boolean;
  attachmentCount: number;
  status: PurchaseVoucherStatus;
  revision: number;
  stockSynchronized: boolean;
  createdBy: string;
  createdByName: string;
  updatedBy: string;
  updatedByName: string;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PurchaseVoucherListSummary {
  activeCount: number;
  cancelledCount: number;
  activeTotalAmount: number;
  withAttachmentCount: number;
}

export interface IPurchaseProjectAggregationResult {
  totalAmount: number;
  materialAmount: number;
  expenseAmount: number;
  latestActivityAt: Date | null;
}

export interface IPurchaseVoucherRepository {
  generateNextVoucherNumber(): Promise<string>;
  create(
    record: Omit<IPurchaseVoucher, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IPurchaseVoucher>;
  findByIdOrVoucherNumber(identifier: string): Promise<IPurchaseVoucher | null>;
  findByClientRequestId(
    clientRequestId: string,
  ): Promise<IPurchaseVoucher | null>;
  findActiveBySupplierInvoice(
    normalizedSupplierName: string,
    normalizedInvoiceNumber: string,
    excludeRecordId?: string,
  ): Promise<IPurchaseVoucher | null>;
  findVouchers(
    query: ListPurchaseVouchersDto & {
      resolvedProjectRecordId?: string | null;
      filterUnassignedProject?: boolean;
    },
  ): Promise<PaginatedResult<IPurchaseVoucher>>;
  computeSummaryCounts(): Promise<PurchaseVoucherListSummary>;
  updateByRecordId(
    recordId: string,
    updates: Partial<IPurchaseVoucher>,
  ): Promise<IPurchaseVoucher | null>;
  aggregateActivePurchasesForProject(
    projectRecordId: string,
    projectCode: string,
  ): Promise<IPurchaseProjectAggregationResult>;
  recordStockMovement(
    entry: Omit<IPurchaseStockMovement, '_id'>,
  ): Promise<IPurchaseStockMovement>;
  findStockMovementByKey(
    idempotencyKey: string,
  ): Promise<IPurchaseStockMovement | null>;
  listStockMovementsForVoucher(
    voucherId: string,
  ): Promise<IPurchaseStockMovement[]>;
  deleteByRecordId(recordId: string): Promise<boolean>;
  deleteStockMovementsForVoucherRevision(
    voucherId: string,
    revision: number,
  ): Promise<void>;
}

export interface IPurchaseVoucherService {
  createPurchaseVoucher(
    rawBody: unknown,
    uploadedFiles: UploadedBillInputFile[],
    caller: PurchaseCallerIdentity,
    headerIdempotencyKey?: string,
  ): Promise<{ voucher: PurchaseVoucherResponseDto; created: boolean }>;
  updatePurchaseVoucher(
    identifier: string,
    rawBody: unknown,
    uploadedFiles: UploadedBillInputFile[],
    caller: PurchaseCallerIdentity,
  ): Promise<PurchaseVoucherResponseDto>;
  cancelPurchaseVoucher(
    identifier: string,
    cancelReasonRaw: unknown,
    caller: PurchaseCallerIdentity,
  ): Promise<PurchaseVoucherResponseDto>;
  getPurchaseVoucherById(identifier: string): Promise<{
    voucher: PurchaseVoucherResponseDto;
    stockMovements: PurchaseStockMovementResponseDto[];
  }>;
  listPurchaseVouchers(rawQuery: Record<string, unknown>): Promise<
    PaginatedResult<PurchaseVoucherResponseDto> & {
      vouchers: PurchaseVoucherResponseDto[];
      summary: PurchaseVoucherListSummary;
      storageInfo: {
        provider: BillStorageProvider;
        persistentExternalConfigured: boolean;
      };
    }
  >;
  openVoucherAttachment(
    identifier: string,
    attachmentId: string,
  ): Promise<{
    attachment: IPurchaseBillAttachment;
    buffer: Buffer;
  }>;
}

export interface IPurchaseVoucherController {
  list(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  getById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  create(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  update(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  uploadAttachments(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  cancel(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  streamAttachment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
}
