import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { validateLoginDto } from '../dto/login.dto';
import {
  IAuthService,
  InactiveAccountError,
  InvalidCredentialsError,
} from '../service/auth.service';

export interface IAuthController {
  login(req: Request, res: Response, next: NextFunction): Promise<void>;
  me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

export class AuthController implements IAuthController {
  constructor(private authService: IAuthService) {}

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
      if (
        error instanceof InvalidCredentialsError ||
        error instanceof InactiveAccountError
      ) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };
}
