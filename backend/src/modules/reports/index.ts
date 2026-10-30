import { Router } from 'express';
import {
  requireAllPermissions,
  requirePermission,
  verifyToken,
} from '../../middleware/auth';
import { ReportsController } from './controller/reports.controller';
import { ReportsRepository } from './repository/reports.repository';
import { ReportsService } from './service/reports.service';

export const reportsRepository = new ReportsRepository();
export const reportsService = new ReportsService(reportsRepository);
export const reportsController = new ReportsController(reportsService);

const reportsRouter = Router();

reportsRouter.use(verifyToken);

reportsRouter.get(
  '/projects',
  requirePermission('reports.view'),
  reportsController.listProjectReports,
);
reportsRouter.get(
  '/projects/export',
  requireAllPermissions(['reports.view', 'reports.viewProfitability']),
  reportsController.exportProjectReportsCsv,
);
reportsRouter.get(
  '/projects/:id/pdf',
  requireAllPermissions(['reports.view', 'reports.viewProfitability']),
  reportsController.exportIndividualProjectReportPdf,
);
reportsRouter.get(
  '/projects/:id',
  requirePermission('reports.view'),
  reportsController.getIndividualProjectReport,
);

export * from './types';
export * from './dto/reports.dto';
export * from './repository/reports.repository';
export * from './service/reports.service';
export * from './controller/reports.controller';
export * from './utils/report-exporters';

export default reportsRouter;
