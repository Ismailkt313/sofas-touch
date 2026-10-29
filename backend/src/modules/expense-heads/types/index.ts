import {
  ExpenseHeadCategory,
  IExpenseHead,
} from '../models/expense-head.model';

export type ExpenseHeadCallerRole = 'admin' | 'data_entry';

export interface ExpenseHeadValidationResult<T> {
  isValid: boolean;
  errors?: Record<string, string>;
  value?: T;
}

export interface CreateExpenseHeadDto {
  name: string;
  category: ExpenseHeadCategory;
  description: string;
}

export interface UpdateExpenseHeadDto {
  name?: string;
  category?: ExpenseHeadCategory;
  description?: string;
}

export interface ListExpenseHeadsQueryDto {
  page: number;
  limit: number;
  search?: string;
  category?: ExpenseHeadCategory;
  status: 'active' | 'inactive' | 'all';
}

export interface PaginatedExpenseHeadsResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExpenseHeadResponseDto {
  id: string;
  name: string;
  category: ExpenseHeadCategory;
  description: string;
  isActive: boolean;
  status: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IExpenseHeadsRepository {
  create(
    data: Omit<IExpenseHead, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IExpenseHead>;
  findById(id: string): Promise<IExpenseHead | null>;
  findByNormalizedName(
    normalizedName: string,
    excludeId?: string,
  ): Promise<IExpenseHead | null>;
  findMany(
    query: ListExpenseHeadsQueryDto,
  ): Promise<PaginatedExpenseHeadsResult<IExpenseHead>>;
  updateById(
    id: string,
    updates: Partial<IExpenseHead>,
  ): Promise<IExpenseHead | null>;
}
