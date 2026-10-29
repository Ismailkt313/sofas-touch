import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import {
  validateDashboardMonthlyExpensesQuery,
  validateDashboardOverviewQuery,
} from '../dto/dashboard.dto';
import { DashboardService } from '../service/dashboard.service';
import { DashboardCallerIdentity } from '../types';

function extractCaller(req: AuthenticatedRequest): DashboardCallerIdentity {
  return {
    id: String(req.user?.id || ''),
    email: String(req.user?.email || ''),
    name: String(req.user?.name || req.user?.email || 'Workspace User'),
    role: req.user?.role === 'admin' ? 'admin' : 'data_entry',
  };
}

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  getOverview = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateDashboardOverviewQuery(
        (req.query || {}) as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        const firstMsg = validation.errors
          ? Object.values(validation.errors)[0]
          : 'Invalid dashboard query parameters.';
        res.status(400).json({
          error: 'Bad Request',
          message: firstMsg,
          errors: validation.errors,
        });
        return;
      }

      const caller = extractCaller(req);
      const overview = await this.service.getOverview(validation.value, caller);
      res.status(200).json(overview);
    } catch (err) {
      next(err);
    }
  };

  getMonthlyExpenses = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const validation = validateDashboardMonthlyExpensesQuery(
        (req.query || {}) as Record<string, unknown>,
      );

      if (!validation.isValid || !validation.value) {
        const firstMsg = validation.errors
          ? Object.values(validation.errors)[0]
          : 'Invalid monthly expense query parameters.';
        res.status(400).json({
          error: 'Bad Request',
          message: firstMsg,
          errors: validation.errors,
        });
        return;
      }

      const result = await this.service.getMonthlyExpenses(validation.value);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
