import {
  BillStorageProvider,
  IPurchaseBillAttachment,
  PurchaseBillAttachmentResponseDto,
  UploadedBillInputFile,
} from '../../purchases/types';

export type ExpenseVoucherStatus = 'active' | 'cancelled';

export interface ExpenseCallerIdentity {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'data_entry';
  permissions?: string[];
  assignedProjectIds?: string[] | null;
}

export interface ValidationResult<T> {
  isValid: boolean;
  value?: T;
  errors?: Record<string, string>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IExpenseCounter {
  _id: string;
  seq: number;
}

export interface IExpenseCategory {
  _id?: string;
  name: string;
  normalizedName: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ExpenseCategoryResponseDto {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IExpenseReceiptAttachment = IPurchaseBillAttachment;
export type ExpenseReceiptAttachmentResponseDto =
  PurchaseBillAttachmentResponseDto;
export type UploadedReceiptInputFile = UploadedBillInputFile;

export interface IExpenseVoucher {
  _id?: string;
  voucherNumber: string;
  expenseDate: Date;
  categoryId: string;
  categoryName: string;
  amount: number;
  description: string;
  projectRecordId: string | null;
  projectCode: string | null;
  projectName: string | null;
  attachments: IExpenseReceiptAttachment[];
  status: ExpenseVoucherStatus;
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

export interface ExpenseVoucherResponseDto {
  id: string;
  voucherNumber: string;
  expenseDate: Date;
  categoryId: string;
  categoryName: string;
  amount: number;
  description: string;
  projectRecordId: string | null;
  projectCode: string | null;
  projectName: string | null;
  attachments: ExpenseReceiptAttachmentResponseDto[];
  hasAttachments: boolean;
  attachmentCount: number;
  status: ExpenseVoucherStatus;
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

export interface CreateExpenseCategoryDto {
  name: string;
  description: string;
}

export interface UpdateExpenseCategoryDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateExpenseVoucherDto {
  expenseDate: Date;
  categoryId: string | null;
  newCategoryName: string | null;
  amount: number;
  description: string;
  projectId: string | null;
  clientRequestId: string | null;
}

export interface UpdateExpenseVoucherDto {
  expenseDate?: Date;
  categoryId?: string | null;
  newCategoryName?: string | null;
  amount?: number;
  description?: string;
  projectId?: string | null;
  removeAttachmentIds?: string[];
}

export interface ListExpenseVouchersDto {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  projectId?: string;
  fromDate?: Date;
  toDate?: Date;
  status: 'active' | 'cancelled' | 'all';
}

export interface ExpenseVoucherListSummary {
  activeCount: number;
  cancelledCount: number;
  activeTotalAmount: number;
  projectLinkedCount: number;
  projectLinkedTotalAmount: number;
  generalExpenseCount: number;
  generalTotalAmount: number;
  withReceiptCount: number;
}

export interface IExpenseRepository {
  ensureDefaultCategories(): Promise<void>;
  listCategories(options?: {
    includeInactive?: boolean;
  }): Promise<IExpenseCategory[]>;
  findCategoryById(id: string): Promise<IExpenseCategory | null>;
  findCategoryByNormalizedName(
    normalizedName: string,
  ): Promise<IExpenseCategory | null>;
  createCategory(
    data: Omit<IExpenseCategory, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IExpenseCategory>;
  updateCategoryById(
    id: string,
    updates: Partial<IExpenseCategory>,
  ): Promise<IExpenseCategory | null>;
  syncCategoryNameOnVouchers(
    categoryId: string,
    categoryName: string,
  ): Promise<void>;
  nextVoucherNumber(): Promise<string>;
  createVoucher(
    data: Omit<IExpenseVoucher, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IExpenseVoucher>;
  findVoucherByIdOrNumber(identifier: string): Promise<IExpenseVoucher | null>;
  findVoucherByClientRequestId(
    clientRequestId: string,
  ): Promise<IExpenseVoucher | null>;
  findVouchers(
    filters: ListExpenseVouchersDto & {
      resolvedProjectRecordId?: string | null;
      filterUnassignedProject?: boolean;
    },
  ): Promise<PaginatedResult<IExpenseVoucher>>;
  computeSummaryCounts(): Promise<ExpenseVoucherListSummary>;
  updateVoucherById(
    recordId: string,
    updates: Partial<IExpenseVoucher>,
  ): Promise<IExpenseVoucher | null>;
  aggregateActiveExpensesForProject(
    projectRecordId: string,
    projectCode: string,
  ): Promise<{ totalAmount: number; latestActivityAt: Date | null }>;
}

export type ExpenseStorageProvider = BillStorageProvider;
