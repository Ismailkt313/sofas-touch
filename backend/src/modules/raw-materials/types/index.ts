import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { CreateRawMaterialDto } from '../dto/create-raw-material.dto';
import { GetRawMaterialsDto } from '../dto/get-raw-materials.dto';
import {
  AdjustRawMaterialStockDto,
  UpdateRawMaterialDto,
  UpdateRawMaterialStatusDto,
} from '../dto/update-raw-material.dto';
import {
  IRawMaterial,
  RawMaterialCategory,
  RawMaterialUnit,
} from '../models/raw-material.model';

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

export type RawMaterialCallerRole = 'admin' | 'data_entry';

export interface RawMaterialResponseDto {
  id: string;
  name: string;
  category: RawMaterialCategory | null;
  unit: RawMaterialUnit;
  quantityOnHand: number;
  description: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RawMaterialPurchaseReferenceDto {
  id: string;
  name: string;
  unit: RawMaterialUnit;
  category: RawMaterialCategory | null;
  quantityOnHand: number;
  isActive: boolean;
}

export interface CreateRawMaterialRecordInput {
  name: string;
  normalizedName: string;
  category: RawMaterialCategory | null;
  unit: RawMaterialUnit;
  quantityOnHand?: number;
  description: string;
  isActive: boolean;
  createdBy: string;
}

export interface UpdateRawMaterialRecordInput {
  name?: string;
  normalizedName?: string;
  category?: RawMaterialCategory | null;
  unit?: RawMaterialUnit;
  quantityOnHand?: number;
  description?: string;
  isActive?: boolean;
}

export interface FindRawMaterialsQuery {
  page: number;
  limit: number;
  search?: string;
  category?: RawMaterialCategory;
  isActive?: boolean;
}

export interface IRawMaterialsRepository {
  create(input: CreateRawMaterialRecordInput): Promise<IRawMaterial>;
  findMaterials(query: FindRawMaterialsQuery): Promise<PaginatedResult<IRawMaterial>>;
  findById(id: string): Promise<IRawMaterial | null>;
  findByIds(ids: string[]): Promise<IRawMaterial[]>;
  findByNormalizedName(normalizedName: string): Promise<IRawMaterial | null>;
  updateById(
    id: string,
    updates: UpdateRawMaterialRecordInput,
  ): Promise<IRawMaterial | null>;
  adjustStockQuantity(id: string, newQuantity: number): Promise<IRawMaterial | null>;
  incrementStockQuantity(id: string, delta: number): Promise<IRawMaterial | null>;
  adjustQuantityOnHand(
    id: string,
    delta: number,
  ): Promise<IRawMaterial | null>;
  deleteById(id: string): Promise<boolean>;
}

export interface IRawMaterialsService {
  createRawMaterial(
    dto: CreateRawMaterialDto,
    createdBy: string,
  ): Promise<RawMaterialResponseDto>;
  listRawMaterials(
    dto: GetRawMaterialsDto,
    callerRole: RawMaterialCallerRole,
  ): Promise<PaginatedResult<RawMaterialResponseDto>>;
  getRawMaterialById(
    id: string,
    callerRole: RawMaterialCallerRole,
  ): Promise<RawMaterialResponseDto>;
  updateRawMaterial(
    id: string,
    dto: UpdateRawMaterialDto,
  ): Promise<RawMaterialResponseDto>;
  updateRawMaterialStatus(
    id: string,
    dto: UpdateRawMaterialStatusDto,
  ): Promise<RawMaterialResponseDto>;
  adjustStockQuantity(
    id: string,
    dto: AdjustRawMaterialStockDto,
  ): Promise<RawMaterialResponseDto>;
  applyStockDelta(
    id: string,
    delta: number,
    expectedUnit?: RawMaterialUnit,
  ): Promise<RawMaterialResponseDto>;
  getSelectableMaterialForPurchase(
    id: string,
  ): Promise<RawMaterialPurchaseReferenceDto>;
  getMaterialReferenceById(
    id: string,
  ): Promise<RawMaterialPurchaseReferenceDto | null>;
  getMaterialReferencesByIds(
    ids: string[],
  ): Promise<Map<string, RawMaterialPurchaseReferenceDto>>;
  withMaterialStockLocks<T>(
    materialIds: string[],
    operation: () => Promise<T>,
  ): Promise<T>;
  withMaterialNameLocks<T>(
    materialNames: string[],
    operation: () => Promise<T>,
  ): Promise<T>;
  adjustStockForPurchaseUnlocked(
    id: string,
    expectedUnit: RawMaterialUnit,
    delta: number,
  ): Promise<RawMaterialPurchaseReferenceDto>;
}

export interface IRawMaterialsController {
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
  updateStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  adjustStock(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
}
