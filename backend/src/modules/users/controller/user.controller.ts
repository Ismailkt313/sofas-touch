import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { activityService } from '../../activity';
import { validateListUsersDto } from '../dto/list-users.dto';
import { validateListPendingApprovalsDto } from '../dto/list-pending-approvals.dto';
import { validateRejectUserDto } from '../dto/reject-user.dto';
import { validateCreateUserDto } from '../dto/create-user.dto';
import { validateUpdateUserDto } from '../dto/update-user.dto';
import { validateUpdateStatusDto } from '../dto/update-status.dto';
import { cloudinaryService } from '../../../services/cloudinary.service';
import { IUserController, IUserService } from '../types';
import {
  InvalidOperationError,
  SelfApprovalError,
  SelfDeactivationError,
  UserAlreadyExistsError,
  UserNotFoundError,
} from '../service/user.service';

export { IUserController };

export class UserController implements IUserController {
  constructor(private userService: IUserService) {}

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateListUsersDto(
        req.query as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid query parameters.',
          errors: validation.errors,
        });
        return;
      }

      const result = await this.userService.listUsers(validation.value);
      res.status(200).json({
        ...result,
        approvalsSupported: true,
        capabilities: {
          canApprove: true,
          canReject: true,
          supportsRejectionReason: true,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  };

  listPendingApprovals = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateListPendingApprovalsDto(
        req.query as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid query parameters for pending approvals.',
          errors: validation.errors,
        });
        return;
      }

      const result = await this.userService.listPendingApprovals(validation.value);
      res.status(200).json({
        ...result,
        approvalsSupported: true,
        capabilities: {
          canApprove: true,
          canReject: true,
          supportsRejectionReason: true,
        },
      });
    } catch (error: unknown) {
      next(error);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Valid user ID is required.',
        });
        return;
      }

      const user = await this.userService.getUserById(id.trim());
      res.status(200).json({ user });
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateCreateUserDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed for user details.',
          errors: validation.errors,
        });
        return;
      }

      const currentAdminId = req.user?.id || req.user?.email || '';
      const adminName = req.user?.name || req.user?.email || 'Administrator';
      const user = await this.userService.createUser(
        validation.value,
        currentAdminId,
      );

      await activityService.recordSafe({
        actionType: 'user.created',
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.name,
        description: `Created Data Entry user account for ${user.name}.`,
        actorId: currentAdminId || 'admin',
        actorName: adminName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/users',
      });

      res.status(201).json({
        message: 'User created successfully.',
        user,
      });
    } catch (error: unknown) {
      if (error instanceof UserAlreadyExistsError) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };

  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Valid user ID is required.',
        });
        return;
      }

      const validation = validateUpdateUserDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed for user update.',
          errors: validation.errors,
        });
        return;
      }

      const currentAdminId = req.user?.id || req.user?.email || '';
      const adminName = req.user?.name || req.user?.email || 'Administrator';
      const user = await this.userService.updateUser(
        id.trim(),
        validation.value,
        currentAdminId,
      );

      await activityService.recordSafe({
        actionType: 'user.updated',
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.name,
        description: `Updated user account profile for ${user.name}.`,
        actorId: currentAdminId || 'admin',
        actorName: adminName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/users',
      });

      res.status(200).json({
        message: 'User updated successfully.',
        user,
      });
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      if (error instanceof UserAlreadyExistsError) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
        return;
      }

      if (error instanceof InvalidOperationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      if (error instanceof SelfDeactivationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };

  updateStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Valid user ID is required.',
        });
        return;
      }

      const validation = validateUpdateStatusDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed for status update.',
          errors: validation.errors,
        });
        return;
      }

      const currentAdminId = req.user?.id || req.user?.email || '';
      const adminName = req.user?.name || req.user?.email || 'Administrator';
      const user = await this.userService.updateUserStatus(
        id.trim(),
        validation.value.isActive,
        currentAdminId,
      );

      await activityService.recordSafe({
        actionType: 'user.status_changed',
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.name,
        description: `${user.isActive ? 'Activated' : 'Deactivated'} user account for ${user.name}.`,
        actorId: currentAdminId || 'admin',
        actorName: adminName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/users',
      });

      res.status(200).json({
        message: 'User status updated successfully.',
        user,
      });
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      if (error instanceof SelfDeactivationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };

  approveUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Valid user ID is required.',
        });
        return;
      }

      const currentAdminId = req.user?.id || req.user?.email || '';
      const adminName = req.user?.name || req.user?.email || 'Administrator';
      const user = await this.userService.approveUser(id.trim(), currentAdminId);

      await activityService.recordSafe({
        actionType: 'user.approved',
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.name,
        description: `Approved Data Entry registration for ${user.name}.`,
        actorId: currentAdminId || 'admin',
        actorName: adminName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/users',
      });

      res.status(200).json({
        message: 'User account approved successfully.',
        user,
      });
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      if (error instanceof SelfApprovalError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      if (error instanceof InvalidOperationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };

  rejectUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string' || !id.trim()) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Valid user ID is required.',
        });
        return;
      }

      const validation = validateRejectUserDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed for account rejection.',
          errors: validation.errors,
        });
        return;
      }

      const currentAdminId = req.user?.id || req.user?.email || '';
      const adminName = req.user?.name || req.user?.email || 'Administrator';
      const user = await this.userService.rejectUser(
        id.trim(),
        currentAdminId,
        validation.value.reason,
      );

      await activityService.recordSafe({
        actionType: 'user.rejected',
        entityType: 'user',
        entityId: user.id,
        entityLabel: user.name,
        description: `Rejected Data Entry registration request for ${user.name}.`,
        actorId: currentAdminId || 'admin',
        actorName: adminName,
        actorRole: 'admin',
        visibility: 'admin_only',
        targetPath: '/user-approvals',
      });

      res.status(200).json({
        message: 'User account registration rejected.',
        user,
      });
    } catch (error: unknown) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      if (error instanceof SelfApprovalError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      if (error instanceof InvalidOperationError) {
        res.status(400).json({
          error: 'Bad Request',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };

  uploadAvatar = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const rawId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const id = String(rawId || '').trim();
      const callerId = req.user?.id || '';
      const callerRole = req.user?.role || '';
      const callerPermissions = req.user?.permissions || [];
      const hasManage =
        callerRole === 'admin' || callerPermissions.includes('users.manage');

      if (id !== callerId && !hasManage) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to update this user avatar.',
        });
        return;
      }

      const file = req.file;
      if (!file || !file.buffer || file.buffer.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'No image file was uploaded.',
        });
        return;
      }

      let imageUrl: string;
      if (cloudinaryService.isConfigured()) {
        const uploadResult = await cloudinaryService.uploadImage(
          file.buffer,
          file.originalname || 'avatar.jpg',
          {
            folder: 'softtouch/avatars',
            transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
          },
        );
        imageUrl = uploadResult.secureUrl;
      } else {
        const mime = file.mimetype || 'image/jpeg';
        imageUrl = `data:${mime};base64,${file.buffer.toString('base64')}`;
      }

      const user = await this.userService.updateUser(
        id,
        { image: imageUrl },
        callerId,
      );

      res.status(200).json({
        message: 'Avatar updated successfully.',
        imageUrl,
        user,
      });
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };
}
