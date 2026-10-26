import { env } from '../../../config/env';
import { CreateProjectDto } from '../dto/create-project.dto';
import {
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
  ProjectActivityEventType,
  ProjectCategory,
  ProjectStatus,
} from '../models/project.model';
import {
  IProjectRepository,
  PaginatedResult,
} from '../repository/project.repository';
import {
  calculateProjectFinancialMetrics,
  evaluateCostThresholdTransitions,
  IVoucherTotalsProvider,
  NoopVoucherTotalsProvider,
} from './project-financial.service';

export class ProjectNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Project '${identifier}' was not found.`);
    this.name = 'ProjectNotFoundError';
  }
}

export class InvalidProjectOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProjectOperationError';
  }
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function mapProjectResponse(project: IProject): ProjectResponseDto {
  const metrics = calculateProjectFinancialMetrics({
    contractValue: project.contractValue,
    totalPurchases: project.totalPurchases,
    totalOtherExpenses: project.totalOtherExpenses,
  });

  return {
    id: String(project._id),
    projectId: project.projectId,
    name: project.name,
    clientName: project.clientName,
    category: project.category,
    status: project.status,
    description: project.description || '',
    contractValue: metrics.contractValue,
    totalPurchases: metrics.totalPurchases,
    totalOtherExpenses: metrics.totalOtherExpenses,
    totalCost: metrics.totalCost,
    estimatedProfit: metrics.estimatedProfit,
    costPercentage: metrics.costPercentage,
    estimatedProfitMargin: metrics.estimatedProfitMargin,
    profitType: 'estimated',
    isAudited: false,
    costAlertThresholdPercent: project.costAlertThresholdPercent,
    costThresholdState: {
      warningCrossed: Boolean(project.costThresholdState?.warningCrossed),
      exceededCrossed: Boolean(project.costThresholdState?.exceededCrossed),
      warningThresholdPercent:
        project.costThresholdState?.warningThresholdPercent ??
        project.costAlertThresholdPercent,
    },
    lastActivityAt: project.lastActivityAt,
    lastActivityType: project.lastActivityType,
    createdBy: project.createdBy,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

function mapFinancialSummary(project: IProject): ProjectFinancialSummaryDto {
  const metrics = calculateProjectFinancialMetrics({
    contractValue: project.contractValue,
    totalPurchases: project.totalPurchases,
    totalOtherExpenses: project.totalOtherExpenses,
  });

  return {
    id: String(project._id),
    projectId: project.projectId,
    name: project.name,
    clientName: project.clientName,
    status: project.status,
    contractValue: metrics.contractValue,
    totalPurchases: metrics.totalPurchases,
    totalOtherExpenses: metrics.totalOtherExpenses,
    totalCost: metrics.totalCost,
    estimatedProfit: metrics.estimatedProfit,
    costPercentage: metrics.costPercentage,
    estimatedProfitMargin: metrics.estimatedProfitMargin,
    profitType: 'estimated',
    isAudited: false,
    costAlertThresholdPercent: project.costAlertThresholdPercent,
    costThresholdState: {
      warningCrossed: Boolean(project.costThresholdState?.warningCrossed),
      exceededCrossed: Boolean(project.costThresholdState?.exceededCrossed),
      warningThresholdPercent:
        project.costThresholdState?.warningThresholdPercent ??
        project.costAlertThresholdPercent,
    },
    financialSummaryUpdatedAt: project.financialSummaryUpdatedAt,
  };
}

function mapCostAlertResponse(
  alert: IProjectCostAlert,
): ProjectCostAlertResponseDto {
  return {
    id: String(alert._id),
    projectRecordId: alert.projectRecordId,
    projectId: alert.projectId,
    projectName: alert.projectName,
    thresholdType: alert.thresholdType,
    thresholdPercent: alert.thresholdPercent,
    contractValue: alert.contractValue,
    totalCost: alert.totalCost,
    costPercentage: alert.costPercentage,
    message: alert.message,
    status: alert.status,
    triggeredAt: alert.triggeredAt,
    resolvedAt: alert.resolvedAt ?? null,
    resolvedReason: alert.resolvedReason ?? null,
  };
}

function mapActivityWarningResponse(
  warning: IProjectActivityWarning,
): ProjectActivityWarningResponseDto {
  return {
    id: String(warning._id),
    projectRecordId: warning.projectRecordId,
    projectId: warning.projectId,
    projectName: warning.projectName,
    projectStatus: warning.projectStatus,
    lastActivityAt: warning.lastActivityAt,
    inactiveDays: warning.inactiveDays,
    inactivityThresholdDays: warning.inactivityThresholdDays,
    message: warning.message,
    status: warning.status,
    triggeredAt: warning.triggeredAt,
    resolvedAt: warning.resolvedAt ?? null,
    resolvedReason: warning.resolvedReason ?? null,
  };
}

export class ProjectService implements IProjectService {
  private projectLocks: Map<string, Promise<unknown>> = new Map();

  constructor(
    private projectRepository: IProjectRepository,
    private voucherTotalsProvider: IVoucherTotalsProvider = new NoopVoucherTotalsProvider(),
  ) {}

  setVoucherTotalsProvider(provider: IVoucherTotalsProvider): void {
    this.voucherTotalsProvider = provider;
  }

  getVoucherIntegrationStatus(): {
    purchaseModuleIntegrated: boolean;
    expenseModuleIntegrated: boolean;
    schedulerConfigured: boolean;
  } {
    return {
      purchaseModuleIntegrated:
        this.voucherTotalsProvider.isPurchaseIntegrationActive(),
      expenseModuleIntegrated:
        this.voucherTotalsProvider.isExpenseIntegrationActive(),
      schedulerConfigured: false,
    };
  }

  private async withProjectLock<T>(
    recordId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.projectLocks.get(recordId) || Promise.resolve();
    let releaseLock!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const chained = previous.then(() => gate, () => gate);
    this.projectLocks.set(recordId, chained);

    await previous.catch(() => undefined);

    try {
      return await operation();
    } finally {
      releaseLock();
      if (this.projectLocks.get(recordId) === chained) {
        this.projectLocks.delete(recordId);
      }
    }
  }

  private async persistThresholdTransitions(params: {
    recordId: string;
    projectId: string;
    projectName: string;
    contractValue: number;
    totalCost: number;
    costPercentage: number;
    warningThresholdPercent: number;
    previousState: IProject['costThresholdState'];
    now: Date;
  }): Promise<{
    nextState: IProject['costThresholdState'];
    triggeredAlerts: IProjectCostAlert[];
  }> {
    const transition = evaluateCostThresholdTransitions({
      previousState: params.previousState,
      contractValue: params.contractValue,
      totalCost: params.totalCost,
      warningThresholdPercent: params.warningThresholdPercent,
    });

    const triggeredAlerts: IProjectCostAlert[] = [];

    if (transition.resolveWarningAlert) {
      await this.projectRepository.resolveActiveCostAlerts(
        params.recordId,
        'warning',
        'cost_reduced_below_threshold',
        params.now,
      );
    }

    if (transition.resolveCriticalAlert) {
      await this.projectRepository.resolveActiveCostAlerts(
        params.recordId,
        'critical',
        'cost_reduced_below_threshold',
        params.now,
      );
    }

    if (transition.triggerWarningAlert) {
      const warningAlert = await this.projectRepository.createCostAlert({
        projectRecordId: params.recordId,
        projectId: params.projectId,
        projectName: params.projectName,
        thresholdType: 'warning',
        thresholdPercent: params.warningThresholdPercent,
        contractValue: params.contractValue,
        totalCost: params.totalCost,
        costPercentage: params.costPercentage,
        message: `Project ${params.projectId} (${params.projectName}) has reached ${params.costPercentage}% of contract value (warning threshold: ${params.warningThresholdPercent}%).`,
        status: 'active',
        triggeredAt: params.now,
        resolvedAt: null,
        resolvedReason: null,
      });
      triggeredAlerts.push(warningAlert);
    }

    if (transition.triggerCriticalAlert) {
      const criticalMessage =
        params.contractValue > 0
          ? `Project ${params.projectId} (${params.projectName}) total cost (${params.totalCost}) has reached or exceeded 100% of contract value (${params.costPercentage}%).`
          : `Project ${params.projectId} (${params.projectName}) has incurred costs (${params.totalCost}) against a zero contract value.`;

      const criticalAlert = await this.projectRepository.createCostAlert({
        projectRecordId: params.recordId,
        projectId: params.projectId,
        projectName: params.projectName,
        thresholdType: 'critical',
        thresholdPercent: transition.criticalThresholdPercent,
        contractValue: params.contractValue,
        totalCost: params.totalCost,
        costPercentage: params.costPercentage,
        message: criticalMessage,
        status: 'active',
        triggeredAt: params.now,
        resolvedAt: null,
        resolvedReason: null,
      });
      triggeredAlerts.push(criticalAlert);
    }

    return {
      nextState: transition.nextState,
      triggeredAlerts,
    };
  }

  async createProject(
    dto: CreateProjectDto,
    createdBy: string,
  ): Promise<ProjectResponseDto> {
    const now = new Date();
    const initialMetrics = calculateProjectFinancialMetrics({
      contractValue: dto.contractValue,
      totalPurchases: 0,
      totalOtherExpenses: 0,
    });

    const created = await this.projectRepository.createWithGeneratedCode(
      (generatedProjectCode) => ({
        projectId: generatedProjectCode,
        name: dto.name,
        clientName: dto.clientName,
        category: dto.category,
        status: dto.status,
        description: dto.description,
        contractValue: initialMetrics.contractValue,
        costAlertThresholdPercent: dto.costAlertThresholdPercent,
        totalPurchases: initialMetrics.totalPurchases,
        totalOtherExpenses: initialMetrics.totalOtherExpenses,
        totalCost: initialMetrics.totalCost,
        estimatedProfit: initialMetrics.estimatedProfit,
        costPercentage: initialMetrics.costPercentage,
        estimatedProfitMargin: initialMetrics.estimatedProfitMargin,
        financialSummaryUpdatedAt: now,
        costThresholdState: {
          warningCrossed: false,
          exceededCrossed: false,
          warningThresholdPercent: dto.costAlertThresholdPercent,
        },
        lastActivityAt: now,
        lastActivityType: 'project_created',
        inactivityWarningState: {
          activeWarningId: null,
          warnedForLastActivityAt: null,
        },
        createdBy: createdBy || 'unknown',
        createdAt: now,
        updatedAt: now,
      }),
    );

    return mapProjectResponse(created);
  }

  async listProjects(
    filters: ListProjectsDto,
  ): Promise<PaginatedResult<ProjectResponseDto>> {
    const result = await this.projectRepository.findProjects(filters);
    return {
      ...result,
      items: result.items.map(mapProjectResponse),
    };
  }

  async getProjectByIdOrCode(identifier: string): Promise<ProjectResponseDto> {
    const project = await this.projectRepository.findByIdOrCode(identifier);
    if (!project) {
      throw new ProjectNotFoundError(identifier);
    }
    return mapProjectResponse(project);
  }

  async updateProject(
    identifier: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const target = await this.projectRepository.findByIdOrCode(identifier);
    if (!target || !target._id) {
      throw new ProjectNotFoundError(identifier);
    }

    const recordId = String(target._id);

    return this.withProjectLock(recordId, async () => {
      const fresh = await this.projectRepository.findByIdOrCode(recordId);
      if (!fresh || !fresh._id) {
        throw new ProjectNotFoundError(identifier);
      }

      const now = new Date();
      const nextName = dto.name ?? fresh.name;
      const nextClientName = dto.clientName ?? fresh.clientName;
      const nextCategory = dto.category ?? fresh.category;
      const nextStatus = dto.status ?? fresh.status;
      const nextDescription = dto.description ?? fresh.description ?? '';
      const nextContractValue = dto.contractValue ?? fresh.contractValue;
      const nextWarningThreshold =
        dto.costAlertThresholdPercent ?? fresh.costAlertThresholdPercent;

      const voucherTotals =
        await this.voucherTotalsProvider.aggregateProjectVouchers(
          recordId,
          fresh.projectId,
        );

      const metrics = calculateProjectFinancialMetrics({
        contractValue: nextContractValue,
        totalPurchases: voucherTotals.totalPurchases,
        totalOtherExpenses: voucherTotals.totalOtherExpenses,
      });

      const thresholdOutcome = await this.persistThresholdTransitions({
        recordId,
        projectId: fresh.projectId,
        projectName: nextName,
        contractValue: metrics.contractValue,
        totalCost: metrics.totalCost,
        costPercentage: metrics.costPercentage,
        warningThresholdPercent: nextWarningThreshold,
        previousState: fresh.costThresholdState,
        now,
      });

      const resolveReason =
        nextStatus === 'Completed' ? 'project_completed' : 'activity_resumed';
      await this.projectRepository.resolveActiveActivityWarnings(
        recordId,
        resolveReason,
        now,
      );

      const updated = await this.projectRepository.updateByRecordId(recordId, {
        name: nextName,
        clientName: nextClientName,
        category: nextCategory,
        status: nextStatus,
        description: nextDescription,
        contractValue: metrics.contractValue,
        costAlertThresholdPercent: nextWarningThreshold,
        totalPurchases: metrics.totalPurchases,
        totalOtherExpenses: metrics.totalOtherExpenses,
        totalCost: metrics.totalCost,
        estimatedProfit: metrics.estimatedProfit,
        costPercentage: metrics.costPercentage,
        estimatedProfitMargin: metrics.estimatedProfitMargin,
        financialSummaryUpdatedAt: now,
        costThresholdState: thresholdOutcome.nextState,
        lastActivityAt: now,
        lastActivityType: 'project_updated',
        inactivityWarningState: {
          activeWarningId: null,
          warnedForLastActivityAt: null,
        },
      });

      if (!updated) {
        throw new ProjectNotFoundError(identifier);
      }

      return mapProjectResponse(updated);
    });
  }

  async deleteProject(identifier: string): Promise<ProjectResponseDto> {
    const target = await this.projectRepository.findByIdOrCode(identifier);
    if (!target || !target._id) {
      throw new ProjectNotFoundError(identifier);
    }

    const recordId = String(target._id);

    return this.withProjectLock(recordId, async () => {
      const deleted = await this.projectRepository.deleteByRecordId(recordId);
      if (!deleted) {
        throw new ProjectNotFoundError(identifier);
      }
      return mapProjectResponse(deleted);
    });
  }

  async getProjectFinancialSummary(
    identifier: string,
  ): Promise<ProjectFinancialSummaryDto> {
    const target = await this.projectRepository.findByIdOrCode(identifier);
    if (!target || !target._id) {
      throw new ProjectNotFoundError(identifier);
    }

    if (
      this.voucherTotalsProvider.isPurchaseIntegrationActive() ||
      this.voucherTotalsProvider.isExpenseIntegrationActive()
    ) {
      return this.recalculateProjectFinancials(String(target._id));
    }

    return mapFinancialSummary(target);
  }

  async listProjectFinancialSummaries(
    filters: ListProjectsDto,
  ): Promise<PaginatedResult<ProjectFinancialSummaryDto>> {
    const result = await this.projectRepository.findProjects(filters);
    return {
      ...result,
      items: result.items.map(mapFinancialSummary),
    };
  }

  async recalculateProjectFinancials(
    identifier: string,
  ): Promise<ProjectFinancialSummaryDto> {
    const target = await this.projectRepository.findByIdOrCode(identifier);
    if (!target || !target._id) {
      throw new ProjectNotFoundError(identifier);
    }

    const recordId = String(target._id);

    return this.withProjectLock(recordId, async () => {
      const fresh = await this.projectRepository.findByIdOrCode(recordId);
      if (!fresh || !fresh._id) {
        throw new ProjectNotFoundError(identifier);
      }

      const now = new Date();
      const voucherTotals =
        await this.voucherTotalsProvider.aggregateProjectVouchers(
          recordId,
          fresh.projectId,
        );

      const metrics = calculateProjectFinancialMetrics({
        contractValue: fresh.contractValue,
        totalPurchases: voucherTotals.totalPurchases,
        totalOtherExpenses: voucherTotals.totalOtherExpenses,
      });

      const thresholdOutcome = await this.persistThresholdTransitions({
        recordId,
        projectId: fresh.projectId,
        projectName: fresh.name,
        contractValue: metrics.contractValue,
        totalCost: metrics.totalCost,
        costPercentage: metrics.costPercentage,
        warningThresholdPercent: fresh.costAlertThresholdPercent,
        previousState: fresh.costThresholdState,
        now,
      });

      let nextLastActivityAt = new Date(fresh.lastActivityAt);
      let nextInactivityState = { ...fresh.inactivityWarningState };

      if (
        voucherTotals.latestVoucherActivityAt &&
        voucherTotals.latestVoucherActivityAt.getTime() >
          nextLastActivityAt.getTime()
      ) {
        nextLastActivityAt = new Date(voucherTotals.latestVoucherActivityAt);
        await this.projectRepository.resolveActiveActivityWarnings(
          recordId,
          'activity_resumed',
          now,
        );
        nextInactivityState = {
          activeWarningId: null,
          warnedForLastActivityAt: null,
        };
      }

      const updated = await this.projectRepository.updateByRecordId(recordId, {
        totalPurchases: metrics.totalPurchases,
        totalOtherExpenses: metrics.totalOtherExpenses,
        totalCost: metrics.totalCost,
        estimatedProfit: metrics.estimatedProfit,
        costPercentage: metrics.costPercentage,
        estimatedProfitMargin: metrics.estimatedProfitMargin,
        financialSummaryUpdatedAt: now,
        costThresholdState: thresholdOutcome.nextState,
        lastActivityAt: nextLastActivityAt,
        inactivityWarningState: nextInactivityState,
      });

      if (!updated) {
        throw new ProjectNotFoundError(identifier);
      }

      return mapFinancialSummary(updated);
    });
  }

  async syncAfterVoucherMutation(
    event: VoucherMutationEvent,
  ): Promise<{
    summary: ProjectFinancialSummaryDto;
    triggeredAlerts: ProjectCostAlertResponseDto[];
  }> {
    const target = await this.projectRepository.findByIdOrCode(event.projectId);
    if (!target || !target._id) {
      throw new ProjectNotFoundError(event.projectId);
    }

    const recordId = String(target._id);

    return this.withProjectLock(recordId, async () => {
      const fresh = await this.projectRepository.findByIdOrCode(recordId);
      if (!fresh || !fresh._id) {
        throw new ProjectNotFoundError(event.projectId);
      }

      const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();
      const voucherTotals =
        await this.voucherTotalsProvider.aggregateProjectVouchers(
          recordId,
          fresh.projectId,
        );

      const metrics = calculateProjectFinancialMetrics({
        contractValue: fresh.contractValue,
        totalPurchases: voucherTotals.totalPurchases,
        totalOtherExpenses: voucherTotals.totalOtherExpenses,
      });

      const thresholdOutcome = await this.persistThresholdTransitions({
        recordId,
        projectId: fresh.projectId,
        projectName: fresh.name,
        contractValue: metrics.contractValue,
        totalCost: metrics.totalCost,
        costPercentage: metrics.costPercentage,
        warningThresholdPercent: fresh.costAlertThresholdPercent,
        previousState: fresh.costThresholdState,
        now: occurredAt,
      });

      const candidateTimestamps = [
        new Date(fresh.lastActivityAt).getTime(),
        occurredAt.getTime(),
      ];
      if (voucherTotals.latestVoucherActivityAt) {
        candidateTimestamps.push(
          voucherTotals.latestVoucherActivityAt.getTime(),
        );
      }
      const nextActivityTimestamp = new Date(Math.max(...candidateTimestamps));

      const activityEventType =
        `${event.voucherType}_voucher_${event.action}` as ProjectActivityEventType;

      await this.projectRepository.resolveActiveActivityWarnings(
        recordId,
        'activity_resumed',
        occurredAt,
      );

      const updated = await this.projectRepository.updateByRecordId(recordId, {
        totalPurchases: metrics.totalPurchases,
        totalOtherExpenses: metrics.totalOtherExpenses,
        totalCost: metrics.totalCost,
        estimatedProfit: metrics.estimatedProfit,
        costPercentage: metrics.costPercentage,
        estimatedProfitMargin: metrics.estimatedProfitMargin,
        financialSummaryUpdatedAt: occurredAt,
        costThresholdState: thresholdOutcome.nextState,
        lastActivityAt: nextActivityTimestamp,
        lastActivityType: activityEventType,
        inactivityWarningState: {
          activeWarningId: null,
          warnedForLastActivityAt: null,
        },
      });

      if (!updated) {
        throw new ProjectNotFoundError(event.projectId);
      }

      return {
        summary: mapFinancialSummary(updated),
        triggeredAlerts: thresholdOutcome.triggeredAlerts.map(
          mapCostAlertResponse,
        ),
      };
    });
  }

  async listCostAlerts(
    filters: ListProjectAlertsDto,
  ): Promise<PaginatedResult<ProjectCostAlertResponseDto>> {
    const result = await this.projectRepository.findCostAlerts(filters);
    return {
      ...result,
      items: result.items.map(mapCostAlertResponse),
    };
  }

  async getProjectCostAlerts(
    identifier: string,
  ): Promise<{
    projectId: string;
    alerts: ProjectCostAlertResponseDto[];
  }> {
    const project = await this.projectRepository.findByIdOrCode(identifier);
    if (!project || !project._id) {
      throw new ProjectNotFoundError(identifier);
    }

    const alerts = await this.projectRepository.findCostAlertsByProject(
      String(project._id),
    );

    return {
      projectId: project.projectId,
      alerts: alerts.map(mapCostAlertResponse),
    };
  }

  async evaluateProjectInactivity(options?: {
    inactivityDays?: number;
    referenceDate?: Date;
  }): Promise<ActivityEvaluationSummary> {
    const inactivityThresholdDays =
      options?.inactivityDays && options.inactivityDays > 0
        ? options.inactivityDays
        : env.PROJECT_INACTIVITY_THRESHOLD_DAYS;
    const referenceDate = options?.referenceDate
      ? new Date(options.referenceDate)
      : new Date();
    const thresholdMs = inactivityThresholdDays * MS_PER_DAY;

    const allProjects = await this.projectRepository.findAllProjects();
    let evaluatedCount = 0;
    let newlyTriggeredCount = 0;

    for (const candidate of allProjects) {
      if (!candidate._id) {
        continue;
      }

      const recordId = String(candidate._id);

      await this.withProjectLock(recordId, async () => {
        const fresh = await this.projectRepository.findByIdOrCode(recordId);
        if (!fresh || !fresh._id) {
          return;
        }

        if (fresh.status === 'Completed') {
          if (fresh.inactivityWarningState?.activeWarningId) {
            await this.projectRepository.resolveActiveActivityWarnings(
              recordId,
              'project_completed',
              referenceDate,
            );
            await this.projectRepository.updateByRecordId(recordId, {
              inactivityWarningState: {
                activeWarningId: null,
                warnedForLastActivityAt: null,
              },
            });
          }
          return;
        }

        evaluatedCount += 1;

        const voucherTotals =
          await this.voucherTotalsProvider.aggregateProjectVouchers(
            recordId,
            fresh.projectId,
          );

        let effectiveLastActivityAt = new Date(fresh.lastActivityAt);
        if (
          voucherTotals.latestVoucherActivityAt &&
          voucherTotals.latestVoucherActivityAt.getTime() >
            effectiveLastActivityAt.getTime()
        ) {
          effectiveLastActivityAt = new Date(
            voucherTotals.latestVoucherActivityAt,
          );
        }

        if (
          effectiveLastActivityAt.getTime() >
          new Date(fresh.lastActivityAt).getTime()
        ) {
          await this.projectRepository.resolveActiveActivityWarnings(
            recordId,
            'activity_resumed',
            referenceDate,
          );
          await this.projectRepository.updateByRecordId(recordId, {
            lastActivityAt: effectiveLastActivityAt,
            inactivityWarningState: {
              activeWarningId: null,
              warnedForLastActivityAt: null,
            },
          });
        }

        const elapsedMs =
          referenceDate.getTime() - effectiveLastActivityAt.getTime();

        if (elapsedMs < thresholdMs) {
          return;
        }

        const alreadyWarnedTimestamp = fresh.inactivityWarningState
          ?.warnedForLastActivityAt
          ? new Date(
              fresh.inactivityWarningState.warnedForLastActivityAt,
            ).getTime()
          : null;

        if (alreadyWarnedTimestamp === effectiveLastActivityAt.getTime()) {
          return;
        }

        const inactiveDays =
          Math.floor((elapsedMs / MS_PER_DAY) * 100) / 100;

        const createdWarning =
          await this.projectRepository.createActivityWarning({
            projectRecordId: recordId,
            projectId: fresh.projectId,
            projectName: fresh.name,
            projectStatus: fresh.status,
            lastActivityAt: effectiveLastActivityAt,
            inactiveDays,
            inactivityThresholdDays,
            message: `Project ${fresh.projectId} (${fresh.name}) has had no recorded activity for ${Math.floor(inactiveDays)} day(s) (threshold: ${inactivityThresholdDays} day(s)).`,
            status: 'active',
            triggeredAt: referenceDate,
            resolvedAt: null,
            resolvedReason: null,
          });

        newlyTriggeredCount += 1;

        await this.projectRepository.updateByRecordId(recordId, {
          lastActivityAt: effectiveLastActivityAt,
          inactivityWarningState: {
            activeWarningId: String(createdWarning._id),
            warnedForLastActivityAt: effectiveLastActivityAt,
          },
        });
      });
    }

    const activeWarningsResult =
      await this.projectRepository.findActivityWarnings({
        page: 1,
        limit: 100,
        status: 'active',
      });

    return {
      evaluatedCount,
      newlyTriggeredCount,
      activeWarningsCount: activeWarningsResult.total,
      inactivityThresholdDays,
      schedulerConfigured: false,
      warnings: activeWarningsResult.items.map(mapActivityWarningResponse),
    };
  }

  async listActivityWarnings(
    filters: ListActivityWarningsDto,
    referenceDate?: Date,
  ): Promise<
    PaginatedResult<ProjectActivityWarningResponseDto> & {
      inactivityThresholdDays: number;
      schedulerConfigured: boolean;
    }
  > {
    if (filters.evaluate) {
      await this.evaluateProjectInactivity({
        inactivityDays: filters.inactivityDays,
        referenceDate,
      });
    }

    const result = await this.projectRepository.findActivityWarnings({
      page: filters.page,
      limit: filters.limit,
      projectId: filters.projectId,
      status: filters.status,
    });

    return {
      ...result,
      items: result.items.map(mapActivityWarningResponse),
      inactivityThresholdDays: filters.inactivityDays,
      schedulerConfigured: false,
    };
  }
}
