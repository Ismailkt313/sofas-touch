import mongoose, { Model } from 'mongoose';
import {
  ExpenseVoucherModel,
  IExpenseVoucher,
  sharedExpenseVoucherMemoryStore,
} from '../../expenses';
import { roundFinancialAmount } from '../../projects';
import {
  IPurchaseVoucher,
  PurchaseVoucherModel,
  sharedPurchaseVoucherMemoryStore,
} from '../../purchases';
import {
  IRawMaterial,
  RawMaterialModel,
  sharedRawMaterialMemoryStore,
} from '../../raw-materials';
import {
  DashboardRecentTransactionDto,
  DashboardStockAlertItemDto,
  DashboardStockAlertsDto,
} from '../types';

export interface RawMonthlySpendEntry {
  monthKey: string;
  purchaseCosts: number;
  purchaseCount: number;
  otherExpenses: number;
  expenseCount: number;
}

function toMonthKeyUtc(raw: Date | string): string | null {
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }
  return dt.toISOString().slice(0, 7);
}

function roundQty(val: number): number {
  if (!Number.isFinite(val)) return 0;
  const rounded = Math.round((val + Number.EPSILON) * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export class DashboardRepository {
  constructor(
    private readonly purchaseModel: Model<IPurchaseVoucher> = PurchaseVoucherModel,
    private readonly expenseModel: Model<IExpenseVoucher> = ExpenseVoucherModel,
    private readonly materialModel: Model<IRawMaterial> = RawMaterialModel,
    private readonly purchaseMemory: Map<
      string,
      IPurchaseVoucher
    > = sharedPurchaseVoucherMemoryStore,
    private readonly expenseMemory: Map<
      string,
      IExpenseVoucher
    > = sharedExpenseVoucherMemoryStore,
    private readonly materialMemory: Map<
      string,
      IRawMaterial
    > = sharedRawMaterialMemoryStore,
  ) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async aggregateMonthlySpend(params: {
    fromDate: Date;
    toDate: Date;
  }): Promise<Map<string, RawMonthlySpendEntry>> {
    const byMonth = new Map<string, RawMonthlySpendEntry>();

    const ensureBucket = (key: string): RawMonthlySpendEntry => {
      let existing = byMonth.get(key);
      if (!existing) {
        existing = {
          monthKey: key,
          purchaseCosts: 0,
          purchaseCount: 0,
          otherExpenses: 0,
          expenseCount: 0,
        };
        byMonth.set(key, existing);
      }
      return existing;
    };

    if (this.isDbConnected()) {
      const [purchaseGroups, expenseGroups] = await Promise.all([
        this.purchaseModel
          .aggregate<{
            _id: string;
            total: number;
            count: number;
          }>([
            {
              $match: {
                status: 'active',
                purchaseDate: {
                  $gte: params.fromDate,
                  $lte: params.toDate,
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$purchaseDate',
                    timezone: 'UTC',
                  },
                },
                total: { $sum: '$finalTotal' },
                count: { $sum: 1 },
              },
            },
          ])
          .exec(),
        this.expenseModel
          .aggregate<{
            _id: string;
            total: number;
            count: number;
          }>([
            {
              $match: {
                status: 'active',
                expenseDate: {
                  $gte: params.fromDate,
                  $lte: params.toDate,
                },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$expenseDate',
                    timezone: 'UTC',
                  },
                },
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ])
          .exec(),
      ]);

      for (const row of purchaseGroups) {
        if (!row._id) continue;
        const b = ensureBucket(row._id);
        b.purchaseCosts = roundFinancialAmount(b.purchaseCosts + row.total);
        b.purchaseCount += row.count;
      }

      for (const row of expenseGroups) {
        if (!row._id) continue;
        const b = ensureBucket(row._id);
        b.otherExpenses = roundFinancialAmount(b.otherExpenses + row.total);
        b.expenseCount += row.count;
      }

      return byMonth;
    }

    const fromMs = params.fromDate.getTime();
    const toMs = params.toDate.getTime();

    for (const p of this.purchaseMemory.values()) {
      if (p.status !== 'active') continue;
      const ms = new Date(p.purchaseDate).getTime();
      if (Number.isNaN(ms) || ms < fromMs || ms > toMs) continue;
      const key = toMonthKeyUtc(p.purchaseDate);
      if (!key) continue;
      const b = ensureBucket(key);
      b.purchaseCosts = roundFinancialAmount(b.purchaseCosts + p.finalTotal);
      b.purchaseCount += 1;
    }

    for (const e of this.expenseMemory.values()) {
      if (e.status !== 'active') continue;
      const ms = new Date(e.expenseDate).getTime();
      if (Number.isNaN(ms) || ms < fromMs || ms > toMs) continue;
      const key = toMonthKeyUtc(e.expenseDate);
      if (!key) continue;
      const b = ensureBucket(key);
      b.otherExpenses = roundFinancialAmount(b.otherExpenses + e.amount);
      b.expenseCount += 1;
    }

    return byMonth;
  }

  async findRecentTransactions(
    limit: number,
  ): Promise<DashboardRecentTransactionDto[]> {
    const safeLimit = Math.min(20, Math.max(1, limit));

    let recentPurchases: IPurchaseVoucher[] = [];
    let recentExpenses: IExpenseVoucher[] = [];

    if (this.isDbConnected()) {
      const [pDocs, eDocs] = await Promise.all([
        this.purchaseModel
          .find({})
          .sort({ purchaseDate: -1, createdAt: -1, _id: -1 })
          .limit(safeLimit)
          .lean()
          .exec(),
        this.expenseModel
          .find({})
          .sort({ expenseDate: -1, createdAt: -1, _id: -1 })
          .limit(safeLimit)
          .lean()
          .exec(),
      ]);
      recentPurchases = pDocs as unknown as IPurchaseVoucher[];
      recentExpenses = eDocs as unknown as IExpenseVoucher[];
    } else {
      recentPurchases = Array.from(this.purchaseMemory.values())
        .sort((a, b) => {
          const dDiff =
            new Date(b.purchaseDate).getTime() -
            new Date(a.purchaseDate).getTime();
          if (dDiff !== 0) return dDiff;
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
        })
        .slice(0, safeLimit);

      recentExpenses = Array.from(this.expenseMemory.values())
        .sort((a, b) => {
          const dDiff =
            new Date(b.expenseDate).getTime() -
            new Date(a.expenseDate).getTime();
          if (dDiff !== 0) return dDiff;
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
        })
        .slice(0, safeLimit);
    }

    const mappedPurchases: DashboardRecentTransactionDto[] =
      recentPurchases.map((p) => ({
        id: String(p._id || p.voucherNumber),
        type: 'purchase',
        voucherNumber: p.voucherNumber,
        projectCode: p.projectCode || null,
        projectName: p.projectName || null,
        partyOrCategory: p.supplierName || 'Supplier',
        amount: roundFinancialAmount(p.finalTotal),
        transactionDate: new Date(p.purchaseDate),
        createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        status: p.status === 'cancelled' ? 'cancelled' : 'active',
        detailPath: `/purchases/${encodeURIComponent(p.voucherNumber)}`,
      }));

    const mappedExpenses: DashboardRecentTransactionDto[] = recentExpenses.map(
      (e) => ({
        id: String(e._id || e.voucherNumber),
        type: 'expense',
        voucherNumber: e.voucherNumber,
        projectCode: e.projectCode || null,
        projectName: e.projectName || null,
        partyOrCategory: e.categoryName || 'Expense',
        amount: roundFinancialAmount(e.amount),
        transactionDate: new Date(e.expenseDate),
        createdAt: e.createdAt ? new Date(e.createdAt) : undefined,
        status: e.status === 'cancelled' ? 'cancelled' : 'active',
        detailPath: `/expenses?view=${encodeURIComponent(e.voucherNumber)}`,
      }),
    );

    const combined = [...mappedPurchases, ...mappedExpenses];
    combined.sort((a, b) => {
      const txDiff =
        new Date(b.transactionDate).getTime() -
        new Date(a.transactionDate).getTime();
      if (txDiff !== 0) return txDiff;
      const crDiff =
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime();
      if (crDiff !== 0) return crDiff;
      return b.voucherNumber.localeCompare(a.voucherNumber);
    });

    return combined.slice(0, safeLimit);
  }

  async findStockAlerts(): Promise<DashboardStockAlertsDto> {
    let activeMaterials: IRawMaterial[] = [];
    let totalActiveMaterials = 0;
    let configuredThresholdCount = 0;

    if (this.isDbConnected()) {
      const [alertDocs, activeCount, configuredCount] = await Promise.all([
        this.materialModel
          .find({
            isActive: true,
            $or: [
              { quantityOnHand: { $lte: 0 } },
              {
                minStockLevel: { $ne: null, $gte: 0 },
                $expr: { $lte: ['$quantityOnHand', '$minStockLevel'] },
              },
            ],
          })
          .lean()
          .exec(),
        this.materialModel.countDocuments({ isActive: true }).exec(),
        this.materialModel
          .countDocuments({
            isActive: true,
            minStockLevel: { $ne: null, $gte: 0 },
          })
          .exec(),
      ]);

      activeMaterials = alertDocs as unknown as IRawMaterial[];
      totalActiveMaterials = activeCount;
      configuredThresholdCount = configuredCount;
    } else {
      const allActive = Array.from(this.materialMemory.values()).filter(
        (m) => m.isActive,
      );
      totalActiveMaterials = allActive.length;
      configuredThresholdCount = allActive.filter(
        (m) =>
          typeof m.minStockLevel === 'number' &&
          Number.isFinite(m.minStockLevel) &&
          m.minStockLevel >= 0,
      ).length;
      activeMaterials = allActive.filter((m) => {
        const qty = roundQty(Number(m.quantityOnHand ?? 0));
        const min =
          typeof m.minStockLevel === 'number' &&
          Number.isFinite(m.minStockLevel) &&
          m.minStockLevel >= 0
            ? roundQty(m.minStockLevel)
            : null;
        if (qty <= 0) return true;
        if (min !== null && qty <= min) return true;
        return false;
      });
    }

    let outOfStockCount = 0;
    let lowStockCount = 0;

    const alertItems: DashboardStockAlertItemDto[] = activeMaterials.map(
      (mat) => {
        const id = String(mat._id || '');
        const qty = Math.max(0, roundQty(Number(mat.quantityOnHand ?? 0)));
        const minLevel =
          typeof mat.minStockLevel === 'number' &&
          Number.isFinite(mat.minStockLevel) &&
          mat.minStockLevel >= 0
            ? roundQty(mat.minStockLevel)
            : null;

        const isOut = qty <= 0;
        if (isOut) {
          outOfStockCount += 1;
        } else {
          lowStockCount += 1;
        }

        return {
          id,
          name: mat.name,
          category: mat.category ?? null,
          unit: mat.unit,
          quantityOnHand: qty,
          minStockLevel: minLevel,
          alertStatus: isOut ? 'out_of_stock' : 'low_stock',
          detailPath: `/raw-materials?material=${encodeURIComponent(id)}`,
        };
      },
    );

    alertItems.sort((a, b) => {
      if (a.alertStatus !== b.alertStatus) {
        return a.alertStatus === 'out_of_stock' ? -1 : 1;
      }
      const ratioA =
        a.minStockLevel && a.minStockLevel > 0
          ? a.quantityOnHand / a.minStockLevel
          : 0;
      const ratioB =
        b.minStockLevel && b.minStockLevel > 0
          ? b.quantityOnHand / b.minStockLevel
          : 0;
      if (ratioA !== ratioB) return ratioA - ratioB;
      return a.name.localeCompare(b.name);
    });

    return {
      totalActiveMaterials,
      configuredThresholdCount,
      outOfStockCount,
      lowStockCount,
      items: alertItems.slice(0, 15),
    };
  }
}
