import assert from 'assert';
import mongoose from 'mongoose';
import app from '../../../index';
import { connectDB } from '../../../config/db';
import { generateToken } from '../../../middleware/auth';
import {
  calculateProjectFinancialMetrics,
  IVoucherTotalsProvider,
  NoopVoucherTotalsProvider,
  PROJECT_SEQUENCE_COUNTER_ID,
  projectRepository,
  ProjectRepository,
  projectService,
  ProjectService,
  ProjectVoucherAggregationTotals,
  sharedProjectActivityWarningMemoryStore,
  sharedProjectCostAlertMemoryStore,
  sharedProjectCounterMemoryStore,
  sharedProjectMemoryStore,
  validateCreateProjectDto,
  validateListProjectsDto,
  validateUpdateProjectDto,
} from '../index';

interface TestVoucherRecord {
  id: string;
  projectCode: string;
  type: 'purchase' | 'expense';
  amount: number;
  updatedAt: Date;
}

class InMemoryTestVoucherProvider implements IVoucherTotalsProvider {
  private vouchers: Map<string, TestVoucherRecord> = new Map();

  upsert(record: TestVoucherRecord): void {
    this.vouchers.set(record.id, { ...record });
  }

  remove(id: string): void {
    this.vouchers.delete(id);
  }

  clear(): void {
    this.vouchers.clear();
  }

  isPurchaseIntegrationActive(): boolean {
    return true;
  }

  isExpenseIntegrationActive(): boolean {
    return true;
  }

  async aggregateProjectVouchers(
    _projectRecordId: string,
    projectCode: string,
  ): Promise<ProjectVoucherAggregationTotals> {
    let totalPurchases = 0;
    let totalOtherExpenses = 0;
    let latestVoucherActivityAt: Date | null = null;

    for (const v of this.vouchers.values()) {
      if (v.projectCode.toUpperCase() !== projectCode.toUpperCase()) {
        continue;
      }
      if (v.type === 'purchase') {
        totalPurchases += v.amount;
      } else {
        totalOtherExpenses += v.amount;
      }
      if (
        !latestVoucherActivityAt ||
        v.updatedAt.getTime() > latestVoucherActivityAt.getTime()
      ) {
        latestVoucherActivityAt = new Date(v.updatedAt);
      }
    }

    return {
      totalPurchases: Math.round((totalPurchases + Number.EPSILON) * 100) / 100,
      totalOtherExpenses:
        Math.round((totalOtherExpenses + Number.EPSILON) * 100) / 100,
      latestVoucherActivityAt,
    };
  }
}

function resetInMemoryProjectState(): void {
  sharedProjectMemoryStore.clear();
  sharedProjectCounterMemoryStore.clear();
  sharedProjectCostAlertMemoryStore.clear();
  sharedProjectActivityWarningMemoryStore.clear();
}

async function runTests(): Promise<void> {
  await connectDB();
  resetInMemoryProjectState();
  console.log('--- Starting Project Management Automations Test Suite ---');

  console.log('Testing Project DTO validations & manual ID rejection...');
  {
    const manualIdAttempt = validateCreateProjectDto({
      projectId: 'PRJ-9999',
      name: 'Custom Sofa Suite',
      clientName: 'Kensington Client',
      contractValue: 15000,
    });
    assert.strictEqual(manualIdAttempt.isValid, false);
    assert.ok(manualIdAttempt.errors?.projectId);

    const manualCodeUpdateAttempt = validateUpdateProjectDto({
      projectId: 'PRJ-0001',
      name: 'Renamed Project',
    });
    assert.strictEqual(manualCodeUpdateAttempt.isValid, false);
    assert.ok(manualCodeUpdateAttempt.errors?.projectId);

    const negativeContractAttempt = validateCreateProjectDto({
      name: 'Invalid Contract Project',
      clientName: 'Client A',
      contractValue: -100,
    });
    assert.strictEqual(negativeContractAttempt.isValid, false);
    assert.ok(negativeContractAttempt.errors?.contractValue);

    const zeroContractValid = validateCreateProjectDto({
      name: 'Complimentary Showroom Mockup',
      clientName: 'Internal Showroom',
      contractValue: 0,
      totalCost: 99999,
      estimatedProfit: 88888,
    });
    assert.strictEqual(zeroContractValid.isValid, true);
    assert.strictEqual(zeroContractValid.value?.contractValue, 0);
    assert.strictEqual(
      (zeroContractValid.value as unknown as Record<string, unknown>).totalCost,
      undefined,
    );

    const validList = validateListProjectsDto({
      page: '1',
      limit: '15',
      status: 'In Progress',
      category: 'Curtains',
    });
    assert.strictEqual(validList.isValid, true);
    assert.strictEqual(validList.value?.status, 'In Progress');
    assert.strictEqual(validList.value?.category, 'Curtains');
  }
  console.log('✓ Project DTO validations passed.');

  console.log('Testing sequential, concurrent & error-resilient Project ID generation...');
  {
    resetInMemoryProjectState();
    const repo = new ProjectRepository();
    const svc = new ProjectService(repo);

    const p1 = await svc.createProject(
      {
        name: 'First Sequential Project',
        clientName: 'Client One',
        category: 'Modular Sofa',
        status: 'In Progress',
        description: '',
        contractValue: 10000,
        costAlertThresholdPercent: 80,
      },
      'admin@softtouchsofas.com',
    );
    const p2 = await svc.createProject(
      {
        name: 'Second Sequential Project',
        clientName: 'Client Two',
        category: 'Curtains',
        status: 'In Progress',
        description: '',
        contractValue: 20000,
        costAlertThresholdPercent: 80,
      },
      'admin@softtouchsofas.com',
    );
    const p3 = await svc.createProject(
      {
        name: 'Third Sequential Project',
        clientName: 'Client Three',
        category: 'Armchair',
        status: 'Under Review',
        description: '',
        contractValue: 5000,
        costAlertThresholdPercent: 80,
      },
      'dataentry@softtouchsofas.com',
    );

    assert.strictEqual(p1.projectId, 'PRJ-0001');
    assert.strictEqual(p2.projectId, 'PRJ-0002');
    assert.strictEqual(p3.projectId, 'PRJ-0003');

    const concurrentCount = 25;
    const concurrentCreated = await Promise.all(
      Array.from({ length: concurrentCount }, (_, index) =>
        svc.createProject(
          {
            name: `Concurrent Project ${index + 1}`,
            clientName: `Concurrent Client ${index + 1}`,
            category: 'Bespoke Interior',
            status: 'In Progress',
            description: '',
            contractValue: 12000 + index * 100,
            costAlertThresholdPercent: 80,
          },
          'admin@softtouchsofas.com',
        ),
      ),
    );

    const generatedCodes = concurrentCreated.map((p) => p.projectId);
    const uniqueCodes = new Set(generatedCodes);
    assert.strictEqual(uniqueCodes.size, concurrentCount);

    const sortedCodes = [...generatedCodes].sort();
    assert.strictEqual(sortedCodes[0], 'PRJ-0004');
    assert.strictEqual(sortedCodes[sortedCodes.length - 1], 'PRJ-0028');

    let failCallIndex = 0;
    repo.setBeforePersistHook((payload) => {
      failCallIndex += 1;
      if (failCallIndex === 2 || failCallIndex === 5) {
        throw new Error(`Simulated DB write error while persisting ${payload.projectId}`);
      }
    });

    const settledWithFailures = await Promise.allSettled(
      Array.from({ length: 6 }, (_, idx) =>
        svc.createProject(
          {
            name: `Resilience Batch ${idx + 1}`,
            clientName: 'Resilience Client',
            category: 'Modular Sofa',
            status: 'In Progress',
            description: '',
            contractValue: 8000,
            costAlertThresholdPercent: 80,
          },
          'admin@softtouchsofas.com',
        ),
      ),
    );

    repo.setBeforePersistHook(null);

    const fulfilled = settledWithFailures.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof svc.createProject>>> =>
        r.status === 'fulfilled',
    );
    const rejected = settledWithFailures.filter((r) => r.status === 'rejected');
    assert.strictEqual(fulfilled.length, 4);
    assert.strictEqual(rejected.length, 2);

    const allStored = await svc.listProjects({ page: 1, limit: 100 });
    const allStoredCodes = allStored.items.map((item) => item.projectId);
    assert.strictEqual(new Set(allStoredCodes).size, allStoredCodes.length);
    assert.strictEqual(
      sharedProjectCounterMemoryStore.get(PROJECT_SEQUENCE_COUNTER_ID),
      34,
    );
  }
  console.log('✓ Sequential, concurrent & DB-error-safe ID generation passed.');

  console.log('Testing financial formulas, floating-point safety & zero contract value...');
  {
    const standardMetrics = calculateProjectFinancialMetrics({
      contractValue: 50000,
      totalPurchases: 22500.55,
      totalOtherExpenses: 7499.45,
    });
    assert.strictEqual(standardMetrics.totalPurchases, 22500.55);
    assert.strictEqual(standardMetrics.totalOtherExpenses, 7499.45);
    assert.strictEqual(standardMetrics.totalCost, 30000);
    assert.strictEqual(standardMetrics.estimatedProfit, 20000);
    assert.strictEqual(standardMetrics.costPercentage, 60);
    assert.strictEqual(standardMetrics.estimatedProfitMargin, 40);
    assert.strictEqual(standardMetrics.profitType, 'estimated');
    assert.strictEqual(standardMetrics.isAudited, false);

    const floatEdge = calculateProjectFinancialMetrics({
      contractValue: 100,
      totalPurchases: 19.99,
      totalOtherExpenses: 30.02,
    });
    assert.strictEqual(floatEdge.totalCost, 50.01);
    assert.strictEqual(floatEdge.estimatedProfit, 49.99);
    assert.strictEqual(floatEdge.costPercentage, 50.01);
    assert.strictEqual(floatEdge.estimatedProfitMargin, 49.99);

    const zeroContractEmpty = calculateProjectFinancialMetrics({
      contractValue: 0,
      totalPurchases: 0,
      totalOtherExpenses: 0,
    });
    assert.strictEqual(zeroContractEmpty.totalCost, 0);
    assert.strictEqual(zeroContractEmpty.estimatedProfit, 0);
    assert.strictEqual(zeroContractEmpty.costPercentage, 0);
    assert.strictEqual(zeroContractEmpty.estimatedProfitMargin, 0);
    assert.strictEqual(Number.isFinite(zeroContractEmpty.costPercentage), true);
    assert.strictEqual(
      Number.isFinite(zeroContractEmpty.estimatedProfitMargin),
      true,
    );

    const zeroContractWithCost = calculateProjectFinancialMetrics({
      contractValue: 0,
      totalPurchases: 400,
      totalOtherExpenses: 150,
    });
    assert.strictEqual(zeroContractWithCost.totalCost, 550);
    assert.strictEqual(zeroContractWithCost.estimatedProfit, -550);
    assert.strictEqual(zeroContractWithCost.costPercentage, 0);
    assert.strictEqual(zeroContractWithCost.estimatedProfitMargin, 0);
  }
  console.log('✓ Financial formulas & zero contract value calculations passed.');

  console.log('Testing voucher mutations, threshold crossings, re-crossings & duplicate alert prevention...');
  {
    resetInMemoryProjectState();
    const repo = new ProjectRepository();
    const voucherLedger = new InMemoryTestVoucherProvider();
    const svc = new ProjectService(repo, voucherLedger);

    const project = await svc.createProject(
      {
        name: 'Chelsea Townhouse Bespoke Sofa',
        clientName: 'Victoria Sterling',
        category: 'Modular Sofa',
        status: 'In Progress',
        description: 'Full velvet modular sofa installation',
        contractValue: 10000,
        costAlertThresholdPercent: 80,
      },
      'admin@softtouchsofas.com',
    );

    assert.strictEqual(project.projectId, 'PRJ-0001');

    voucherLedger.upsert({
      id: 'pv_1',
      projectCode: project.projectId,
      type: 'purchase',
      amount: 5000,
      updatedAt: new Date('2026-10-01T10:00:00Z'),
    });

    const sync1 = await svc.syncAfterVoucherMutation({
      projectId: project.projectId,
      voucherType: 'purchase',
      action: 'created',
      occurredAt: new Date('2026-10-01T10:00:00Z'),
    });

    assert.strictEqual(sync1.summary.totalPurchases, 5000);
    assert.strictEqual(sync1.summary.totalCost, 5000);
    assert.strictEqual(sync1.summary.estimatedProfit, 5000);
    assert.strictEqual(sync1.summary.costPercentage, 50);
    assert.strictEqual(sync1.triggeredAlerts.length, 0);

    voucherLedger.upsert({
      id: 'ev_1',
      projectCode: project.projectId,
      type: 'expense',
      amount: 3200,
      updatedAt: new Date('2026-10-02T10:00:00Z'),
    });

    const concurrentCrossingResults = await Promise.all([
      svc.syncAfterVoucherMutation({
        projectId: project.projectId,
        voucherType: 'expense',
        action: 'created',
        occurredAt: new Date('2026-10-02T10:00:00Z'),
      }),
      svc.syncAfterVoucherMutation({
        projectId: project.projectId,
        voucherType: 'expense',
        action: 'updated',
        occurredAt: new Date('2026-10-02T10:01:00Z'),
      }),
    ]);

    const totalWarningTriggered = concurrentCrossingResults.reduce(
      (sum, r) => sum + r.triggeredAlerts.length,
      0,
    );
    assert.strictEqual(totalWarningTriggered, 1);

    let projectAlerts = await svc.getProjectCostAlerts(project.projectId);
    assert.strictEqual(projectAlerts.alerts.length, 1);
    assert.strictEqual(projectAlerts.alerts[0].thresholdType, 'warning');
    assert.strictEqual(projectAlerts.alerts[0].thresholdPercent, 80);
    assert.strictEqual(projectAlerts.alerts[0].status, 'active');

    voucherLedger.upsert({
      id: 'ev_2',
      projectCode: project.projectId,
      type: 'expense',
      amount: 500,
      updatedAt: new Date('2026-10-03T10:00:00Z'),
    });

    const syncAbove80 = await svc.syncAfterVoucherMutation({
      projectId: project.projectId,
      voucherType: 'expense',
      action: 'created',
      occurredAt: new Date('2026-10-03T10:00:00Z'),
    });
    assert.strictEqual(syncAbove80.summary.costPercentage, 87);
    assert.strictEqual(syncAbove80.triggeredAlerts.length, 0);

    voucherLedger.upsert({
      id: 'pv_2',
      projectCode: project.projectId,
      type: 'purchase',
      amount: 1800,
      updatedAt: new Date('2026-10-04T10:00:00Z'),
    });

    const syncAbove100 = await svc.syncAfterVoucherMutation({
      projectId: project.projectId,
      voucherType: 'purchase',
      action: 'created',
      occurredAt: new Date('2026-10-04T10:00:00Z'),
    });
    assert.strictEqual(syncAbove100.summary.totalCost, 10500);
    assert.strictEqual(syncAbove100.summary.estimatedProfit, -500);
    assert.strictEqual(syncAbove100.summary.costPercentage, 105);
    assert.strictEqual(syncAbove100.summary.estimatedProfitMargin, -5);
    assert.strictEqual(syncAbove100.triggeredAlerts.length, 1);
    assert.strictEqual(syncAbove100.triggeredAlerts[0].thresholdType, 'critical');
    assert.strictEqual(syncAbove100.triggeredAlerts[0].thresholdPercent, 100);

    voucherLedger.upsert({
      id: 'ev_2',
      projectCode: project.projectId,
      type: 'expense',
      amount: 700,
      updatedAt: new Date('2026-10-05T10:00:00Z'),
    });
    const syncStillAbove100 = await svc.syncAfterVoucherMutation({
      projectId: project.projectId,
      voucherType: 'expense',
      action: 'updated',
      occurredAt: new Date('2026-10-05T10:00:00Z'),
    });
    assert.strictEqual(syncStillAbove100.triggeredAlerts.length, 0);

    voucherLedger.remove('pv_2');
    const syncAfterDeleteBelow100 = await svc.syncAfterVoucherMutation({
      projectId: project.projectId,
      voucherType: 'purchase',
      action: 'deleted',
      occurredAt: new Date('2026-10-06T10:00:00Z'),
    });
    assert.strictEqual(syncAfterDeleteBelow100.summary.totalCost, 8900);
    assert.strictEqual(syncAfterDeleteBelow100.summary.costPercentage, 89);
    assert.strictEqual(
      syncAfterDeleteBelow100.summary.costThresholdState.warningCrossed,
      true,
    );
    assert.strictEqual(
      syncAfterDeleteBelow100.summary.costThresholdState.exceededCrossed,
      false,
    );

    projectAlerts = await svc.getProjectCostAlerts(project.projectId);
    const activeAfterPartialDrop = projectAlerts.alerts.filter(
      (a) => a.status === 'active',
    );
    const resolvedAfterPartialDrop = projectAlerts.alerts.filter(
      (a) => a.status === 'resolved',
    );
    assert.strictEqual(activeAfterPartialDrop.length, 1);
    assert.strictEqual(activeAfterPartialDrop[0].thresholdType, 'warning');
    assert.strictEqual(resolvedAfterPartialDrop.length, 1);
    assert.strictEqual(resolvedAfterPartialDrop[0].thresholdType, 'critical');

    voucherLedger.remove('ev_1');
    voucherLedger.remove('ev_2');
    const syncDropTo50 = await svc.syncAfterVoucherMutation({
      projectId: project.projectId,
      voucherType: 'expense',
      action: 'deleted',
      occurredAt: new Date('2026-10-07T10:00:00Z'),
    });
    assert.strictEqual(syncDropTo50.summary.totalCost, 5000);
    assert.strictEqual(syncDropTo50.summary.costPercentage, 50);
    assert.strictEqual(
      syncDropTo50.summary.costThresholdState.warningCrossed,
      false,
    );

    voucherLedger.upsert({
      id: 'pv_3',
      projectCode: project.projectId,
      type: 'purchase',
      amount: 3400,
      updatedAt: new Date('2026-10-08T10:00:00Z'),
    });
    const syncRecross80 = await svc.syncAfterVoucherMutation({
      projectId: project.projectId,
      voucherType: 'purchase',
      action: 'created',
      occurredAt: new Date('2026-10-08T10:00:00Z'),
    });
    assert.strictEqual(syncRecross80.summary.totalCost, 8400);
    assert.strictEqual(syncRecross80.summary.costPercentage, 84);
    assert.strictEqual(syncRecross80.triggeredAlerts.length, 1);
    assert.strictEqual(syncRecross80.triggeredAlerts[0].thresholdType, 'warning');

    const zeroContractProject = await svc.createProject(
      {
        name: 'Zero Value Sample Project',
        clientName: 'Showroom Floor',
        category: 'Armchair',
        status: 'In Progress',
        description: '',
        contractValue: 0,
        costAlertThresholdPercent: 80,
      },
      'admin@softtouchsofas.com',
    );
    const zeroAlertsInitial = await svc.getProjectCostAlerts(
      zeroContractProject.projectId,
    );
    assert.strictEqual(zeroAlertsInitial.alerts.length, 0);

    voucherLedger.upsert({
      id: 'zv_1',
      projectCode: zeroContractProject.projectId,
      type: 'expense',
      amount: 250,
      updatedAt: new Date('2026-10-08T12:00:00Z'),
    });
    const zeroSync = await svc.syncAfterVoucherMutation({
      projectId: zeroContractProject.projectId,
      voucherType: 'expense',
      action: 'created',
    });
    assert.strictEqual(zeroSync.summary.costPercentage, 0);
    assert.strictEqual(zeroSync.summary.estimatedProfitMargin, 0);
    assert.strictEqual(zeroSync.summary.estimatedProfit, -250);
    assert.strictEqual(zeroSync.triggeredAlerts.length, 1);
    assert.strictEqual(zeroSync.triggeredAlerts[0].thresholdType, 'critical');

    const customThresholdProject = await svc.createProject(
      {
        name: 'Custom 70% Threshold Project',
        clientName: 'Belgravia Studio',
        category: 'Curtains',
        status: 'In Progress',
        description: '',
        contractValue: 10000,
        costAlertThresholdPercent: 70,
      },
      'admin@softtouchsofas.com',
    );
    voucherLedger.upsert({
      id: 'ct_1',
      projectCode: customThresholdProject.projectId,
      type: 'purchase',
      amount: 11200,
      updatedAt: new Date('2026-10-09T10:00:00Z'),
    });
    const jumpSync = await svc.syncAfterVoucherMutation({
      projectId: customThresholdProject.projectId,
      voucherType: 'purchase',
      action: 'created',
    });
    assert.strictEqual(jumpSync.triggeredAlerts.length, 2);
    assert.strictEqual(jumpSync.triggeredAlerts[0].thresholdPercent, 70);
    assert.strictEqual(jumpSync.triggeredAlerts[1].thresholdPercent, 100);
  }
  console.log('✓ Voucher sync, threshold crossings, re-crossings & duplicate prevention passed.');

  console.log('Testing Project Activity Warnings, Completed exclusion & duplicate window prevention...');
  {
    resetInMemoryProjectState();
    const repo = new ProjectRepository();
    const voucherLedger = new InMemoryTestVoucherProvider();
    const svc = new ProjectService(repo, voucherLedger);

    const activePrj = await svc.createProject(
      {
        name: 'Stale Active Project',
        clientName: 'Lord Byron',
        category: 'Curtains',
        status: 'In Progress',
        description: '',
        contractValue: 18000,
        costAlertThresholdPercent: 80,
      },
      'admin@softtouchsofas.com',
    );

    const completedPrj = await svc.createProject(
      {
        name: 'Finished Penthouse Project',
        clientName: 'Lady Ada',
        category: 'Modular Sofa',
        status: 'Completed',
        description: '',
        contractValue: 32000,
        costAlertThresholdPercent: 80,
      },
      'admin@softtouchsofas.com',
    );

    const twentyDaysLater = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const eval1 = await svc.evaluateProjectInactivity({
      inactivityDays: 14,
      referenceDate: twentyDaysLater,
    });

    assert.strictEqual(eval1.evaluatedCount, 1);
    assert.strictEqual(eval1.newlyTriggeredCount, 1);
    assert.strictEqual(eval1.activeWarningsCount, 1);
    assert.strictEqual(eval1.warnings[0].projectId, activePrj.projectId);

    const refreshedActive = await svc.getProjectByIdOrCode(activePrj.projectId);
    assert.strictEqual(refreshedActive.status, 'In Progress');

    const completedWarnings = await svc.listActivityWarnings(
      {
        page: 1,
        limit: 20,
        projectId: completedPrj.projectId,
        status: 'active',
        evaluate: false,
        inactivityDays: 14,
      },
      twentyDaysLater,
    );
    assert.strictEqual(completedWarnings.total, 0);

    const twentyTwoDaysLater = new Date(Date.now() + 22 * 24 * 60 * 60 * 1000);
    const evalDuplicateCheck = await svc.evaluateProjectInactivity({
      inactivityDays: 14,
      referenceDate: twentyTwoDaysLater,
    });
    assert.strictEqual(evalDuplicateCheck.newlyTriggeredCount, 0);
    assert.strictEqual(evalDuplicateCheck.activeWarningsCount, 1);

    const activityResumeDate = new Date(Date.now() + 23 * 24 * 60 * 60 * 1000);
    voucherLedger.upsert({
      id: 'act_v1',
      projectCode: activePrj.projectId,
      type: 'purchase',
      amount: 1200,
      updatedAt: activityResumeDate,
    });
    await svc.syncAfterVoucherMutation({
      projectId: activePrj.projectId,
      voucherType: 'purchase',
      action: 'created',
      occurredAt: activityResumeDate,
    });

    const activeWarningsAfterResume = await svc.listActivityWarnings({
      page: 1,
      limit: 20,
      status: 'active',
      evaluate: false,
      inactivityDays: 14,
    });
    assert.strictEqual(activeWarningsAfterResume.total, 0);

    const fortyDaysLater = new Date(
      activityResumeDate.getTime() + 16 * 24 * 60 * 60 * 1000,
    );
    const evalNewWindow = await svc.evaluateProjectInactivity({
      inactivityDays: 14,
      referenceDate: fortyDaysLater,
    });
    assert.strictEqual(evalNewWindow.newlyTriggeredCount, 1);
    assert.strictEqual(evalNewWindow.activeWarningsCount, 1);

    const beforeNoopProject = await svc.getProjectByIdOrCode(activePrj.projectId);
    await svc.updateProject(activePrj.projectId, {
      status: beforeNoopProject.status,
    });
    const afterNoopProject = await svc.getProjectByIdOrCode(activePrj.projectId);
    assert.strictEqual(
      new Date(afterNoopProject.lastActivityAt).getTime(),
      new Date(beforeNoopProject.lastActivityAt).getTime(),
    );
    const activeWarningsAfterNoop = await svc.listActivityWarnings({
      page: 1,
      limit: 20,
      status: 'active',
      evaluate: false,
      inactivityDays: 14,
    });
    assert.strictEqual(activeWarningsAfterNoop.total, 1);

    const evalIncreasedThreshold = await svc.evaluateProjectInactivity({
      inactivityDays: 30,
      referenceDate: fortyDaysLater,
    });
    assert.strictEqual(evalIncreasedThreshold.newlyTriggeredCount, 0);
    assert.strictEqual(evalIncreasedThreshold.activeWarningsCount, 0);

    const dupAlert1 = await repo.createCostAlert({
      projectRecordId: activePrj.id,
      projectId: activePrj.projectId,
      projectName: activePrj.name,
      thresholdType: 'warning',
      thresholdPercent: 80,
      contractValue: 18000,
      totalCost: 15000,
      costPercentage: 83.33,
      message: 'Initial active warning',
      status: 'active',
      triggeredAt: new Date(),
      resolvedAt: null,
      resolvedReason: null,
    });
    const dupAlert2 = await repo.createCostAlert({
      projectRecordId: activePrj.id,
      projectId: activePrj.projectId,
      projectName: activePrj.name,
      thresholdType: 'warning',
      thresholdPercent: 80,
      contractValue: 18000,
      totalCost: 15500,
      costPercentage: 86.11,
      message: 'Duplicate active warning attempt',
      status: 'active',
      triggeredAt: new Date(),
      resolvedAt: null,
      resolvedReason: null,
    });
    assert.strictEqual(String(dupAlert1._id), String(dupAlert2._id));
  }
  console.log('✓ Project Activity Warnings passed.');

  console.log('Testing HTTP /api/projects endpoints, auth & RBAC...');
  resetInMemoryProjectState();
  const voucherProviderForHttp = new InMemoryTestVoucherProvider();
  projectService.setVoucherTotalsProvider(voucherProviderForHttp);

  const adminToken = generateToken({
    id: 'usr_admin_001',
    email: 'admin@softtouchsofas.com',
    role: 'admin',
    name: 'Admin Manager',
    approvalStatus: 'approved',
  });

  const dataEntryToken = generateToken({
    id: 'usr_data_entry_002',
    email: 'dataentry@softtouchsofas.com',
    role: 'data_entry',
    name: 'Data Entry Specialist',
    approvalStatus: 'approved',
  });

  const pendingUserToken = generateToken({
    id: 'usr_pending_003',
    email: 'hamza.malik@example.com',
    role: 'data_entry',
    name: 'Hamza Malik',
    approvalStatus: 'pending',
  });

  const server = app.listen(0);
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/projects`;

  try {
    const unauthRes = await fetch(baseUrl);
    assert.strictEqual(unauthRes.status, 401);

    const pendingRes = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${pendingUserToken}` },
    });
    assert.strictEqual(pendingRes.status, 403);

    const manualIdHttpRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({
        projectId: 'PRJ-0777',
        name: 'Tampered ID Project',
        clientName: 'Client X',
        contractValue: 10000,
      }),
    });
    assert.strictEqual(manualIdHttpRes.status, 400);

    const createHttpRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({
        name: 'Mayfair Velvet Sectional',
        clientName: 'Harrington Estates',
        category: 'Modular Sofa',
        contractValue: 25000,
        totalCost: 999999,
        estimatedProfit: 999999,
      }),
    });
    assert.strictEqual(createHttpRes.status, 201);
    const createdBody = (await createHttpRes.json()) as {
      project: {
        id: string;
        projectId: string;
        contractValue: number;
        totalCost: number;
        estimatedProfit: number;
        costPercentage: number;
        estimatedProfitMargin: number;
      };
    };
    assert.strictEqual(createdBody.project.projectId, 'PRJ-0001');
    assert.strictEqual(createdBody.project.contractValue, 25000);
    assert.strictEqual(createdBody.project.totalCost, 0);
    assert.strictEqual(createdBody.project.estimatedProfit, 25000);

    voucherProviderForHttp.upsert({
      id: 'http_pv_1',
      projectCode: 'PRJ-0001',
      type: 'purchase',
      amount: 15000,
      updatedAt: new Date(),
    });
    voucherProviderForHttp.upsert({
      id: 'http_ev_1',
      projectCode: 'PRJ-0001',
      type: 'expense',
      amount: 6000,
      updatedAt: new Date(),
    });
    await projectService.syncAfterVoucherMutation({
      projectId: 'PRJ-0001',
      voucherType: 'expense',
      action: 'created',
    });

    const summaryRes = await fetch(`${baseUrl}/PRJ-0001/financial-summary`, {
      headers: { Authorization: `Bearer ${dataEntryToken}` },
    });
    assert.strictEqual(summaryRes.status, 200);
    const summaryData = (await summaryRes.json()) as {
      summary: {
        projectId: string;
        name: string;
        contractValue: number;
        totalPurchases: number;
        totalOtherExpenses: number;
        totalCost: number;
        estimatedProfit: number;
        costPercentage: number;
        estimatedProfitMargin: number;
        profitType: string;
        isAudited: boolean;
      };
    };
    assert.strictEqual(summaryData.summary.projectId, 'PRJ-0001');
    assert.strictEqual(summaryData.summary.totalPurchases, 15000);
    assert.strictEqual(summaryData.summary.totalOtherExpenses, 6000);
    assert.strictEqual(summaryData.summary.totalCost, 21000);
    assert.strictEqual(summaryData.summary.estimatedProfit, 4000);
    assert.strictEqual(summaryData.summary.costPercentage, 84);
    assert.strictEqual(summaryData.summary.estimatedProfitMargin, 16);
    assert.strictEqual(summaryData.summary.profitType, 'estimated');
    assert.strictEqual(summaryData.summary.isAudited, false);

    const dataEntryAlertsForbidden = await fetch(`${baseUrl}/alerts`, {
      headers: { Authorization: `Bearer ${dataEntryToken}` },
    });
    assert.strictEqual(dataEntryAlertsForbidden.status, 403);

    const adminAlertsRes = await fetch(`${baseUrl}/alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminAlertsRes.status, 200);
    const adminAlertsBody = (await adminAlertsRes.json()) as {
      total: number;
      alerts: Array<{ projectId: string; thresholdPercent: number }>;
    };
    assert.strictEqual(adminAlertsBody.total, 1);
    assert.strictEqual(adminAlertsBody.alerts[0].projectId, 'PRJ-0001');
    assert.strictEqual(adminAlertsBody.alerts[0].thresholdPercent, 80);

    const patchTamperIdRes = await fetch(`${baseUrl}/PRJ-0001`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({
        projectId: 'PRJ-0999',
        name: 'Illegal ID Change',
      }),
    });
    assert.strictEqual(patchTamperIdRes.status, 400);

    const patchContractRes = await fetch(`${baseUrl}/PRJ-0001`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({
        contractValue: 20000,
        totalCost: 1,
        estimatedProfit: 999999,
      }),
    });
    assert.strictEqual(patchContractRes.status, 200);
    const patchedProjectBody = (await patchContractRes.json()) as {
      project: {
        projectId: string;
        contractValue: number;
        totalCost: number;
        estimatedProfit: number;
        costPercentage: number;
      };
    };
    assert.strictEqual(patchedProjectBody.project.projectId, 'PRJ-0001');
    assert.strictEqual(patchedProjectBody.project.contractValue, 20000);
    assert.strictEqual(patchedProjectBody.project.totalCost, 21000);
    assert.strictEqual(patchedProjectBody.project.estimatedProfit, -1000);
    assert.strictEqual(patchedProjectBody.project.costPercentage, 105);

    const projectSpecificAlertsRes = await fetch(`${baseUrl}/PRJ-0001/alerts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(projectSpecificAlertsRes.status, 200);
    const projectSpecificAlertsBody =
      (await projectSpecificAlertsRes.json()) as {
        projectId: string;
        alerts: Array<{ thresholdType: string; status: string }>;
      };
    assert.strictEqual(projectSpecificAlertsBody.projectId, 'PRJ-0001');
    assert.strictEqual(projectSpecificAlertsBody.alerts.length, 2);

    const summariesListRes = await fetch(`${baseUrl}/financial-summaries`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(summariesListRes.status, 200);

    const evaluateWarningsRes = await fetch(
      `${baseUrl}/activity-warnings/evaluate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ inactivityDays: 14 }),
      },
    );
    assert.strictEqual(evaluateWarningsRes.status, 200);

    const adminWarningsRes = await fetch(`${baseUrl}/activity-warnings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminWarningsRes.status, 200);

    const dataEntryDeleteForbidden = await fetch(`${baseUrl}/PRJ-0001`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${dataEntryToken}` },
    });
    assert.strictEqual(dataEntryDeleteForbidden.status, 403);

    const adminDeleteRes = await fetch(`${baseUrl}/PRJ-0001`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminDeleteRes.status, 200);
  } finally {
    projectService.setVoucherTotalsProvider(new NoopVoucherTotalsProvider());
    projectRepository.toString();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log('✓ HTTP /api/projects endpoint, summary, alerts & RBAC tests passed.');
  console.log('--- All Project Management Automation Tests Passed Successfully! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Project Management test suite failed:', err);
  process.exit(1);
});
