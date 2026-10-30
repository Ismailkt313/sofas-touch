import { env } from '../../../config/env';
import { IExpenseVoucher } from '../../expenses';
import { isProjectAccessibleToCaller } from '../../permissions/constants/permissions.constants';
import {
  calculateProjectFinancialMetrics,
  IProject,
  roundFinancialAmount,
  roundPercentage,
} from '../../projects';
import { IPurchaseVoucher } from '../../purchases';
import {
  validateProjectReportDetailQueryDto,
  validateProjectReportsQueryDto,
} from '../dto/reports.dto';
import { ReportsRepository } from '../repository/reports.repository';
import {
  DateWiseCostBucketDto,
  DateWiseCostEntryDto,
  IndividualProjectReportResponseDto,
  ProjectFinancialHealth,
  ProjectProfitabilityRowDto,
  ProjectReportExpenseItemDto,
  ProjectReportListResponseDto,
  ProjectReportPurchaseItemDto,
  ProjectReportsQueryDto,
  ReportCallerIdentity,
  ReportPeriodMetaDto,
  ReportsPortfolioSummaryDto,
} from '../types';
import {
  buildIndividualProjectReportPdf,
  buildProjectSummariesCsv,
} from '../utils/report-exporters';

export class ReportValidationError extends Error {
  public readonly statusCode = 400;
  public readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>, message = 'Invalid report query.') {
    super(message);
    this.name = 'ReportValidationError';
    this.errors = errors;
  }
}

export class ReportForbiddenError extends Error {
  public readonly statusCode = 403;

  constructor(
    message = 'Access denied. Administrator privileges are required to view financial profitability reports.',
  ) {
    super(message);
    this.name = 'ReportForbiddenError';
  }
}

export class ReportNotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message = 'Requested project was not found.') {
    super(message);
    this.name = 'ReportNotFoundError';
  }
}

function isWithinDateRange(
  dateVal: Date | string | undefined | null,
  fromDate?: Date,
  toDate?: Date,
): boolean {
  if (!fromDate && !toDate) {
    return true;
  }
  if (!dateVal) {
    return false;
  }
  const ms = new Date(dateVal).getTime();
  if (Number.isNaN(ms)) {
    return false;
  }
  if (fromDate && ms < fromDate.getTime()) {
    return false;
  }
  if (toDate && ms > toDate.getTime()) {
    return false;
  }
  return true;
}

function toUtcDateKey(raw: Date | string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '1970-01-01';
  }
  return parsed.toISOString().slice(0, 10);
}

export function determineProjectHealthStatus(params: {
  contractValue: number;
  totalCost: number;
  estimatedProfit: number;
  costPercentage: number;
  warningThresholdPercent: number;
}): ProjectFinancialHealth {
  if (params.estimatedProfit < 0) {
    return 'loss';
  }
  if (params.contractValue > 0) {
    if (params.costPercentage + 1e-9 >= params.warningThresholdPercent) {
      return 'near_limit';
    }
    if (params.estimatedProfit > 0) {
      return 'profitable';
    }
  }
  return 'neutral';
}

function extractOptionalSiteLocation(project: IProject): string | null {
  const raw = project as unknown as Record<string, unknown>;
  if (typeof raw.siteLocation === 'string' && raw.siteLocation.trim()) {
    return raw.siteLocation.trim();
  }
  if (typeof raw.location === 'string' && raw.location.trim()) {
    return raw.location.trim();
  }
  return null;
}

function extractOptionalClientContact(project: IProject): string | null {
  const raw = project as unknown as Record<string, unknown>;
  if (typeof raw.clientContact === 'string' && raw.clientContact.trim()) {
    return raw.clientContact.trim();
  }
  if (typeof raw.clientPhone === 'string' && raw.clientPhone.trim()) {
    return raw.clientPhone.trim();
  }
  return null;
}

export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository = new ReportsRepository(),
  ) {}

  private assertCanViewReports(caller: ReportCallerIdentity): void {
    const allowed =
      caller.role === 'admin' ||
      (Array.isArray(caller.permissions) &&
        caller.permissions.includes('reports.view'));
    if (!allowed) {
      throw new ReportForbiddenError();
    }
  }

  private canViewProfitability(caller: ReportCallerIdentity): boolean {
    return (
      caller.role === 'admin' ||
      (Array.isArray(caller.permissions) &&
        caller.permissions.includes('reports.viewProfitability'))
    );
  }

  private assertAdmin(caller: ReportCallerIdentity): void {
    if (!this.canViewProfitability(caller)) {
      throw new ReportForbiddenError();
    }
    this.assertCanViewReports(caller);
  }

  private buildPeriodMeta(
    fromDateStr: string | null,
    toDateStr: string | null,
  ): ReportPeriodMetaDto {
    const isDateFiltered = Boolean(fromDateStr || toDateStr);
    return {
      isDateFiltered,
      fromDate: fromDateStr,
      toDate: toDateStr,
      filterBasis: 'transaction_date',
      reportingMode: isDateFiltered ? 'period' : 'lifetime',
    };
  }

  private sortProjectRows(
    rows: ProjectProfitabilityRowDto[],
    query: ProjectReportsQueryDto,
  ): ProjectProfitabilityRowDto[] {
    const dir = query.sortOrder === 'asc' ? 1 : -1;
    const sorted = [...rows];

    sorted.sort((a, b) => {
      if (query.sortBy === 'profitMargin') {
        const aHas = a.marginApplicable && a.profitMargin !== null;
        const bHas = b.marginApplicable && b.profitMargin !== null;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
          const diff = (a.profitMargin as number) - (b.profitMargin as number);
          if (diff !== 0) return diff * dir;
        }
      } else if (query.sortBy === 'contractValue') {
        const diff = a.contractValue - b.contractValue;
        if (diff !== 0) return diff * dir;
      } else if (query.sortBy === 'totalCost') {
        const diff = a.totalProjectCosts - b.totalProjectCosts;
        if (diff !== 0) return diff * dir;
      } else if (query.sortBy === 'estimatedProfit') {
        const diff = a.estimatedProfit - b.estimatedProfit;
        if (diff !== 0) return diff * dir;
      } else {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        const diff = aTime - bTime;
        if (diff !== 0) return diff * dir;
      }

      return a.projectId.localeCompare(b.projectId) * dir;
    });

    return sorted;
  }

  private computeSummaryFromRows(
    rows: ProjectProfitabilityRowDto[],
  ): ReportsPortfolioSummaryDto {
    let contractValue = 0;
    let materialPurchaseCosts = 0;
    let otherProjectExpenses = 0;
    let lifetimePurchases = 0;
    let lifetimeExpenses = 0;
    let profitableCount = 0;
    let nearLimitCount = 0;
    let lossCount = 0;

    for (const row of rows) {
      contractValue = roundFinancialAmount(contractValue + row.contractValue);
      materialPurchaseCosts = roundFinancialAmount(
        materialPurchaseCosts + row.materialPurchaseCosts,
      );
      otherProjectExpenses = roundFinancialAmount(
        otherProjectExpenses + row.otherProjectExpenses,
      );
      lifetimePurchases = roundFinancialAmount(
        lifetimePurchases + row.lifetimeMaterialPurchaseCosts,
      );
      lifetimeExpenses = roundFinancialAmount(
        lifetimeExpenses + row.lifetimeOtherProjectExpenses,
      );

      if (row.healthStatus === 'profitable') profitableCount += 1;
      else if (row.healthStatus === 'near_limit') nearLimitCount += 1;
      else if (row.healthStatus === 'loss') lossCount += 1;
    }

    const activeMetrics = calculateProjectFinancialMetrics({
      contractValue,
      totalPurchases: materialPurchaseCosts,
      totalOtherExpenses: otherProjectExpenses,
    });

    const lifetimeMetrics = calculateProjectFinancialMetrics({
      contractValue,
      totalPurchases: lifetimePurchases,
      totalOtherExpenses: lifetimeExpenses,
    });

    const marginApplicable = activeMetrics.contractValue > 0;

    return {
      projectCount: rows.length,
      contractValue: activeMetrics.contractValue,
      materialPurchaseCosts: activeMetrics.totalPurchases,
      otherProjectExpenses: activeMetrics.totalOtherExpenses,
      totalProjectCosts: activeMetrics.totalCost,
      estimatedProfit: activeMetrics.estimatedProfit,
      profitMargin: marginApplicable
        ? activeMetrics.estimatedProfitMargin
        : null,
      marginApplicable,
      costPercentage: marginApplicable ? activeMetrics.costPercentage : null,
      costPercentageApplicable: marginApplicable,
      lifetimeTotalProjectCosts: lifetimeMetrics.totalCost,
      lifetimeEstimatedProfit: lifetimeMetrics.estimatedProfit,
      lifetimeProfitMargin: marginApplicable
        ? lifetimeMetrics.estimatedProfitMargin
        : null,
      profitableCount,
      nearLimitCount,
      lossCount,
      profitType: 'estimated',
      isAudited: false,
    };
  }

  private async buildFilteredRowsAndSummary(
    rawQuery: Record<string, unknown>,
  ): Promise<{
    query: ProjectReportsQueryDto;
    period: ReportPeriodMetaDto;
    sortedRows: ProjectProfitabilityRowDto[];
    summary: ReportsPortfolioSummaryDto;
  }> {
    const validation = validateProjectReportsQueryDto(rawQuery);
    if (!validation.isValid || !validation.value) {
      const firstMsg = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Invalid report query parameters.';
      throw new ReportValidationError(
        validation.errors || { query: 'Invalid query parameters.' },
        firstMsg,
      );
    }

    const query = validation.value;
    const period = this.buildPeriodMeta(query.fromDateStr, query.toDateStr);

    const candidateProjects = await this.repository.findCandidateProjects({
      search: query.search,
      status: query.status,
    });

    const totalsMap = await this.repository.aggregateTotalsForProjects(
      candidateProjects,
      {
        fromDate: query.fromDate,
        toDate: query.toDate,
      },
    );

    const rows: ProjectProfitabilityRowDto[] = [];

    for (const proj of candidateProjects) {
      const recId = String(proj._id || '');
      const bucket = totalsMap.get(recId);
      const lifetimePurchases = bucket?.lifetimePurchases ?? 0;
      const lifetimeExpenses = bucket?.lifetimeExpenses ?? 0;
      const periodPurchases = bucket?.periodPurchases ?? 0;
      const periodExpenses = bucket?.periodExpenses ?? 0;
      const periodPurchaseCount = bucket?.periodPurchaseCount ?? 0;
      const periodExpenseCount = bucket?.periodExpenseCount ?? 0;
      const lifetimePurchaseCount = bucket?.lifetimePurchaseCount ?? 0;
      const lifetimeExpenseCount = bucket?.lifetimeExpenseCount ?? 0;

      if (
        period.isDateFiltered &&
        periodPurchaseCount === 0 &&
        periodExpenseCount === 0
      ) {
        continue;
      }

      const activePurchases = period.isDateFiltered
        ? periodPurchases
        : lifetimePurchases;
      const activeExpenses = period.isDateFiltered
        ? periodExpenses
        : lifetimeExpenses;

      const activeMetrics = calculateProjectFinancialMetrics({
        contractValue: proj.contractValue,
        totalPurchases: activePurchases,
        totalOtherExpenses: activeExpenses,
      });

      const lifetimeMetrics = calculateProjectFinancialMetrics({
        contractValue: proj.contractValue,
        totalPurchases: lifetimePurchases,
        totalOtherExpenses: lifetimeExpenses,
      });

      const marginApplicable = activeMetrics.contractValue > 0;
      const warningThresholdPercent =
        proj.costAlertThresholdPercent ||
        env.PROJECT_COST_WARNING_THRESHOLD_PERCENT;

      const healthStatus = determineProjectHealthStatus({
        contractValue: lifetimeMetrics.contractValue,
        totalCost: lifetimeMetrics.totalCost,
        estimatedProfit: lifetimeMetrics.estimatedProfit,
        costPercentage: lifetimeMetrics.costPercentage,
        warningThresholdPercent,
      });

      rows.push({
        id: recId,
        projectId: proj.projectId,
        name: proj.name,
        clientName: proj.clientName,
        siteLocation: extractOptionalSiteLocation(proj),
        category: proj.category,
        status: proj.status,
        contractValue: activeMetrics.contractValue,
        materialPurchaseCosts: activeMetrics.totalPurchases,
        otherProjectExpenses: activeMetrics.totalOtherExpenses,
        totalProjectCosts: activeMetrics.totalCost,
        estimatedProfit: activeMetrics.estimatedProfit,
        profitMargin: marginApplicable
          ? activeMetrics.estimatedProfitMargin
          : null,
        marginApplicable,
        costPercentage: marginApplicable ? activeMetrics.costPercentage : null,
        costPercentageApplicable: marginApplicable,
        warningThresholdPercent,
        healthStatus,
        purchaseCount: period.isDateFiltered
          ? periodPurchaseCount
          : lifetimePurchaseCount,
        expenseCount: period.isDateFiltered
          ? periodExpenseCount
          : lifetimeExpenseCount,
        lifetimeMaterialPurchaseCosts: lifetimeMetrics.totalPurchases,
        lifetimeOtherProjectExpenses: lifetimeMetrics.totalOtherExpenses,
        lifetimeTotalProjectCosts: lifetimeMetrics.totalCost,
        lifetimeEstimatedProfit: lifetimeMetrics.estimatedProfit,
        lifetimeProfitMargin: marginApplicable
          ? lifetimeMetrics.estimatedProfitMargin
          : null,
        createdAt: proj.createdAt,
        lastActivityAt: proj.lastActivityAt,
        profitType: 'estimated',
        isAudited: false,
      });
    }

    const sortedRows = this.sortProjectRows(rows, query);
    const summary = this.computeSummaryFromRows(sortedRows);

    return {
      query,
      period,
      sortedRows,
      summary,
    };
  }

  async listProjectReports(
    rawQuery: Record<string, unknown>,
    caller: ReportCallerIdentity,
  ): Promise<ProjectReportListResponseDto> {
    this.assertCanViewReports(caller);
    const includeProfitability = this.canViewProfitability(caller);

    const { query, period, sortedRows } =
      await this.buildFilteredRowsAndSummary(rawQuery);

    const scopedRows = Array.isArray(caller.assignedProjectIds)
      ? sortedRows.filter((row) =>
          isProjectAccessibleToCaller(
            caller.assignedProjectIds,
            row.id,
            row.projectId,
          ),
        )
      : sortedRows;

    const computedSummary = this.computeSummaryFromRows(scopedRows);
    const total = scopedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    const safePage = Math.min(query.page, totalPages);
    const startIdx = (safePage - 1) * query.limit;
    const rawPagedItems = scopedRows.slice(startIdx, startIdx + query.limit);

    if (!includeProfitability) {
      const redactedSummary = {
        ...computedSummary,
        contractValue: null,
        estimatedProfit: null,
        profitMargin: null,
        marginApplicable: false,
        costPercentage: null,
        costPercentageApplicable: false,
        lifetimeEstimatedProfit: null,
        profitableProjectCount: 0,
        nearLimitProjectCount: 0,
        lossProjectCount: 0,
        profitabilityRedacted: true,
      } as unknown as ReportsPortfolioSummaryDto;

      const redactedItems = rawPagedItems.map((row) => ({
        ...row,
        contractValue: null,
        estimatedProfit: null,
        profitMargin: null,
        marginApplicable: false,
        costPercentage: null,
        costPercentageApplicable: false,
        lifetimeEstimatedProfit: null,
        healthStatus: 'neutral',
        profitabilityRedacted: true,
      })) as unknown as ProjectProfitabilityRowDto[];

      return {
        period,
        summary: redactedSummary,
        items: redactedItems,
        total,
        page: safePage,
        limit: query.limit,
        totalPages,
        schemaNotes: {
          siteLocationPersisted: false,
          clientContactPersisted: false,
        },
      };
    }

    return {
      period,
      summary: computedSummary,
      items: rawPagedItems,
      total,
      page: safePage,
      limit: query.limit,
      totalPages,
      schemaNotes: {
        siteLocationPersisted: false,
        clientContactPersisted: false,
      },
    };
  }

  async exportProjectReportsCsv(
    rawQuery: Record<string, unknown>,
    caller: ReportCallerIdentity,
  ): Promise<{ csv: string; fileName: string }> {
    this.assertAdmin(caller);

    const { period, sortedRows, summary } =
      await this.buildFilteredRowsAndSummary(rawQuery);

    const csv = buildProjectSummariesCsv({
      period,
      summary,
      rows: sortedRows,
    });

    const dateSuffix = period.isDateFiltered
      ? `${period.fromDate || 'start'}_to_${period.toDate || 'end'}`
      : new Date().toISOString().slice(0, 10);

    return {
      csv,
      fileName: `soft-touch-sofas-project-profitability-${dateSuffix}.csv`,
    };
  }

  private mapPurchaseHistoryItem(
    pv: IPurchaseVoucher,
  ): ProjectReportPurchaseItemDto {
    const voucherId = String(pv._id);
    const encodedVoucherId = encodeURIComponent(voucherId);
    const lineItems = (pv.lineItems || []).map((li) => ({
      materialName: li.materialName,
      quantity: li.quantity,
      unit: li.unit,
      unitPrice: roundFinancialAmount(li.unitPrice),
      lineTotal: roundFinancialAmount(li.lineTotal),
    }));

    const materialsSummary =
      lineItems.length === 0
        ? 'No line items'
        : lineItems.length === 1
          ? `${lineItems[0].materialName} (${lineItems[0].quantity} ${lineItems[0].unit})`
          : `${lineItems[0].materialName} + ${lineItems.length - 1} more`;

    const attachments = (pv.attachments || []).map((att) => {
      const encodedAttId = encodeURIComponent(att.attachmentId);
      const baseUrl = `/api/purchases/${encodedVoucherId}/attachments/${encodedAttId}`;
      return {
        attachmentId: att.attachmentId,
        originalName: att.originalName,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        storageProvider: att.storageProvider,
        uploadedBy: att.uploadedBy,
        uploadedByName: att.uploadedByName || '',
        uploadedAt: att.uploadedAt,
        viewUrl: baseUrl,
        downloadUrl: `${baseUrl}?download=1`,
      };
    });

    return {
      id: voucherId,
      voucherNumber: pv.voucherNumber,
      purchaseDate: pv.purchaseDate,
      supplierName: pv.supplierName,
      supplierInvoiceNumber: pv.supplierInvoiceNumber || '',
      materialsSummary,
      lineItems,
      subtotal: roundFinancialAmount(pv.subtotal),
      discountAmount: roundFinancialAmount(pv.discountAmount),
      taxAmount: roundFinancialAmount(pv.taxAmount),
      otherCharges: roundFinancialAmount(pv.otherCharges),
      finalTotal: roundFinancialAmount(pv.finalTotal),
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      attachments,
      detailPath: `/purchases/${encodeURIComponent(pv.voucherNumber || voucherId)}`,
    };
  }

  private mapExpenseHistoryItem(
    ev: IExpenseVoucher,
  ): ProjectReportExpenseItemDto {
    const voucherId = String(ev._id);
    const encodedVoucherId = encodeURIComponent(voucherId);
    const attachments = (ev.attachments || []).map((att) => {
      const encodedAttId = encodeURIComponent(att.attachmentId);
      const baseUrl = `/api/expenses/${encodedVoucherId}/attachments/${encodedAttId}`;
      return {
        attachmentId: att.attachmentId,
        originalName: att.originalName,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        storageProvider: att.storageProvider,
        uploadedBy: att.uploadedBy,
        uploadedByName: att.uploadedByName || '',
        uploadedAt: att.uploadedAt,
        viewUrl: baseUrl,
        downloadUrl: `${baseUrl}?download=1`,
      };
    });

    return {
      id: voucherId,
      voucherNumber: ev.voucherNumber,
      expenseDate: ev.expenseDate,
      categoryId: ev.categoryId,
      categoryName: ev.categoryName,
      description: ev.description,
      amount: roundFinancialAmount(ev.amount),
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      attachments,
      detailPath: `/expenses?view=${encodeURIComponent(ev.voucherNumber || voucherId)}`,
    };
  }

  private buildDateWiseCostHistory(
    purchases: ProjectReportPurchaseItemDto[],
    expenses: ProjectReportExpenseItemDto[],
  ): DateWiseCostBucketDto[] {
    const dateMap = new Map<
      string,
      {
        purchaseCosts: number;
        purchaseCount: number;
        otherExpenses: number;
        expenseCount: number;
        entries: DateWiseCostEntryDto[];
      }
    >();

    const getOrCreate = (dateKey: string) => {
      let existing = dateMap.get(dateKey);
      if (!existing) {
        existing = {
          purchaseCosts: 0,
          purchaseCount: 0,
          otherExpenses: 0,
          expenseCount: 0,
          entries: [],
        };
        dateMap.set(dateKey, existing);
      }
      return existing;
    };

    for (const pv of purchases) {
      const dateKey = toUtcDateKey(pv.purchaseDate);
      const bucket = getOrCreate(dateKey);
      bucket.purchaseCosts = roundFinancialAmount(
        bucket.purchaseCosts + pv.finalTotal,
      );
      bucket.purchaseCount += 1;
      bucket.entries.push({
        id: pv.id,
        type: 'purchase',
        voucherNumber: pv.voucherNumber,
        transactionDate: pv.purchaseDate,
        title: pv.supplierName,
        subtitle: pv.materialsSummary,
        amount: pv.finalTotal,
        hasAttachments: pv.hasAttachments,
        detailPath: pv.detailPath,
      });
    }

    for (const ev of expenses) {
      const dateKey = toUtcDateKey(ev.expenseDate);
      const bucket = getOrCreate(dateKey);
      bucket.otherExpenses = roundFinancialAmount(
        bucket.otherExpenses + ev.amount,
      );
      bucket.expenseCount += 1;
      bucket.entries.push({
        id: ev.id,
        type: 'expense',
        voucherNumber: ev.voucherNumber,
        transactionDate: ev.expenseDate,
        title: ev.categoryName,
        subtitle: ev.description,
        amount: ev.amount,
        hasAttachments: ev.hasAttachments,
        detailPath: ev.detailPath,
      });
    }

    const sortedAscendingDates = Array.from(dateMap.keys()).sort((a, b) =>
      a.localeCompare(b),
    );

    let runningCumulative = 0;
    const chronologicalAscending: DateWiseCostBucketDto[] =
      sortedAscendingDates.map((dateKey) => {
        const b = dateMap.get(dateKey)!;
        const dayTotal = roundFinancialAmount(
          b.purchaseCosts + b.otherExpenses,
        );
        runningCumulative = roundFinancialAmount(runningCumulative + dayTotal);

        return {
          date: dateKey,
          purchaseCosts: b.purchaseCosts,
          purchaseCount: b.purchaseCount,
          otherExpenses: b.otherExpenses,
          expenseCount: b.expenseCount,
          totalCosts: dayTotal,
          cumulativeCosts: runningCumulative,
          entries: b.entries,
        };
      });

    return chronologicalAscending;
  }

  async getIndividualProjectReport(
    identifier: string,
    rawQuery: Record<string, unknown>,
    caller: ReportCallerIdentity,
  ): Promise<IndividualProjectReportResponseDto> {
    this.assertCanViewReports(caller);
    const includeProfitability = this.canViewProfitability(caller);

    const validation = validateProjectReportDetailQueryDto(rawQuery);
    if (!validation.isValid || !validation.value) {
      const firstMsg = validation.errors
        ? Object.values(validation.errors)[0]
        : 'Invalid date range parameters.';
      throw new ReportValidationError(
        validation.errors || { query: 'Invalid query parameters.' },
        firstMsg,
      );
    }

    const query = validation.value;
    const project = await this.repository.findProjectByIdOrCode(identifier);
    if (!project || !project._id) {
      throw new ReportNotFoundError(
        `Project '${identifier}' was not found.`,
      );
    }

    if (
      !isProjectAccessibleToCaller(
        caller.assignedProjectIds,
        String(project._id),
        project.projectId,
      )
    ) {
      throw new ReportForbiddenError(
        'Access denied. You do not have permission to view reports for this project.',
      );
    }

    const period = this.buildPeriodMeta(query.fromDateStr, query.toDateStr);
    const projectRecordId = String(project._id);

    const tx = await this.repository.findAllProjectTransactions(
      projectRecordId,
      project.projectId,
    );

    let lifetimePurchases = 0;
    for (const pv of tx.activePurchases) {
      lifetimePurchases = roundFinancialAmount(
        lifetimePurchases + Number(pv.finalTotal || 0),
      );
    }

    let lifetimeExpenses = 0;
    for (const ev of tx.activeExpenses) {
      lifetimeExpenses = roundFinancialAmount(
        lifetimeExpenses + Number(ev.amount || 0),
      );
    }

    const scopedPurchasesRaw = period.isDateFiltered
      ? tx.activePurchases.filter((pv) =>
          isWithinDateRange(pv.purchaseDate, query.fromDate, query.toDate),
        )
      : tx.activePurchases;

    const scopedExpensesRaw = period.isDateFiltered
      ? tx.activeExpenses.filter((ev) =>
          isWithinDateRange(ev.expenseDate, query.fromDate, query.toDate),
        )
      : tx.activeExpenses;

    const purchaseHistory = scopedPurchasesRaw.map((pv) =>
      this.mapPurchaseHistoryItem(pv),
    );
    const expenseHistory = scopedExpensesRaw.map((ev) =>
      this.mapExpenseHistoryItem(ev),
    );

    let periodPurchases = 0;
    for (const item of purchaseHistory) {
      periodPurchases = roundFinancialAmount(periodPurchases + item.finalTotal);
    }

    let periodExpenses = 0;
    for (const item of expenseHistory) {
      periodExpenses = roundFinancialAmount(periodExpenses + item.amount);
    }

    const lifetimeMetrics = calculateProjectFinancialMetrics({
      contractValue: project.contractValue,
      totalPurchases: lifetimePurchases,
      totalOtherExpenses: lifetimeExpenses,
    });

    const periodMetrics = calculateProjectFinancialMetrics({
      contractValue: project.contractValue,
      totalPurchases: periodPurchases,
      totalOtherExpenses: periodExpenses,
    });

    const marginApplicable = lifetimeMetrics.contractValue > 0;
    const warningThresholdPercent =
      project.costAlertThresholdPercent ||
      env.PROJECT_COST_WARNING_THRESHOLD_PERCENT;

    const healthStatus = determineProjectHealthStatus({
      contractValue: lifetimeMetrics.contractValue,
      totalCost: lifetimeMetrics.totalCost,
      estimatedProfit: lifetimeMetrics.estimatedProfit,
      costPercentage: lifetimeMetrics.costPercentage,
      warningThresholdPercent,
    });

    const breakdownPurchases = period.isDateFiltered
      ? periodMetrics.totalPurchases
      : lifetimeMetrics.totalPurchases;
    const breakdownExpenses = period.isDateFiltered
      ? periodMetrics.totalOtherExpenses
      : lifetimeMetrics.totalOtherExpenses;
    const breakdownTotal = period.isDateFiltered
      ? periodMetrics.totalCost
      : lifetimeMetrics.totalCost;

    const materialShareOfCostPercent =
      breakdownTotal > 0
        ? roundPercentage((breakdownPurchases / breakdownTotal) * 100)
        : 0;
    const expenseShareOfCostPercent =
      breakdownTotal > 0
        ? roundPercentage((breakdownExpenses / breakdownTotal) * 100)
        : 0;

    const materialPercentOfContract = marginApplicable
      ? roundPercentage(
          (breakdownPurchases / lifetimeMetrics.contractValue) * 100,
        )
      : null;
    const expensePercentOfContract = marginApplicable
      ? roundPercentage(
          (breakdownExpenses / lifetimeMetrics.contractValue) * 100,
        )
      : null;

    const dateWiseCostHistory = this.buildDateWiseCostHistory(
      purchaseHistory,
      expenseHistory,
    );

    const fullReport: IndividualProjectReportResponseDto = {
      period,
      project: {
        id: projectRecordId,
        projectId: project.projectId,
        name: project.name,
        clientName: project.clientName,
        clientContact: extractOptionalClientContact(project),
        siteLocation: extractOptionalSiteLocation(project),
        category: project.category,
        status: project.status,
        description: project.description || '',
        contractValue: lifetimeMetrics.contractValue,
        costAlertThresholdPercent: warningThresholdPercent,
        createdBy: project.createdBy,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        lastActivityAt: project.lastActivityAt,
        lastActivityType: project.lastActivityType,
      },
      financialOverview: {
        lifetime: {
          contractValue: lifetimeMetrics.contractValue,
          materialPurchaseCosts: lifetimeMetrics.totalPurchases,
          otherProjectExpenses: lifetimeMetrics.totalOtherExpenses,
          totalProjectCosts: lifetimeMetrics.totalCost,
          estimatedProfit: lifetimeMetrics.estimatedProfit,
          profitMargin: marginApplicable
            ? lifetimeMetrics.estimatedProfitMargin
            : null,
          marginApplicable,
          costPercentage: marginApplicable
            ? lifetimeMetrics.costPercentage
            : null,
          costPercentageApplicable: marginApplicable,
          healthStatus,
          profitType: 'estimated',
          isAudited: false,
        },
        selectedPeriod: {
          materialPurchaseCosts: periodMetrics.totalPurchases,
          otherProjectExpenses: periodMetrics.totalOtherExpenses,
          totalProjectCosts: periodMetrics.totalCost,
          netAgainstContract: periodMetrics.estimatedProfit,
          marginAgainstContract: marginApplicable
            ? periodMetrics.estimatedProfitMargin
            : null,
          marginApplicable,
          costPercentageOfContract: marginApplicable
            ? periodMetrics.costPercentage
            : null,
          purchaseCount: purchaseHistory.length,
          expenseCount: expenseHistory.length,
        },
        costBreakdown: {
          basis: period.isDateFiltered ? 'period' : 'lifetime',
          materialPurchaseCosts: breakdownPurchases,
          otherProjectExpenses: breakdownExpenses,
          totalProjectCosts: breakdownTotal,
          materialShareOfCostPercent,
          expenseShareOfCostPercent,
          materialPercentOfContract,
          expensePercentOfContract,
        },
      },
      purchaseHistory,
      expenseHistory,
      excludedCounts: {
        cancelledPurchases: tx.cancelledPurchaseCount,
        cancelledExpenses: tx.cancelledExpenseCount,
      },
      dateWiseCostHistory,
      schemaNotes: {
        siteLocationPersisted: false,
        clientContactPersisted: false,
      },
    };

    if (!includeProfitability) {
      return {
        ...fullReport,
        project: {
          ...fullReport.project,
          contractValue: null as unknown as number,
          costAlertThresholdPercent: null as unknown as number,
        },
        financialOverview: {
          lifetime: {
            ...fullReport.financialOverview.lifetime,
            contractValue: null as unknown as number,
            estimatedProfit: null as unknown as number,
            profitMargin: null,
            marginApplicable: false,
            costPercentage: null,
            costPercentageApplicable: false,
            healthStatus: 'neutral',
          },
          selectedPeriod: {
            ...fullReport.financialOverview.selectedPeriod,
            netAgainstContract: null as unknown as number,
            marginAgainstContract: null,
            marginApplicable: false,
            costPercentageOfContract: null,
          },
          costBreakdown: {
            ...fullReport.financialOverview.costBreakdown,
            materialPercentOfContract: null,
            expensePercentOfContract: null,
          },
        },
      };
    }

    return fullReport;
  }

  async exportIndividualProjectReportPdf(
    identifier: string,
    rawQuery: Record<string, unknown>,
    caller: ReportCallerIdentity,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    this.assertAdmin(caller);
    const report = await this.getIndividualProjectReport(
      identifier,
      rawQuery,
      caller,
    );
    const buffer = buildIndividualProjectReportPdf(report);
    const safeCode = report.project.projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const suffix = report.period.isDateFiltered
      ? `${report.period.fromDate || 'start'}_to_${report.period.toDate || 'end'}`
      : 'lifetime';

    return {
      buffer,
      fileName: `soft-touch-sofas-${safeCode}-report-${suffix}.pdf`,
    };
  }
}
