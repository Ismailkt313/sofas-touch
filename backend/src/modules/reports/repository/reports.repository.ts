import mongoose, { Model } from 'mongoose';
import {
  ExpenseVoucherModel,
  IExpenseVoucher,
  sharedExpenseVoucherMemoryStore,
} from '../../expenses';
import {
  IProject,
  ProjectModel,
  ProjectStatus,
  roundFinancialAmount,
  sharedProjectMemoryStore,
} from '../../projects';
import {
  IPurchaseVoucher,
  PurchaseVoucherModel,
  sharedPurchaseVoucherMemoryStore,
} from '../../purchases';
import { ProjectVoucherTotalsBucket } from '../types';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function emptyTotalsBucket(): ProjectVoucherTotalsBucket {
  return {
    lifetimePurchases: 0,
    lifetimePurchaseCount: 0,
    lifetimeExpenses: 0,
    lifetimeExpenseCount: 0,
    periodPurchases: 0,
    periodPurchaseCount: 0,
    periodExpenses: 0,
    periodExpenseCount: 0,
  };
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

export class ReportsRepository {
  constructor(
    private readonly projectModel: Model<IProject> = ProjectModel,
    private readonly purchaseModel: Model<IPurchaseVoucher> = PurchaseVoucherModel,
    private readonly expenseModel: Model<IExpenseVoucher> = ExpenseVoucherModel,
    private readonly projectMemory: Map<string, IProject> = sharedProjectMemoryStore,
    private readonly purchaseMemory: Map<
      string,
      IPurchaseVoucher
    > = sharedPurchaseVoucherMemoryStore,
    private readonly expenseMemory: Map<
      string,
      IExpenseVoucher
    > = sharedExpenseVoucherMemoryStore,
  ) {}

  private isDbConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async findCandidateProjects(filters: {
    search?: string;
    status: ProjectStatus | 'all';
  }): Promise<IProject[]> {
    if (this.isDbConnected()) {
      const query: Record<string, unknown> = {};
      if (filters.status !== 'all') {
        query.status = filters.status;
      }
      if (filters.search) {
        const pattern = new RegExp(escapeRegex(filters.search), 'i');
        query.$or = [
          { projectId: pattern },
          { name: pattern },
          { clientName: pattern },
        ];
      }

      const docs = await this.projectModel.find(query).lean().exec();
      return (docs as unknown as IProject[]).map((doc) => ({
        ...doc,
        _id: String(doc._id),
      }));
    }

    let items = Array.from(this.projectMemory.values());

    if (filters.status !== 'all') {
      items = items.filter((proj) => proj.status === filters.status);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (proj) =>
          (proj.projectId || '').toLowerCase().includes(q) ||
          (proj.name || '').toLowerCase().includes(q) ||
          (proj.clientName || '').toLowerCase().includes(q),
      );
    }

    return items.map((proj) => ({
      ...proj,
      _id: String(proj._id),
    }));
  }

  async findProjectByIdOrCode(identifier: string): Promise<IProject | null> {
    const clean = String(identifier || '').trim();
    if (!clean) {
      return null;
    }

    if (this.isDbConnected()) {
      let doc = null;
      if (mongoose.isValidObjectId(clean)) {
        doc = await this.projectModel.findById(clean).lean().exec();
      }
      if (!doc) {
        doc = await this.projectModel
          .findOne({ projectId: clean.toUpperCase() })
          .lean()
          .exec();
      }
      if (!doc) {
        return null;
      }
      const typed = doc as unknown as IProject;
      return { ...typed, _id: String(typed._id) };
    }

    const direct = this.projectMemory.get(clean);
    if (direct) {
      return { ...direct, _id: String(direct._id) };
    }

    const upper = clean.toUpperCase();
    for (const proj of this.projectMemory.values()) {
      if (
        String(proj._id) === clean ||
        (proj.projectId || '').toUpperCase() === upper
      ) {
        return { ...proj, _id: String(proj._id) };
      }
    }
    return null;
  }

  async aggregateTotalsForProjects(
    projects: IProject[],
    dateRange: { fromDate?: Date; toDate?: Date },
  ): Promise<Map<string, ProjectVoucherTotalsBucket>> {
    const bucketMap = new Map<string, ProjectVoucherTotalsBucket>();
    const codeToRecordId = new Map<string, string>();
    const recordIdSet = new Set<string>();

    for (const proj of projects) {
      const recId = String(proj._id || '');
      if (!recId) continue;
      recordIdSet.add(recId);
      bucketMap.set(recId, emptyTotalsBucket());
      if (proj.projectId) {
        codeToRecordId.set(proj.projectId.toUpperCase(), recId);
      }
    }

    if (recordIdSet.size === 0) {
      return bucketMap;
    }

    const resolveCanonicalProjectId = (
      projectRecordId: string | null | undefined,
      projectCode: string | null | undefined,
    ): string | null => {
      if (projectRecordId && recordIdSet.has(projectRecordId)) {
        return projectRecordId;
      }
      if (projectCode) {
        const mapped = codeToRecordId.get(projectCode.toUpperCase());
        if (mapped) {
          return mapped;
        }
      }
      return null;
    };

    if (this.isDbConnected()) {
      const recordIds = Array.from(recordIdSet);
      const projectCodes = Array.from(codeToRecordId.keys());

      const buildPeriodCondition = (dateField: string): Record<string, unknown> => {
        const conds: Array<Record<string, unknown>> = [];
        if (dateRange.fromDate) {
          conds.push({ $gte: [`$${dateField}`, dateRange.fromDate] });
        }
        if (dateRange.toDate) {
          conds.push({ $lte: [`$${dateField}`, dateRange.toDate] });
        }
        if (conds.length === 0) {
          return { $literal: true };
        }
        return conds.length === 1 ? conds[0] : { $and: conds };
      };

      const matchOr: Array<Record<string, unknown>> = [
        { projectRecordId: { $in: recordIds } },
      ];
      if (projectCodes.length > 0) {
        matchOr.push({ projectCode: { $in: projectCodes } });
      }

      const [purchaseGroups, expenseGroups] = await Promise.all([
        this.purchaseModel
          .aggregate<{
            _id: { projectRecordId: string | null; projectCode: string | null };
            lifetimeTotal: number;
            lifetimeCount: number;
            periodTotal: number;
            periodCount: number;
          }>([
            {
              $match: {
                status: 'active',
                $or: matchOr,
              },
            },
            {
              $group: {
                _id: {
                  projectRecordId: '$projectRecordId',
                  projectCode: { $toUpper: { $ifNull: ['$projectCode', ''] } },
                },
                lifetimeTotal: { $sum: '$finalTotal' },
                lifetimeCount: { $sum: 1 },
                periodTotal: {
                  $sum: {
                    $cond: [
                      buildPeriodCondition('purchaseDate'),
                      '$finalTotal',
                      0,
                    ],
                  },
                },
                periodCount: {
                  $sum: {
                    $cond: [buildPeriodCondition('purchaseDate'), 1, 0],
                  },
                },
              },
            },
          ])
          .exec(),
        this.expenseModel
          .aggregate<{
            _id: { projectRecordId: string | null; projectCode: string | null };
            lifetimeTotal: number;
            lifetimeCount: number;
            periodTotal: number;
            periodCount: number;
          }>([
            {
              $match: {
                status: 'active',
                $or: matchOr,
              },
            },
            {
              $group: {
                _id: {
                  projectRecordId: '$projectRecordId',
                  projectCode: { $toUpper: { $ifNull: ['$projectCode', ''] } },
                },
                lifetimeTotal: { $sum: '$amount' },
                lifetimeCount: { $sum: 1 },
                periodTotal: {
                  $sum: {
                    $cond: [buildPeriodCondition('expenseDate'), '$amount', 0],
                  },
                },
                periodCount: {
                  $sum: {
                    $cond: [buildPeriodCondition('expenseDate'), 1, 0],
                  },
                },
              },
            },
          ])
          .exec(),
      ]);

      for (const row of purchaseGroups) {
        const canonicalId = resolveCanonicalProjectId(
          row._id?.projectRecordId,
          row._id?.projectCode,
        );
        if (!canonicalId) continue;
        const bucket = bucketMap.get(canonicalId)!;
        bucket.lifetimePurchases = roundFinancialAmount(
          bucket.lifetimePurchases + Number(row.lifetimeTotal || 0),
        );
        bucket.lifetimePurchaseCount += Number(row.lifetimeCount || 0);
        bucket.periodPurchases = roundFinancialAmount(
          bucket.periodPurchases + Number(row.periodTotal || 0),
        );
        bucket.periodPurchaseCount += Number(row.periodCount || 0);
      }

      for (const row of expenseGroups) {
        const canonicalId = resolveCanonicalProjectId(
          row._id?.projectRecordId,
          row._id?.projectCode,
        );
        if (!canonicalId) continue;
        const bucket = bucketMap.get(canonicalId)!;
        bucket.lifetimeExpenses = roundFinancialAmount(
          bucket.lifetimeExpenses + Number(row.lifetimeTotal || 0),
        );
        bucket.lifetimeExpenseCount += Number(row.lifetimeCount || 0);
        bucket.periodExpenses = roundFinancialAmount(
          bucket.periodExpenses + Number(row.periodTotal || 0),
        );
        bucket.periodExpenseCount += Number(row.periodCount || 0);
      }

      return bucketMap;
    }

    const seenPurchaseIds = new Set<string>();
    for (const [mapKey, pv] of this.purchaseMemory.entries()) {
      const uniqueId = String(pv._id || mapKey);
      if (seenPurchaseIds.has(uniqueId) || pv.status !== 'active') {
        continue;
      }
      const canonicalId = resolveCanonicalProjectId(
        pv.projectRecordId,
        pv.projectCode,
      );
      if (!canonicalId) {
        continue;
      }
      seenPurchaseIds.add(uniqueId);

      const bucket = bucketMap.get(canonicalId)!;
      const amt = roundFinancialAmount(Number(pv.finalTotal || 0));
      bucket.lifetimePurchases = roundFinancialAmount(
        bucket.lifetimePurchases + amt,
      );
      bucket.lifetimePurchaseCount += 1;

      if (
        isWithinDateRange(
          pv.purchaseDate,
          dateRange.fromDate,
          dateRange.toDate,
        )
      ) {
        bucket.periodPurchases = roundFinancialAmount(
          bucket.periodPurchases + amt,
        );
        bucket.periodPurchaseCount += 1;
      }
    }

    const seenExpenseIds = new Set<string>();
    for (const [mapKey, ev] of this.expenseMemory.entries()) {
      const uniqueId = String(ev._id || mapKey);
      if (seenExpenseIds.has(uniqueId) || ev.status !== 'active') {
        continue;
      }
      const canonicalId = resolveCanonicalProjectId(
        ev.projectRecordId,
        ev.projectCode,
      );
      if (!canonicalId) {
        continue;
      }
      seenExpenseIds.add(uniqueId);

      const bucket = bucketMap.get(canonicalId)!;
      const amt = roundFinancialAmount(Number(ev.amount || 0));
      bucket.lifetimeExpenses = roundFinancialAmount(
        bucket.lifetimeExpenses + amt,
      );
      bucket.lifetimeExpenseCount += 1;

      if (
        isWithinDateRange(ev.expenseDate, dateRange.fromDate, dateRange.toDate)
      ) {
        bucket.periodExpenses = roundFinancialAmount(
          bucket.periodExpenses + amt,
        );
        bucket.periodExpenseCount += 1;
      }
    }

    return bucketMap;
  }

  async findAllProjectTransactions(
    projectRecordId: string,
    projectCode: string,
  ): Promise<{
    activePurchases: IPurchaseVoucher[];
    activeExpenses: IExpenseVoucher[];
    cancelledPurchaseCount: number;
    cancelledExpenseCount: number;
  }> {
    const cleanRecordId = String(projectRecordId || '').trim();
    const cleanCode = String(projectCode || '').trim();
    const upperCode = cleanCode.toUpperCase();

    if (this.isDbConnected()) {
      const orClauses: Array<Record<string, unknown>> = [];
      if (cleanRecordId) {
        orClauses.push({ projectRecordId: cleanRecordId });
      }
      if (cleanCode) {
        orClauses.push({
          projectCode: new RegExp(`^${escapeRegex(cleanCode)}$`, 'i'),
        });
      }

      if (orClauses.length === 0) {
        return {
          activePurchases: [],
          activeExpenses: [],
          cancelledPurchaseCount: 0,
          cancelledExpenseCount: 0,
        };
      }

      const [
        activePurchases,
        activeExpenses,
        cancelledPurchaseCount,
        cancelledExpenseCount,
      ] = await Promise.all([
        this.purchaseModel
          .find({ status: 'active', $or: orClauses })
          .sort({ purchaseDate: -1, createdAt: -1, _id: -1 })
          .lean()
          .exec(),
        this.expenseModel
          .find({ status: 'active', $or: orClauses })
          .sort({ expenseDate: -1, createdAt: -1, _id: -1 })
          .lean()
          .exec(),
        this.purchaseModel
          .countDocuments({ status: 'cancelled', $or: orClauses })
          .exec(),
        this.expenseModel
          .countDocuments({ status: 'cancelled', $or: orClauses })
          .exec(),
      ]);

      return {
        activePurchases: (
          activePurchases as unknown as IPurchaseVoucher[]
        ).map((doc) => ({ ...doc, _id: String(doc._id) })),
        activeExpenses: (activeExpenses as unknown as IExpenseVoucher[]).map(
          (doc) => ({ ...doc, _id: String(doc._id) }),
        ),
        cancelledPurchaseCount,
        cancelledExpenseCount,
      };
    }

    const seenPurchaseIds = new Set<string>();
    const activePurchases: IPurchaseVoucher[] = [];
    let cancelledPurchaseCount = 0;

    for (const [key, pv] of this.purchaseMemory.entries()) {
      const uid = String(pv._id || key);
      if (seenPurchaseIds.has(uid)) continue;
      const matches =
        (cleanRecordId && pv.projectRecordId === cleanRecordId) ||
        (upperCode && (pv.projectCode || '').toUpperCase() === upperCode);
      if (!matches) continue;
      seenPurchaseIds.add(uid);

      if (pv.status === 'active') {
        activePurchases.push({ ...pv, _id: uid });
      } else if (pv.status === 'cancelled') {
        cancelledPurchaseCount += 1;
      }
    }

    activePurchases.sort((a, b) => {
      const diff =
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();
      if (diff !== 0) return diff;
      return String(b._id).localeCompare(String(a._id));
    });

    const seenExpenseIds = new Set<string>();
    const activeExpenses: IExpenseVoucher[] = [];
    let cancelledExpenseCount = 0;

    for (const [key, ev] of this.expenseMemory.entries()) {
      const uid = String(ev._id || key);
      if (seenExpenseIds.has(uid)) continue;
      const matches =
        (cleanRecordId && ev.projectRecordId === cleanRecordId) ||
        (upperCode && (ev.projectCode || '').toUpperCase() === upperCode);
      if (!matches) continue;
      seenExpenseIds.add(uid);

      if (ev.status === 'active') {
        activeExpenses.push({ ...ev, _id: uid });
      } else if (ev.status === 'cancelled') {
        cancelledExpenseCount += 1;
      }
    }

    activeExpenses.sort((a, b) => {
      const diff =
        new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime();
      if (diff !== 0) return diff;
      return String(b._id).localeCompare(String(a._id));
    });

    return {
      activePurchases,
      activeExpenses,
      cancelledPurchaseCount,
      cancelledExpenseCount,
    };
  }
}
