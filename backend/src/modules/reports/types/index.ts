import {
  ProjectCategory,
  ProjectActivityEventType,
  ProjectStatus,
} from '../../projects/models/project.model';
import { PurchaseBillAttachmentResponseDto } from '../../purchases/types';
import { ExpenseReceiptAttachmentResponseDto } from '../../expenses/types';

export type ReportSortField =
  | 'contractValue'
  | 'totalCost'
  | 'estimatedProfit'
  | 'profitMargin'
  | 'createdAt';

export type ReportSortOrder = 'asc' | 'desc';

export type ProjectFinancialHealth =
  | 'profitable'
  | 'near_limit'
  | 'loss'
  | 'neutral';

export interface ReportCallerIdentity {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'data_entry';
  permissions?: string[];
  assignedProjectIds?: string[] | null;
}

export interface ReportValidationResult<T> {
  isValid: boolean;
  value?: T;
  errors?: Record<string, string>;
}

export interface ReportPeriodMetaDto {
  isDateFiltered: boolean;
  fromDate: string | null;
  toDate: string | null;
  filterBasis: 'transaction_date';
  reportingMode: 'lifetime' | 'period';
}

export interface ProjectReportsQueryDto {
  page: number;
  limit: number;
  search?: string;
  status: ProjectStatus | 'all';
  fromDate?: Date;
  toDate?: Date;
  fromDateStr: string | null;
  toDateStr: string | null;
  sortBy: ReportSortField;
  sortOrder: ReportSortOrder;
}

export interface ProjectReportDetailQueryDto {
  fromDate?: Date;
  toDate?: Date;
  fromDateStr: string | null;
  toDateStr: string | null;
}

export interface ReportsPortfolioSummaryDto {
  projectCount: number;
  contractValue: number;
  materialPurchaseCosts: number;
  otherProjectExpenses: number;
  totalProjectCosts: number;
  estimatedProfit: number;
  profitMargin: number | null;
  marginApplicable: boolean;
  costPercentage: number | null;
  costPercentageApplicable: boolean;
  lifetimeTotalProjectCosts: number;
  lifetimeEstimatedProfit: number;
  lifetimeProfitMargin: number | null;
  profitableCount: number;
  nearLimitCount: number;
  lossCount: number;
  profitType: 'estimated';
  isAudited: false;
}

export interface ProjectProfitabilityRowDto {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  siteLocation: string | null;
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
  costPercentageApplicable: boolean;
  warningThresholdPercent: number;
  healthStatus: ProjectFinancialHealth;
  purchaseCount: number;
  expenseCount: number;
  lifetimeMaterialPurchaseCosts: number;
  lifetimeOtherProjectExpenses: number;
  lifetimeTotalProjectCosts: number;
  lifetimeEstimatedProfit: number;
  lifetimeProfitMargin: number | null;
  createdAt?: Date;
  lastActivityAt: Date;
  profitType: 'estimated';
  isAudited: false;
}

export interface ProjectReportListResponseDto {
  period: ReportPeriodMetaDto;
  summary: ReportsPortfolioSummaryDto;
  items: ProjectProfitabilityRowDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  schemaNotes: {
    siteLocationPersisted: boolean;
    clientContactPersisted: boolean;
  };
}

export interface ProjectReportPurchaseItemDto {
  id: string;
  voucherNumber: string;
  purchaseDate: Date;
  supplierName: string;
  supplierInvoiceNumber: string;
  materialsSummary: string;
  lineItems: Array<{
    materialName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  otherCharges: number;
  finalTotal: number;
  hasAttachments: boolean;
  attachmentCount: number;
  attachments: PurchaseBillAttachmentResponseDto[];
  detailPath: string;
}

export interface ProjectReportExpenseItemDto {
  id: string;
  voucherNumber: string;
  expenseDate: Date;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: number;
  hasAttachments: boolean;
  attachmentCount: number;
  attachments: ExpenseReceiptAttachmentResponseDto[];
  detailPath: string;
}

export interface DateWiseCostEntryDto {
  id: string;
  type: 'purchase' | 'expense';
  voucherNumber: string;
  transactionDate: Date;
  title: string;
  subtitle: string;
  amount: number;
  hasAttachments: boolean;
  detailPath: string;
}

export interface DateWiseCostBucketDto {
  date: string;
  purchaseCosts: number;
  purchaseCount: number;
  otherExpenses: number;
  expenseCount: number;
  totalCosts: number;
  cumulativeCosts: number;
  entries: DateWiseCostEntryDto[];
}

export interface IndividualProjectReportResponseDto {
  period: ReportPeriodMetaDto;
  project: {
    id: string;
    projectId: string;
    name: string;
    clientName: string;
    clientContact: string | null;
    siteLocation: string | null;
    category: ProjectCategory;
    status: ProjectStatus;
    description: string;
    contractValue: number;
    costAlertThresholdPercent: number;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
    lastActivityAt: Date;
    lastActivityType: ProjectActivityEventType;
  };
  financialOverview: {
    lifetime: {
      contractValue: number;
      materialPurchaseCosts: number;
      otherProjectExpenses: number;
      totalProjectCosts: number;
      estimatedProfit: number;
      profitMargin: number | null;
      marginApplicable: boolean;
      costPercentage: number | null;
      costPercentageApplicable: boolean;
      healthStatus: ProjectFinancialHealth;
      profitType: 'estimated';
      isAudited: false;
    };
    selectedPeriod: {
      materialPurchaseCosts: number;
      otherProjectExpenses: number;
      totalProjectCosts: number;
      netAgainstContract: number;
      marginAgainstContract: number | null;
      marginApplicable: boolean;
      costPercentageOfContract: number | null;
      purchaseCount: number;
      expenseCount: number;
    };
    costBreakdown: {
      basis: 'lifetime' | 'period';
      materialPurchaseCosts: number;
      otherProjectExpenses: number;
      totalProjectCosts: number;
      materialShareOfCostPercent: number;
      expenseShareOfCostPercent: number;
      materialPercentOfContract: number | null;
      expensePercentOfContract: number | null;
    };
  };
  purchaseHistory: ProjectReportPurchaseItemDto[];
  expenseHistory: ProjectReportExpenseItemDto[];
  excludedCounts: {
    cancelledPurchases: number;
    cancelledExpenses: number;
  };
  dateWiseCostHistory: DateWiseCostBucketDto[];
  schemaNotes: {
    siteLocationPersisted: boolean;
    clientContactPersisted: boolean;
  };
}

export interface ProjectVoucherTotalsBucket {
  lifetimePurchases: number;
  lifetimePurchaseCount: number;
  lifetimeExpenses: number;
  lifetimeExpenseCount: number;
  periodPurchases: number;
  periodPurchaseCount: number;
  periodExpenses: number;
  periodExpenseCount: number;
}
