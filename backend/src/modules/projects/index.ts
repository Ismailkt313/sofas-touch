import { Router } from 'express';
import {
  requirePermission,
  verifyToken,
} from '../../middleware/auth';
import {
  ProjectController,
  IProjectController,
} from './controller/project.controller';
import {
  CreateProjectDto,
  validateCreateProjectDto,
} from './dto/create-project.dto';
import {
  EvaluateActivityWarningsDto,
  ListActivityWarningsDto,
  ListProjectAlertsDto,
  ListProjectsDto,
  validateEvaluateActivityWarningsDto,
  validateListActivityWarningsDto,
  validateListProjectAlertsDto,
  validateListProjectsDto,
} from './dto/list-projects.dto';
import {
  UpdateProjectDto,
  validateUpdateProjectDto,
} from './dto/update-project.dto';
import {
  UpdateProjectStatusDto,
  validateUpdateProjectStatusDto,
} from './dto/update-status.dto';
import {
  IProjectActivityWarning,
  IProjectCostAlert,
  ProjectActivityWarningModel,
  ProjectCostAlertModel,
  sharedProjectActivityWarningMemoryStore,
  sharedProjectCostAlertMemoryStore,
} from './models/project-alert.model';
import {
  extractProjectSequenceNumber,
  formatProjectSequenceCode,
  PROJECT_SEQUENCE_COUNTER_ID,
  ProjectCounterModel,
  sharedProjectCounterMemoryStore,
} from './models/project-counter.model';
import {
  IProject,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  ProjectCategory,
  ProjectModel,
  ProjectStatus,
  sharedProjectMemoryStore,
} from './models/project.model';
import {
  IProjectRepository,
  ProjectPersistenceError,
  ProjectRepository,
} from './repository/project.repository';
import {
  calculateProjectFinancialMetrics,
  evaluateCostThresholdTransitions,
  IVoucherTotalsProvider,
  MongooseVoucherTotalsProvider,
  NoopVoucherTotalsProvider,
  ProjectFinancialCalculationInput,
  ProjectFinancialMetrics,
  ProjectVoucherAggregationTotals,
  roundFinancialAmount,
  roundPercentage,
} from './service/project-financial.service';
import {
  ActivityEvaluationSummary,
  InvalidProjectOperationError,
  IProjectService,
  ProjectActivityWarningResponseDto,
  ProjectCostAlertResponseDto,
  ProjectFinancialSummaryDto,
  ProjectNotFoundError,
  ProjectResponseDto,
  ProjectService,
  VoucherMutationEvent,
} from './service/project.service';

const projectRepository: IProjectRepository = new ProjectRepository(
  ProjectModel,
  ProjectCounterModel,
  ProjectCostAlertModel,
  ProjectActivityWarningModel,
);
const projectService: IProjectService = new ProjectService(projectRepository);
const projectController: IProjectController = new ProjectController(
  projectService,
);

const projectRouter = Router();

projectRouter.use(verifyToken);

projectRouter.get(
  '/alerts',
  requirePermission('reports.viewProfitability'),
  projectController.listCostAlerts,
);
projectRouter.get(
  '/activity-warnings',
  requirePermission('projects.edit'),
  projectController.listActivityWarnings,
);
projectRouter.post(
  '/activity-warnings/evaluate',
  requirePermission('projects.edit'),
  projectController.evaluateActivityWarnings,
);
projectRouter.get(
  '/financial-summaries',
  requirePermission('reports.viewProfitability'),
  projectController.listFinancialSummaries,
);

projectRouter.get(
  '/',
  requirePermission('projects.view'),
  projectController.list,
);
projectRouter.post(
  '/',
  requirePermission('projects.create'),
  projectController.create,
);
projectRouter.get(
  '/:id/financial-summary',
  requirePermission('reports.viewProfitability'),
  projectController.getFinancialSummary,
);
projectRouter.post(
  '/:id/recalculate-financials',
  requirePermission('reports.viewProfitability'),
  projectController.recalculateFinancials,
);
projectRouter.get(
  '/:id/alerts',
  requirePermission('reports.viewProfitability'),
  projectController.getProjectCostAlerts,
);
projectRouter.get(
  '/:id',
  requirePermission('projects.view'),
  projectController.getById,
);
projectRouter.patch(
  '/:id/status',
  requirePermission('projects.edit'),
  projectController.updateStatus,
);
projectRouter.patch(
  '/:id',
  requirePermission('projects.edit'),
  projectController.update,
);
projectRouter.delete(
  '/:id',
  requirePermission('projects.delete'),
  projectController.remove,
);

export {
  projectRouter,
  projectController,
  projectService,
  projectRepository,
  ProjectController,
  ProjectService,
  ProjectRepository,
  ProjectModel,
  ProjectCounterModel,
  ProjectCostAlertModel,
  ProjectActivityWarningModel,
  sharedProjectMemoryStore,
  sharedProjectCounterMemoryStore,
  sharedProjectCostAlertMemoryStore,
  sharedProjectActivityWarningMemoryStore,
  PROJECT_SEQUENCE_COUNTER_ID,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  formatProjectSequenceCode,
  extractProjectSequenceNumber,
  calculateProjectFinancialMetrics,
  evaluateCostThresholdTransitions,
  roundFinancialAmount,
  roundPercentage,
  NoopVoucherTotalsProvider,
  MongooseVoucherTotalsProvider,
  validateCreateProjectDto,
  validateUpdateProjectDto,
  validateUpdateProjectStatusDto,
  validateListProjectsDto,
  validateListProjectAlertsDto,
  validateListActivityWarningsDto,
  validateEvaluateActivityWarningsDto,
  ProjectNotFoundError,
  InvalidProjectOperationError,
  ProjectPersistenceError,
};

export * from './types';

export type {
  IProject,
  IProjectCostAlert,
  IProjectActivityWarning,
  ProjectCategory,
  ProjectStatus,
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
  ListProjectsDto,
  ListProjectAlertsDto,
  ListActivityWarningsDto,
  EvaluateActivityWarningsDto,
  IProjectRepository,
  IProjectService,
  IProjectController,
  IVoucherTotalsProvider,
  ProjectVoucherAggregationTotals,
  ProjectFinancialCalculationInput,
  ProjectFinancialMetrics,
  ProjectFinancialSummaryDto,
  ProjectResponseDto,
  ProjectCostAlertResponseDto,
  ProjectActivityWarningResponseDto,
  VoucherMutationEvent,
  ActivityEvaluationSummary,
};

export default projectRouter;
