process.env.NODE_ENV = 'test';

import assert from 'assert';
import fs from 'fs';
import http from 'http';
import path from 'path';
import mongoose from 'mongoose';
import { generateToken } from '../../../middleware/auth';
import {
  ActivityModel,
  sharedActivityMemoryStore,
  validateListActivitiesQuery,
  validateRecentActivitiesQuery,
} from '../../activity';
import { sharedUserMemoryStore, UserModel } from '../../auth/models/user.model';
import {
  ExpenseCategoryModel,
  ExpenseCounterModel,
  ExpenseVoucherModel,
  sharedExpenseCategoryMemoryStore,
  sharedExpenseCounterMemoryStore,
  sharedExpenseVoucherMemoryStore,
} from '../../expenses';
import {
  ProjectActivityWarningModel,
  ProjectCostAlertModel,
  ProjectCounterModel,
  ProjectModel,
  sharedProjectActivityWarningMemoryStore,
  sharedProjectCostAlertMemoryStore,
  sharedProjectCounterMemoryStore,
  sharedProjectMemoryStore,
} from '../../projects';
import {
  PurchaseCounterModel,
  PurchaseStockMovementModel,
  PurchaseVoucherModel,
  sharedPurchaseCounterMemoryStore,
  sharedPurchaseStockMovementMemoryStore,
  sharedPurchaseVoucherMemoryStore,
} from '../../purchases';
import {
  RawMaterialModel,
  sharedRawMaterialMemoryStore,
} from '../../raw-materials';
import {
  validateDashboardMonthlyExpensesQuery,
  validateDashboardOverviewQuery,
} from '../dto/dashboard.dto';

interface JsonHttpResponse {
  status: number;
  body: Record<string, unknown>;
}

function sendJson(
  baseUrl: string,
  method: string,
  urlPath: string,
  options: {
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<JsonHttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(urlPath, baseUrl);
    const payload =
      options.body !== undefined ? JSON.stringify(options.body) : undefined;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) =>
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
        );
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed: Record<string, unknown> = {};
          try {
            parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
          } catch {
            parsed = { rawText: text };
          }
          resolve({
            status: res.statusCode || 0,
            body: parsed,
          });
        });
      },
    );

    req.on('error', reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

async function resetAllStores(): Promise<void> {
  sharedUserMemoryStore.clear();
  sharedProjectMemoryStore.clear();
  sharedProjectCounterMemoryStore.clear();
  sharedProjectCostAlertMemoryStore.clear();
  sharedProjectActivityWarningMemoryStore.clear();
  sharedRawMaterialMemoryStore.clear();
  sharedPurchaseVoucherMemoryStore.clear();
  sharedPurchaseCounterMemoryStore.clear();
  sharedPurchaseStockMovementMemoryStore.clear();
  sharedExpenseCategoryMemoryStore.clear();
  sharedExpenseVoucherMemoryStore.clear();
  sharedExpenseCounterMemoryStore.clear();
  sharedActivityMemoryStore.clear();

  if (mongoose.connection.readyState === 1) {
    await Promise.all([
      UserModel.deleteMany({}),
      ProjectModel.deleteMany({}),
      ProjectCounterModel.deleteMany({}),
      ProjectCostAlertModel.deleteMany({}),
      ProjectActivityWarningModel.deleteMany({}),
      RawMaterialModel.deleteMany({}),
      PurchaseVoucherModel.deleteMany({}),
      PurchaseCounterModel.deleteMany({}),
      PurchaseStockMovementModel.deleteMany({}),
      ExpenseCategoryModel.deleteMany({}),
      ExpenseVoucherModel.deleteMany({}),
      ExpenseCounterModel.deleteMany({}),
      ActivityModel.deleteMany({}),
    ]);
  }
}

async function seedActors(): Promise<{
  adminToken: string;
  adminId: string;
  dataEntryToken: string;
  dataEntryId: string;
}> {
  const now = new Date();
  const adminId = new mongoose.Types.ObjectId().toHexString();
  const dataEntryId = new mongoose.Types.ObjectId().toHexString();

  const adminRecord = {
    _id: adminId,
    name: 'Dashboard Admin',
    email: 'dashboard.admin@softtouch.local',
    password: 'hashed_unused_in_token_check',
    role: 'admin' as const,
    isActive: true,
    approvalStatus: 'approved' as const,
    createdAt: now,
    updatedAt: now,
  };

  const operatorRecord = {
    _id: dataEntryId,
    name: 'Workshop Operator',
    email: 'dashboard.operator@softtouch.local',
    password: 'hashed_unused_in_token_check',
    role: 'data_entry' as const,
    isActive: true,
    approvalStatus: 'approved' as const,
    createdAt: now,
    updatedAt: now,
  };

  sharedUserMemoryStore.set(adminRecord.email, adminRecord);
  sharedUserMemoryStore.set(operatorRecord.email, operatorRecord);

  if (mongoose.connection.readyState === 1) {
    await UserModel.create([adminRecord, operatorRecord]);
  }

  return {
    adminId,
    dataEntryId,
    adminToken: generateToken({
      id: adminId,
      email: adminRecord.email,
      name: adminRecord.name,
      role: 'admin',
      approvalStatus: 'approved',
    }),
    dataEntryToken: generateToken({
      id: dataEntryId,
      email: operatorRecord.email,
      name: operatorRecord.name,
      role: 'data_entry',
      approvalStatus: 'approved',
    }),
  };
}

async function runDashboardAndActivityTests(): Promise<void> {
  console.log('--- Starting Dashboard & Activity Module Test Suite ---');

  console.log('1. Testing Dashboard & Activity DTO validators...');
  {
    assert.strictEqual(validateDashboardOverviewQuery({}).isValid, true);
    assert.strictEqual(
      validateDashboardOverviewQuery({ projectStatus: 'InvalidStatus' }).isValid,
      false,
    );
    assert.strictEqual(
      validateDashboardOverviewQuery({ projectSortBy: 'unknownField' }).isValid,
      false,
    );
    assert.strictEqual(
      validateDashboardMonthlyExpensesQuery({
        fromDate: '2026-10-20',
        toDate: '2026-10-01',
      }).isValid,
      false,
    );
    assert.strictEqual(
      validateRecentActivitiesQuery({ limit: '50' }).isValid,
      true,
    );
    assert.strictEqual(
      validateRecentActivitiesQuery({ limit: '51' }).isValid,
      false,
    );
    assert.strictEqual(
      validateListActivitiesQuery({
        page: '1',
        limit: '20',
        entityType: 'project',
      }).isValid,
      true,
    );
    assert.strictEqual(
      validateListActivitiesQuery({ entityType: 'invalid' }).isValid,
      false,
    );
  }
  console.log('✓ DTO validations passed.');

  const { default: app } = await import('../../../index');
  await resetAllStores();
  const actors = await seedActors();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to start test HTTP server.');
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    console.log('2. Testing authentication & empty-state responses...');
    {
      const unauthDash = await sendJson(baseUrl, 'GET', '/api/dashboard/overview');
      assert.strictEqual(unauthDash.status, 401);

      const unauthAct = await sendJson(baseUrl, 'GET', '/api/activities/recent');
      assert.strictEqual(unauthAct.status, 401);

      const emptyDash = await sendJson(
        baseUrl,
        'GET',
        '/api/dashboard/overview',
        { token: actors.adminToken },
      );
      assert.strictEqual(emptyDash.status, 200);
      const kpis = emptyDash.body.kpis as Record<string, unknown>;
      assert.strictEqual(kpis.totalProjects, 0);
      assert.strictEqual(kpis.totalContractValue, 0);
      assert.strictEqual(kpis.totalProjectCosts, 0);
      assert.strictEqual(kpis.estimatedProfit, 0);
      assert.strictEqual(kpis.profitMargin, null);
      assert.strictEqual(kpis.marginApplicable, false);
    }

    console.log(
      '3. Recording real signup, materials, projects, purchases & expenses...',
    );

    const signupRes = await sendJson(baseUrl, 'POST', '/api/auth/signup', {
      body: {
        name: 'Pending Upholstery Clerk',
        email: 'pending.clerk@softtouch.local',
        phone: '+919876543210',
        password: 'ClerkSecurePassword123!',
      },
    });
    assert.strictEqual(signupRes.status, 201);

    const matZeroRes = await sendJson(baseUrl, 'POST', '/api/raw-materials', {
      token: actors.adminToken,
      body: {
        name: 'Italian Boucle Cream',
        category: 'Upholstery',
        unit: 'Meter',
        quantityOnHand: 0,
      },
    });
    assert.strictEqual(matZeroRes.status, 201);
    const matZeroId = String(
      (matZeroRes.body.rawMaterial as Record<string, unknown>).id,
    );

    const matThresholdRes = await sendJson(
      baseUrl,
      'POST',
      '/api/raw-materials',
      {
        token: actors.adminToken,
        body: {
          name: 'High Density 40D Foam',
          category: 'Foam',
          unit: 'Sheet',
          quantityOnHand: 3,
          minStockLevel: 5,
        },
      },
    );
    assert.strictEqual(matThresholdRes.status, 201);
    const matThresholdId = String(
      (matThresholdRes.body.rawMaterial as Record<string, unknown>).id,
    );

    const matHealthyRes = await sendJson(
      baseUrl,
      'POST',
      '/api/raw-materials',
      {
        token: actors.adminToken,
        body: {
          name: 'Kiln Dried Teak Frame',
          category: 'Timber',
          unit: 'Piece',
          quantityOnHand: 25,
          minStockLevel: 10,
        },
      },
    );
    assert.strictEqual(matHealthyRes.status, 201);
    const matHealthyId = String(
      (matHealthyRes.body.rawMaterial as Record<string, unknown>).id,
    );

    const projARes = await sendJson(baseUrl, 'POST', '/api/projects', {
      token: actors.adminToken,
      body: {
        name: 'Villa Penthouse Sofa Suite',
        clientName: 'Menon Residence',
        category: 'Modular Sofa',
        contractValue: 200000,
      },
    });
    assert.strictEqual(projARes.status, 201);
    const projA = projARes.body.project as Record<string, unknown>;
    const projAId = String(projA.id);
    const projACode = String(projA.projectId);

    const projBRes = await sendJson(baseUrl, 'POST', '/api/projects', {
      token: actors.adminToken,
      body: {
        name: 'Boutique Hotel Blackout Drapes',
        clientName: 'Harbor Suites',
        category: 'Curtains',
        contractValue: 50000,
      },
    });
    assert.strictEqual(projBRes.status, 201);
    const projB = projBRes.body.project as Record<string, unknown>;
    const projBId = String(projB.id);
    const projBCode = String(projB.projectId);

    const projZeroRes = await sendJson(baseUrl, 'POST', '/api/projects', {
      token: actors.adminToken,
      body: {
        name: 'Showroom Sample Swatch Set',
        clientName: 'Internal Atelier',
        category: 'Bespoke Interior',
        contractValue: 0,
      },
    });
    assert.strictEqual(projZeroRes.status, 201);
    const projZero = projZeroRes.body.project as Record<string, unknown>;
    const projZeroCode = String(projZero.projectId);

    const statusUpdateRes = await sendJson(
      baseUrl,
      'PATCH',
      `/api/projects/${encodeURIComponent(projZeroCode)}/status`,
      {
        token: actors.adminToken,
        body: { status: 'Completed' },
      },
    );
    assert.strictEqual(statusUpdateRes.status, 200);

    const pur1Res = await sendJson(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: actors.dataEntryToken,
        headers: { 'Idempotency-Key': 'dash-test-pur-1' },
        body: {
          purchaseDate: '2026-09-15',
          supplierName: 'Kochi Fabrics Trading',
          supplierInvoiceNumber: 'KFT-901',
          projectId: projAId,
          lineItems: [
            {
              materialId: matHealthyId,
              quantity: 5,
              unitPrice: 10000,
            },
          ],
          taxAmount: 5000,
        },
      },
    );
    assert.strictEqual(pur1Res.status, 201);

    const pur1ReplayRes = await sendJson(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: actors.dataEntryToken,
        headers: { 'Idempotency-Key': 'dash-test-pur-1' },
        body: {
          purchaseDate: '2026-09-15',
          supplierName: 'Kochi Fabrics Trading',
          supplierInvoiceNumber: 'KFT-901',
          projectId: projAId,
          lineItems: [
            {
              materialId: matHealthyId,
              quantity: 5,
              unitPrice: 10000,
            },
          ],
          taxAmount: 5000,
        },
      },
    );
    assert.strictEqual(pur1ReplayRes.status, 200);

    const pur2Res = await sendJson(baseUrl, 'POST', '/api/purchases', {
      token: actors.adminToken,
      body: {
        purchaseDate: '2026-10-10',
        supplierName: 'Malabar Drapery Mills',
        supplierInvoiceNumber: 'MDM-104',
        projectId: projBId,
        lineItems: [
          {
            materialId: matHealthyId,
            quantity: 6,
            unitPrice: 9000,
          },
        ],
        taxAmount: 2000,
      },
    });
    assert.strictEqual(pur2Res.status, 201);

    const purCancelTargetRes = await sendJson(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: actors.adminToken,
        body: {
          purchaseDate: '2026-10-12',
          supplierName: 'Voided Supplier',
          supplierInvoiceNumber: 'VOID-01',
          projectId: projAId,
          lineItems: [
            {
              materialId: matHealthyId,
              quantity: 2,
              unitPrice: 5000,
            },
          ],
        },
      },
    );
    assert.strictEqual(purCancelTargetRes.status, 201);
    const cancelPurVoucherNum = String(
      (purCancelTargetRes.body.voucher as Record<string, unknown>).voucherNumber,
    );

    const purCancelRes = await sendJson(
      baseUrl,
      'POST',
      `/api/purchases/${encodeURIComponent(cancelPurVoucherNum)}/cancel`,
      {
        token: actors.adminToken,
        body: { reason: 'Duplicate supplier invoice entry' },
      },
    );
    assert.strictEqual(purCancelRes.status, 200);

    const catListRes = await sendJson(
      baseUrl,
      'GET',
      '/api/expenses/categories',
      { token: actors.adminToken },
    );
    assert.strictEqual(catListRes.status, 200);
    const categories = catListRes.body.categories as Array<
      Record<string, unknown>
    >;
    const transportCatId = String(categories[0].id);

    const exp1Res = await sendJson(baseUrl, 'POST', '/api/expenses', {
      token: actors.dataEntryToken,
      body: {
        expenseDate: '2026-10-14',
        categoryId: transportCatId,
        amount: 12000,
        description: 'Site delivery van hire for sofa frames',
        projectId: projAId,
      },
    });
    assert.strictEqual(exp1Res.status, 201);

    const expGeneralRes = await sendJson(baseUrl, 'POST', '/api/expenses', {
      token: actors.adminToken,
      body: {
        expenseDate: '2026-10-16',
        categoryId: transportCatId,
        amount: 4500,
        description: 'General showroom electricity bill',
      },
    });
    assert.strictEqual(expGeneralRes.status, 201);

    console.log(
      '4. Verifying Dashboard KPIs match Project Reports 100% & Stock/Monthly/Recent accuracy...',
    );
    {
      const [dashRes, reportsRes] = await Promise.all([
        sendJson(
          baseUrl,
          'GET',
          '/api/dashboard/overview?expenseFromDate=2026-09-01&expenseToDate=2026-10-31',
          { token: actors.adminToken },
        ),
        sendJson(baseUrl, 'GET', '/api/reports/projects', {
          token: actors.adminToken,
        }),
      ]);

      assert.strictEqual(dashRes.status, 200);
      assert.strictEqual(reportsRes.status, 200);

      const dashKpis = dashRes.body.kpis as Record<string, unknown>;
      const repSummary = reportsRes.body.summary as Record<string, unknown>;

      assert.strictEqual(dashKpis.totalProjects, 3);
      assert.strictEqual(dashKpis.activeProjects, 2);
      assert.strictEqual(dashKpis.completedProjects, 1);

      assert.strictEqual(dashKpis.totalContractValue, repSummary.contractValue);
      assert.strictEqual(
        dashKpis.materialPurchaseCosts,
        repSummary.materialPurchaseCosts,
      );
      assert.strictEqual(
        dashKpis.otherProjectExpenses,
        repSummary.otherProjectExpenses,
      );
      assert.strictEqual(
        dashKpis.totalProjectCosts,
        repSummary.totalProjectCosts,
      );
      assert.strictEqual(dashKpis.estimatedProfit, repSummary.estimatedProfit);
      assert.strictEqual(dashKpis.profitMargin, repSummary.profitMargin);

      assert.strictEqual(dashKpis.totalContractValue, 250000);
      assert.strictEqual(dashKpis.materialPurchaseCosts, 111000);
      assert.strictEqual(dashKpis.otherProjectExpenses, 12000);
      assert.strictEqual(dashKpis.totalProjectCosts, 123000);
      assert.strictEqual(dashKpis.estimatedProfit, 127000);
      assert.strictEqual(dashKpis.overBudgetProjectsCount, 1);
      assert.strictEqual(dashKpis.profitableProjectsCount, 1);

      const monthly = dashRes.body.monthlyExpenses as {
        totals: Record<string, number>;
        buckets: Array<Record<string, unknown>>;
      };
      assert.strictEqual(monthly.buckets.length, 2);
      assert.strictEqual(monthly.buckets[0].monthKey, '2026-09');
      assert.strictEqual(monthly.buckets[0].purchaseCosts, 55000);
      assert.strictEqual(monthly.buckets[0].otherExpenses, 0);
      assert.strictEqual(monthly.buckets[1].monthKey, '2026-10');
      assert.strictEqual(monthly.buckets[1].purchaseCosts, 56000);
      assert.strictEqual(monthly.buckets[1].otherExpenses, 16500);
      assert.strictEqual(monthly.totals.totalExpenses, 127500);

      const stockAlerts = dashRes.body.stockAlerts as {
        outOfStockCount: number;
        lowStockCount: number;
        configuredThresholdCount: number;
        items: Array<Record<string, unknown>>;
      };
      assert.strictEqual(stockAlerts.outOfStockCount, 1);
      assert.strictEqual(stockAlerts.lowStockCount, 1);
      assert.strictEqual(stockAlerts.configuredThresholdCount, 2);
      assert.strictEqual(stockAlerts.items.length, 2);
      assert.strictEqual(stockAlerts.items[0].id, matZeroId);
      assert.strictEqual(stockAlerts.items[0].minStockLevel, null);
      assert.strictEqual(stockAlerts.items[0].alertStatus, 'out_of_stock');
      assert.strictEqual(stockAlerts.items[1].id, matThresholdId);
      assert.strictEqual(stockAlerts.items[1].minStockLevel, 5);
      assert.strictEqual(stockAlerts.items[1].alertStatus, 'low_stock');

      const pendingApprovals = dashRes.body.pendingApprovals as {
        count: number;
        items: Array<Record<string, unknown>>;
      };
      assert.strictEqual(pendingApprovals.count, 1);
      assert.strictEqual(
        pendingApprovals.items[0].email,
        'pending.clerk@softtouch.local',
      );
    }

    console.log('5. Verifying RBAC for Data Entry Operators & Activity feed...');
    {
      const opDash = await sendJson(baseUrl, 'GET', '/api/dashboard/overview', {
        token: actors.dataEntryToken,
      });
      assert.strictEqual(opDash.status, 200);
      assert.strictEqual(opDash.body.pendingApprovals, null);

      const opPerf = (
        opDash.body.projectPerformance as {
          items: Array<Record<string, unknown>>;
        }
      ).items;
      assert.ok(
        opPerf.every(
          (row) => !String(row.detailPath || '').endsWith('/report'),
        ),
      );

      const badProjectRes = await sendJson(baseUrl, 'POST', '/api/projects', {
        token: actors.adminToken,
        body: { name: '', clientName: '' },
      });
      assert.strictEqual(badProjectRes.status, 400);

      const adminRecent = await sendJson(
        baseUrl,
        'GET',
        '/api/activities/recent',
        { token: actors.adminToken },
      );
      assert.strictEqual(adminRecent.status, 200);
      const adminItems = adminRecent.body.items as Array<
        Record<string, unknown>
      >;
      assert.ok(adminItems.length >= 10);
      assert.ok(
        adminItems.some((item) => item.actionType === 'user.registered'),
      );
      const purCreatedEvents = adminItems.filter(
        (item) =>
          item.actionType === 'purchase.created' &&
          String(item.description).includes('Kochi Fabrics Trading'),
      );
      assert.strictEqual(purCreatedEvents.length, 1);
      assert.ok(
        adminItems.every(
          (item) =>
            !JSON.stringify(item).includes('ClerkSecurePassword123!') &&
            !JSON.stringify(item).includes('Bearer '),
        ),
      );

      const opRecent = await sendJson(
        baseUrl,
        'GET',
        '/api/activities/recent',
        { token: actors.dataEntryToken },
      );
      assert.strictEqual(opRecent.status, 200);
      const opItems = opRecent.body.items as Array<Record<string, unknown>>;
      assert.ok(opItems.every((item) => item.entityType !== 'user'));
      assert.ok(
        opItems.every(
          (item) =>
            !String(item.targetPath || '').startsWith('/users') &&
            !String(item.targetPath || '').startsWith('/user-approvals'),
        ),
      );

      const filteredHistory = await sendJson(
        baseUrl,
        'GET',
        `/api/activities?projectId=${encodeURIComponent(projACode)}&limit=5`,
        { token: actors.adminToken },
      );
      assert.strictEqual(filteredHistory.status, 200);
      const projHistoryItems = filteredHistory.body.items as Array<
        Record<string, unknown>
      >;
      assert.ok(projHistoryItems.length >= 3);
      assert.ok(
        projHistoryItems.every((item) => item.projectCode === projACode),
      );

      for (let idx = 0; idx < 45; idx += 1) {
        const adjRes = await sendJson(
          baseUrl,
          'PATCH',
          `/api/raw-materials/${encodeURIComponent(matHealthyId)}/stock`,
          {
            token: actors.adminToken,
            body: {
              quantityOnHand: 40 + idx,
              reason: `Cycle count verification batch ${idx + 1}`,
            },
          },
        );
        assert.strictEqual(adjRes.status, 200);
      }

      const cappedRecent = await sendJson(
        baseUrl,
        'GET',
        '/api/activities/recent',
        { token: actors.adminToken },
      );
      assert.strictEqual(cappedRecent.status, 200);
      const cappedItems = cappedRecent.body.items as Array<
        Record<string, unknown>
      >;
      assert.strictEqual(cappedItems.length, 50);

      const page2History = await sendJson(
        baseUrl,
        'GET',
        '/api/activities?page=2&limit=25',
        { token: actors.adminToken },
      );
      assert.strictEqual(page2History.status, 200);
      assert.strictEqual(page2History.body.page, 2);
      assert.ok(Number(page2History.body.total) > 50);
    }

    console.log('✓ All Dashboard & Activity assertions passed.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const storageDir = path.resolve(process.cwd(), 'storage/purchase-bills');
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }
  }

  console.log('=== ALL DASHBOARD & ACTIVITY TESTS PASSED ===');
}

runDashboardAndActivityTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Dashboard & Activity test suite failed:', err);
    process.exit(1);
  });
