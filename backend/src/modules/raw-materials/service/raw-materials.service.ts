import { CreateRawMaterialDto } from '../dto/create-raw-material.dto';
import { GetRawMaterialsDto } from '../dto/get-raw-materials.dto';
import {
  AdjustRawMaterialStockDto,
  UpdateRawMaterialDto,
  UpdateRawMaterialStatusDto,
} from '../dto/update-raw-material.dto';
import {
  IRawMaterial,
  RawMaterialUnit,
  isValidRawMaterialObjectId,
  normalizeMaterialDisplayName,
  normalizeMaterialNameKey,
} from '../models/raw-material.model';
import {
  DuplicateRawMaterialKeyError,
  InsufficientRawMaterialStockError,
} from '../repository/raw-materials.repository';
import {
  FindRawMaterialsQuery,
  IRawMaterialsRepository,
  IRawMaterialsService,
  PaginatedResult,
  RawMaterialCallerRole,
  RawMaterialPurchaseReferenceDto,
  RawMaterialResponseDto,
  UpdateRawMaterialRecordInput,
} from '../types';

export class InvalidRawMaterialIdError extends Error {
  public readonly statusCode = 400;

  constructor(id: string) {
    super(
      id
        ? `Invalid raw material ID format: '${id}'.`
        : 'Raw material ID is required.',
    );
    this.name = 'InvalidRawMaterialIdError';
  }
}

export class RawMaterialNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(id: string) {
    super(`Raw material with ID '${id}' was not found.`);
    this.name = 'RawMaterialNotFoundError';
  }
}

export class RawMaterialAlreadyExistsError extends Error {
  public readonly statusCode = 409;

  constructor(name: string) {
    super(`A raw material named '${name}' already exists.`);
    this.name = 'RawMaterialAlreadyExistsError';
  }
}

export class InactiveRawMaterialAccessForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(
    message = 'Access denied. Data Entry accounts can only access active raw materials.',
  ) {
    super(message);
    this.name = 'InactiveRawMaterialAccessForbiddenError';
  }
}

export class InactiveRawMaterialSelectionError extends Error {
  public readonly statusCode = 400;

  constructor(name: string) {
    super(
      `Raw material '${name}' is inactive and cannot be selected for new purchases.`,
    );
    this.name = 'InactiveRawMaterialSelectionError';
  }
}

export class IncompatibleMaterialUnitError extends Error {
  public readonly statusCode = 400;

  constructor(materialName: string, materialUnit: string, voucherUnit: string) {
    super(
      `Cannot apply purchase quantity with unit '${voucherUnit}' to material '${materialName}' which uses '${materialUnit}'.`,
    );
    this.name = 'IncompatibleMaterialUnitError';
  }
}

export class InsufficientStockQuantityError extends Error {
  public readonly statusCode = 400;

  constructor(materialName: string, currentStock: number, requestedReduction: number) {
    super(
      `Cannot reduce stock by ${requestedReduction} for material '${materialName}'. Current stock is only ${currentStock}.`,
    );
    this.name = 'InsufficientStockQuantityError';
  }
}

export class RawMaterialUnitConflictError extends Error {
  public readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'RawMaterialUnitConflictError';
  }
}

export function mapRawMaterialToResponse(
  material: IRawMaterial,
): RawMaterialResponseDto {
  return {
    id: String(material._id || ''),
    name: material.name,
    category: material.category ?? null,
    unit: material.unit,
    quantityOnHand:
      typeof material.quantityOnHand === 'number' &&
      !Number.isNaN(material.quantityOnHand)
        ? Math.max(0, material.quantityOnHand)
        : 0,
    minStockLevel:
      typeof material.minStockLevel === 'number' &&
      Number.isFinite(material.minStockLevel) &&
      material.minStockLevel >= 0
        ? material.minStockLevel
        : null,
    description: material.description || '',
    isActive: Boolean(material.isActive),
    createdBy: material.createdBy || undefined,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
  };
}

export function mapRawMaterialToPurchaseReference(
  material: IRawMaterial,
): RawMaterialPurchaseReferenceDto {
  return {
    id: String(material._id || ''),
    name: material.name,
    unit: material.unit,
    category: material.category ?? null,
    quantityOnHand:
      typeof material.quantityOnHand === 'number' &&
      !Number.isNaN(material.quantityOnHand)
        ? Math.max(0, material.quantityOnHand)
        : 0,
    isActive: Boolean(material.isActive),
  };
}

export class RawMaterialsService implements IRawMaterialsService {
  private readonly repository: IRawMaterialsRepository;
  private readonly materialLocks: Map<string, Promise<unknown>> = new Map();

  constructor(repository: IRawMaterialsRepository) {
    this.repository = repository;
  }

  private assertValidId(rawId: string): string {
    const trimmed = typeof rawId === 'string' ? rawId.trim() : '';
    if (!isValidRawMaterialObjectId(trimmed)) {
      throw new InvalidRawMaterialIdError(trimmed);
    }
    return trimmed;
  }

  private async withSingleMaterialLock<T>(
    idKey: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.materialLocks.get(idKey) || Promise.resolve();
    let releaseLock!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const chained = previous.then(
      () => gate,
      () => gate,
    );
    this.materialLocks.set(idKey, chained);

    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseLock();
      if (this.materialLocks.get(idKey) === chained) {
        this.materialLocks.delete(idKey);
      }
    }
  }

  async withMaterialStockLocks<T>(
    materialIds: string[],
    operation: () => Promise<T>,
  ): Promise<T> {
    const sortedKeys = Array.from(
      new Set(
        materialIds
          .map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : ''))
          .filter(Boolean),
      ),
    ).sort();

    const runNested = async (index: number): Promise<T> => {
      if (index >= sortedKeys.length) {
        return operation();
      }
      return this.withSingleMaterialLock(sortedKeys[index], () =>
        runNested(index + 1),
      );
    };

    return runNested(0);
  }

  async withMaterialNameLocks<T>(
    materialNames: string[],
    operation: () => Promise<T>,
  ): Promise<T> {
    const sortedKeys = Array.from(
      new Set(
        materialNames
          .map((name) =>
            typeof name === 'string' ? normalizeMaterialNameKey(name) : '',
          )
          .filter(Boolean)
          .map((key) => `name:${key}`),
      ),
    ).sort();

    const runNested = async (index: number): Promise<T> => {
      if (index >= sortedKeys.length) {
        return operation();
      }
      return this.withSingleMaterialLock(sortedKeys[index], () =>
        runNested(index + 1),
      );
    };

    return runNested(0);
  }

  async createRawMaterial(
    dto: CreateRawMaterialDto,
    createdBy: string,
  ): Promise<RawMaterialResponseDto> {
    const cleanName = normalizeMaterialDisplayName(dto.name);
    const normalizedName = normalizeMaterialNameKey(cleanName);

    return this.withMaterialNameLocks([normalizedName], async () => {
      const existing =
        await this.repository.findByNormalizedName(normalizedName);
      if (existing) {
        throw new RawMaterialAlreadyExistsError(cleanName);
      }

      try {
        const created = await this.repository.create({
          name: cleanName,
          normalizedName,
          category: dto.category ?? null,
          unit: dto.unit,
          quantityOnHand: dto.quantityOnHand ?? 0,
          minStockLevel: dto.minStockLevel ?? null,
          description: dto.description || '',
          isActive: true,
          createdBy,
        });

        return mapRawMaterialToResponse(created);
      } catch (err: unknown) {
        if (err instanceof DuplicateRawMaterialKeyError) {
          throw new RawMaterialAlreadyExistsError(cleanName);
        }
        throw err;
      }
    });
  }

  async listRawMaterials(
    dto: GetRawMaterialsDto,
    callerRole: RawMaterialCallerRole,
  ): Promise<PaginatedResult<RawMaterialResponseDto>> {
    const query: FindRawMaterialsQuery = {
      page: dto.page,
      limit: dto.limit,
      search: dto.search,
      category: dto.category,
    };

    if (callerRole !== 'admin') {
      if (
        dto.requestedStatusFilter === 'inactive' ||
        dto.requestedStatusFilter === 'all'
      ) {
        throw new InactiveRawMaterialAccessForbiddenError(
          'Access denied. Data Entry accounts may only list active raw materials.',
        );
      }
      query.isActive = true;
    } else if (dto.requestedStatusFilter === 'active') {
      query.isActive = true;
    } else if (dto.requestedStatusFilter === 'inactive') {
      query.isActive = false;
    }

    const result = await this.repository.findMaterials(query);

    return {
      items: result.items.map(mapRawMaterialToResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getRawMaterialById(
    id: string,
    callerRole: RawMaterialCallerRole,
  ): Promise<RawMaterialResponseDto> {
    const validId = this.assertValidId(id);
    const material = await this.repository.findById(validId);

    if (!material) {
      throw new RawMaterialNotFoundError(validId);
    }

    if (callerRole !== 'admin' && !material.isActive) {
      throw new InactiveRawMaterialAccessForbiddenError(
        'Access denied. Inactive raw materials cannot be accessed by Data Entry accounts.',
      );
    }

    return mapRawMaterialToResponse(material);
  }

  async updateRawMaterial(
    id: string,
    dto: UpdateRawMaterialDto,
  ): Promise<RawMaterialResponseDto> {
    const validId = this.assertValidId(id);
    const existing = await this.repository.findById(validId);

    if (!existing) {
      throw new RawMaterialNotFoundError(validId);
    }

    const recordUpdates: UpdateRawMaterialRecordInput = {};

    if (dto.name !== undefined) {
      const cleanName = normalizeMaterialDisplayName(dto.name);
      const normalizedName = normalizeMaterialNameKey(cleanName);

      const colliding = await this.repository.findByNormalizedName(normalizedName);
      if (
        colliding &&
        String(colliding._id).toLowerCase() !== String(existing._id).toLowerCase()
      ) {
        throw new RawMaterialAlreadyExistsError(cleanName);
      }

      recordUpdates.name = cleanName;
      recordUpdates.normalizedName = normalizedName;
    }

    if (dto.category !== undefined) {
      recordUpdates.category = dto.category;
    }

    if (dto.unit !== undefined) {
      const currentQty = Number(existing.quantityOnHand ?? 0);
      if (dto.unit !== existing.unit && currentQty > 0) {
        throw new RawMaterialUnitConflictError(
          `Cannot change unit for '${existing.name}' from '${existing.unit}' to '${dto.unit}' while recorded purchase quantity (${currentQty} ${existing.unit}) is greater than zero.`,
        );
      }
      recordUpdates.unit = dto.unit;
    }

    if (dto.description !== undefined) {
      recordUpdates.description = dto.description;
    }

    if (dto.minStockLevel !== undefined) {
      recordUpdates.minStockLevel = dto.minStockLevel;
    }

    try {
      const updated = await this.repository.updateById(validId, recordUpdates);
      if (!updated) {
        throw new RawMaterialNotFoundError(validId);
      }
      return mapRawMaterialToResponse(updated);
    } catch (err: unknown) {
      if (err instanceof DuplicateRawMaterialKeyError) {
        throw new RawMaterialAlreadyExistsError(dto.name || '');
      }
      throw err;
    }
  }

  async updateRawMaterialStatus(
    id: string,
    dto: UpdateRawMaterialStatusDto,
  ): Promise<RawMaterialResponseDto> {
    const validId = this.assertValidId(id);
    const existing = await this.repository.findById(validId);

    if (!existing) {
      throw new RawMaterialNotFoundError(validId);
    }

    const updated = await this.repository.updateById(validId, {
      isActive: dto.isActive,
    });

    if (!updated) {
      throw new RawMaterialNotFoundError(validId);
    }

    return mapRawMaterialToResponse(updated);
  }

  async adjustStockQuantity(
    id: string,
    dto: AdjustRawMaterialStockDto,
  ): Promise<RawMaterialResponseDto> {
    const validId = this.assertValidId(id);
    const existing = await this.repository.findById(validId);

    if (!existing) {
      throw new RawMaterialNotFoundError(validId);
    }

    const updated = await this.repository.adjustStockQuantity(
      validId,
      dto.quantityOnHand,
    );

    if (!updated) {
      throw new RawMaterialNotFoundError(validId);
    }

    return mapRawMaterialToResponse(updated);
  }

  async applyStockDelta(
    id: string,
    delta: number,
    expectedUnit?: RawMaterialUnit,
  ): Promise<RawMaterialResponseDto> {
    const validId = this.assertValidId(id);
    const material = await this.repository.findById(validId);

    if (!material) {
      throw new RawMaterialNotFoundError(validId);
    }

    if (expectedUnit && material.unit !== expectedUnit) {
      throw new IncompatibleMaterialUnitError(
        material.name,
        material.unit,
        expectedUnit,
      );
    }

    const currentQty =
      typeof material.quantityOnHand === 'number' && !Number.isNaN(material.quantityOnHand)
        ? material.quantityOnHand
        : 0;

    if (delta < 0 && currentQty + delta < 0) {
      throw new InsufficientStockQuantityError(
        material.name,
        currentQty,
        Math.abs(delta),
      );
    }

    const updated = await this.repository.incrementStockQuantity(validId, delta);
    if (!updated) {
      throw new InsufficientStockQuantityError(
        material.name,
        currentQty,
        Math.abs(delta),
      );
    }

    return mapRawMaterialToResponse(updated);
  }

  async getSelectableMaterialForPurchase(
    id: string,
  ): Promise<RawMaterialPurchaseReferenceDto> {
    const validId = this.assertValidId(id);
    const material = await this.repository.findById(validId);

    if (!material) {
      throw new RawMaterialNotFoundError(validId);
    }

    if (!material.isActive) {
      throw new InactiveRawMaterialSelectionError(material.name);
    }

    return mapRawMaterialToPurchaseReference(material);
  }

  async getMaterialReferenceById(
    id: string,
  ): Promise<RawMaterialPurchaseReferenceDto | null> {
    if (!isValidRawMaterialObjectId(id)) {
      return null;
    }
    const material = await this.repository.findById(id.trim());
    return material ? mapRawMaterialToPurchaseReference(material) : null;
  }

  async getMaterialReferencesByIds(
    ids: string[],
  ): Promise<Map<string, RawMaterialPurchaseReferenceDto>> {
    const materials = await this.repository.findByIds(ids);
    const referenceMap = new Map<string, RawMaterialPurchaseReferenceDto>();
    for (const material of materials) {
      const reference = mapRawMaterialToPurchaseReference(material);
      referenceMap.set(reference.id, reference);
    }
    return referenceMap;
  }

  async adjustStockForPurchaseUnlocked(
    id: string,
    expectedUnit: RawMaterialUnit,
    delta: number,
  ): Promise<RawMaterialPurchaseReferenceDto> {
    const validId = this.assertValidId(id);
    const existing = await this.repository.findById(validId);

    if (!existing) {
      throw new RawMaterialNotFoundError(validId);
    }

    if (existing.unit !== expectedUnit) {
      throw new RawMaterialUnitConflictError(
        `Incompatible unit '${expectedUnit}' for material '${existing.name}'. Expected '${existing.unit}'.`,
      );
    }

    const updated = await this.repository.adjustQuantityOnHand(validId, delta);
    if (!updated) {
      throw new RawMaterialNotFoundError(validId);
    }

    return mapRawMaterialToPurchaseReference(updated);
  }
}

export { InsufficientRawMaterialStockError };
