import { Router } from 'express';
import {
  requirePermission,
  verifyToken,
} from '../../middleware/auth';
import { RawMaterialsController } from './controller/raw-materials.controller';
import { RawMaterialsRepository } from './repository/raw-materials.repository';
import { RawMaterialsService } from './service/raw-materials.service';

export const rawMaterialsRepository = new RawMaterialsRepository();
export const rawMaterialsService = new RawMaterialsService(
  rawMaterialsRepository,
);
export const rawMaterialsController = new RawMaterialsController(
  rawMaterialsService,
);

const router = Router();

router.use(verifyToken);

router.get(
  '/',
  requirePermission('materials.view'),
  rawMaterialsController.list,
);
router.get(
  '/:id',
  requirePermission('materials.view'),
  rawMaterialsController.getById,
);
router.post(
  '/',
  requirePermission('materials.create'),
  rawMaterialsController.create,
);
router.patch(
  '/:id/status',
  requirePermission('materials.edit'),
  rawMaterialsController.updateStatus,
);
router.patch(
  '/:id/stock',
  requirePermission('materials.manageStock'),
  rawMaterialsController.adjustStock,
);
router.patch(
  '/:id',
  requirePermission('materials.edit'),
  rawMaterialsController.update,
);

export {
  DuplicateRawMaterialKeyError,
  InsufficientRawMaterialStockError,
  RawMaterialsRepository,
} from './repository/raw-materials.repository';
export {
  InactiveRawMaterialAccessForbiddenError,
  InactiveRawMaterialSelectionError,
  IncompatibleMaterialUnitError,
  InsufficientStockQuantityError,
  InvalidRawMaterialIdError,
  mapRawMaterialToPurchaseReference,
  mapRawMaterialToResponse,
  RawMaterialAlreadyExistsError,
  RawMaterialNotFoundError,
  RawMaterialUnitConflictError,
  RawMaterialsService,
} from './service/raw-materials.service';
export { RawMaterialsController };

export * from './models/raw-material.model';
export * from './types';
export * from './dto/create-raw-material.dto';
export * from './dto/update-raw-material.dto';
export * from './dto/get-raw-materials.dto';

export default router;
