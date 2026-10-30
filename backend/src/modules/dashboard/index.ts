import { Router } from 'express';
import {
  requireAllPermissions,
  requirePermission,
  verifyToken,
} from '../../middleware/auth';
import { DashboardController } from './controller/dashboard.controller';
import { DashboardRepository } from './repository/dashboard.repository';
import { DashboardService } from './service/dashboard.service';

export const dashboardRepository = new DashboardRepository();
export const dashboardService = new DashboardService(dashboardRepository);
export const dashboardController = new DashboardController(dashboardService);

const dashboardRouter = Router();

dashboardRouter.use(verifyToken);

dashboardRouter.get(
  '/overview',
  requirePermission('dashboard.view'),
  dashboardController.getOverview,
);
dashboardRouter.get(
  '/monthly-expenses',
  requireAllPermissions(['dashboard.view', 'reports.viewProfitability']),
  dashboardController.getMonthlyExpenses,
);

export { DashboardController, DashboardRepository, DashboardService };
export * from './dto/dashboard.dto';
export * from './types';

export default dashboardRouter;
