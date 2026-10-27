import mongoose, { Model } from 'mongoose';
import { env } from '../../../config/env';
import { IProjectCostThresholdState } from '../models/project.model';

import {
  CostThresholdTransitionResult,
  IVoucherTotalsProvider,
  ProjectFinancialCalculationInput,
  ProjectFinancialMetrics,
  ProjectVoucherAggregationTotals,
} from '../types';

export {
  CostThresholdTransitionResult,
  IVoucherTotalsProvider,
  ProjectFinancialCalculationInput,
  ProjectFinancialMetrics,
  ProjectVoucherAggregationTotals,
};

export interface VoucherModelBindingConfig {
  model: Model<Record<string, unknown>>;
  projectRefField: string;
  amountField: string;
  activityField?: string;
  baseFilter?: Record<string, unknown>;
}

function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

export function roundFinancialAmount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return normalizeZero(Math.round((value + Number.EPSILON) * 100) / 100);
}

export function roundPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return normalizeZero(Math.round((value + Number.EPSILON) * 100) / 100);
}

export function calculateProjectFinancialMetrics(
  input: ProjectFinancialCalculationInput,
): ProjectFinancialMetrics {
  const safeContractValue = Math.max(0, roundFinancialAmount(input.contractValue));
  const safePurchases = Math.max(0, roundFinancialAmount(input.totalPurchases));
  const safeOtherExpenses = Math.max(
    0,
    roundFinancialAmount(input.totalOtherExpenses),
  );

  const totalCost = roundFinancialAmount(safePurchases + safeOtherExpenses);
  const estimatedProfit = roundFinancialAmount(safeContractValue - totalCost);

  let costPercentage = 0;
  let estimatedProfitMargin = 0;

  if (safeContractValue > 0) {
    costPercentage = roundPercentage((totalCost / safeContractValue) * 100);
    estimatedProfitMargin = roundPercentage(
      (estimatedProfit / safeContractValue) * 100,
    );
  }

  return {
    contractValue: safeContractValue,
    totalPurchases: safePurchases,
    totalOtherExpenses: safeOtherExpenses,
    totalCost,
    estimatedProfit,
    costPercentage,
    estimatedProfitMargin,
    profitType: 'estimated',
    isAudited: false,
  };
}

export function evaluateCostThresholdTransitions(params: {
  previousState: IProjectCostThresholdState;
  contractValue: number;
  totalCost: number;
  warningThresholdPercent?: number;
  criticalThresholdPercent?: number;
}): CostThresholdTransitionResult {
  const warningThresholdPercent =
    params.warningThresholdPercent ??
    params.previousState.warningThresholdPercent ??
    env.PROJECT_COST_WARNING_THRESHOLD_PERCENT;
  const criticalThresholdPercent =
    params.criticalThresholdPercent ??
    env.PROJECT_COST_CRITICAL_THRESHOLD_PERCENT;

  let isWarningCurrentlyCrossed = false;
  let isCriticalCurrentlyCrossed = false;

  if (params.contractValue > 0) {
    const rawRatioPercent = (params.totalCost / params.contractValue) * 100;
    isWarningCurrentlyCrossed =
      rawRatioPercent + 1e-9 >= warningThresholdPercent;
    isCriticalCurrentlyCrossed =
      rawRatioPercent + 1e-9 >= criticalThresholdPercent;
  } else {
    isWarningCurrentlyCrossed = false;
    isCriticalCurrentlyCrossed = params.totalCost > 0;
  }

  const triggerWarningAlert =
    !params.previousState.warningCrossed && isWarningCurrentlyCrossed;
  const resolveWarningAlert =
    params.previousState.warningCrossed && !isWarningCurrentlyCrossed;

  const triggerCriticalAlert =
    !params.previousState.exceededCrossed && isCriticalCurrentlyCrossed;
  const resolveCriticalAlert =
    params.previousState.exceededCrossed && !isCriticalCurrentlyCrossed;

  return {
    nextState: {
      warningCrossed: isWarningCurrentlyCrossed,
      exceededCrossed: isCriticalCurrentlyCrossed,
      warningThresholdPercent,
    },
    triggerWarningAlert,
    resolveWarningAlert,
    triggerCriticalAlert,
    resolveCriticalAlert,
    criticalThresholdPercent,
  };
}

export class NoopVoucherTotalsProvider implements IVoucherTotalsProvider {
  async aggregateProjectVouchers(
    _projectRecordId: string,
    _projectCode: string,
  ): Promise<ProjectVoucherAggregationTotals> {
    return {
      totalPurchases: 0,
      totalOtherExpenses: 0,
      latestVoucherActivityAt: null,
    };
  }

  isPurchaseIntegrationActive(): boolean {
    return false;
  }

  isExpenseIntegrationActive(): boolean {
    return false;
  }
}

export class MongooseVoucherTotalsProvider implements IVoucherTotalsProvider {
  constructor(
    private bindings: {
      purchase?: VoucherModelBindingConfig;
      expense?: VoucherModelBindingConfig;
    } = {},
  ) {}

  isPurchaseIntegrationActive(): boolean {
    return Boolean(this.bindings.purchase);
  }

  isExpenseIntegrationActive(): boolean {
    return Boolean(this.bindings.expense);
  }

  private async aggregateBinding(
    binding: VoucherModelBindingConfig | undefined,
    projectRecordId: string,
    projectCode: string,
  ): Promise<{ total: number; latestActivityAt: Date | null }> {
    if (!binding || mongoose.connection.readyState !== 1) {
      return { total: 0, latestActivityAt: null };
    }

    const candidateRefs: unknown[] = [projectRecordId, projectCode];
    if (mongoose.isValidObjectId(projectRecordId)) {
      candidateRefs.push(new mongoose.Types.ObjectId(projectRecordId));
    }

    const matchStage: Record<string, unknown> = {
      ...(binding.baseFilter || {}),
      [binding.projectRefField]: { $in: candidateRefs },
    };

    const activityExpr = binding.activityField
      ? `$${binding.activityField}`
      : '$updatedAt';

    const rows = await binding.model
      .aggregate<{ totalAmount: number; latestAt: Date | null }>([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: `$${binding.amountField}` },
            latestAt: { $max: activityExpr },
          },
        },
      ])
      .exec();

    if (!rows.length) {
      return { total: 0, latestActivityAt: null };
    }

    return {
      total: roundFinancialAmount(Number(rows[0].totalAmount) || 0),
      latestActivityAt: rows[0].latestAt ? new Date(rows[0].latestAt) : null,
    };
  }

  async aggregateProjectVouchers(
    projectRecordId: string,
    projectCode: string,
  ): Promise<ProjectVoucherAggregationTotals> {
    const [purchases, expenses] = await Promise.all([
      this.aggregateBinding(
        this.bindings.purchase,
        projectRecordId,
        projectCode,
      ),
      this.aggregateBinding(
        this.bindings.expense,
        projectRecordId,
        projectCode,
      ),
    ]);

    let latestVoucherActivityAt: Date | null = null;
    if (purchases.latestActivityAt && expenses.latestActivityAt) {
      latestVoucherActivityAt =
        purchases.latestActivityAt.getTime() >=
        expenses.latestActivityAt.getTime()
          ? purchases.latestActivityAt
          : expenses.latestActivityAt;
    } else {
      latestVoucherActivityAt =
        purchases.latestActivityAt || expenses.latestActivityAt;
    }

    return {
      totalPurchases: purchases.total,
      totalOtherExpenses: expenses.total,
      latestVoucherActivityAt,
    };
  }
}
