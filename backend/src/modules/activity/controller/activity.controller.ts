import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import {
  validateListActivitiesQuery,
  validateRecentActivitiesQuery,
} from '../dto/activity.dto';
import { ActivityService } from '../service/activity.service';
import { ActivityCallerIdentity } from '../types';

function extractCaller(req: AuthenticatedRequest): ActivityCallerIdentity {
  return {
    id: String(req.user?.id || ''),
    email: String(req.user?.email || ''),
    name: String(req.user?.name || req.user?.email || 'Workspace User'),
    role: req.user?.role === 'admin' ? 'admin' : 'data_entry',
  };
}

export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  listRecent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateRecentActivitiesQuery(
        (req.query || {}) as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid query parameters for recent activity.',
          errors: validation.errors,
        });
        return;
      }

      const caller = extractCaller(req);
      const result = await this.service.listRecent(
        validation.value.limit,
        caller,
      );

      res.status(200).json({
        activities: result.items,
        items: result.items,
        limit: result.limit,
      });
    } catch (error: unknown) {
      next(error);
    }
  };

  listPaginated = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateListActivitiesQuery(
        (req.query || {}) as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        const firstMsg = validation.errors
          ? Object.values(validation.errors)[0]
          : 'Invalid query parameters for activity history.';
        res.status(400).json({
          error: 'Bad Request',
          message: firstMsg,
          errors: validation.errors,
        });
        return;
      }

      const caller = extractCaller(req);
      const result = await this.service.listPaginated(validation.value, caller);

      res.status(200).json({
        activities: result.items,
        ...result,
      });
    } catch (error: unknown) {
      next(error);
    }
  };
}
