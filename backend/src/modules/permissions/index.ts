import { Router } from 'express';
import { requirePermission, verifyToken } from '../../middleware/auth';
import { PermissionController } from './controller/permission.controller';
import {
  permissionRepository,
  permissionService,
} from './service/permission.service';

export const permissionController = new PermissionController(permissionService);

const permissionRouter = Router();

permissionRouter.use(verifyToken);
permissionRouter.use(requirePermission('permissions.manage'));

permissionRouter.get('/', permissionController.getOverview);
permissionRouter.put(
  '/roles/:role',
  permissionController.updateDataEntryRole,
);
permissionRouter.post(
  '/roles/data_entry/reset',
  permissionController.resetDataEntryRole,
);
permissionRouter.put(
  '/users/:userId',
  permissionController.updateUserOverrides,
);

export * from './constants/permissions.constants';
export * from './dto/permission.dto';
export * from './models/role-permission.model';
export * from './repository/permission.repository';
export * from './service/permission.service';
export { PermissionController };

export default permissionRouter;
