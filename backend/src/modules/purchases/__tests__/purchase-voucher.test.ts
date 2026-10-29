process.env.NODE_ENV = 'test';

import assert from 'assert';
import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';
import mongoose from 'mongoose';
import app from '../../../index';
import { generateToken } from '../../../middleware/auth';
import { sharedUserMemoryStore } from '../../auth/models/user.model';
import {
  projectRepository,
  projectService,
  sharedProjectActivityWarningMemoryStore,
  sharedProjectCostAlertMemoryStore,
  sharedProjectCounterMemoryStore,
  sharedProjectMemoryStore,
} from '../../projects';
import {
  rawMaterialsRepository,
  rawMaterialsService,
  sharedRawMaterialMemoryStore,
} from '../../raw-materials';
import {
  billAttachmentStorage,
  LocalProtectedBillStorageService,
  PurchaseVoucherRepository,
  PurchaseVoucherService,
  registerPurchaseProjectFinancialIntegration,
  sharedPurchaseCounterMemoryStore,
  sharedPurchaseStockMovementMemoryStore,
  sharedPurchaseVoucherMemoryStore,
  validateAndInspectBillFile,
  validateCreatePurchaseVoucherDto,
  validateListPurchaseVouchersDto,
  validateUpdatePurchaseVoucherDto,
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
  console.log('--- Starting Purchase Voucher Module Test Suite ---');

  registerPurchaseProjectFinancialIntegration();

  sharedUserMemoryStore.clear();
  sharedRawMaterialMemoryStore.clear();
  sharedProjectMemoryStore.clear();
  sharedProjectCounterMemoryStore.clear();
  sharedProjectCostAlertMemoryStore.clear();
  sharedProjectActivityWarningMemoryStore.clear();
  sharedPurchaseVoucherMemoryStore.clear();
  sharedPurchaseCounterMemoryStore.clear();
  sharedPurchaseStockMovementMemoryStore.clear();

  console.log(
    '1. Testing DTO validation, mass-assignment protection & magic-byte storage checks...',
  );

  const rejectedMassAssign = validateCreatePurchaseVoucherDto({
    voucherNumber: 'PV-9999',
    purchaseDate: '2026-10-20',
    supplierName: 'Kochi Timber House',
    lineItems: [{ materialId: '507f1f77bcf86cd799439011', quantity: 5, unitPrice: 100 }],
  });
  assert.strictEqual(rejectedMassAssign.isValid, false);
  assert.ok(rejectedMassAssign.errors?.voucherNumber);

  const validDto = validateCreatePurchaseVoucherDto({
    purchaseDate: '2026-10-20',
    supplierName: '  Kochi   Timber House ',
    supplierInvoiceNumber: ' INV-2026/009 ',
    lineItems: JSON.stringify([
      {
        materialId: '507f1f77bcf86cd799439011',
        quantity: '12.5',
        unitPrice: '340.50',
      },
    ]),
    discountAmount: '100',
    taxAmount: '250.25',
    otherCharges: '50',
    subtotal: 999999,
    finalTotal: 1,
  });
  assert.strictEqual(validDto.isValid, true);
  assert.strictEqual(validDto.value?.supplierName, 'Kochi Timber House');
  assert.strictEqual(validDto.value?.supplierInvoiceNumber, 'INV-2026/009');
  assert.strictEqual(validDto.value?.lineItems[0].quantity, 12.5);
  assert.strictEqual(validDto.value?.lineItems[0].unitPrice, 340.5);

  const invalidUpdateDto = validateUpdatePurchaseVoucherDto({}, false);
  assert.strictEqual(invalidUpdateDto.isValid, false);

  const invalidListDto = validateListPurchaseVouchersDto({
    fromDate: '2026-10-25',
    toDate: '2026-10-01',
  });
  assert.strictEqual(invalidListDto.isValid, false);
  assert.ok(invalidListDto.errors?.dateRange);

  const pngBytes = buildMinimalPngBuffer();
  const pdfBytes = buildMinimalPdfBuffer();
  const pngCheck = validateAndInspectBillFile({
    originalname: 'invoice_scan.png',
    mimetype: 'image/png',
    size: pngBytes.length,
    buffer: pngBytes,
  });
  assert.strictEqual(pngCheck.detectedMime, 'image/png');

  assert.throws(() =>
    validateAndInspectBillFile({
      originalname: 'spoofed.pdf',
      mimetype: 'application/pdf',
      size: 32,
      buffer: Buffer.from('<script>alert(1)</script>       ', 'utf8'),
    }),
  );

  const tmpStorageDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sts-bill-storage-test-'),
  );
  const isolatedStorage = new LocalProtectedBillStorageService(tmpStorageDir);
  const savedMeta = await isolatedStorage.saveBillFile({
    originalname: '../../evil/../supplier_bill.pdf',
    mimetype: 'application/pdf',
    size: pdfBytes.length,
    buffer: pdfBytes,
  });
  assert.ok(!savedMeta.originalName.includes('..'));
  const readBack = await isolatedStorage.readBillBuffer(savedMeta.storageKey);
  assert.strictEqual(readBack.sizeBytes, pdfBytes.length);
  await isolatedStorage.deleteBillFile(savedMeta.storageKey);
  await fs.rm(tmpStorageDir, { recursive: true, force: true });

  console.log('✓ DTO, mass-assignment & storage magic-byte checks passed.');

  const adminId = new mongoose.Types.ObjectId().toHexString();
  const operatorId = new mongoose.Types.ObjectId().toHexString();
  const pendingId = new mongoose.Types.ObjectId().toHexString();

  sharedUserMemoryStore.set(adminId, {
    _id: adminId,
    name: 'Arjun Menon',
    email: 'admin-pv@softtouchsofas.com',
    role: 'admin',
    isActive: true,
    approvalStatus: 'approved',
  });
  sharedUserMemoryStore.set(operatorId, {
    _id: operatorId,
    name: 'Meera Nair',
    email: 'operator-pv@softtouchsofas.com',
    role: 'data_entry',
    isActive: true,
    approvalStatus: 'approved',
  });
  sharedUserMemoryStore.set(pendingId, {
    _id: pendingId,
    name: 'Pending User',
    email: 'pending-pv@softtouchsofas.com',
    role: 'data_entry',
    isActive: true,
    approvalStatus: 'pending',
  });

  const adminToken = generateToken({
    id: adminId,
    email: 'admin-pv@softtouchsofas.com',
    role: 'admin',
    name: 'Arjun Menon',
    approvalStatus: 'approved',
  });
  const operatorToken = generateToken({
    id: operatorId,
    email: 'operator-pv@softtouchsofas.com',
    role: 'data_entry',
    name: 'Meera Nair',
    approvalStatus: 'approved',
  });
  const pendingToken = generateToken({
    id: pendingId,
    email: 'pending-pv@softtouchsofas.com',
    role: 'data_entry',
    name: 'Pending User',
    approvalStatus: 'pending',
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind ephemeral HTTP server');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    console.log('2. Setting up Raw Materials & Projects via real HTTP APIs...');

    const unauthRes = await jsonReq(baseUrl, 'GET', '/api/purchases');
    assert.strictEqual(unauthRes.status, 401);

    const pendingRes = await jsonReq(baseUrl, 'GET', '/api/purchases', {
      token: pendingToken,
    });
    assert.strictEqual(pendingRes.status, 403);

    const createTeakRes = await jsonReq(baseUrl, 'POST', '/api/raw-materials', {
      token: adminToken,
      body: {
        name: 'Nilambur Teak Frame',
        category: 'Timber',
        unit: 'Running Feet',
      },
    });
    assert.strictEqual(createTeakRes.status, 201);
    const teakMat = createTeakRes.body.rawMaterial as Record<string, unknown>;
    const teakId = String(teakMat.id);
    assert.strictEqual(teakMat.quantityOnHand, 0);

    const createVelvetRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/raw-materials',
      {
        token: adminToken,
        body: {
          name: 'Italian Velvet Sand',
          category: 'Upholstery',
          unit: 'Meter',
        },
      },
    );
    assert.strictEqual(createVelvetRes.status, 201);
    const velvetId = String(
      (createVelvetRes.body.rawMaterial as Record<string, unknown>).id,
    );

    const createFoamRes = await jsonReq(baseUrl, 'POST', '/api/raw-materials', {
      token: adminToken,
      body: {
        name: 'HD Cushion Foam 40D',
        category: 'Foam',
        unit: 'Sheet',
      },
    });
    assert.strictEqual(createFoamRes.status, 201);
    const foamId = String(
      (createFoamRes.body.rawMaterial as Record<string, unknown>).id,
    );

    const createProjARes = await jsonReq(baseUrl, 'POST', '/api/projects', {
      token: adminToken,
      body: {
        name: 'Vazhakkala Penthouse Lounge',
        clientName: 'Dr. Ramesh Kurup',
        category: 'Modular Sofa',
        contractValue: 200000,
      },
    });
    assert.strictEqual(createProjARes.status, 201);
    const projectA = createProjARes.body.project as Record<string, unknown>;
    const projectARecordId = String(projectA.id);
    const projectACode = String(projectA.projectId);

    const createProjBRes = await jsonReq(baseUrl, 'POST', '/api/projects', {
      token: adminToken,
      body: {
        name: 'Panampilly Boutique Curtains',
        clientName: 'Studio Olive',
        category: 'Curtains',
        contractValue: 120000,
      },
    });
    assert.strictEqual(createProjBRes.status, 201);
    const projectBRecordId = String(
      (createProjBRes.body.project as Record<string, unknown>).id,
    );

    console.log(
      '3. Testing manual Purchase Voucher creation, server-side recalculation, stock & project sync...',
    );

    const wrongUnitRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: operatorToken,
      body: {
        purchaseDate: '2026-10-20',
        supplierName: 'Malabar Woods & Veneers',
        projectId: projectARecordId,
        entryMethod: 'manual',
        lineItems: [
          {
            materialId: teakId,
            unit: 'Meter',
            quantity: 10,
            unitPrice: 250,
          },
        ],
      },
    });
    assert.strictEqual(wrongUnitRes.status, 400);

    const manualCreateRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: operatorToken,
      body: {
        purchaseDate: '2026-10-21',
        supplierName: 'Malabar Woods & Veneers',
        supplierInvoiceNumber: 'MWV-2026-104',
        projectId: projectARecordId,
        entryMethod: 'manual',
        lineItems: [
          {
            materialId: teakId,
            quantity: 20,
            unitPrice: 450,
            remarks: 'Kiln dried frame rails',
          },
          {
            materialId: foamId,
            quantity: 8,
            unitPrice: 1250,
          },
        ],
        discountAmount: 500,
        taxAmount: 1710,
        otherCharges: 290,
        subtotal: 1,
        finalTotal: 1,
        notes: 'Delivered to workshop bay 2',
        clientRequestId: 'req-manual-pv-001',
      },
    });
    assert.strictEqual(manualCreateRes.status, 201);
    const pv1 = manualCreateRes.body.voucher as Record<string, unknown>;
    const pv1Id = String(pv1.id);
    assert.strictEqual(pv1.voucherNumber, 'PV-0001');
    assert.strictEqual(pv1.subtotal, 19000);
    assert.strictEqual(pv1.finalTotal, 20500);
    assert.strictEqual(pv1.hasAttachments, false);
    assert.strictEqual(pv1.createdByName, 'Meera Nair');
    assert.strictEqual(pv1.projectCode, projectACode);

    const replayRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: operatorToken,
      body: {
        purchaseDate: '2026-10-21',
        supplierName: 'Malabar Woods & Veneers',
        supplierInvoiceNumber: 'MWV-2026-104',
        projectId: projectARecordId,
        entryMethod: 'manual',
        lineItems: [
          { materialId: teakId, quantity: 20, unitPrice: 450 },
          { materialId: foamId, quantity: 8, unitPrice: 1250 },
        ],
        discountAmount: 500,
        taxAmount: 1710,
        otherCharges: 290,
        clientRequestId: 'req-manual-pv-001',
      },
    });
    assert.strictEqual(replayRes.status, 200);
    assert.strictEqual(replayRes.body.idempotentReplay, true);
    assert.strictEqual(
      (replayRes.body.voucher as Record<string, unknown>).voucherNumber,
      'PV-0001',
    );

    const dupInvRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: adminToken,
      body: {
        purchaseDate: '2026-10-22',
        supplierName: '  malabar woods & veneers ',
        supplierInvoiceNumber: 'mwv-2026-104',
        entryMethod: 'manual',
        lineItems: [{ materialId: teakId, quantity: 5, unitPrice: 450 }],
      },
    });
    assert.strictEqual(dupInvRes.status, 409);

    const teakAfterPv1 = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${teakId}`,
      { token: operatorToken },
    );
    assert.strictEqual(
      (teakAfterPv1.body.rawMaterial as Record<string, unknown>).quantityOnHand,
      20,
    );

    const foamAfterPv1 = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${foamId}`,
      { token: operatorToken },
    );
    assert.strictEqual(
      (foamAfterPv1.body.rawMaterial as Record<string, unknown>).quantityOnHand,
      8,
    );

    const unitChangeBlocked = await jsonReq(
      baseUrl,
      'PATCH',
      `/api/raw-materials/${teakId}`,
      {
        token: adminToken,
        body: { unit: 'Meter' },
      },
    );
    assert.strictEqual(unitChangeBlocked.status, 409);

    const projASummary1 = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectARecordId}/financial-summary`,
      { token: adminToken },
    );
    assert.strictEqual(projASummary1.status, 200);
    const summary1 = projASummary1.body.summary as Record<string, unknown>;
    assert.strictEqual(summary1.totalPurchases, 20500);
    assert.strictEqual(summary1.totalCost, 20500);
    assert.strictEqual(summary1.estimatedProfit, 179500);
    assert.strictEqual(
      (projASummary1.body.integrations as Record<string, unknown>)
        .purchaseModuleIntegrated,
      true,
    );

    console.log(
      '4. Testing multipart bill upload (PNG + PDF), spoofed file rejection & protected attachment streaming...',
    );

    const spoofForm = new FormData();
    spoofForm.set('purchaseDate', '2026-10-23');
    spoofForm.set('supplierName', 'Kochi Fabrics');
    spoofForm.set('entryMethod', 'upload_bill');
    spoofForm.set(
      'lineItems',
      JSON.stringify([{ materialId: velvetId, quantity: 15, unitPrice: 800 }]),
    );
    spoofForm.append(
      'attachments',
      new Blob(['<html>not an image</html>'], { type: 'image/png' }),
      'fake.png',
    );
    const spoofUploadRes = await fetch(`${baseUrl}/api/purchases`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: spoofForm,
    });
    assert.strictEqual(spoofUploadRes.status, 400);

    const billForm = new FormData();
    billForm.set('purchaseDate', '2026-10-23');
    billForm.set('supplierName', 'Cochin Drapery & Fabrics');
    billForm.set('supplierInvoiceNumber', 'CDF-882');
    billForm.set('projectId', projectARecordId);
    billForm.set('entryMethod', 'upload_bill');
    billForm.set(
      'lineItems',
      JSON.stringify([
        {
          materialId: velvetId,
          quantity: 15.5,
          unitPrice: 1200,
          remarks: 'Lot #B42',
        },
      ]),
    );
    billForm.set('taxAmount', '2232');
    billForm.append(
      'attachments',
      new Blob([new Uint8Array(pngBytes)], { type: 'image/png' }),
      'cdf_bill_photo.png',
    );
    billForm.append(
      'attachments',
      new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
      'cdf_tax_invoice.pdf',
    );

    const uploadCreateRes = await fetch(`${baseUrl}/api/purchases`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: billForm,
    });
    assert.strictEqual(uploadCreateRes.status, 201);
    const uploadCreateJson = (await uploadCreateRes.json()) as Record<
      string,
      unknown
    >;
    const pv2 = uploadCreateJson.voucher as Record<string, unknown>;
    const pv2Id = String(pv2.id);
    assert.strictEqual(pv2.voucherNumber, 'PV-0002');
    assert.strictEqual(pv2.subtotal, 18600);
    assert.strictEqual(pv2.finalTotal, 20832);
    assert.strictEqual(pv2.attachmentCount, 2);

    const attachments = pv2.attachments as Array<Record<string, unknown>>;
    const pngAtt = attachments[0];
    const viewPath = String(pngAtt.viewUrl);

    const unauthStream = await fetch(`${baseUrl}${viewPath}`);
    assert.strictEqual(unauthStream.status, 401);

    const authStream = await fetch(`${baseUrl}${viewPath}`, {
      headers: { Authorization: `Bearer ${operatorToken}` },
    });
    assert.strictEqual(authStream.status, 200);
    assert.strictEqual(authStream.headers.get('content-type'), 'image/png');
    assert.strictEqual(
      authStream.headers.get('x-content-type-options'),
      'nosniff',
    );
    assert.ok(
      (authStream.headers.get('cache-control') || '').includes('no-store'),
    );
    const downloadedBytes = Buffer.from(await authStream.arrayBuffer());
    assert.strictEqual(downloadedBytes.equals(pngBytes), true);

    console.log(
      '5. Testing voucher edit (stock delta reversal + project reassignment + late bill attachment)...',
    );

    const lateBillForm = new FormData();
    lateBillForm.set('projectId', projectBRecordId);
    lateBillForm.set(
      'lineItems',
      JSON.stringify([
        { materialId: teakId, quantity: 14, unitPrice: 450 },
        { materialId: velvetId, quantity: 4.5, unitPrice: 1200 },
      ]),
    );
    lateBillForm.set('discountAmount', '200');
    lateBillForm.set('taxAmount', '1000');
    lateBillForm.set('otherCharges', '0');
    lateBillForm.append(
      'attachments',
      new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
      'mwv_late_invoice.pdf',
    );

    const editPv1Res = await fetch(`${baseUrl}/api/purchases/${pv1Id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${operatorToken}` },
      body: lateBillForm,
    });
    assert.strictEqual(editPv1Res.status, 200);
    const editedPv1 = ((await editPv1Res.json()) as Record<string, unknown>)
      .voucher as Record<string, unknown>;
    assert.strictEqual(editedPv1.subtotal, 11700);
    assert.strictEqual(editedPv1.finalTotal, 12500);
    assert.strictEqual(editedPv1.attachmentCount, 1);

    const teakAfterEdit = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${teakId}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (teakAfterEdit.body.rawMaterial as Record<string, unknown>)
        .quantityOnHand,
      14,
    );

    const foamAfterEdit = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${foamId}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (foamAfterEdit.body.rawMaterial as Record<string, unknown>)
        .quantityOnHand,
      0,
    );

    const velvetAfterEdit = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${velvetId}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (velvetAfterEdit.body.rawMaterial as Record<string, unknown>)
        .quantityOnHand,
      20,
    );

    const projAAfterReassign = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectARecordId}/financial-summary`,
      { token: adminToken },
    );
    assert.strictEqual(
      (projAAfterReassign.body.summary as Record<string, unknown>)
        .totalPurchases,
      20832,
    );

    const projBAfterReassign = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectBRecordId}/financial-summary`,
      { token: adminToken },
    );
    assert.strictEqual(
      (projBAfterReassign.body.summary as Record<string, unknown>)
        .totalPurchases,
      12500,
    );

    console.log(
      '6. Testing Completed project lock, RBAC on cancel, stock reversal & concurrency...',
    );

    await jsonReq(
      baseUrl,
      'PATCH',
      `/api/projects/${projectBRecordId}/status`,
      {
        token: adminToken,
        body: { status: 'Completed' },
      },
    );

    const completedProjPurchase = await jsonReq(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: adminToken,
        body: {
          purchaseDate: '2026-10-24',
          supplierName: 'Kochi Hardware Co',
          projectId: projectBRecordId,
          lineItems: [{ materialId: foamId, quantity: 2, unitPrice: 900 }],
        },
      },
    );
    assert.strictEqual(completedProjPurchase.status, 409);

    await jsonReq(
      baseUrl,
      'PATCH',
      `/api/projects/${projectBRecordId}/status`,
      {
        token: adminToken,
        body: { status: 'In Progress' },
      },
    );

    const operatorCancelForbidden = await jsonReq(
      baseUrl,
      'POST',
      `/api/purchases/${pv1Id}/cancel`,
      {
        token: operatorToken,
        body: { reason: 'Entered twice' },
      },
    );
    assert.strictEqual(operatorCancelForbidden.status, 403);

    const adminCancelPv1 = await jsonReq(
      baseUrl,
      'POST',
      `/api/purchases/${pv1Id}/cancel`,
      {
        token: adminToken,
        body: { reason: 'Supplier credit note issued' },
      },
    );
    assert.strictEqual(adminCancelPv1.status, 200);
    assert.strictEqual(
      (adminCancelPv1.body.voucher as Record<string, unknown>).status,
      'cancelled',
    );

    const doubleCancelPv1 = await jsonReq(
      baseUrl,
      'POST',
      `/api/purchases/${pv1Id}/cancel`,
      { token: adminToken },
    );
    assert.strictEqual(doubleCancelPv1.status, 409);

    const teakAfterCancel = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${teakId}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (teakAfterCancel.body.rawMaterial as Record<string, unknown>)
        .quantityOnHand,
      0,
    );

    const velvetAfterCancel = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${velvetId}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (velvetAfterCancel.body.rawMaterial as Record<string, unknown>)
        .quantityOnHand,
      15.5,
    );

    const projBAfterCancel = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectBRecordId}/financial-summary`,
      { token: adminToken },
    );
    assert.strictEqual(
      (projBAfterCancel.body.summary as Record<string, unknown>)
        .totalPurchases,
      0,
    );

    const pv1Details = await jsonReq(
      baseUrl,
      'GET',
      `/api/purchases/${pv1Id}`,
      { token: adminToken },
    );
    assert.strictEqual(pv1Details.status, 200);
    const movements = pv1Details.body.stockMovements as Array<
      Record<string, unknown>
    >;
    assert.ok(movements.length >= 4);
    assert.ok(movements.some((m) => m.movementType === 'purchase_created'));
    assert.ok(movements.some((m) => m.movementType === 'purchase_revised'));
    assert.ok(movements.some((m) => m.movementType === 'purchase_cancelled'));

    const concurrentResults = await Promise.all(
      [1, 2, 3, 4].map((idx) =>
        jsonReq(baseUrl, 'POST', '/api/purchases', {
          token: operatorToken,
          body: {
            purchaseDate: '2026-10-25',
            supplierName: `Concurrent Supplier ${idx}`,
            supplierInvoiceNumber: `CONC-${idx}`,
            lineItems: [{ materialId: foamId, quantity: 3, unitPrice: 1000 }],
          },
        }),
      ),
    );
    for (const r of concurrentResults) {
      assert.strictEqual(r.status, 201);
    }

    const foamAfterConcurrent = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${foamId}`,
      { token: adminToken },
    );
    assert.strictEqual(
      (foamAfterConcurrent.body.rawMaterial as Record<string, unknown>)
        .quantityOnHand,
      12,
    );

    console.log('7. Testing GET /api/purchases search, date, project & status filters...');

    const activeList = await jsonReq(
      baseUrl,
      'GET',
      '/api/purchases?page=1&limit=10',
      { token: operatorToken },
    );
    assert.strictEqual(activeList.status, 200);
    assert.strictEqual(activeList.body.total, 5);

    const searchList = await jsonReq(
      baseUrl,
      'GET',
      '/api/purchases?search=CDF-882',
      { token: operatorToken },
    );
    assert.strictEqual(searchList.status, 200);
    assert.strictEqual(searchList.body.total, 1);

    const projAList = await jsonReq(
      baseUrl,
      'GET',
      `/api/purchases?projectId=${projectARecordId}`,
      { token: operatorToken },
    );
    assert.strictEqual(projAList.status, 200);
    assert.strictEqual(projAList.body.total, 1);

    const cancelledList = await jsonReq(
      baseUrl,
      'GET',
      '/api/purchases?status=cancelled',
      { token: adminToken },
    );
    assert.strictEqual(cancelledList.status, 200);
    assert.strictEqual(cancelledList.body.total, 1);

    console.log(
      '8. Testing inline new Raw Material creation, mixed vouchers, single-count stock, conflicts, rollback, concurrency, edits & cancellation...',
    );

    const createCottonSpongeRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/raw-materials',
      {
        token: adminToken,
        body: {
          name: 'Cotton Sponge',
          category: 'Foam',
          unit: 'Kilogram',
          quantityOnHand: 20,
        },
      },
    );
    assert.strictEqual(createCottonSpongeRes.status, 201);
    const cottonSpongeId = String(
      (createCottonSpongeRes.body.rawMaterial as Record<string, unknown>).id,
    );

    const sneakyStockDto = validateCreatePurchaseVoucherDto({
      purchaseDate: '2026-10-28',
      supplierName: 'Kochi Fabrics',
      lineItems: [
        {
          newMaterial: {
            name: 'Sneaky Material',
            unit: 'Meter',
            quantityOnHand: 500,
          },
          quantity: 10,
          unitPrice: 100,
        },
      ],
    });
    assert.strictEqual(sneakyStockDto.isValid, false);
    assert.ok(sneakyStockDto.errors?.['lineItems[0].newMaterial.quantityOnHand']);

    const bothIdAndNewDto = validateCreatePurchaseVoucherDto({
      purchaseDate: '2026-10-28',
      supplierName: 'Kochi Fabrics',
      lineItems: [
        {
          materialId: cottonSpongeId,
          newMaterial: {
            name: 'Curtain',
            unit: 'Meter',
          },
          quantity: 10,
          unitPrice: 100,
        },
      ],
    });
    assert.strictEqual(bothIdAndNewDto.isValid, false);
    assert.ok(bothIdAndNewDto.errors?.['lineItems[0].materialId']);

    const projABeforeMixed = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectARecordId}`,
      { token: operatorToken },
    );
    const projAPurchasesBefore = Number(
      (projABeforeMixed.body.project as Record<string, unknown>).totalPurchases,
    );

    const mixedVoucherRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: operatorToken,
      body: {
        purchaseDate: '2026-10-28',
        supplierName: 'Cochin Drapery & Foam Mart',
        supplierInvoiceNumber: 'CDFM-2026-901',
        projectId: projectARecordId,
        entryMethod: 'upload_bill',
        clientRequestId: 'mixed-curtain-req-1',
        lineItems: [
          {
            materialId: cottonSpongeId,
            unit: 'kg',
            quantity: 10,
            unitPrice: 180,
          },
          {
            newMaterial: {
              name: '  Curtain  ',
              unit: 'm',
              category: 'Curtain',
              description: 'Heavy blackout drape fabric',
            },
            quantity: 15,
            unitPrice: 320,
          },
        ],
        taxAmount: 400,
      },
    });
    assert.strictEqual(mixedVoucherRes.status, 201);
    const mixedVoucher = mixedVoucherRes.body.voucher as Record<string, unknown>;
    const mixedVoucherId = String(mixedVoucher.id);
    assert.strictEqual(mixedVoucher.subtotal, 6600);
    assert.strictEqual(mixedVoucher.finalTotal, 7000);
    assert.strictEqual(mixedVoucher.stockSynchronized, true);

    const mixedLineItems = mixedVoucher.lineItems as Array<
      Record<string, unknown>
    >;
    assert.strictEqual(mixedLineItems.length, 2);
    assert.strictEqual(mixedLineItems[0].materialId, cottonSpongeId);
    assert.strictEqual(mixedLineItems[0].unit, 'Kilogram');
    const curtainId = String(mixedLineItems[1].materialId);
    assert.ok(/^[a-f0-9]{24}$/i.test(curtainId));
    assert.strictEqual(mixedLineItems[1].materialName, 'Curtain');
    assert.strictEqual(mixedLineItems[1].unit, 'Meter');

    const cottonAfterMixed = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${cottonSpongeId}`,
      { token: operatorToken },
    );
    assert.strictEqual(cottonAfterMixed.status, 200);
    assert.strictEqual(
      (cottonAfterMixed.body.rawMaterial as Record<string, unknown>)
        .quantityOnHand,
      30,
    );

    const curtainAfterMixed = await jsonReq(
      baseUrl,
      'GET',
      `/api/raw-materials/${curtainId}`,
      { token: operatorToken },
    );
    assert.strictEqual(curtainAfterMixed.status, 200);
    const curtainDoc = curtainAfterMixed.body.rawMaterial as Record<
      string,
      unknown
    >;
    assert.strictEqual(curtainDoc.name, 'Curtain');
    assert.strictEqual(curtainDoc.unit, 'Meter');
    assert.strictEqual(curtainDoc.quantityOnHand, 15);

    const mixedDetailRes = await jsonReq(
      baseUrl,
      'GET',
      `/api/purchases/${mixedVoucherId}`,
      { token: operatorToken },
    );
    assert.strictEqual(mixedDetailRes.status, 200);
    const mixedMovements = mixedDetailRes.body.stockMovements as Array<
      Record<string, unknown>
    >;
    assert.strictEqual(mixedMovements.length, 2);
    const curtainMovement = mixedMovements.find(
      (m) => m.materialId === curtainId,
    );
    assert.ok(curtainMovement);
    assert.strictEqual(curtainMovement?.quantityDelta, 15);
    assert.strictEqual(curtainMovement?.resultingQuantityOnHand, 15);

    const projAAfterMixed = await jsonReq(
      baseUrl,
      'GET',
      `/api/projects/${projectARecordId}`,
      { token: operatorToken },
    );
    assert.strictEqual(
      Number(
        (projAAfterMixed.body.project as Record<string, unknown>)
          .totalPurchases,
      ),
      projAPurchasesBefore + 7000,
    );

    const mixedReplayRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: operatorToken,
      body: {
        purchaseDate: '2026-10-28',
        supplierName: 'Cochin Drapery & Foam Mart',
        supplierInvoiceNumber: 'CDFM-2026-901',
        projectId: projectARecordId,
        entryMethod: 'upload_bill',
        clientRequestId: 'mixed-curtain-req-1',
        lineItems: [
          {
            materialId: cottonSpongeId,
            unit: 'kg',
            quantity: 10,
            unitPrice: 180,
          },
          {
            newMaterial: {
              name: 'Curtain',
              unit: 'Meter',
            },
            quantity: 15,
            unitPrice: 320,
          },
        ],
        taxAmount: 400,
      },
    });
    assert.strictEqual(mixedReplayRes.status, 200);
    assert.strictEqual(mixedReplayRes.body.idempotentReplay, true);

    const curtainAfterReplay = await rawMaterialsRepository.findById(curtainId);
    assert.strictEqual(curtainAfterReplay?.quantityOnHand, 15);
    const cottonAfterReplay =
      await rawMaterialsRepository.findById(cottonSpongeId);
    assert.strictEqual(cottonAfterReplay?.quantityOnHand, 30);

    const compatibleDupNameRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: operatorToken,
        body: {
          purchaseDate: '2026-10-28',
          supplierName: 'Cochin Drapery & Foam Mart',
          supplierInvoiceNumber: 'CDFM-2026-902',
          lineItems: [
            {
              newMaterial: {
                name: '  curtain ',
                unit: 'Meter',
              },
              quantity: 5,
              unitPrice: 330,
            },
          ],
        },
      },
    );
    assert.strictEqual(compatibleDupNameRes.status, 201);
    const dupReuseLines = (
      compatibleDupNameRes.body.voucher as Record<string, unknown>
    ).lineItems as Array<Record<string, unknown>>;
    assert.strictEqual(dupReuseLines[0].materialId, curtainId);
    const curtainAfterReuse = await rawMaterialsRepository.findById(curtainId);
    assert.strictEqual(curtainAfterReuse?.quantityOnHand, 20);

    const unitConflictNewMatRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: operatorToken,
        body: {
          purchaseDate: '2026-10-28',
          supplierName: 'Cochin Drapery & Foam Mart',
          supplierInvoiceNumber: 'CDFM-2026-903',
          lineItems: [
            {
              newMaterial: {
                name: ' cotton   sponge ',
                unit: 'Meter',
              },
              quantity: 8,
              unitPrice: 210,
            },
          ],
        },
      },
    );
    assert.strictEqual(unitConflictNewMatRes.status, 409);
    assert.ok(
      (unitConflictNewMatRes.body.errors as Record<string, string>)?.[
        'lineItems[0].unit'
      ],
    );
    assert.strictEqual(
      (await rawMaterialsRepository.findById(cottonSpongeId))?.quantityOnHand,
      30,
    );

    const createJuteRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/raw-materials',
      {
        token: adminToken,
        body: {
          name: 'Discontinued Jute Webbing',
          unit: 'Meter',
        },
      },
    );
    assert.strictEqual(createJuteRes.status, 201);
    const juteId = String(
      (createJuteRes.body.rawMaterial as Record<string, unknown>).id,
    );
    await jsonReq(baseUrl, 'PATCH', `/api/raw-materials/${juteId}/status`, {
      token: adminToken,
      body: { isActive: false },
    });

    const inactiveCollisionRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: operatorToken,
        body: {
          purchaseDate: '2026-10-28',
          supplierName: 'Webbing Traders',
          lineItems: [
            {
              newMaterial: {
                name: 'discontinued jute webbing',
                unit: 'Meter',
              },
              quantity: 10,
              unitPrice: 55,
            },
          ],
        },
      },
    );
    assert.strictEqual(inactiveCollisionRes.status, 409);

    const intraConflictRes = await jsonReq(baseUrl, 'POST', '/api/purchases', {
      token: operatorToken,
      body: {
        purchaseDate: '2026-10-28',
        supplierName: 'Sheer House',
        lineItems: [
          {
            newMaterial: { name: 'Linen Sheer', unit: 'Meter' },
            quantity: 6,
            unitPrice: 240,
          },
          {
            newMaterial: { name: ' linen  sheer ', unit: 'Piece' },
            quantity: 4,
            unitPrice: 240,
          },
        ],
      },
    });
    assert.strictEqual(intraConflictRes.status, 400);
    assert.strictEqual(
      await rawMaterialsRepository.findByNormalizedName('linen sheer'),
      null,
    );

    const intraSameNewMatRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: operatorToken,
        body: {
          purchaseDate: '2026-10-28',
          supplierName: 'Sheer House',
          supplierInvoiceNumber: 'SH-100',
          lineItems: [
            {
              newMaterial: { name: 'Linen Sheer', unit: 'Meter' },
              quantity: 6,
              unitPrice: 240,
            },
            {
              newMaterial: { name: ' linen  sheer ', unit: 'm' },
              quantity: 4,
              unitPrice: 250,
            },
          ],
        },
      },
    );
    assert.strictEqual(intraSameNewMatRes.status, 201);
    const linenSheerDoc =
      await rawMaterialsRepository.findByNormalizedName('linen sheer');
    assert.ok(linenSheerDoc);
    assert.strictEqual(linenSheerDoc?.quantityOnHand, 10);

    const failedDiscountWithNewMatRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/purchases',
      {
        token: operatorToken,
        body: {
          purchaseDate: '2026-10-28',
          supplierName: 'Orphan Test Supplier',
          discountAmount: 99999,
          lineItems: [
            {
              materialId: cottonSpongeId,
              quantity: 5,
              unitPrice: 180,
            },
            {
              newMaterial: { name: 'Orphaned Silk', unit: 'Meter' },
              quantity: 12,
              unitPrice: 400,
            },
          ],
        },
      },
    );
    assert.strictEqual(failedDiscountWithNewMatRes.status, 400);
    assert.strictEqual(
      await rawMaterialsRepository.findByNormalizedName('orphaned silk'),
      null,
    );
    assert.strictEqual(
      (await rawMaterialsRepository.findById(cottonSpongeId))?.quantityOnHand,
      30,
    );

    const voucherCountBeforeSimulatedFailure =
      sharedPurchaseVoucherMemoryStore.size;
    const movementCountBeforeSimulatedFailure =
      sharedPurchaseStockMovementMemoryStore.size;
    const realPurchaseRepo = new PurchaseVoucherRepository();
    const failingMovementRepo: PurchaseVoucherRepository = Object.create(
      realPurchaseRepo,
    );
    let movementCallCounter = 0;
    failingMovementRepo.recordStockMovement = async (entry) => {
      movementCallCounter += 1;
      if (movementCallCounter >= 2) {
        throw new Error('Simulated ledger persistence failure');
      }
      return realPurchaseRepo.recordStockMovement(entry);
    };

    const failingPurchaseService = new PurchaseVoucherService(
      failingMovementRepo,
      rawMaterialsRepository,
      rawMaterialsService,
      projectRepository,
      projectService,
      billAttachmentStorage,
    );

    await assert.rejects(
      () =>
        failingPurchaseService.createPurchaseVoucher(
          {
            purchaseDate: '2026-10-28',
            supplierName: 'Rollback Trim Supplier',
            supplierInvoiceNumber: 'RB-501',
            lineItems: [
              {
                materialId: cottonSpongeId,
                quantity: 7,
                unitPrice: 180,
              },
              {
                newMaterial: {
                  name: 'Rollback Tassel Trim',
                  unit: 'Meter',
                },
                quantity: 25,
                unitPrice: 90,
              },
            ],
          },
          [],
          {
            id: 'op-rollback',
            email: 'op@softtouch.test',
            name: 'Operator',
            role: 'data_entry',
          },
        ),
      /Simulated ledger persistence failure/,
    );

    assert.strictEqual(
      await rawMaterialsRepository.findByNormalizedName('rollback tassel trim'),
      null,
    );
    assert.strictEqual(
      (await rawMaterialsRepository.findById(cottonSpongeId))?.quantityOnHand,
      30,
    );
    assert.strictEqual(
      sharedPurchaseVoucherMemoryStore.size,
      voucherCountBeforeSimulatedFailure,
    );
    assert.strictEqual(
      sharedPurchaseStockMovementMemoryStore.size,
      movementCountBeforeSimulatedFailure,
    );

    const concurrentQuantities = [2, 3, 4, 5];
    const concurrentResponses = await Promise.all(
      concurrentQuantities.map((qty, idx) =>
        jsonReq(baseUrl, 'POST', '/api/purchases', {
          token: operatorToken,
          body: {
            purchaseDate: '2026-10-28',
            supplierName: 'Hardware Concurrent Co',
            supplierInvoiceNumber: `HCC-${idx + 1}`,
            lineItems: [
              {
                newMaterial: {
                  name: 'Brass Piping Nail',
                  unit: 'Box',
                  category: 'Hardware',
                },
                quantity: qty,
                unitPrice: 150,
              },
            ],
          },
        }),
      ),
    );
    for (const res of concurrentResponses) {
      assert.strictEqual(res.status, 201);
    }

    const matchingBrassRecords = Array.from(
      sharedRawMaterialMemoryStore.values(),
    ).filter((m) => m.normalizedName === 'brass piping nail');
    assert.strictEqual(matchingBrassRecords.length, 1);
    assert.strictEqual(matchingBrassRecords[0].quantityOnHand, 14);

    const editedMixedRes = await jsonReq(
      baseUrl,
      'PATCH',
      `/api/purchases/${mixedVoucherId}`,
      {
        token: operatorToken,
        body: {
          lineItems: [
            {
              materialId: cottonSpongeId,
              quantity: 6,
              unitPrice: 180,
            },
            {
              materialId: curtainId,
              quantity: 11,
              unitPrice: 320,
            },
            {
              newMaterial: {
                name: '  Buckram Tape ',
                unit: 'm',
                category: 'Curtain',
              },
              quantity: 20,
              unitPrice: 45,
            },
          ],
        },
      },
    );
    assert.strictEqual(editedMixedRes.status, 200);
    assert.strictEqual(
      (await rawMaterialsRepository.findById(cottonSpongeId))?.quantityOnHand,
      26,
    );
    assert.strictEqual(
      (await rawMaterialsRepository.findById(curtainId))?.quantityOnHand,
      16,
    );
    const buckramDoc =
      await rawMaterialsRepository.findByNormalizedName('buckram tape');
    assert.ok(buckramDoc);
    assert.strictEqual(buckramDoc?.quantityOnHand, 20);

    const cancelMixedRes = await jsonReq(
      baseUrl,
      'POST',
      `/api/purchases/${mixedVoucherId}/cancel`,
      {
        token: adminToken,
        body: { reason: 'Testing full reversal on mixed existing + new items' },
      },
    );
    assert.strictEqual(cancelMixedRes.status, 200);
    assert.strictEqual(
      (await rawMaterialsRepository.findById(cottonSpongeId))?.quantityOnHand,
      20,
    );
    assert.strictEqual(
      (await rawMaterialsRepository.findById(curtainId))?.quantityOnHand,
      5,
    );
    assert.strictEqual(
      (
        await rawMaterialsRepository.findById(String(buckramDoc?._id))
      )?.quantityOnHand,
      0,
    );

    console.log('✓ All HTTP, stock sync, project sync, attachment & RBAC tests passed.');
  } finally {
    for (const v of sharedPurchaseVoucherMemoryStore.values()) {
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

  console.log('=== ALL PURCHASE VOUCHER MODULE TESTS PASSED ===');
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Purchase Voucher test suite failed:', err);
    process.exit(1);
  });
