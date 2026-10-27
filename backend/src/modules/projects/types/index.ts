import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../types/auth';
import { CreateProjectDto } from '../dto/create-project.dto';
import {
  EvaluateActivityWarningsDto,
  ListActivityWarningsDto,
  ListProjectAlertsDto,
  ListProjectsDto,
} from '../dto/list-projects.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import {
  AlertLifecycleStatus,
  CostThresholdAlertType,
  IProjectActivityWarning,
  IProjectCostAlert,
} from '../models/project-alert.model';
import {
  IProject,
  IProjectCostThresholdState,
  ProjectActivityEventType,
  ProjectCategory,
  ProjectStatus,
} from '../models/project.model';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateProjectStatusDto {
  status: ProjectStatus;
}

export interface IProjectController {
  list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getFinancialSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  listFinancialSummaries(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  recalculateFinancials(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  listCostAlerts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  getProjectCostAlerts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  listActivityWarnings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  evaluateActivityWarnings(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
}

export interface ProjectFinancialSummaryDto {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  status: ProjectStatus;
  contractValue: number;
  totalPurchases: number;
  totalOtherExpenses: number;
  totalCost: number;
  estimatedProfit: number;
  costPercentage: number;
  estimatedProfitMargin: number;
  profitType: 'estimated';
  isAudited: false;
  costAlertThresholdPercent: number;
  costThresholdState: {
    warningCrossed: boolean;
    exceededCrossed: boolean;
    warningThresholdPercent: number;
  };
  financialSummaryUpdatedAt: Date;
}

export interface ProjectResponseDto {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  category: ProjectCategory;
  status: ProjectStatus;
  description: string;
  contractValue: number;
  totalPurchases: number;
  totalOtherExpenses: number;
  totalCost: number;
  estimatedProfit: number;
  costPercentage: number;
  estimatedProfitMargin: number;
  profitType: 'estimated';
  isAudited: false;
  costAlertThresholdPercent: number;
  costThresholdState: {
    warningCrossed: boolean;
    exceededCrossed: boolean;
    warningThresholdPercent: number;
  };
  lastActivityAt: Date;
  lastActivityType: ProjectActivityEventType;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProjectCostAlertResponseDto {
  id: string;
  projectRecordId: string;
  projectId: string;
  projectName: string;
  thresholdType: CostThresholdAlertType;
  thresholdPercent: number;
  contractValue: number;
  totalCost: number;
  costPercentage: number;
  message: string;
  status: AlertLifecycleStatus;
  triggeredAt: Date;
  resolvedAt: Date | null;
  resolvedReason: string | null;
}

export interface ProjectActivityWarningResponseDto {
  id: string;
  projectRecordId: string;
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  lastActivityAt: Date;
  inactiveDays: number;
  inactivityThresholdDays: number;
  message: string;
  status: AlertLifecycleStatus;
  triggeredAt: Date;
  resolvedAt: Date | null;
  resolvedReason: string | null;
}

export interface VoucherMutationEvent {
  projectId: string;
  voucherType: 'purchase' | 'expense';
  action: 'created' | 'updated' | 'deleted';
  occurredAt?: Date;
}

export interface ActivityEvaluationSummary {
  evaluatedCount: number;
  newlyTriggeredCount: number;
  activeWarningsCount: number;
  inactivityThresholdDays: number;
  schedulerConfigured: boolean;
  warnings: ProjectActivityWarningResponseDto[];
}

export interface ProjectFinancialCalculationInput {
  contractValue: number;
  totalPurchases: number;
  totalOtherExpenses: number;
}

export interface ProjectFinancialMetrics {
  contractValue: number;
  totalPurchases: number;
  totalOtherExpenses: number;
  totalCost: number;
  estimatedProfit: number;
  costPercentage: number;
  estimatedProfitMargin: number;
  profitType: 'estimated';
  isAudited: false;
}

export interface CostThresholdTransitionResult {
  nextState: IProjectCostThresholdState;
  triggerWarningAlert: boolean;
  resolveWarningAlert: boolean;
  triggerCriticalAlert: boolean;
  resolveCriticalAlert: boolean;
  criticalThresholdPercent: number;
}

export interface ProjectVoucherAggregationTotals {
  totalPurchases: number;
  totalOtherExpenses: number;
  latestVoucherActivityAt: Date | null;
}

export interface IVoucherTotalsProvider {
  aggregateProjectVouchers(
    projectRecordId: string,
    projectCode: string,
  ): Promise<ProjectVoucherAggregationTotals>;
  isPurchaseIntegrationActive(): boolean;
  isExpenseIntegrationActive(): boolean;
}

export interface IProjectService {
  setVoucherTotalsProvider(provider: IVoucherTotalsProvider): void;
  getVoucherIntegrationStatus(): {
    purchaseModuleIntegrated: boolean;
    expenseModuleIntegrated: boolean;
    schedulerConfigured: boolean;
  };
  createProject(
    dto: CreateProjectDto,
    createdBy: string,
  ): Promise<ProjectResponseDto>;
  listProjects(
    filters: ListProjectsDto,
  ): Promise<PaginatedResult<ProjectResponseDto>>;
  getProjectByIdOrCode(identifier: string): Promise<ProjectResponseDto>;
  updateProject(
    identifier: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto>;
  updateProjectStatus(
    identifier: string,
    status: ProjectStatus,
  ): Promise<ProjectResponseDto>;
  deleteProject(identifier: string): Promise<ProjectResponseDto>;
  getProjectFinancialSummary(
    identifier: string,
  ): Promise<ProjectFinancialSummaryDto>;
  listProjectFinancialSummaries(
    filters: ListProjectsDto,
  ): Promise<PaginatedResult<ProjectFinancialSummaryDto>>;
  recalculateProjectFinancials(
    identifier: string,
  ): Promise<ProjectFinancialSummaryDto>;
  syncAfterVoucherMutation(
    event: VoucherMutationEvent,
  ): Promise<{
    summary: ProjectFinancialSummaryDto;
    triggeredAlerts: ProjectCostAlertResponseDto[];
  }>;
  listCostAlerts(
    filters: ListProjectAlertsDto,
  ): Promise<PaginatedResult<ProjectCostAlertResponseDto>>;
  getProjectCostAlerts(
    identifier: string,
  ): Promise<{
    projectId: string;
    alerts: ProjectCostAlertResponseDto[];
  }>;
  evaluateProjectInactivity(options?: {
    inactivityDays?: number;
    referenceDate?: Date;
  }): Promise<ActivityEvaluationSummary>;
  listActivityWarnings(
    filters: ListActivityWarningsDto,
    referenceDate?: Date,
  ): Promise<
    PaginatedResult<ProjectActivityWarningResponseDto> & {
      inactivityThresholdDays: number;
      schedulerConfigured: boolean;
    }
  >;
}

export interface IProjectRepository {
  allocateNextProjectCode(): Promise<string>;
  createWithGeneratedCode(
    buildProject: (projectId: string) => Omit<IProject, '_id'>,
  ): Promise<IProject>;
  findProjects(filters: ListProjectsDto): Promise<PaginatedResult<IProject>>;
  findAllProjects(): Promise<IProject[]>;
  findAllNonCompletedProjects(): Promise<IProject[]>;
  findByIdOrCode(identifier: string): Promise<IProject | null>;
  updateByRecordId(
    recordId: string,
    updateData: Partial<IProject>,
  ): Promise<IProject | null>;
  deleteByRecordId(recordId: string): Promise<IProject | null>;
  createCostAlert(
    alertData: Omit<IProjectCostAlert, '_id'>,
  ): Promise<IProjectCostAlert>;
  resolveActiveCostAlerts(
    projectRecordId: string,
    thresholdType: CostThresholdAlertType,
    reason: string,
    resolvedAt?: Date,
  ): Promise<number>;
  findCostAlerts(
    filters: ListProjectAlertsDto,
  ): Promise<PaginatedResult<IProjectCostAlert>>;
  findCostAlertsByProject(projectRecordId: string): Promise<IProjectCostAlert[]>;
  createActivityWarning(
    warningData: Omit<IProjectActivityWarning, '_id'>,
  ): Promise<IProjectActivityWarning>;
  resolveActiveActivityWarnings(
    projectRecordId: string,
    reason: string,
    resolvedAt?: Date,
  ): Promise<number>;
  findActivityWarnings(filters: {
    page: number;
    limit: number;
    projectId?: string;
    status?: AlertLifecycleStatus;
  }): Promise<PaginatedResult<IProjectActivityWarning>>;
}
