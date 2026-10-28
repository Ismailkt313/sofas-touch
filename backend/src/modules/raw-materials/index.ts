import { Router } from 'express';
import {
  requireAdmin,
  requireDataEntryOrAdmin,
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

router.get('/', requireDataEntryOrAdmin, rawMaterialsController.list);
router.get('/:id', requireDataEntryOrAdmin, rawMaterialsController.getById);
router.post('/', requireAdmin, rawMaterialsController.create);
router.patch(
  '/:id/status',
  requireAdmin,
  rawMaterialsController.updateStatus,
);
router.patch('/:id', requireAdmin, rawMaterialsController.update);

export {
  DuplicateRawMaterialKeyError,
  RawMaterialsRepository,
} from './repository/raw-materials.repository';
export {
  InactiveRawMaterialAccessForbiddenError,
  InactiveRawMaterialSelectionError,
  InvalidRawMaterialIdError,
  mapRawMaterialToPurchaseReference,
  mapRawMaterialToResponse,
  RawMaterialAlreadyExistsError,
  RawMaterialNotFoundError,
  RawMaterialsService,
} from './service/raw-materials.service';
export { RawMaterialsController };

export * from './models/raw-material.model';
export * from './types';
export * from './dto/create-raw-material.dto';
export * from './dto/update-raw-material.dto';
export * from './dto/get-raw-materials.dto';

export default router;
