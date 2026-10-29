import { Router } from 'express';
import { requireAdmin, verifyToken } from '../../middleware/auth';
import { ReportsController } from './controller/reports.controller';
import { ReportsRepository } from './repository/reports.repository';
import { ReportsService } from './service/reports.service';

export const reportsRepository = new ReportsRepository();
export const reportsService = new ReportsService(reportsRepository);
export const reportsController = new ReportsController(reportsService);

const reportsRouter = Router();

reportsRouter.use(verifyToken);
reportsRouter.use(requireAdmin);

reportsRouter.get('/projects', reportsController.listProjectReports);
reportsRouter.get('/projects/export', reportsController.exportProjectReportsCsv);
reportsRouter.get(
  '/projects/:id/pdf',
  reportsController.exportIndividualProjectReportPdf,
);
reportsRouter.get(
  '/projects/:id',
  reportsController.getIndividualProjectReport,
);

export * from './types';
export * from './dto/reports.dto';
export * from './repository/reports.repository';
export * from './service/reports.service';
export * from './controller/reports.controller';
export * from './utils/report-exporters';

export default reportsRouter;
