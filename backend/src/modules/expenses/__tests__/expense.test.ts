process.env.NODE_ENV = 'test';

import assert from 'assert';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import app from '../../../index';
import { generateToken } from '../../../middleware/auth';
import { sharedUserMemoryStore } from '../../auth/models/user.model';
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
  DEFAULT_EXPENSE_CATEGORIES,
  registerExpenseProjectFinancialIntegration,
  sharedExpenseCategoryMemoryStore,
  sharedExpenseCounterMemoryStore,
  sharedExpenseVoucherMemoryStore,
  validateCreateExpenseCategoryDto,
  validateCreateExpenseVoucherDto,
  validateListExpenseVouchersDto,
  validateUpdateExpenseVoucherDto,
} from '../index';

function buildMinimalPngBuffer(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

function buildMinimalPdfBuffer(): Buffer {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n107\n%%EOF\n',
    'ascii',
  );
}

async function jsonReq(
  baseUrl: string,
  method: string,
  urlPath: string,
  options: {
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers || {}),
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
  console.log('--- Starting Expense Management Module Test Suite ---');

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

  console.log('1. Testing Expense DTO validation & mass-assignment guards...');

  const badMassAssign = validateCreateExpenseVoucherDto({
    voucherNumber: 'EXP-9999',
    expenseDate: '2026-10-29',
    categoryId: 'cat-1',
    amount: 500,
    description: 'Workshop delivery',
  });
  assert.strictEqual(badMassAssign.isValid, false);
  assert.ok(badMassAssign.errors?.voucherNumber);

  const zeroAmount = validateCreateExpenseVoucherDto({
    expenseDate: '2026-10-29',
    categoryId: 'cat-1',
    amount: 0,
    description: 'Zero test',
  });
  assert.strictEqual(zeroAmount.isValid, false);
  assert.ok(zeroAmount.errors?.amount);

  const negativeAmount = validateCreateExpenseVoucherDto({
    expenseDate: '2026-10-29',
    categoryId: 'cat-1',
    amount: -120,
    description: 'Negative test',
  });
  assert.strictEqual(negativeAmount.isValid, false);
  assert.ok(negativeAmount.errors?.amount);

  const validExpenseDto = validateCreateExpenseVoucherDto({
    expenseDate: '2026-10-29',
    categoryId: 'cat-1',
    amount: '1450.556',
    description: '  Tempo   freight   to Kakkanad  ',
  });
  assert.strictEqual(validExpenseDto.isValid, true);
  assert.strictEqual(validExpenseDto.value?.amount, 1450.56);
  assert.strictEqual(
    validExpenseDto.value?.description,
    'Tempo freight to Kakkanad',
  );

  const badCategoryDto = validateCreateExpenseCategoryDto({
    name: ' ',
  });
  assert.strictEqual(badCategoryDto.isValid, false);

  const badUpdateDto = validateUpdateExpenseVoucherDto({
    status: 'cancelled',
  });
  assert.strictEqual(badUpdateDto.isValid, false);

  const badDateRangeDto = validateListExpenseVouchersDto({
    fromDate: '2026-10-30',
    toDate: '2026-10-01',
  });
  assert.strictEqual(badDateRangeDto.isValid, false);

  console.log('✓ DTO & mass-assignment checks passed.');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const adminId = '507f1f77bcf86cd799439091';
    const operatorId = '507f1f77bcf86cd799439092';
    const pendingId = '507f1f77bcf86cd799439093';

    sharedUserMemoryStore.set(adminId, {
      _id: adminId,
      name: 'Workshop Admin',
      email: 'admin@softtouch.test',
      role: 'admin',
      isActive: true,
      approvalStatus: 'approved',
    });

    sharedUserMemoryStore.set(operatorId, {
      _id: operatorId,
      name: 'Data Entry Staff',
      email: 'operator@softtouch.test',
      role: 'data_entry',
      isActive: true,
      approvalStatus: 'approved',
    });

    sharedUserMemoryStore.set(pendingId, {
      _id: pendingId,
      name: 'Pending Operator',
      email: 'pending@softtouch.test',
      role: 'data_entry',
      isActive: true,
      approvalStatus: 'pending',
    });

    const adminToken = generateToken({
      id: adminId,
      email: 'admin@softtouch.test',
      name: 'Workshop Admin',
      role: 'admin',
      approvalStatus: 'approved',
    });

    const operatorToken = generateToken({
      id: operatorId,
      email: 'operator@softtouch.test',
      name: 'Data Entry Staff',
      role: 'data_entry',
      approvalStatus: 'approved',
    });

    const pendingToken = generateToken({
      id: pendingId,
      email: 'pending@softtouch.test',
      name: 'Pending Operator',
      role: 'data_entry',
      approvalStatus: 'pending',
    });

    console.log(
      '2. Testing default categories, duplicate prevention & RBAC...',
    );

    const unauthRes = await jsonReq(baseUrl, 'GET', '/api/expenses');
    assert.strictEqual(unauthRes.status, 401);

    const pendingRes = await jsonReq(baseUrl, 'GET', '/api/expenses', {
      token: pendingToken,
    });
    assert.strictEqual(pendingRes.status, 403);

    const catListRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/expenses/categories',
      { token: operatorToken },
    );
    assert.strictEqual(catListRes.status, 200);
    const initialCategories = catListRes.body.categories as Array<{
      id: string;
      name: string;
      isDefault: boolean;
      isActive: boolean;
    }>;
    assert.strictEqual(initialCategories.length, DEFAULT_EXPENSE_CATEGORIES.length);
    for (const expected of [
      'Transportation',
      'Labour',
      'Installation',
      'Repairs',
      'Miscellaneous',
    ]) {
      assert.ok(
        initialCategories.some((c) => c.name === expected),
        `Expected seeded category ${expected}`,
      );
    }

    const operatorCreateCat = await jsonReq(
      baseUrl,
      'POST',
      '/api/expenses/categories',
      {
        token: operatorToken,
        body: { name: ' Showroom Tea ' },
      },
    );
    assert.strictEqual(operatorCreateCat.status, 403);

    const dupSeedCat = await jsonReq(
      baseUrl,
      'POST',
      '/api/expenses/categories',
      {
        token: adminToken,
        body: { name: '  transportation  ' },
      },
    );
    assert.strictEqual(dupSeedCat.status, 409);

    const adminCreateCat = await jsonReq(
      baseUrl,
      'POST',
      '/api/expenses/categories',
      {
        token: adminToken,
        body: {
          name: '  Packaging & Wrapping ',
          description: 'Bubble wrap and protective covers',
        },
      },
    );
    assert.strictEqual(adminCreateCat.status, 201);
    const packagingCat = adminCreateCat.body.category as {
      id: string;
      name: string;
    };
    assert.strictEqual(packagingCat.name, 'Packaging & Wrapping');

    const dupCustomCat = await jsonReq(
      baseUrl,
      'POST',
      '/api/expenses/categories',
      {
        token: adminToken,
        body: { name: 'PACKAGING & WRAPPING' },
      },
    );
    assert.strictEqual(dupCustomCat.status, 409);

    console.log(
      '3. Setting up Projects & Purchase Voucher to verify zero double-counting...',
    );

    const projARes = await jsonReq(baseUrl, 'POST', '/api/projects', {
      token: adminToken,
      body: {
        name: 'Luxury L-Sofa Villa Project',
        clientName: 'Mr. Menon',
        category: 'Modular Sofa',
        contractValue: 100000,
      },
    });
    assert.strictEqual(projARes.status, 201);
    const projectA = projARes.body.project as {
      id: string;
      projectId: string;
    };

    const projBRes = await jsonReq(baseUrl, 'POST', '/api/projects', {
      token: adminToken,
      body: {
        name: 'Penthouse Drapery & Headboard',
        clientName: 'Mrs. Nair',
        category: 'Curtains',
        contractValue: 50000,
      },
    });
    assert.strictEqual(projBRes.status, 201);
    const projectB = projBRes.body.project as {
      id: string;
      projectId: string;
    };

    const purchaseRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: adminToken,
      body: {
        purchaseDate: '2026-10-15',
        supplierName: 'Kochi Foam & Fabric',
        projectId: projectA.id,
        lineItems: [
          {
            newMaterial: {
              name: '40D HR Sofa Foam',
              category: 'Foam',
              unit: 'Sheet',
            },
            quantity: 10,
            unitPrice: 2000,
          },
        ],
      },
    });
    assert.strictEqual(purchaseRes.status, 201);

    const projAAfterPurchase = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectA.id}`,
      { token: adminToken },
    );
    assert.strictEqual(projAAfterPurchase.status, 200);
    const pA1 = projAAfterPurchase.body.project as Record<string, unknown>;
    assert.strictEqual(pA1.totalPurchases, 20000);
    assert.strictEqual(pA1.totalOtherExpenses, 0);
    assert.strictEqual(pA1.totalCost, 20000);
    assert.strictEqual(pA1.estimatedProfit, 80000);

    const projAFin1 = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectA.id}/financial-summary`,
      { token: adminToken },
    );
    assert.strictEqual(projAFin1.status, 200);
    const integrations1 = projAFin1.body.integrations as Record<
      string,
      boolean
    >;
    assert.strictEqual(integrations1.purchaseModuleIntegrated, true);
    assert.strictEqual(integrations1.expenseModuleIntegrated, true);

    console.log(
      '4. Testing Data Entry expense recording (with & without project) & inline category RBAC...',
    );

    const transportCat = initialCategories.find(
      (c) => c.name === 'Transportation',
    )!;
    const repairsCat = initialCategories.find((c) => c.name === 'Repairs')!;

    const operatorInlineBlocked = await jsonReq(
      baseUrl,
      'POST',
      '/api/expenses',
      {
        token: operatorToken,
        body: {
          expenseDate: '2026-10-20',
          newCategoryName: 'Operator Unauthorized Cat',
          amount: 500,
          description: 'Attempt inline category as operator',
        },
      },
    );
    assert.strictEqual(operatorInlineBlocked.status, 403);

    const expProjectRes = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: operatorToken,
      body: {
        expenseDate: '2026-10-20',
        categoryId: transportCat.id,
        amount: 15000,
        description: 'Tempo delivery of sofa frame & upholstery to Villa',
        projectId: projectA.id,
        clientRequestId: 'idemp-exp-001',
      },
    });
    assert.strictEqual(expProjectRes.status, 201);
    const exp1 = expProjectRes.body.voucher as Record<string, unknown>;
    assert.strictEqual(exp1.voucherNumber, 'EXP-0001');
    assert.strictEqual(exp1.amount, 15000);
    assert.strictEqual(exp1.categoryName, 'Transportation');
    assert.strictEqual(exp1.projectCode, projectA.projectId);
    assert.strictEqual(exp1.hasAttachments, false);

    const expIdempotentRes = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: operatorToken,
      body: {
        expenseDate: '2026-10-20',
        categoryId: transportCat.id,
        amount: 15000,
        description: 'Tempo delivery of sofa frame & upholstery to Villa',
        projectId: projectA.id,
        clientRequestId: 'idemp-exp-001',
      },
    });
    assert.strictEqual(expIdempotentRes.status, 200);
    assert.strictEqual(
      (expIdempotentRes.body.voucher as Record<string, unknown>).id,
      exp1.id,
    );

    const projAAfterExpense = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectA.id}`,
      { token: operatorToken },
    );
    assert.strictEqual(projAAfterExpense.status, 200);
    const pA2 = projAAfterExpense.body.project as Record<string, unknown>;
    assert.strictEqual(pA2.totalPurchases, 20000);
    assert.strictEqual(pA2.totalOtherExpenses, 15000);
    assert.strictEqual(pA2.totalCost, 35000);
    assert.strictEqual(pA2.estimatedProfit, 65000);
    assert.strictEqual(pA2.costPercentage, 35);
    assert.strictEqual(pA2.estimatedProfitMargin, 65);

    const finSummaryRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/projects/financial-summaries',
      { token: adminToken },
    );
    assert.strictEqual(finSummaryRes.status, 200);
    const summaryItems = finSummaryRes.body.items as Array<
      Record<string, unknown>
    >;
    const summaryProjA = summaryItems.find(
      (i) => i.projectId === projectA.projectId,
    )!;
    assert.strictEqual(summaryProjA.totalPurchases, 20000);
    assert.strictEqual(summaryProjA.totalOtherExpenses, 15000);
    assert.strictEqual(summaryProjA.totalCost, 35000);
    assert.strictEqual(summaryProjA.estimatedProfit, 65000);

    const generalExpRes = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: operatorToken,
      body: {
        expenseDate: '2026-10-21',
        categoryId: repairsCat.id,
        amount: 4500,
        description: 'Industrial sewing machine motor servicing',
      },
    });
    assert.strictEqual(generalExpRes.status, 201);
    const expGeneral = generalExpRes.body.voucher as Record<string, unknown>;
    assert.strictEqual(expGeneral.voucherNumber, 'EXP-0002');
    assert.strictEqual(expGeneral.projectRecordId, null);

    const projAUntouched = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectA.id}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (projAUntouched.body.project as Record<string, unknown>).totalCost,
      35000,
    );

    console.log(
      '5. Testing multipart receipt upload (PNG + PDF), inline Admin category creation & streaming...',
    );

    const spoofedForm = new FormData();
    spoofedForm.append(
      'payload',
      JSON.stringify({
        expenseDate: '2026-10-22',
        categoryId: transportCat.id,
        amount: 900,
        description: 'Spoofed receipt test',
      }),
    );
    spoofedForm.append(
      'receipt',
      new Blob([new Uint8Array(Buffer.from('MZ-not-a-valid-image'))], {
        type: 'image/png',
      }),
      'fake-receipt.png',
    );
    const spoofedRes = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: spoofedForm,
    });
    assert.strictEqual(spoofedRes.status, 400);

    const validMultipartForm = new FormData();
    validMultipartForm.append(
      'payload',
      JSON.stringify({
        expenseDate: '2026-10-22',
        newCategoryName: 'Site Crane & Rigging',
        amount: 8500,
        description: 'Penthouse balcony sofa hoisting crane charge',
        projectId: projectB.id,
      }),
    );
    validMultipartForm.append(
      'receipt',
      new Blob([new Uint8Array(buildMinimalPngBuffer())], { type: 'image/png' }),
      'crane-slip.png',
    );
    validMultipartForm.append(
      'receipt',
      new Blob([new Uint8Array(buildMinimalPdfBuffer())], {
        type: 'application/pdf',
      }),
      'crane-tax-receipt.pdf',
    );

    const multipartCreateRes = await fetch(`${baseUrl}/api/expenses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: validMultipartForm,
    });
    assert.strictEqual(multipartCreateRes.status, 201);
    const multipartBody = (await multipartCreateRes.json()) as {
      voucher: {
        id: string;
        voucherNumber: string;
        categoryId: string;
        categoryName: string;
        attachmentCount: number;
        attachments: Array<{
          attachmentId: string;
          mimeType: string;
          viewUrl: string;
          downloadUrl: string;
        }>;
      };
    };
    assert.strictEqual(
      multipartBody.voucher.categoryName,
      'Site Crane & Rigging',
    );
    assert.strictEqual(multipartBody.voucher.attachmentCount, 2);

    const streamRes = await fetch(
      `${baseUrl}${multipartBody.voucher.attachments[0].viewUrl}`,
      {
        headers: { Authorization: `Bearer ${operatorToken}` },
      },
    );
    assert.strictEqual(streamRes.status, 200);
    assert.strictEqual(streamRes.headers.get('content-type'), 'image/png');
    const streamedBytes = Buffer.from(await streamRes.arrayBuffer());
    assert.ok(streamedBytes.length > 20);

    console.log(
      '6. Testing RBAC on edit/cancel, project reassignment, threshold alerts & category rename sync...',
    );

    const operatorEditBlocked = await jsonReq(
      baseUrl,
      'PATCH',
      `/api/expenses/${exp1.id}`,
      {
        token: operatorToken,
        body: { amount: 16000 },
      },
    );
    assert.strictEqual(operatorEditBlocked.status, 403);

    const operatorCancelBlocked = await jsonReq(
      baseUrl,
      'POST',
      `/api/expenses/${exp1.id}/cancel`,
      {
        token: operatorToken,
        body: { reason: 'Operator cancel attempt' },
      },
    );
    assert.strictEqual(operatorCancelBlocked.status, 403);

    const adminEditRes = await jsonReq(
      baseUrl,
      'PATCH',
      `/api/expenses/${exp1.id}`,
      {
        token: adminToken,
        body: {
          amount: 65000,
          description: 'Full villa delivery, unloading & staging crew',
        },
      },
    );
    assert.strictEqual(adminEditRes.status, 200);

    const projAAfterEdit = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectA.id}`,
      { token: adminToken },
    );
    const pA3 = projAAfterEdit.body.project as Record<string, unknown>;
    assert.strictEqual(pA3.totalPurchases, 20000);
    assert.strictEqual(pA3.totalOtherExpenses, 65000);
    assert.strictEqual(pA3.totalCost, 85000);
    assert.strictEqual(pA3.estimatedProfit, 15000);
    const thresholdState = pA3.costThresholdState as Record<string, unknown>;
    assert.strictEqual(thresholdState.warningCrossed, true);
    assert.strictEqual(thresholdState.exceededCrossed, false);

    const reassignRes = await jsonReq(
      baseUrl,
      'PATCH',
      `/api/expenses/${multipartBody.voucher.id}`,
      {
        token: adminToken,
        body: {
          projectId: projectA.id,
          removeAttachmentIds: [
            multipartBody.voucher.attachments[1].attachmentId,
          ],
        },
      },
    );
    assert.strictEqual(reassignRes.status, 200);
    assert.strictEqual(
      (reassignRes.body.voucher as Record<string, unknown>).attachmentCount,
      1,
    );

    const [projAAfterReassign, projBAfterReassign] = await Promise.all([
      jsonReq(baseUrl, 'GET', `/api/projects/${projectA.id}`, {
        token: adminToken,
      }),
      jsonReq(baseUrl, 'GET', `/api/projects/${projectB.id}`, {
        token: adminToken,
      }),
    ]);
    assert.strictEqual(
      (projAAfterReassign.body.project as Record<string, unknown>)
        .totalOtherExpenses,
      73500,
    );
    assert.strictEqual(
      (projBAfterReassign.body.project as Record<string, unknown>)
        .totalOtherExpenses,
      0,
    );

    const renameCatRes = await jsonReq(
      baseUrl,
      'PATCH',
      `/api/expenses/categories/${multipartBody.voucher.categoryId}`,
      {
        token: adminToken,
        body: {
          name: 'Crane & Heavy Rigging',
          isActive: false,
        },
      },
    );
    assert.strictEqual(renameCatRes.status, 200);

    const reloadedExp = await jsonReq(
      baseUrl,
      'GET',
      `/api/expenses/${multipartBody.voucher.id}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (reloadedExp.body.voucher as Record<string, unknown>).categoryName,
      'Crane & Heavy Rigging',
    );

    const operatorCatListAfterDeactivate = await jsonReq(
      baseUrl,
      'GET',
      '/api/expenses/categories',
      { token: operatorToken },
    );
    const activeCatNamesForOperator = (
      operatorCatListAfterDeactivate.body.categories as Array<{ name: string }>
    ).map((c) => c.name);
    assert.ok(!activeCatNamesForOperator.includes('Crane & Heavy Rigging'));

    const cancelRes = await jsonReq(
      baseUrl,
      'POST',
      `/api/expenses/${multipartBody.voucher.id}/cancel`,
      {
        token: adminToken,
        body: { reason: 'Duplicate crane entry' },
      },
    );
    assert.strictEqual(cancelRes.status, 200);

    const projAAfterCancel = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectA.id}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (projAAfterCancel.body.project as Record<string, unknown>)
        .totalOtherExpenses,
      65000,
    );
    assert.strictEqual(
      (projAAfterCancel.body.project as Record<string, unknown>).totalCost,
      85000,
    );

    console.log(
      '7. Testing Completed project lock & /api/expenses filters/summary...',
    );

    const completeProjB = await jsonReq(
      baseUrl,
      'PATCH',
      `/api/projects/${projectB.id}/status`,
      {
        token: adminToken,
        body: { status: 'Completed' },
      },
    );
    assert.strictEqual(completeProjB.status, 200);

    const blockedCompletedExp = await jsonReq(baseUrl, 'POST', '/api/expenses', {
      token: adminToken,
      body: {
        expenseDate: '2026-10-25',
        categoryId: transportCat.id,
        amount: 1200,
        description: 'Post-completion attempt',
        projectId: projectB.id,
      },
    });
    assert.strictEqual(blockedCompletedExp.status, 409);

    const unassignedList = await jsonReq(
      baseUrl,
      'GET',
      '/api/expenses?projectId=unassigned&status=active',
      { token: adminToken },
    );
    assert.strictEqual(unassignedList.status, 200);
    assert.strictEqual(unassignedList.body.total, 1);
    const summaryBlock = unassignedList.body.summary as Record<string, number>;
    assert.strictEqual(summaryBlock.activeCount, 2);
    assert.strictEqual(summaryBlock.cancelledCount, 1);
    assert.strictEqual(summaryBlock.activeTotalAmount, 69500);
    assert.strictEqual(summaryBlock.projectLinkedTotalAmount, 65000);
    assert.strictEqual(summaryBlock.generalTotalAmount, 4500);

    console.log(
      '✓ All HTTP, category, receipt upload, RBAC & project profitability tests passed.',
    );
    console.log('=== ALL EXPENSE MANAGEMENT MODULE TESTS PASSED ===');
  } finally {
    for (const v of sharedExpenseVoucherMemoryStore.values()) {
      for (const att of v.attachments || []) {
        try {
          const storageFile = path.resolve(
            process.cwd(),
            'storage/purchase-bills',
            att.storageKey,
          );
          await fs.unlink(storageFile);
        } catch {
          void 0;
        }
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Expense Management Test Suite Failed:', err);
    process.exit(1);
  });
