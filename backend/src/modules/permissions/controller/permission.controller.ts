import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { activityService } from '../../activity';
import {
  validateUpdateRolePermissionsDto,
  validateUpdateUserPermissionOverridesDto,
} from '../dto/permission.dto';
import {
  InvalidPermissionTargetError,
  PermissionService,
  PermissionTargetNotFoundError,
} from '../service/permission.service';

export class PermissionController {
  constructor(private readonly service: PermissionService) {}

  getOverview = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const overview = await this.service.getManagementOverview();
      res.status(200).json(overview);
    } catch (err) {
      next(err);
    }
  };

  updateDataEntryRole = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const roleParam = String(req.params.role || '').trim().toLowerCase();
      if (roleParam && roleParam !== 'data_entry') {
        res.status(400).json({
          error: 'Bad Request',
          message:
            'Only Data Entry role permissions are configurable. Administrator permissions are protected against lockout.',
        });
        return;
      }

      const validation = validateUpdateRolePermissionsDto(req.body);
      if (!validation.isValid || !validation.value) {
        const firstMsg = validation.errors
          ? Object.values(validation.errors)[0]
          : 'Invalid role permissions payload.';
        res.status(400).json({
          error: 'Bad Request',
          message: firstMsg,
          errors: validation.errors,
        });
        return;
      }

      const actorId = req.user?.id || 'admin';
      const actorName = req.user?.name || req.user?.email || 'Administrator';

      const result = await this.service.updateDataEntryPermissions({
        permissions: validation.value.permissions,
        actorId,
        actorName,
      });

      await activityService.recordSafe({
        actionType: 'permissions.updated',
        entityType: 'permission',
        entityId: 'data_entry',
        entityLabel: 'Data Entry Role Permissions',
        description: `Updated default employee access (${result.saved.permissions.length} active permissions).`,
        actorId,
        actorName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/permissions',
      });

      res.status(200).json({
        message: 'Data Entry role permissions saved successfully.',
        ...result.overview,
      });
    } catch (err) {
      next(err);
    }
  };

  resetDataEntryRole = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = req.user?.id || 'admin';
      const actorName = req.user?.name || req.user?.email || 'Administrator';

      const result = await this.service.resetDataEntryPermissions({
        actorId,
        actorName,
      });

      await activityService.recordSafe({
        actionType: 'permissions.reset',
        entityType: 'permission',
        entityId: 'data_entry',
        entityLabel: 'Data Entry Role Permissions',
        description:
          'Restored Data Entry Operator permissions to the recommended secure defaults.',
        actorId,
        actorName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/permissions',
      });

      res.status(200).json({
        message: 'Data Entry permissions restored to recommended defaults.',
        ...result.overview,
      });
    } catch (err) {
      next(err);
    }
  };

  updateUserOverrides = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const rawId = req.params.userId;
      const targetUserId = Array.isArray(rawId) ? rawId[0] : rawId;

      if (targetUserId && req.user?.id && targetUserId === req.user.id) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'You cannot modify your own permission overrides.',
        });
        return;
      }

      const validation = validateUpdateUserPermissionOverridesDto(req.body);
      if (!validation.isValid || !validation.value) {
        const firstMsg = validation.errors
          ? Object.values(validation.errors)[0]
          : 'Invalid user permission override payload.';
        res.status(400).json({
          error: 'Bad Request',
          message: firstMsg,
          errors: validation.errors,
        });
        return;
      }

      const updated = await this.service.updateUserOverrides({
        targetUserId: String(targetUserId || ''),
        dto: validation.value,
      });

      const actorId = req.user?.id || 'admin';
      const actorName = req.user?.name || req.user?.email || 'Administrator';

      await activityService.recordSafe({
        actionType: 'permissions.user_overridden',
        entityType: 'permission',
        entityId: String(updated.user._id || targetUserId),
        entityLabel: updated.user.name,
        description: `Updated access for ${updated.user.name}.`,
        actorId,
        actorName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/permissions',
      });

      const overview = await this.service.getManagementOverview();
      res.status(200).json({
        message: `Saved permission overrides for ${updated.user.name}.`,
        effectivePermissions: updated.effectivePermissions,
        ...overview,
      });
    } catch (err) {
      if (err instanceof PermissionTargetNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: err.message,
        });
        return;
      }
      if (err instanceof InvalidPermissionTargetError) {
        res.status(400).json({
          error: 'Bad Request',
          message: err.message,
        });
        return;
      }
      next(err);
    }
  };
}
