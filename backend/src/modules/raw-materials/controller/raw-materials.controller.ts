import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { activityService } from '../../activity';
import { validateCreateRawMaterialDto } from '../dto/create-raw-material.dto';
import { validateGetRawMaterialsDto } from '../dto/get-raw-materials.dto';
import {
  validateAdjustStockDto,
  validateUpdateRawMaterialDto,
  validateUpdateRawMaterialStatusDto,
} from '../dto/update-raw-material.dto';
import { DuplicateRawMaterialKeyError } from '../repository/raw-materials.repository';
import {
  InactiveRawMaterialAccessForbiddenError,
  InactiveRawMaterialSelectionError,
  IncompatibleMaterialUnitError,
  InsufficientRawMaterialStockError,
  InsufficientStockQuantityError,
  InvalidRawMaterialIdError,
  RawMaterialAlreadyExistsError,
  RawMaterialNotFoundError,
  RawMaterialUnitConflictError,
} from '../service/raw-materials.service';
import {
  IRawMaterialsController,
  IRawMaterialsService,
  RawMaterialCallerRole,
} from '../types';

function extractParam(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) {
    return (raw[0] || '').trim();
  }
  return typeof raw === 'string' ? raw.trim() : '';
}

function resolveCallerRole(req: AuthenticatedRequest): RawMaterialCallerRole {
  return req.user?.role === 'admin' ? 'admin' : 'data_entry';
}

export class RawMaterialsController implements IRawMaterialsController {
  private readonly rawMaterialsService: IRawMaterialsService;

  constructor(rawMaterialsService: IRawMaterialsService) {
    this.rawMaterialsService = rawMaterialsService;
  }

  private handleKnownErrors(err: unknown, res: Response): boolean {
    if (
      err instanceof InvalidRawMaterialIdError ||
      err instanceof InactiveRawMaterialSelectionError ||
      err instanceof IncompatibleMaterialUnitError ||
      err instanceof InsufficientStockQuantityError
    ) {
      res.status(400).json({
        error: 'Bad Request',
        message: err.message,
      });
      return true;
    }

    if (err instanceof InactiveRawMaterialAccessForbiddenError) {
      res.status(403).json({
        error: 'Forbidden',
        message: err.message,
      });
      return true;
    }

    if (err instanceof RawMaterialNotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: err.message,
      });
      return true;
    }

    if (
      err instanceof RawMaterialAlreadyExistsError ||
      err instanceof DuplicateRawMaterialKeyError ||
      err instanceof RawMaterialUnitConflictError ||
      err instanceof InsufficientRawMaterialStockError
    ) {
      res.status(409).json({
        error: 'Conflict',
        message: err.message,
      });
      return true;
    }

    return false;
  }

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateGetRawMaterialsDto(
        (req.query || {}) as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid query parameters.',
          errors: validation.errors,
        });
        return;
      }

      const callerRole = resolveCallerRole(req);
      const result = await this.rawMaterialsService.listRawMaterials(
        validation.value,
        callerRole,
      );

      res.status(200).json({
        rawMaterials: result.items,
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (err: unknown) {
      if (!this.handleKnownErrors(err, res)) {
        next(err);
      }
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Raw material ID is required.',
        });
        return;
      }

      const callerRole = resolveCallerRole(req);
      const rawMaterial = await this.rawMaterialsService.getRawMaterialById(
        id,
        callerRole,
      );

      res.status(200).json({ rawMaterial });
    } catch (err: unknown) {
      if (!this.handleKnownErrors(err, res)) {
        next(err);
      }
    }
  };

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateCreateRawMaterialDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed.',
          errors: validation.errors,
        });
        return;
      }

      const createdBy = req.user?.id || req.user?.email || 'admin';
      const rawMaterial = await this.rawMaterialsService.createRawMaterial(
        validation.value,
        createdBy,
      );

      await activityService.recordSafe({
        actionType: 'material.created',
        entityType: 'material',
        entityId: rawMaterial.id,
        entityLabel: rawMaterial.name,
        description: `Added raw material ${rawMaterial.name} (${rawMaterial.unit}).`,
        actorId: createdBy,
        actorName: req.user?.name || req.user?.email || 'Administrator',
        actorRole: resolveCallerRole(req),
        targetPath: `/raw-materials?material=${encodeURIComponent(rawMaterial.id)}`,
      });

      res.status(201).json({
        message: 'Raw material created successfully.',
        rawMaterial,
      });
    } catch (err: unknown) {
      if (!this.handleKnownErrors(err, res)) {
        next(err);
      }
    }
  };

  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Raw material ID is required.',
        });
        return;
      }

      const validation = validateUpdateRawMaterialDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed.',
          errors: validation.errors,
        });
        return;
      }

      const rawMaterial = await this.rawMaterialsService.updateRawMaterial(
        id,
        validation.value,
      );

      await activityService.recordSafe({
        actionType: 'material.updated',
        entityType: 'material',
        entityId: rawMaterial.id,
        entityLabel: rawMaterial.name,
        description: `Updated raw material specifications for ${rawMaterial.name}.`,
        actorId: req.user?.id || req.user?.email || 'admin',
        actorName: req.user?.name || req.user?.email || 'Administrator',
        actorRole: resolveCallerRole(req),
        targetPath: `/raw-materials?material=${encodeURIComponent(rawMaterial.id)}`,
      });

      res.status(200).json({
        message: 'Raw material updated successfully.',
        rawMaterial,
      });
    } catch (err: unknown) {
      if (!this.handleKnownErrors(err, res)) {
        next(err);
      }
    }
  };

  updateStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Raw material ID is required.',
        });
        return;
      }

      const validation = validateUpdateRawMaterialStatusDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed.',
          errors: validation.errors,
        });
        return;
      }

      const rawMaterial =
        await this.rawMaterialsService.updateRawMaterialStatus(
          id,
          validation.value,
        );

      await activityService.recordSafe({
        actionType: 'material.status_changed',
        entityType: 'material',
        entityId: rawMaterial.id,
        entityLabel: rawMaterial.name,
        description: `${rawMaterial.isActive ? 'Activated' : 'Deactivated'} raw material ${rawMaterial.name}.`,
        actorId: req.user?.id || req.user?.email || 'admin',
        actorName: req.user?.name || req.user?.email || 'Administrator',
        actorRole: resolveCallerRole(req),
        targetPath: `/raw-materials?material=${encodeURIComponent(rawMaterial.id)}`,
      });

      res.status(200).json({
        message: rawMaterial.isActive
          ? 'Raw material activated successfully.'
          : 'Raw material deactivated successfully.',
        rawMaterial,
      });
    } catch (err: unknown) {
      if (!this.handleKnownErrors(err, res)) {
        next(err);
      }
    }
  };

  adjustStock = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = extractParam(req.params.id);
      if (!id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Raw material ID is required.',
        });
        return;
      }

      const validation = validateAdjustStockDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed.',
          errors: validation.errors,
        });
        return;
      }

      const rawMaterial = await this.rawMaterialsService.adjustStockQuantity(
        id,
        validation.value,
      );

      await activityService.recordSafe({
        actionType: 'material.stock_adjusted',
        entityType: 'material',
        entityId: rawMaterial.id,
        entityLabel: rawMaterial.name,
        description: `Adjusted stock quantity of ${rawMaterial.name} to ${rawMaterial.quantityOnHand} ${rawMaterial.unit}.`,
        actorId: req.user?.id || req.user?.email || 'admin',
        actorName: req.user?.name || req.user?.email || 'Administrator',
        actorRole: resolveCallerRole(req),
        targetPath: `/raw-materials?material=${encodeURIComponent(rawMaterial.id)}`,
      });

      res.status(200).json({
        message: 'Stock quantity adjusted successfully.',
        rawMaterial,
      });
    } catch (err: unknown) {
      if (!this.handleKnownErrors(err, res)) {
        next(err);
      }
    }
  };
}
