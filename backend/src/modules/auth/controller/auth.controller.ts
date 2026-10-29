import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { activityService } from '../../activity';
import { validateLoginDto } from '../dto/login.dto';
import { validateSignupDto } from '../dto/signup.dto';
import { IAuthController, IAuthService } from '../types';
import {
  InactiveAccountError,
  InvalidCredentialsError,
  PendingApprovalError,
  RejectedAccountError,
  UserAlreadyExistsError,
} from '../service/auth.service';

export { IAuthController };

export class AuthController implements IAuthController {
  constructor(private authService: IAuthService) {}

  signup = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateSignupDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed for registration details.',
          errors: validation.errors,
        });
        return;
      }

      const result = await this.authService.signup(validation.value);

      await activityService.recordSafe({
        actionType: 'user.registered',
        entityType: 'user',
        entityId: result.user.id,
        entityLabel: result.user.name,
        description: `${result.user.name} submitted a Data Entry registration request.`,
        actorId: result.user.id,
        actorName: result.user.name,
        actorRole: 'public',
        visibility: 'admin_only',
        targetPath: '/user-approvals',
      });

      res.status(201).json({
        message:
          'Registration submitted successfully. Your account is pending administrator approval.',
        user: result.user,
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

  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateLoginDto(req.body);
      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Validation failed for login credentials.',
          errors: validation.errors,
        });
        return;
      }

      const result = await this.authService.login(validation.value);

      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
        return;
      }

      if (error instanceof InactiveAccountError) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
          code: 'ACCOUNT_INACTIVE',
        });
        return;
      }

      if (error instanceof PendingApprovalError) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
          code: 'PENDING_APPROVAL',
        });
        return;
      }

      if (error instanceof RejectedAccountError) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
          code: 'ACCOUNT_REJECTED',
        });
        return;
      }

      next(error);
    }
  };

  me = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication token required.',
        });
        return;
      }

      const user = await this.authService.getCurrentUser(req.user.id);
      res.status(200).json({ user });
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
        return;
      }

      if (error instanceof InactiveAccountError) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
          code: 'ACCOUNT_INACTIVE',
        });
        return;
      }

      if (error instanceof PendingApprovalError) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
          code: 'PENDING_APPROVAL',
        });
        return;
      }

      if (error instanceof RejectedAccountError) {
        res.status(403).json({
          error: 'Forbidden',
          message: error.message,
          code: 'ACCOUNT_REJECTED',
        });
        return;
      }

      next(error);
    }
  };
}
