import {
  ProjectCategory,
  ProjectStatus,
} from '../../projects/models/project.model';
import { RawMaterialCategory, RawMaterialUnit } from '../../raw-materials';
import {
  ProjectFinancialHealth,
  ReportSortField,
  ReportSortOrder,
} from '../../reports/types';

export interface DashboardCallerIdentity {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'data_entry';
}

export interface DashboardOverviewQueryDto {
  projectStatus: ProjectStatus | 'all';
  projectSearch?: string;
  projectSortBy: ReportSortField;
  projectSortOrder: ReportSortOrder;
  expenseMonths: number;
  expenseFromDate?: Date;
  expenseToDate?: Date;
  expenseFromDateStr: string | null;
  expenseToDateStr: string | null;
  recentLimit: number;
}

export interface DashboardMonthlyExpensesQueryDto {
  months: number;
  fromDate?: Date;
  toDate?: Date;
  fromDateStr: string | null;
  toDateStr: string | null;
}

export interface DashboardKpiSummaryDto {
  totalProjects: number;
  activeProjects: number;
  inProgressProjects: number;
  underReviewProjects: number;
  completedProjects: number;
  totalContractValue: number;
  materialPurchaseCosts: number;
  otherProjectExpenses: number;
  totalProjectCosts: number;
  estimatedProfit: number;
  profitMargin: number | null;
  marginApplicable: boolean;
  costPercentage: number | null;
  profitableProjectsCount: number;
  nearLimitProjectsCount: number;
  overBudgetProjectsCount: number;
  profitType: 'estimated';
  isAudited: false;
}

export interface DashboardProjectPerformanceRowDto {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  category: ProjectCategory;
  status: ProjectStatus;
  contractValue: number;
  materialPurchaseCosts: number;
  otherProjectExpenses: number;
  totalProjectCosts: number;
  estimatedProfit: number;
  profitMargin: number | null;
  marginApplicable: boolean;
  costPercentage: number | null;
  warningThresholdPercent: number;
  healthStatus: ProjectFinancialHealth;
  detailPath: string;
}

export interface MonthlyExpenseBucketDto {
  monthKey: string;
  label: string;
  shortLabel: string;
  purchaseCosts: number;
  purchaseCount: number;
  otherExpenses: number;
  expenseCount: number;
  totalExpenses: number;
}

export interface DashboardMonthlyExpensesDto {
  fromDate: string;
  toDate: string;
  isCustomRange: boolean;
  totals: {
    purchaseCosts: number;
    otherExpenses: number;
    totalExpenses: number;
    purchaseCount: number;
    expenseCount: number;
  };
  buckets: MonthlyExpenseBucketDto[];
}

export interface DashboardRecentTransactionDto {
  id: string;
  type: 'purchase' | 'expense';
  voucherNumber: string;
  projectCode: string | null;
  projectName: string | null;
  partyOrCategory: string;
  amount: number;
  transactionDate: Date;
  createdAt?: Date;
  status: 'active' | 'cancelled';
  detailPath: string;
}

export type StockAlertSeverity = 'out_of_stock' | 'low_stock';

export interface DashboardStockAlertItemDto {
  id: string;
  name: string;
  category: RawMaterialCategory | null;
  unit: RawMaterialUnit;
  quantityOnHand: number;
  minStockLevel: number | null;
  alertStatus: StockAlertSeverity;
  detailPath: string;
}

export interface DashboardStockAlertsDto {
  totalActiveMaterials: number;
  configuredThresholdCount: number;
  outOfStockCount: number;
  lowStockCount: number;
  items: DashboardStockAlertItemDto[];
}

export interface DashboardPendingApprovalUserDto {
  id: string;
  name: string;
  email: string;
  createdAt?: string | Date;
}

export interface DashboardPendingApprovalsDto {
  count: number;
  items: DashboardPendingApprovalUserDto[];
}

export interface DashboardOverviewResponseDto {
  generatedAt: string;
  kpis: DashboardKpiSummaryDto;
  projectPerformance: {
    totalMatching: number;
    items: DashboardProjectPerformanceRowDto[];
  };
  monthlyExpenses: DashboardMonthlyExpensesDto;
  recentTransactions: DashboardRecentTransactionDto[];
  stockAlerts: DashboardStockAlertsDto;
  pendingApprovals: DashboardPendingApprovalsDto | null;
}
