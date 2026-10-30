import { env } from '../../../config/env';
import { isProjectAccessibleToCaller } from '../../permissions/constants/permissions.constants';
import {
  calculateProjectFinancialMetrics,
  roundFinancialAmount,
  roundPercentage,
} from '../../projects';
import {
  determineProjectHealthStatus,
  ReportsRepository,
  reportsRepository,
} from '../../reports';
import { appSettingsRepository } from '../../settings';
import { IUserService, userService } from '../../users';
import { DashboardRepository } from '../repository/dashboard.repository';
import {
  DashboardCallerIdentity,
  DashboardKpiSummaryDto,
  DashboardMonthlyExpensesDto,
  DashboardMonthlyExpensesQueryDto,
  DashboardOperationalQuickActionDto,
  DashboardOverviewQueryDto,
  DashboardOverviewResponseDto,
  DashboardPendingApprovalsDto,
  DashboardProjectPerformanceRowDto,
  DashboardValidationAlertDto,
  MonthlyExpenseBucketDto,
} from '../types';

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function buildMonthSequence(
  fromDate: Date,
  toDate: Date,
): Array<{ monthKey: string; label: string; shortLabel: string }> {
  const result: Array<{ monthKey: string; label: string; shortLabel: string }> =
    [];
  let year = fromDate.getUTCFullYear();
  let month = fromDate.getUTCMonth();
  const endYear = toDate.getUTCFullYear();
  const endMonth = toDate.getUTCMonth();

  let guard = 0;
  while ((year < endYear || (year === endYear && month <= endMonth)) && guard < 36) {
    const mm = String(month + 1).padStart(2, '0');
    const shortMonth = SHORT_MONTH_NAMES[month] || mm;
    result.push({
      monthKey: `${year}-${mm}`,
      label: `${shortMonth} ${year}`,
      shortLabel: `${shortMonth} '${String(year).slice(-2)}`,
    });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    guard += 1;
  }

  return result;
}

function resolveDefaultMonthlyBounds(monthsCount: number): {
  fromDate: Date;
  toDate: Date;
  fromDateStr: string;
  toDateStr: string;
} {
  const now = new Date();
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth();
  const endDay = now.getUTCDate();

  const toDate = new Date(Date.UTC(endYear, endMonth, endDay, 23, 59, 59, 999));

  const startAnchor = new Date(
    Date.UTC(endYear, endMonth - Math.max(0, monthsCount - 1), 1, 0, 0, 0, 0),
  );

  return {
    fromDate: startAnchor,
    toDate,
    fromDateStr: startAnchor.toISOString().slice(0, 10),
    toDateStr: toDate.toISOString().slice(0, 10),
  };
}

function buildQuickActions(
  perms: Set<string>,
): DashboardOperationalQuickActionDto[] {
  const actions: DashboardOperationalQuickActionDto[] = [];
  if (perms.has('purchases.create')) {
    actions.push({
      id: 'record-purchase',
      label: 'Record Purchase Voucher',
      description: 'Log supplier material bills and update stock on hand.',
      path: '/purchases/new',
      permission: 'purchases.create',
    });
  }
  if (perms.has('expenses.create')) {
    actions.push({
      id: 'record-expense',
      label: 'Record Expense',
      description: 'Enter transport, labour, or workshop project expenses.',
      path: '/expenses',
      permission: 'expenses.create',
    });
  }
  if (perms.has('projects.create')) {
    actions.push({
      id: 'create-project',
      label: 'Create Project',
      description: 'Open a new client upholstery or interior order.',
      path: '/projects',
      permission: 'projects.create',
    });
  } else if (perms.has('projects.view')) {
    actions.push({
      id: 'view-projects',
      label: 'Browse Active Projects',
      description: 'Look up client codes and active workshop statuses.',
      path: '/projects',
      permission: 'projects.view',
    });
  }
  if (perms.has('materials.view')) {
    actions.push({
      id: 'lookup-materials',
      label: 'Raw Materials Lookup',
      description: 'Check current stock quantities and material units.',
      path: '/raw-materials',
      permission: 'materials.view',
    });
  }
  if (perms.has('activity.viewOwn') || perms.has('activity.viewAll')) {
    actions.push({
      id: 'view-activity',
      label: 'My Activity Log',
      description: 'Review your recently submitted vouchers and updates.',
      path: '/activity',
      permission: perms.has('activity.viewAll')
        ? 'activity.viewAll'
        : 'activity.viewOwn',
    });
  }
  return actions;
}

export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository = new DashboardRepository(),
    private readonly reportsRepo: ReportsRepository = reportsRepository,
    private readonly usersSvc: IUserService = userService,
  ) {}

  async getMonthlyExpenses(
    query: DashboardMonthlyExpensesQueryDto,
  ): Promise<DashboardMonthlyExpensesDto> {
    const isCustomRange = Boolean(query.fromDate || query.toDate);
    const defaultBounds = resolveDefaultMonthlyBounds(query.months || 6);

    const effectiveFrom = query.fromDate || defaultBounds.fromDate;
    const effectiveTo = query.toDate || defaultBounds.toDate;
    const effectiveFromStr =
      query.fromDateStr || effectiveFrom.toISOString().slice(0, 10);
    const effectiveToStr =
      query.toDateStr || effectiveTo.toISOString().slice(0, 10);

    const rawByMonth = await this.repository.aggregateMonthlySpend({
      fromDate: effectiveFrom,
      toDate: effectiveTo,
    });

    const monthSeq = buildMonthSequence(effectiveFrom, effectiveTo);
    let sumPurchases = 0;
    let sumExpenses = 0;
    let sumPurchaseCount = 0;
    let sumExpenseCount = 0;

    const buckets: MonthlyExpenseBucketDto[] = monthSeq.map((meta) => {
      const hit = rawByMonth.get(meta.monthKey);
      const pCost = roundFinancialAmount(hit?.purchaseCosts ?? 0);
      const eCost = roundFinancialAmount(hit?.otherExpenses ?? 0);
      const pCount = hit?.purchaseCount ?? 0;
      const eCount = hit?.expenseCount ?? 0;
      const total = roundFinancialAmount(pCost + eCost);

      sumPurchases = roundFinancialAmount(sumPurchases + pCost);
      sumExpenses = roundFinancialAmount(sumExpenses + eCost);
      sumPurchaseCount += pCount;
      sumExpenseCount += eCount;

      return {
        monthKey: meta.monthKey,
        label: meta.label,
        shortLabel: meta.shortLabel,
        purchaseCosts: pCost,
        purchaseCount: pCount,
        otherExpenses: eCost,
        expenseCount: eCount,
        totalExpenses: total,
      };
    });

    return {
      fromDate: effectiveFromStr,
      toDate: effectiveToStr,
      isCustomRange,
      totals: {
        purchaseCosts: sumPurchases,
        otherExpenses: sumExpenses,
        totalExpenses: roundFinancialAmount(sumPurchases + sumExpenses),
        purchaseCount: sumPurchaseCount,
        expenseCount: sumExpenseCount,
      },
      buckets,
    };
  }

  private async fetchPendingApprovalsForCaller(
    perms: Set<string>,
    isAdmin: boolean,
  ): Promise<DashboardPendingApprovalsDto | null> {
    if (!isAdmin && !perms.has('users.approve')) {
      return null;
    }

    const result = await this.usersSvc.listPendingApprovals({
      page: 1,
      limit: 5,
    });

    return {
      count: result.pagination.total,
      items: result.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
      })),
    };
  }

  async getOverview(
    query: DashboardOverviewQueryDto,
    caller: DashboardCallerIdentity,
  ): Promise<DashboardOverviewResponseDto> {
    const isAdmin = caller.role === 'admin';
    const perms = new Set(caller.permissions || []);
    const canViewProfitability =
      isAdmin || perms.has('reports.viewProfitability');
    const canViewProjects = isAdmin || perms.has('projects.view');
    const canViewPurchases = isAdmin || perms.has('purchases.view');
    const canViewExpenses = isAdmin || perms.has('expenses.view');
    const canViewMaterials = isAdmin || perms.has('materials.view');
    const canViewReports =
      isAdmin || (perms.has('reports.view') && canViewProfitability);
    const assignedProjectIds = isAdmin ? null : caller.assignedProjectIds;

    if (!canViewProfitability) {
      const [candidateProjects, recentTransactions, stockAlerts, settings] =
        await Promise.all([
          canViewProjects
            ? this.reportsRepo.findCandidateProjects({ status: 'all' })
            : Promise.resolve([]),
          this.repository.findRecentTransactions(query.recentLimit, {
            includePurchases: canViewPurchases,
            includeExpenses: canViewExpenses,
            assignedProjectIds,
          }),
          canViewMaterials
            ? this.repository.findStockAlerts()
            : Promise.resolve(null),
          appSettingsRepository.getSettings(),
        ]);

      const accessibleProjects = candidateProjects.filter((p) =>
        isProjectAccessibleToCaller(
          assignedProjectIds,
          String(p._id || ''),
          p.projectId,
        ),
      );

      let inProgress = 0;
      let underReview = 0;
      let completed = 0;
      for (const p of accessibleProjects) {
        if (p.status === 'In Progress') inProgress += 1;
        else if (p.status === 'Under Review') underReview += 1;
        else if (p.status === 'Completed') completed += 1;
      }

      let filteredProjects = accessibleProjects;
      if (query.projectStatus !== 'all') {
        filteredProjects = filteredProjects.filter(
          (p) => p.status === query.projectStatus,
        );
      }
      if (query.projectSearch) {
        const q = query.projectSearch.toLowerCase();
        filteredProjects = filteredProjects.filter(
          (p) =>
            p.projectId.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.clientName.toLowerCase().includes(q),
        );
      }

      const operationalProjectItems = filteredProjects
        .slice(0, 12)
        .map((p) => ({
          id: String(p._id || ''),
          projectId: p.projectId,
          name: p.name,
          clientName: p.clientName,
          category: p.category,
          status: p.status,
          detailPath: `/projects/${encodeURIComponent(p.projectId)}`,
        }));

      const missingPurchaseDocs = recentTransactions.filter(
        (t) =>
          t.type === 'purchase' &&
          t.status === 'active' &&
          t.hasAttachment === false,
      );
      const missingExpenseDocs = recentTransactions.filter(
        (t) =>
          t.type === 'expense' &&
          t.status === 'active' &&
          t.hasAttachment === false,
      );

      const validationAlerts: DashboardValidationAlertDto[] = [];
      if (missingPurchaseDocs.length > 0 && canViewPurchases) {
        validationAlerts.push({
          id: 'missing-purchase-bills',
          severity: 'warning',
          title: `${missingPurchaseDocs.length} recent purchase voucher${
            missingPurchaseDocs.length === 1 ? ' is' : 's are'
          } missing supplier bill attachments`,
          description:
            'Upload scanned supplier invoices so material purchases remain ready for verification.',
          actionLabel: 'Review Purchases',
          actionPath: missingPurchaseDocs[0]?.detailPath || '/purchases',
        });
      }
      if (missingExpenseDocs.length > 0 && canViewExpenses) {
        validationAlerts.push({
          id: 'missing-expense-receipts',
          severity: 'info',
          title: `${missingExpenseDocs.length} recent expense entr${
            missingExpenseDocs.length === 1 ? 'y has' : 'ies have'
          } no receipt attached`,
          description:
            'Attach supporting receipts whenever a printed bill or slip is available.',
          actionLabel: 'View Expenses',
          actionPath: '/expenses',
        });
      }
      if (
        canViewProjects &&
        accessibleProjects.length === 0 &&
        (perms.has('purchases.create') || perms.has('expenses.create'))
      ) {
        validationAlerts.push({
          id: 'no-active-projects',
          severity: 'warning',
          title: 'No accessible projects are currently open',
          description:
            'Purchase and expense vouchers require an active project code. Contact an Administrator if a project needs to be assigned.',
          actionLabel: null,
          actionPath: null,
        });
      }

      const myRecentCount = recentTransactions.filter(
        (t) => t.createdByUserId && t.createdByUserId === caller.id,
      ).length;

      return {
        generatedAt: new Date().toISOString(),
        mode: 'operational',
        kpis: null,
        projectPerformance: null,
        monthlyExpenses: null,
        recentTransactions,
        stockAlerts,
        pendingApprovals: null,
        operational: {
          guidanceNote: settings.operatorGuidanceBanner,
          quickActions: buildQuickActions(perms),
          projectSummary: canViewProjects
            ? {
                totalAccessible: accessibleProjects.length,
                inProgress,
                underReview,
                completed,
                items: operationalProjectItems,
              }
            : null,
          myRecentCount,
          validationAlerts,
        },
      };
    }

    const allProjectsPromise = this.reportsRepo.findCandidateProjects({
      status: 'all',
    });

    const monthlyPromise = this.getMonthlyExpenses({
      months: query.expenseMonths,
      fromDate: query.expenseFromDate,
      toDate: query.expenseToDate,
      fromDateStr: query.expenseFromDateStr,
      toDateStr: query.expenseToDateStr,
    });

    const recentPromise = this.repository.findRecentTransactions(
      query.recentLimit,
      {
        includePurchases: canViewPurchases,
        includeExpenses: canViewExpenses,
        assignedProjectIds,
      },
    );
    const stockAlertsPromise = canViewMaterials
      ? this.repository.findStockAlerts()
      : Promise.resolve(null);
    const pendingApprovalsPromise = this.fetchPendingApprovalsForCaller(
      perms,
      isAdmin,
    );

    const candidateProjects = await allProjectsPromise;
    const allProjects = candidateProjects.filter((p) =>
      isProjectAccessibleToCaller(
        assignedProjectIds,
        String(p._id || ''),
        p.projectId,
      ),
    );
    const totalsMap = await this.reportsRepo.aggregateTotalsForProjects(
      allProjects,
      {},
    );

    const [monthlyExpenses, recentTransactions, stockAlerts, pendingApprovals] =
      await Promise.all([
        monthlyPromise,
        recentPromise,
        stockAlertsPromise,
        pendingApprovalsPromise,
      ]);

    let inProgressProjects = 0;
    let underReviewProjects = 0;
    let completedProjects = 0;
    let totalContractValue = 0;
    let materialPurchaseCosts = 0;
    let otherProjectExpenses = 0;
    let profitableProjectsCount = 0;
    let nearLimitProjectsCount = 0;
    let overBudgetProjectsCount = 0;

    const allPerformanceRows: Array<
      DashboardProjectPerformanceRowDto & { createdAtMs: number }
    > = [];

    for (const proj of allProjects) {
      const recId = String(proj._id || '');
      if (proj.status === 'In Progress') inProgressProjects += 1;
      else if (proj.status === 'Under Review') underReviewProjects += 1;
      else if (proj.status === 'Completed') completedProjects += 1;

      const bucket = totalsMap.get(recId);
      const pCost = roundFinancialAmount(bucket?.lifetimePurchases ?? 0);
      const eCost = roundFinancialAmount(bucket?.lifetimeExpenses ?? 0);

      const metrics = calculateProjectFinancialMetrics({
        contractValue: proj.contractValue,
        totalPurchases: pCost,
        totalOtherExpenses: eCost,
      });

      const warningThreshold =
        proj.costAlertThresholdPercent ??
        env.PROJECT_COST_WARNING_THRESHOLD_PERCENT;

      const healthStatus = determineProjectHealthStatus({
        contractValue: metrics.contractValue,
        totalCost: metrics.totalCost,
        estimatedProfit: metrics.estimatedProfit,
        costPercentage: metrics.costPercentage,
        warningThresholdPercent: warningThreshold,
      });

      totalContractValue = roundFinancialAmount(
        totalContractValue + metrics.contractValue,
      );
      materialPurchaseCosts = roundFinancialAmount(
        materialPurchaseCosts + metrics.totalPurchases,
      );
      otherProjectExpenses = roundFinancialAmount(
        otherProjectExpenses + metrics.totalOtherExpenses,
      );

      if (healthStatus === 'loss') overBudgetProjectsCount += 1;
      else if (healthStatus === 'near_limit') nearLimitProjectsCount += 1;
      else if (healthStatus === 'profitable') profitableProjectsCount += 1;

      const marginApplicable = metrics.contractValue > 0;
      const encodedCode = encodeURIComponent(proj.projectId);
      const detailPath = canViewReports
        ? `/projects/${encodedCode}/report`
        : canViewProjects
          ? `/projects/${encodedCode}`
          : '/dashboard';

      allPerformanceRows.push({
        id: recId,
        projectId: proj.projectId,
        name: proj.name,
        clientName: proj.clientName,
        category: proj.category,
        status: proj.status,
        contractValue: metrics.contractValue,
        materialPurchaseCosts: metrics.totalPurchases,
        otherProjectExpenses: metrics.totalOtherExpenses,
        totalProjectCosts: metrics.totalCost,
        estimatedProfit: metrics.estimatedProfit,
        profitMargin: marginApplicable ? metrics.estimatedProfitMargin : null,
        marginApplicable,
        costPercentage: marginApplicable ? metrics.costPercentage : null,
        warningThresholdPercent: warningThreshold,
        healthStatus,
        detailPath,
        createdAtMs: proj.createdAt ? new Date(proj.createdAt).getTime() : 0,
      });
    }

    const totalProjectCosts = roundFinancialAmount(
      materialPurchaseCosts + otherProjectExpenses,
    );
    const estimatedProfit = roundFinancialAmount(
      totalContractValue - totalProjectCosts,
    );
    const kpiMarginApplicable = totalContractValue > 0;
    const profitMargin = kpiMarginApplicable
      ? roundPercentage((estimatedProfit / totalContractValue) * 100)
      : null;
    const costPercentage = kpiMarginApplicable
      ? roundPercentage((totalProjectCosts / totalContractValue) * 100)
      : null;

    const kpis: DashboardKpiSummaryDto = {
      totalProjects: allProjects.length,
      activeProjects: inProgressProjects + underReviewProjects,
      inProgressProjects,
      underReviewProjects,
      completedProjects,
      totalContractValue,
      materialPurchaseCosts,
      otherProjectExpenses,
      totalProjectCosts,
      estimatedProfit,
      profitMargin,
      marginApplicable: kpiMarginApplicable,
      costPercentage,
      profitableProjectsCount,
      nearLimitProjectsCount,
      overBudgetProjectsCount,
      profitType: 'estimated',
      isAudited: false,
    };

    let filteredRows = allPerformanceRows;
    if (query.projectStatus !== 'all') {
      filteredRows = filteredRows.filter(
        (r) => r.status === query.projectStatus,
      );
    }

    if (query.projectSearch) {
      const q = query.projectSearch.toLowerCase();
      filteredRows = filteredRows.filter(
        (r) =>
          r.projectId.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q),
      );
    }

    const dir = query.projectSortOrder === 'asc' ? 1 : -1;
    filteredRows.sort((a, b) => {
      if (query.projectSortBy === 'profitMargin') {
        if (a.marginApplicable !== b.marginApplicable) {
          return a.marginApplicable ? -1 : 1;
        }
        if (!a.marginApplicable && !b.marginApplicable) {
          return b.createdAtMs - a.createdAtMs;
        }
        const diff = (a.profitMargin ?? 0) - (b.profitMargin ?? 0);
        if (diff !== 0) return diff * dir;
      } else if (query.projectSortBy === 'contractValue') {
        const diff = a.contractValue - b.contractValue;
        if (diff !== 0) return diff * dir;
      } else if (query.projectSortBy === 'totalCost') {
        const diff = a.totalProjectCosts - b.totalProjectCosts;
        if (diff !== 0) return diff * dir;
      } else if (query.projectSortBy === 'estimatedProfit') {
        const diff = a.estimatedProfit - b.estimatedProfit;
        if (diff !== 0) return diff * dir;
      } else {
        const diff = a.createdAtMs - b.createdAtMs;
        if (diff !== 0) return diff * dir;
      }

      return b.projectId.localeCompare(a.projectId);
    });

    const sanitizedPerformance: DashboardProjectPerformanceRowDto[] =
      filteredRows.slice(0, 50).map(({ createdAtMs: _unused, ...rest }) => rest);

    return {
      generatedAt: new Date().toISOString(),
      mode: 'executive',
      kpis,
      projectPerformance: {
        totalMatching: filteredRows.length,
        items: sanitizedPerformance,
      },
      monthlyExpenses,
      recentTransactions,
      stockAlerts,
      pendingApprovals,
      operational: null,
    };
  }
}
