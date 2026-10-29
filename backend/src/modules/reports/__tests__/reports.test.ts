process.env.NODE_ENV = 'test';

import assert from 'assert';
import http from 'http';
import app from '../../../index';
import { generateToken } from '../../../middleware/auth';
import { sharedUserMemoryStore } from '../../auth/models/user.model';
import {
  registerExpenseProjectFinancialIntegration,
  sharedExpenseCategoryMemoryStore,
  sharedExpenseCounterMemoryStore,
  sharedExpenseVoucherMemoryStore,
} from '../../expenses';
import {
  sharedProjectActivityWarningMemoryStore,
  sharedProjectCostAlertMemoryStore,
  sharedProjectCounterMemoryStore,
  sharedProjectMemoryStore,
} from '../../projects';
import {
  sharedPurchaseCounterMemoryStore,
  sharedPurchaseStockMovementMemoryStore,
  sharedPurchaseVoucherMemoryStore,
} from '../../purchases';
import { sharedRawMaterialMemoryStore } from '../../raw-materials';
import {
  validateProjectReportDetailQueryDto,
  validateProjectReportsQueryDto,
} from '../index';

async function jsonReq(
  baseUrl: string,
  method: string,
  urlPath: string,
  options: {
    token?: string;
    body?: unknown;
  } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let serialized: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    serialized = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: serialized,
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }
  }
  return { status: response.status, body: parsed };
}

async function runTests(): Promise<void> {
  console.log('--- Starting Project Cost & Profitability Reports Test Suite ---');

  registerExpenseProjectFinancialIntegration();

  sharedUserMemoryStore.clear();
  sharedRawMaterialMemoryStore.clear();
  sharedProjectMemoryStore.clear();
  sharedProjectCounterMemoryStore.clear();
  sharedProjectCostAlertMemoryStore.clear();
  sharedProjectActivityWarningMemoryStore.clear();
  sharedPurchaseVoucherMemoryStore.clear();
  sharedPurchaseCounterMemoryStore.clear();
  sharedPurchaseStockMovementMemoryStore.clear();
  sharedExpenseCategoryMemoryStore.clear();
  sharedExpenseVoucherMemoryStore.clear();
  sharedExpenseCounterMemoryStore.clear();

  console.log('1. Testing Report Query DTO validations...');

  const badDates = validateProjectReportsQueryDto({
    fromDate: '2026-10-30',
    toDate: '2026-10-01',
  });
  assert.strictEqual(badDates.isValid, false);
  assert.ok(badDates.errors?.fromDate);

  const badSort = validateProjectReportsQueryDto({
    sortBy: 'arbitraryField',
  });
  assert.strictEqual(badSort.isValid, false);
  assert.ok(badSort.errors?.sortBy);

  const badDetailDate = validateProjectReportDetailQueryDto({
    fromDate: '2026-02-30',
  });
  assert.strictEqual(badDetailDate.isValid, false);

  const validQuery = validateProjectReportsQueryDto({
    page: '2',
    limit: '5',
    status: 'In Progress',
    fromDate: '2026-10-01',
    toDate: '2026-10-31',
    sortBy: 'profitMargin',
    sortOrder: 'asc',
  });
  assert.strictEqual(validQuery.isValid, true);
  assert.strictEqual(validQuery.value?.page, 2);
  assert.strictEqual(validQuery.value?.limit, 5);
  assert.strictEqual(validQuery.value?.sortBy, 'profitMargin');
  assert.strictEqual(validQuery.value?.sortOrder, 'asc');

  console.log('✓ Report Query DTO checks passed.');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const adminId = '507f1f77bcf86cd799439101';
    const operatorId = '507f1f77bcf86cd799439102';
    const pendingId = '507f1f77bcf86cd799439103';

    sharedUserMemoryStore.set(adminId, {
      _id: adminId,
      name: 'Atelier Admin',
      email: 'admin-reports@softtouch.test',
      role: 'admin',
      isActive: true,
      approvalStatus: 'approved',
    });

    sharedUserMemoryStore.set(operatorId, {
      _id: operatorId,
      name: 'Workshop Operator',
      email: 'operator-reports@softtouch.test',
      role: 'data_entry',
      isActive: true,
      approvalStatus: 'approved',
    });

    sharedUserMemoryStore.set(pendingId, {
      _id: pendingId,
      name: 'Pending User',
      email: 'pending-reports@softtouch.test',
      role: 'data_entry',
      isActive: true,
      approvalStatus: 'pending',
    });

    const adminToken = generateToken({
      id: adminId,
      email: 'admin-reports@softtouch.test',
      name: 'Atelier Admin',
      role: 'admin',
      approvalStatus: 'approved',
    });

    const operatorToken = generateToken({
      id: operatorId,
      email: 'operator-reports@softtouch.test',
      name: 'Workshop Operator',
      role: 'data_entry',
      approvalStatus: 'approved',
    });

    const pendingToken = generateToken({
      id: pendingId,
      email: 'pending-reports@softtouch.test',
      name: 'Pending User',
      role: 'data_entry',
      approvalStatus: 'pending',
    });

    console.log('2. Testing authentication & role-based authorization...');

    assert.strictEqual(
      (await jsonReq(baseUrl, 'GET', '/api/reports/projects')).status,
      401,
    );
    assert.strictEqual(
      (
        await jsonReq(baseUrl, 'GET', '/api/reports/projects', {
          token: pendingToken,
        })
      ).status,
      403,
    );
    assert.strictEqual(
      (
        await jsonReq(baseUrl, 'GET', '/api/reports/projects', {
          token: operatorToken,
        })
      ).status,
      403,
    );
    assert.strictEqual(
      (
        await jsonReq(baseUrl, 'GET', '/api/reports/projects/export', {
          token: operatorToken,
        })
      ).status,
      403,
    );

    const emptyReportRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/reports/projects',
      { token: adminToken },
    );
    assert.strictEqual(emptyReportRes.status, 200);
    assert.strictEqual(emptyReportRes.body.total, 0);
    const emptySummary = emptyReportRes.body.summary as Record<string, unknown>;
    assert.strictEqual(emptySummary.contractValue, 0);
    assert.strictEqual(emptySummary.totalProjectCosts, 0);
    assert.strictEqual(emptySummary.estimatedProfit, 0);
    assert.strictEqual(emptySummary.profitMargin, null);
    assert.strictEqual(emptySummary.marginApplicable, false);

    console.log('✓ Auth, RBAC & empty-state checks passed.');

    console.log(
      '3. Creating projects across all financial scenarios (empty, purchases-only, expenses-only, both + loss, zero-contract)...',
    );

    const createProject = async (payload: Record<string, unknown>) => {
      const res = await jsonReq(baseUrl, 'POST', '/api/projects', {
        token: adminToken,
        body: payload,
      });
      assert.strictEqual(res.status, 201);
      return res.body.project as { id: string; projectId: string };
    };

    const p1NoCosts = await createProject({
      name: 'Aluva Villa Sofa Suite',
      clientName: 'Anand Varma',
      category: 'Modular Sofa',
      contractValue: 120000,
    });

    const p2PurchasesOnly = await createProject({
      name: 'Marine Drive Drapery',
      clientName: 'Nisha Thomas',
      category: 'Curtains',
      contractValue: 100000,
    });

    const p3ExpensesNearLimit = await createProject({
      name: 'Edappally Lounge Refit',
      clientName: 'Kiran Mohan',
      category: 'Armchair',
      contractValue: 50000,
    });

    const p4BothLoss = await createProject({
      name: 'Kakkanad Penthouse Interior',
      clientName: 'Suresh Menon',
      category: 'Bespoke Interior',
      contractValue: 80000,
    });

    const p5ZeroContract = await createProject({
      name: 'Warranty Showroom Sample',
      clientName: 'Internal Atelier',
      category: 'Modular Sofa',
      contractValue: 0,
    });

    const catRes = await jsonReq(baseUrl, 'GET', '/api/expenses/categories', {
      token: adminToken,
    });
    const categories = catRes.body.categories as Array<{
      id: string;
      name: string;
    }>;
    const transportCatId = categories.find(
      (c) => c.name === 'Transportation',
    )!.id;
    const labourCatId = categories.find((c) => c.name === 'Labour')!.id;
    const installCatId = categories.find((c) => c.name === 'Installation')!.id;

    const pvP2Res = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: operatorToken,
      body: {
        purchaseDate: '2026-09-15',
        supplierName: 'Malabar Drapery Mills',
        supplierInvoiceNumber: 'MDM-901',
        projectId: p2PurchasesOnly.id,
        discountAmount: 2000,
        taxAmount: 5040,
        otherCharges: 960,
        lineItems: [
          {
            newMaterial: {
              name: 'Belgian Linen Sheer',
              category: 'Curtain',
              unit: 'Meter',
            },
            quantity: 60,
            unitPrice: 500,
          },
        ],
      },
    });
    assert.strictEqual(pvP2Res.status, 201);
    assert.strictEqual(
      (pvP2Res.body.voucher as Record<string, unknown>).finalTotal,
      34000,
    );

    const expP3Res = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: operatorToken,
      body: {
        expenseDate: '2026-10-10',
        categoryId: labourCatId,
        amount: 42500,
        description: 'Custom armchair frame carving and upholstery labour',
        projectId: p3ExpensesNearLimit.id,
      },
    });
    assert.strictEqual(expP3Res.status, 201);

    const pvP4ActiveRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: adminToken,
      body: {
        purchaseDate: '2026-10-18',
        supplierName: 'Nilambur Teak Traders',
        projectId: p4BothLoss.id,
        lineItems: [
          {
            newMaterial: {
              name: 'Seasoned Teak Battens',
              category: 'Timber',
              unit: 'Running Feet',
            },
            quantity: 120,
            unitPrice: 500,
          },
        ],
      },
    });
    assert.strictEqual(pvP4ActiveRes.status, 201);

    const pvP4ToCancelRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: adminToken,
      body: {
        purchaseDate: '2026-10-19',
        supplierName: 'Duplicate Supplier Entry',
        projectId: p4BothLoss.id,
        lineItems: [
          {
            newMaterial: {
              name: 'Brass Curtain Brackets',
              category: 'Hardware',
              unit: 'Piece',
            },
            quantity: 20,
            unitPrice: 400,
          },
        ],
      },
    });
    assert.strictEqual(pvP4ToCancelRes.status, 201);
    const cancelledPvId = String(
      (pvP4ToCancelRes.body.voucher as Record<string, unknown>).id,
    );
    const cancelPvRes = await jsonReq(
      baseUrl,
      'POST',
      `/api/purchases/${cancelledPvId}/cancel`,
      {
        token: adminToken,
        body: { reason: 'Duplicate purchase entry' },
      },
    );
    assert.strictEqual(cancelPvRes.status, 200);

    const expP4ActiveRes = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: operatorToken,
      body: {
        expenseDate: '2026-10-20',
        categoryId: installCatId,
        amount: 35000,
        description: 'On-site panelling, sofa staging, and curtain installation',
        projectId: p4BothLoss.id,
      },
    });
    assert.strictEqual(expP4ActiveRes.status, 201);

    const expP4ToCancelRes = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: adminToken,
      body: {
        expenseDate: '2026-10-21',
        categoryId: transportCatId,
        amount: 9000,
        description: 'Cancelled duplicate transport voucher',
        projectId: p4BothLoss.id,
      },
    });
    assert.strictEqual(expP4ToCancelRes.status, 201);
    const cancelledExpId = String(
      (expP4ToCancelRes.body.voucher as Record<string, unknown>).id,
    );
    const cancelExpRes = await jsonReq(
      baseUrl,
      'POST',
      `/api/expenses/${cancelledExpId}/cancel`,
      {
        token: adminToken,
        body: { reason: 'Duplicate transport entry' },
      },
    );
    assert.strictEqual(cancelExpRes.status, 200);

    const expP5Res = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: operatorToken,
      body: {
        expenseDate: '2026-10-22',
        categoryId: transportCatId,
        amount: 5000,
        description: 'Showroom sample delivery tempo',
        projectId: p5ZeroContract.id,
      },
    });
    assert.strictEqual(expP5Res.status, 201);

    const workshopGeneralExp = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: operatorToken,
      body: {
        expenseDate: '2026-10-22',
        categoryId: transportCatId,
        amount: 12345,
        description: 'Unassigned general workshop overhead',
      },
    });
    assert.strictEqual(workshopGeneralExp.status, 201);

    const completeP2Res = await jsonReq(
      baseUrl,
      'PATCH',
      `/api/projects/${p2PurchasesOnly.id}/status`,
      {
        token: adminToken,
        body: { status: 'Completed' },
      },
    );
    assert.strictEqual(completeP2Res.status, 200);

    console.log(
      '4. Verifying portfolio summary cards, row calculations, zero double-counting, zero-contract safety & cancelled exclusions...',
    );

    const allRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/reports/projects?limit=10',
      { token: adminToken },
    );
    assert.strictEqual(allRes.status, 200);
    assert.strictEqual(allRes.body.total, 5);

    const items = allRes.body.items as Array<Record<string, unknown>>;
    const byCode = new Map(items.map((r) => [String(r.projectId), r]));

    const r1 = byCode.get(p1NoCosts.projectId)!;
    assert.strictEqual(r1.contractValue, 120000);
    assert.strictEqual(r1.materialPurchaseCosts, 0);
    assert.strictEqual(r1.otherProjectExpenses, 0);
    assert.strictEqual(r1.totalProjectCosts, 0);
    assert.strictEqual(r1.estimatedProfit, 120000);
    assert.strictEqual(r1.profitMargin, 100);
    assert.strictEqual(r1.healthStatus, 'profitable');

    const r2 = byCode.get(p2PurchasesOnly.projectId)!;
    assert.strictEqual(r2.contractValue, 100000);
    assert.strictEqual(r2.materialPurchaseCosts, 34000);
    assert.strictEqual(r2.otherProjectExpenses, 0);
    assert.strictEqual(r2.totalProjectCosts, 34000);
    assert.strictEqual(r2.estimatedProfit, 66000);
    assert.strictEqual(r2.profitMargin, 66);
    assert.strictEqual(r2.healthStatus, 'profitable');

    const r3 = byCode.get(p3ExpensesNearLimit.projectId)!;
    assert.strictEqual(r3.contractValue, 50000);
    assert.strictEqual(r3.materialPurchaseCosts, 0);
    assert.strictEqual(r3.otherProjectExpenses, 42500);
    assert.strictEqual(r3.totalProjectCosts, 42500);
    assert.strictEqual(r3.estimatedProfit, 7500);
    assert.strictEqual(r3.profitMargin, 15);
    assert.strictEqual(r3.costPercentage, 85);
    assert.strictEqual(r3.healthStatus, 'near_limit');

    const r4 = byCode.get(p4BothLoss.projectId)!;
    assert.strictEqual(r4.contractValue, 80000);
    assert.strictEqual(r4.materialPurchaseCosts, 60000);
    assert.strictEqual(r4.otherProjectExpenses, 35000);
    assert.strictEqual(r4.totalProjectCosts, 95000);
    assert.strictEqual(r4.estimatedProfit, -15000);
    assert.strictEqual(r4.profitMargin, -18.75);
    assert.strictEqual(r4.costPercentage, 118.75);
    assert.strictEqual(r4.healthStatus, 'loss');

    const r5 = byCode.get(p5ZeroContract.projectId)!;
    assert.strictEqual(r5.contractValue, 0);
    assert.strictEqual(r5.materialPurchaseCosts, 0);
    assert.strictEqual(r5.otherProjectExpenses, 5000);
    assert.strictEqual(r5.totalProjectCosts, 5000);
    assert.strictEqual(r5.estimatedProfit, -5000);
    assert.strictEqual(r5.marginApplicable, false);
    assert.strictEqual(r5.profitMargin, null);
    assert.strictEqual(r5.costPercentage, null);
    assert.strictEqual(r5.healthStatus, 'loss');

    const summary = allRes.body.summary as Record<string, unknown>;
    assert.strictEqual(summary.projectCount, 5);
    assert.strictEqual(summary.contractValue, 350000);
    assert.strictEqual(summary.materialPurchaseCosts, 94000);
    assert.strictEqual(summary.otherProjectExpenses, 82500);
    assert.strictEqual(summary.totalProjectCosts, 176500);
    assert.strictEqual(summary.estimatedProfit, 173500);
    assert.strictEqual(summary.profitMargin, 49.57);
    assert.strictEqual(summary.profitableCount, 2);
    assert.strictEqual(summary.nearLimitCount, 1);
    assert.strictEqual(summary.lossCount, 2);

    console.log(
      '5. Testing pagination summary consistency, search, status filter, sorting & date-range period filtering...',
    );

    const pagedRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/reports/projects?page=1&limit=2&sortBy=totalCost&sortOrder=desc',
      { token: adminToken },
    );
    assert.strictEqual(pagedRes.status, 200);
    assert.strictEqual(pagedRes.body.total, 5);
    assert.strictEqual(pagedRes.body.totalPages, 3);
    const pagedItems = pagedRes.body.items as Array<Record<string, unknown>>;
    assert.strictEqual(pagedItems.length, 2);
    assert.strictEqual(pagedItems[0].projectId, p4BothLoss.projectId);
    assert.strictEqual(pagedItems[1].projectId, p3ExpensesNearLimit.projectId);
    assert.strictEqual(
      (pagedRes.body.summary as Record<string, unknown>).totalProjectCosts,
      176500,
    );

    const marginAscRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/reports/projects?sortBy=profitMargin&sortOrder=asc',
      { token: adminToken },
    );
    const marginAscItems = marginAscRes.body.items as Array<
      Record<string, unknown>
    >;
    assert.strictEqual(marginAscItems[0].projectId, p4BothLoss.projectId);
    assert.strictEqual(
      marginAscItems[marginAscItems.length - 1].projectId,
      p5ZeroContract.projectId,
    );

    const searchRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/reports/projects?search=Nisha%20Thomas',
      { token: adminToken },
    );
    assert.strictEqual(searchRes.body.total, 1);
    assert.strictEqual(
      (searchRes.body.items as Array<Record<string, unknown>>)[0].projectId,
      p2PurchasesOnly.projectId,
    );

    const completedRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/reports/projects?status=Completed',
      { token: adminToken },
    );
    assert.strictEqual(completedRes.body.total, 1);
    assert.strictEqual(
      (completedRes.body.summary as Record<string, unknown>).totalProjectCosts,
      34000,
    );

    const octPeriodRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/reports/projects?fromDate=2026-10-01&toDate=2026-10-31',
      { token: adminToken },
    );
    assert.strictEqual(octPeriodRes.status, 200);
    assert.strictEqual(octPeriodRes.body.total, 3);
    const octPeriodMeta = octPeriodRes.body.period as Record<string, unknown>;
    assert.strictEqual(octPeriodMeta.isDateFiltered, true);
    assert.strictEqual(octPeriodMeta.reportingMode, 'period');
    const octSummary = octPeriodRes.body.summary as Record<string, unknown>;
    assert.strictEqual(octSummary.materialPurchaseCosts, 60000);
    assert.strictEqual(octSummary.otherProjectExpenses, 82500);
    assert.strictEqual(octSummary.totalProjectCosts, 142500);

    console.log(
      '6. Testing Individual Project Report, Date-Wise Cost History, CSV Export & PDF Export...',
    );

    const detailRes = await jsonReq(
      baseUrl,
      'GET',
      `/api/reports/projects/${p4BothLoss.projectId}`,
      { token: adminToken },
    );
    assert.strictEqual(detailRes.status, 200);
    const detailOverview = detailRes.body.financialOverview as Record<
      string,
      Record<string, unknown>
    >;
    assert.strictEqual(detailOverview.lifetime.contractValue, 80000);
    assert.strictEqual(detailOverview.lifetime.materialPurchaseCosts, 60000);
    assert.strictEqual(detailOverview.lifetime.otherProjectExpenses, 35000);
    assert.strictEqual(detailOverview.lifetime.totalProjectCosts, 95000);
    assert.strictEqual(detailOverview.lifetime.estimatedProfit, -15000);
    assert.strictEqual(detailOverview.lifetime.profitMargin, -18.75);
    assert.strictEqual(detailOverview.lifetime.costPercentage, 118.75);

    const excludedCounts = detailRes.body.excludedCounts as Record<
      string,
      number
    >;
    assert.strictEqual(excludedCounts.cancelledPurchases, 1);
    assert.strictEqual(excludedCounts.cancelledExpenses, 1);

    const dateWise = detailRes.body.dateWiseCostHistory as Array<
      Record<string, unknown>
    >;
    assert.strictEqual(dateWise.length, 2);
    assert.strictEqual(dateWise[0].date, '2026-10-18');
    assert.strictEqual(dateWise[0].purchaseCosts, 60000);
    assert.strictEqual(dateWise[0].otherExpenses, 0);
    assert.strictEqual(dateWise[0].cumulativeCosts, 60000);
    assert.strictEqual(dateWise[1].date, '2026-10-20');
    assert.strictEqual(dateWise[1].purchaseCosts, 0);
    assert.strictEqual(dateWise[1].otherExpenses, 35000);
    assert.strictEqual(dateWise[1].cumulativeCosts, 95000);

    const detailPeriodRes = await jsonReq(
      baseUrl,
      'GET',
      `/api/reports/projects/${p4BothLoss.projectId}?fromDate=2026-10-20&toDate=2026-10-25`,
      { token: adminToken },
    );
    assert.strictEqual(detailPeriodRes.status, 200);
    const periodBlock = (
      detailPeriodRes.body.financialOverview as Record<
        string,
        Record<string, unknown>
      >
    ).selectedPeriod;
    assert.strictEqual(periodBlock.materialPurchaseCosts, 0);
    assert.strictEqual(periodBlock.otherProjectExpenses, 35000);
    assert.strictEqual(periodBlock.totalProjectCosts, 35000);
    assert.strictEqual(
      (
        detailPeriodRes.body.financialOverview as Record<
          string,
          Record<string, unknown>
        >
      ).lifetime.totalProjectCosts,
      95000,
    );

    const csvRes = await fetch(
      `${baseUrl}/api/reports/projects/export?status=all`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert.strictEqual(csvRes.status, 200);
    assert.ok(
      (csvRes.headers.get('content-type') || '').includes('text/csv'),
    );
    const csvText = await csvRes.text();
    assert.ok(csvText.includes(p4BothLoss.projectId));
    assert.ok(csvText.includes('SUMMARY TOTALS'));
    assert.ok(csvText.includes('176500.00'));
    assert.ok(csvText.includes('173500.00'));

    const pdfRes = await fetch(
      `${baseUrl}/api/reports/projects/${p4BothLoss.projectId}/pdf`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    assert.strictEqual(pdfRes.status, 200);
    assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfAscii = pdfBuffer.toString('ascii');
    assert.ok(pdfAscii.startsWith('%PDF-1.4'));
    assert.ok(pdfAscii.includes(p4BothLoss.projectId));
    assert.ok(pdfAscii.includes('95,000.00'));
    assert.ok(pdfAscii.trim().endsWith('%%EOF'));

    const missingDetailRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/reports/projects/PRJ-9999',
      { token: adminToken },
    );
    assert.strictEqual(missingDetailRes.status, 404);

    console.log(
      '✓ Individual project report, date-wise buckets, CSV export & PDF export verified.',
    );
    console.log(
      '=== ALL PROJECT COST & PROFITABILITY REPORT TESTS PASSED ===',
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Reports Test Suite Failed:', err);
    process.exit(1);
  });
