import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import app from '../../../index';
import { generateToken } from '../../../middleware/auth';
import { sharedActivityMemoryStore } from '../../activity/models/activity.model';
import { sharedUserMemoryStore } from '../../auth/models/user.model';
import { sharedExpenseVoucherMemoryStore } from '../../expenses';
import { sharedProjectMemoryStore } from '../../projects';
import { sharedPurchaseVoucherMemoryStore } from '../../purchases';
import { sharedRawMaterialMemoryStore } from '../../raw-materials';
import { sharedAppSettingsMemoryStore } from '../../settings/models/app-settings.model';
import {
  DEFAULT_DATA_ENTRY_PERMISSIONS,
  PERMISSION_KEYS,
} from '../constants/permissions.constants';
import { sharedRolePermissionMemoryStore } from '../models/role-permission.model';
import { permissionService } from '../service/permission.service';

interface JsonResponse {
  status: number;
  body: Record<string, unknown>;
}

async function sendJson(
  baseUrl: string,
  method: string,
  endpoint: string,
  options: {
    token?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
): Promise<JsonResponse> {
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text };
  }

  return { status: res.status, body: parsed };
}

function resetStores(): void {
  sharedUserMemoryStore.clear();
  sharedProjectMemoryStore.clear();
  sharedPurchaseVoucherMemoryStore.clear();
  sharedExpenseVoucherMemoryStore.clear();
  sharedRawMaterialMemoryStore.clear();
  sharedActivityMemoryStore.clear();
  sharedRolePermissionMemoryStore.clear();
  sharedAppSettingsMemoryStore.clear();
  permissionService.invalidateCache();
}

async function runRbacVerificationSuite(): Promise<void> {
  console.log('=== Starting Complete RBAC, Permissions & Settings Test Suite ===');
  resetStores();

  const passwordHash = await bcrypt.hash('SafeWorkshopPass123!', 10);
  const now = new Date();

  const adminId = '507f1f77bcf86cd799439081';
  const operatorAId = '507f1f77bcf86cd799439082';
  const operatorBId = '507f1f77bcf86cd799439083';

  sharedUserMemoryStore.set('rbac.admin@softtouch.local', {
    _id: adminId as unknown as never,
    name: 'Chief Studio Admin',
    email: 'rbac.admin@softtouch.local',
    password: passwordHash,
    phone: '+91 9847000001',
    role: 'admin',
    isActive: true,
    approvalStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  } as never);

  sharedUserMemoryStore.set('riya.operator@softtouch.local', {
    _id: operatorAId as unknown as never,
    name: 'Riya Data Operator',
    email: 'riya.operator@softtouch.local',
    password: passwordHash,
    phone: '+91 9847000002',
    role: 'data_entry',
    isActive: true,
    approvalStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  } as never);

  sharedUserMemoryStore.set('nikhil.operator@softtouch.local', {
    _id: operatorBId as unknown as never,
    name: 'Nikhil Scoped Operator',
    email: 'nikhil.operator@softtouch.local',
    password: passwordHash,
    role: 'data_entry',
    isActive: true,
    approvalStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  } as never);

  const server = app.listen(0);
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    console.log('1. Verifying Admin & Data Entry login payloads and /api/auth/me...');
    const adminLogin = await sendJson(baseUrl, 'POST', '/api/auth/login', {
      body: {
        email: 'rbac.admin@softtouch.local',
        password: 'SafeWorkshopPass123!',
      },
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = String(adminLogin.body.token);
    const adminUserPayload = adminLogin.body.user as Record<string, unknown>;
    assert.equal(
      (adminUserPayload.permissions as string[]).length,
      PERMISSION_KEYS.length,
    );

    const opLogin = await sendJson(baseUrl, 'POST', '/api/auth/login', {
      body: {
        email: 'riya.operator@softtouch.local',
        password: 'SafeWorkshopPass123!',
      },
    });
    assert.equal(opLogin.status, 200);
    const operatorAToken = String(opLogin.body.token);
    const opUserPayload = opLogin.body.user as Record<string, unknown>;
    assert.deepEqual(
      opUserPayload.permissions,
      [...DEFAULT_DATA_ENTRY_PERMISSIONS],
    );

    const operatorBToken = generateToken({
      id: operatorBId,
      email: 'nikhil.operator@softtouch.local',
      role: 'data_entry',
      name: 'Nikhil Scoped Operator',
      approvalStatus: 'approved',
    });

    console.log('2. Seeding projects, materials, purchases, and expenses...');
    const projARes = await sendJson(baseUrl, 'POST', '/api/projects', {
      token: adminToken,
      body: {
        name: 'Emerald Villa Lounge',
        clientName: 'Menon Residence',
        category: 'Modular Sofa',
        contractValue: 320000,
        status: 'In Progress',
      },
    });
    assert.equal(projARes.status, 201);
    const projectA = projARes.body.project as Record<string, unknown>;
    const projectAId = String(projectA.id);
    const projectACode = String(projectA.projectId);

    const projBRes = await sendJson(baseUrl, 'POST', '/api/projects', {
      token: adminToken,
      body: {
        name: 'Harbour Penthouse Curtains',
        clientName: 'Kochi Marine Suites',
        category: 'Curtains',
        contractValue: 180000,
        status: 'In Progress',
      },
    });
    assert.equal(projBRes.status, 201);
    const projectB = projBRes.body.project as Record<string, unknown>;
    const projectBId = String(projectB.id);

    const matForbiddenRes = await sendJson(baseUrl, 'POST', '/api/raw-materials', {
      token: operatorAToken,
      body: {
        name: 'Belgian Linen Oatmeal',
        category: 'Upholstery',
        unit: 'Meter',
      },
    });
    assert.equal(matForbiddenRes.status, 403);

    const matRes = await sendJson(baseUrl, 'POST', '/api/raw-materials', {
      token: adminToken,
      body: {
        name: 'Belgian Linen Oatmeal',
        category: 'Upholstery',
        unit: 'Meter',
        quantityOnHand: 40,
        minStockLevel: 10,
        description: 'Premium woven upholstery linen',
      },
    });
    assert.equal(matRes.status, 201);
    const materialDoc = (matRes.body.rawMaterial ||
      matRes.body.material) as Record<string, unknown>;
    const materialId = String(materialDoc.id);

    const catListRes = await sendJson(
      baseUrl,
      'GET',
      '/api/expenses/categories',
      { token: operatorAToken },
    );
    assert.equal(catListRes.status, 200);
    const categories = catListRes.body.categories as Array<{
      id: string;
      name: string;
    }>;
    const transportCategoryId = String(
      categories.find((c) => c.name === 'Transportation')?.id ||
        categories[0]?.id,
    );

    const purARes = await sendJson(baseUrl, 'POST', '/api/purchases', {
      token: operatorAToken,
      body: {
        purchaseDate: '2026-10-12',
        supplierName: 'LoomCraft India',
        supplierInvoiceNumber: 'LC-2026-101',
        projectId: projectAId,
        clientRequestId: 'rbac-pur-a-1',
        lineItems: [
          {
            materialId,
            quantity: 12,
            unitPrice: 2000,
          },
        ],
      },
    });
    assert.equal(purARes.status, 201);
    const voucherAId = String((purARes.body.voucher as Record<string, unknown>).id);

    const purBRes = await sendJson(baseUrl, 'POST', '/api/purchases', {
      token: adminToken,
      body: {
        purchaseDate: '2026-10-14',
        supplierName: 'LoomCraft India',
        supplierInvoiceNumber: 'LC-2026-102',
        projectId: projectBId,
        clientRequestId: 'rbac-pur-b-1',
        lineItems: [
          {
            materialId,
            quantity: 8,
            unitPrice: 2000,
          },
        ],
      },
    });
    assert.equal(purBRes.status, 201);
    const voucherBId = String((purBRes.body.voucher as Record<string, unknown>).id);

    const expARes = await sendJson(baseUrl, 'POST', '/api/expenses', {
      token: operatorAToken,
      body: {
        expenseDate: '2026-10-15',
        categoryId: transportCategoryId,
        amount: 1800,
        description: 'Metro Van Logistics site delivery',
        projectId: projectAId,
        clientRequestId: 'rbac-exp-a-seed',
      },
    });
    assert.equal(expARes.status, 201);

    console.log('3. Verifying Data Entry route enforcement & confidential financial redaction...');
    for (const [method, endpoint] of [
      ['GET', '/api/users'],
      ['GET', '/api/users/approvals'],
      ['GET', '/api/permissions'],
      ['GET', '/api/settings'],
      ['GET', '/api/reports/projects'],
      ['GET', `/api/reports/projects/${projectACode}`],
      ['GET', `/api/projects/${projectACode}/financial-summary`],
      ['DELETE', `/api/projects/${projectACode}`],
      ['DELETE', `/api/purchases/${voucherAId}`],
    ] as const) {
      const denied = await sendJson(baseUrl, method, endpoint, {
        token: operatorAToken,
      });
      assert.equal(
        denied.status,
        403,
        `Expected ${method} ${endpoint} to return 403 for default data_entry`,
      );
    }

    const opProjectsList = await sendJson(baseUrl, 'GET', '/api/projects', {
      token: operatorAToken,
    });
    assert.equal(opProjectsList.status, 200);
    const listedProjects = opProjectsList.body.projects as Array<Record<string, unknown>>;
    assert.equal(listedProjects.length, 2);
    for (const proj of listedProjects) {
      assert.equal(proj.contractValue, null);
      assert.equal(proj.estimatedProfit, null);
      assert.equal(proj.estimatedProfitMargin, null);
      assert.equal(proj.costPercentage, null);
      assert.equal(proj.financialsRedacted, true);
    }

    const opDashboard = await sendJson(baseUrl, 'GET', '/api/dashboard/overview', {
      token: operatorAToken,
    });
    assert.equal(opDashboard.status, 200);
    assert.equal(opDashboard.body.mode, 'operational');
    assert.equal(opDashboard.body.kpis, null);
    assert.equal(opDashboard.body.projectPerformance, null);
    assert.equal(opDashboard.body.monthlyExpenses, null);
    assert.equal(opDashboard.body.pendingApprovals, null);
    assert.ok(opDashboard.body.operational);

    const adminDashboard = await sendJson(baseUrl, 'GET', '/api/dashboard/overview', {
      token: adminToken,
    });
    assert.equal(adminDashboard.status, 200);
    assert.equal(adminDashboard.body.mode, 'executive');
    assert.ok(adminDashboard.body.kpis);
    assert.ok(adminDashboard.body.projectPerformance);

    const opRecentActivity = await sendJson(baseUrl, 'GET', '/api/activities/recent', {
      token: operatorAToken,
    });
    assert.equal(opRecentActivity.status, 200);
    assert.equal(opRecentActivity.body.scope, 'own');
    const opActivities = opRecentActivity.body.items as Array<Record<string, unknown>>;
    assert.ok(opActivities.length >= 2);
    assert.ok(opActivities.every((entry) => entry.actorId === operatorAId));

    console.log('4. Verifying Admin Role Baseline update, dependency rules & instant enforcement...');
    const reservedRoleAttempt = await sendJson(
      baseUrl,
      'PUT',
      '/api/permissions/roles/data_entry',
      {
        token: adminToken,
        body: {
          permissions: [...DEFAULT_DATA_ENTRY_PERMISSIONS, 'permissions.manage'],
        },
      },
    );
    assert.equal(reservedRoleAttempt.status, 400);

    const updatedRoleBaseline = DEFAULT_DATA_ENTRY_PERMISSIONS.filter(
      (perm) => perm !== 'expenses.create',
    ).concat(['reports.view']);

    const roleUpdateRes = await sendJson(
      baseUrl,
      'PUT',
      '/api/permissions/roles/data_entry',
      {
        token: adminToken,
        body: {
          permissions: updatedRoleBaseline,
        },
      },
    );
    assert.equal(roleUpdateRes.status, 200);
    const savedRoles = roleUpdateRes.body.roles as {
      data_entry: { permissions: string[] };
    };
    assert.equal(savedRoles.data_entry.permissions.includes('expenses.create'), false);
    assert.equal(savedRoles.data_entry.permissions.includes('reports.view'), true);

    const blockedExpenseCreate = await sendJson(baseUrl, 'POST', '/api/expenses', {
      token: operatorAToken,
      body: {
        expenseDate: '2026-10-16',
        categoryId: transportCategoryId,
        amount: 2500,
        description: 'Kerala Cargo Movers',
        projectId: projectAId,
        clientRequestId: 'rbac-exp-blocked-1',
      },
    });
    assert.equal(blockedExpenseCreate.status, 403);

    const newlyAllowedReports = await sendJson(
      baseUrl,
      'GET',
      '/api/reports/projects',
      { token: operatorAToken },
    );
    assert.equal(newlyAllowedReports.status, 200);
    const reportSummary = newlyAllowedReports.body.summary as Record<string, unknown>;
    assert.equal(reportSummary.contractValue, null);
    assert.equal(reportSummary.estimatedProfit, null);
    assert.equal(reportSummary.profitabilityRedacted, true);

    console.log('5. Verifying per-user overrides, revocation precedence & assignedProjectIds scoping...');
    const reservedUserGrantAttempt = await sendJson(
      baseUrl,
      'PUT',
      `/api/permissions/users/${operatorBId}`,
      {
        token: adminToken,
        body: {
          grant: ['settings.manage'],
          revoke: [],
          assignedProjectIds: null,
        },
      },
    );
    assert.equal(reservedUserGrantAttempt.status, 400);

    const userOverrideRes = await sendJson(
      baseUrl,
      'PUT',
      `/api/permissions/users/${operatorBId}`,
      {
        token: adminToken,
        body: {
          grant: ['expenses.create', 'purchases.create'],
          revoke: ['purchases.create'],
          assignedProjectIds: [projectAId],
        },
      },
    );
    assert.equal(userOverrideRes.status, 200);
    const effectiveList = userOverrideRes.body.effectivePermissions as string[];
    assert.equal(effectiveList.includes('expenses.create'), true);
    assert.equal(effectiveList.includes('purchases.create'), false);

    const scopedProjectsRes = await sendJson(baseUrl, 'GET', '/api/projects', {
      token: operatorBToken,
    });
    assert.equal(scopedProjectsRes.status, 200);
    const scopedProjects = scopedProjectsRes.body.projects as Array<Record<string, unknown>>;
    assert.equal(scopedProjects.length, 1);
    assert.equal(scopedProjects[0].id, projectAId);

    const forbiddenUnassignedProject = await sendJson(
      baseUrl,
      'GET',
      `/api/projects/${projectBId}`,
      { token: operatorBToken },
    );
    assert.equal(forbiddenUnassignedProject.status, 403);

    const forbiddenUnassignedVoucher = await sendJson(
      baseUrl,
      'GET',
      `/api/purchases/${voucherBId}`,
      { token: operatorBToken },
    );
    assert.equal(forbiddenUnassignedVoucher.status, 403);

    const allowedScopedExpense = await sendJson(baseUrl, 'POST', '/api/expenses', {
      token: operatorBToken,
      body: {
        expenseDate: '2026-10-17',
        categoryId: transportCategoryId,
        amount: 3200,
        description: 'Installation Crew transport',
        projectId: projectAId,
        clientRequestId: 'rbac-exp-scoped-a',
      },
    });
    assert.equal(allowedScopedExpense.status, 201);

    const forbiddenUnassignedExpense = await sendJson(
      baseUrl,
      'POST',
      '/api/expenses',
      {
        token: operatorBToken,
        body: {
          expenseDate: '2026-10-17',
          categoryId: transportCategoryId,
          amount: 3200,
          description: 'Installation Crew transport',
          projectId: projectBId,
          clientRequestId: 'rbac-exp-scoped-b',
        },
      },
    );
    assert.equal(forbiddenUnassignedExpense.status, 403);

    const revokedPurchaseAttempt = await sendJson(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: operatorBToken,
        body: {
          purchaseDate: '2026-10-17',
          supplierName: 'LoomCraft India',
          supplierInvoiceNumber: 'LC-2026-999',
          projectId: projectAId,
          clientRequestId: 'rbac-pur-revoked-b',
          lineItems: [{ materialId, quantity: 1, unitPrice: 2000 }],
        },
      },
    );
    assert.equal(revokedPurchaseAttempt.status, 403);

    const adminSelfLockoutAttempt = await sendJson(
      baseUrl,
      'PUT',
      `/api/permissions/users/${adminId}`,
      {
        token: adminToken,
        body: {
          grant: [],
          revoke: ['permissions.manage'],
        },
      },
    );
    assert.equal(adminSelfLockoutAttempt.status, 400);

    console.log('6. Verifying Restore Defaults & self-elevation prevention...');
    const resetRes = await sendJson(
      baseUrl,
      'POST',
      '/api/permissions/roles/data_entry/reset',
      { token: adminToken },
    );
    assert.equal(resetRes.status, 200);
    const resetRoles = resetRes.body.roles as {
      data_entry: { permissions: string[] };
    };
    assert.deepEqual(
      resetRoles.data_entry.permissions,
      [...DEFAULT_DATA_ENTRY_PERMISSIONS],
    );

    const selfElevationAttempt = await sendJson(baseUrl, 'PATCH', '/api/auth/me', {
      token: operatorAToken,
      body: {
        name: 'Tampered Admin',
        role: 'admin',
        permissions: ['permissions.manage'],
      },
    });
    assert.equal(selfElevationAttempt.status, 403);
    assert.equal(selfElevationAttempt.body.code, 'SELF_ELEVATION_FORBIDDEN');

    const safeProfileUpdate = await sendJson(baseUrl, 'PATCH', '/api/auth/me', {
      token: operatorAToken,
      body: {
        name: 'Riya Senior Operator',
        phone: '+91 9847999999',
      },
    });
    assert.equal(safeProfileUpdate.status, 200);
    assert.equal(
      (safeProfileUpdate.body.user as Record<string, unknown>).name,
      'Riya Senior Operator',
    );
    assert.equal(
      (safeProfileUpdate.body.user as Record<string, unknown>).role,
      'data_entry',
    );

    const signupElevationAttempt = await sendJson(
      baseUrl,
      'POST',
      '/api/auth/signup',
      {
        body: {
          name: 'External Applicant',
          email: 'applicant.tamper@softtouch.local',
          password: 'SafeWorkshopPass123!',
          role: 'admin',
          permissions: ['permissions.manage'],
        },
      },
    );
    assert.equal(signupElevationAttempt.status, 201);
    const createdApplicant = signupElevationAttempt.body.user as Record<string, unknown>;
    assert.equal(createdApplicant.role, 'data_entry');
    assert.equal(createdApplicant.approvalStatus, 'pending');

    console.log('7. Verifying Application Settings persistence & RBAC audit trail...');
    const updateSettingsRes = await sendJson(baseUrl, 'PUT', '/api/settings', {
      token: adminToken,
      body: {
        companyName: 'Soft Touch Bespoke Studio',
        workshopLocation: 'Chalakudy, Kerala',
        defaultCostWarningPercent: 85,
      },
    });
    assert.equal(updateSettingsRes.status, 200);
    const savedSettings = updateSettingsRes.body.settings as Record<string, unknown>;
    assert.equal(savedSettings.companyName, 'Soft Touch Bespoke Studio');
    assert.equal(savedSettings.defaultCostWarningPercent, 85);

    const adminAuditRes = await sendJson(baseUrl, 'GET', '/api/activities?limit=30', {
      token: adminToken,
    });
    assert.equal(adminAuditRes.status, 200);
    const auditItems = adminAuditRes.body.items as Array<Record<string, unknown>>;
    assert.ok(auditItems.some((i) => i.actionType === 'permissions.updated'));
    assert.ok(auditItems.some((i) => i.actionType === 'permissions.user_overridden'));
    assert.ok(auditItems.some((i) => i.actionType === 'permissions.reset'));
    assert.ok(auditItems.some((i) => i.actionType === 'settings.updated'));

    console.log('=== ALL 12 RBAC & PERMISSION VERIFICATION SCENARIOS PASSED ===');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runRbacVerificationSuite()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('RBAC verification suite failed:', error);
    process.exit(1);
  });
