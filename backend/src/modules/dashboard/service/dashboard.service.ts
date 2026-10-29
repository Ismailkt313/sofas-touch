import { env } from '../../../config/env';
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
import { IUserService, userService } from '../../users';
import { DashboardRepository } from '../repository/dashboard.repository';
import {
  DashboardCallerIdentity,
  DashboardKpiSummaryDto,
  DashboardMonthlyExpensesDto,
  DashboardMonthlyExpensesQueryDto,
  DashboardOverviewQueryDto,
  DashboardOverviewResponseDto,
  DashboardPendingApprovalsDto,
  DashboardProjectPerformanceRowDto,
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

  private async fetchPendingApprovalsForAdmin(
    caller: DashboardCallerIdentity,
  ): Promise<DashboardPendingApprovalsDto | null> {
    if (caller.role !== 'admin') {
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
    );
    const stockAlertsPromise = this.repository.findStockAlerts();
    const pendingApprovalsPromise = this.fetchPendingApprovalsForAdmin(caller);

    const allProjects = await allProjectsPromise;
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
      const detailPath =
        caller.role === 'admin'
          ? `/projects/${encodedCode}/report`
          : `/projects/${encodedCode}`;

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
      kpis,
      projectPerformance: {
        totalMatching: filteredRows.length,
        items: sanitizedPerformance,
      },
      monthlyExpenses,
      recentTransactions,
      stockAlerts,
      pendingApprovals,
    };
  }
}
