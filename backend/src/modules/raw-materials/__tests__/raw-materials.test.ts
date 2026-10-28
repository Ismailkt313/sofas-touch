process.env.NODE_ENV = 'test';

import assert from 'assert';
import http from 'http';
import mongoose from 'mongoose';
import { generateToken } from '../../../middleware/auth';
import { sharedUserMemoryStore } from '../../auth/models/user.model';
import {
  DuplicateRawMaterialKeyError,
  IRawMaterial,
  IRawMaterialsRepository,
  InactiveRawMaterialSelectionError,
  RawMaterialAlreadyExistsError,
  RawMaterialModel,
  RawMaterialsRepository,
  RawMaterialsService,
  rawMaterialsService,
  sharedRawMaterialMemoryStore,
  validateCreateRawMaterialDto,
  validateGetRawMaterialsDto,
  validateUpdateRawMaterialDto,
  validateUpdateRawMaterialStatusDto,
} from '../index';

interface HttpJsonResponse {
  status: number;
  body: Record<string, unknown>;
}

function sendJsonRequest(
  baseUrl: string,
  method: string,
  path: string,
  options: {
    token?: string;
    body?: unknown;
  } = {},
): Promise<HttpJsonResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(path, baseUrl);
    const payload =
      options.body !== undefined ? JSON.stringify(options.body) : undefined;

    const headers: Record<string, string> = {
      Accept: 'application/json',
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
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            resolve({
              status: res.statusCode || 0,
              body: parsed as Record<string, unknown>,
            });
          } catch (err) {
            reject(err);
          }
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

function seedTestUsers(): {
  adminToken: string;
  dataEntryToken: string;
  inactiveDataEntryToken: string;
  pendingDataEntryToken: string;
} {
  const now = new Date();

  const adminUser = {
    _id: '507f1f77bcf86cd799439001',
    name: 'Materials Admin',
    email: 'materials.admin@softtouch.local',
    role: 'admin' as const,
    isActive: true,
    approvalStatus: 'approved' as const,
    createdAt: now,
    updatedAt: now,
  };

  const dataEntryUser = {
    _id: '507f1f77bcf86cd799439002',
    name: 'Materials Operator',
    email: 'materials.operator@softtouch.local',
    role: 'data_entry' as const,
    isActive: true,
    approvalStatus: 'approved' as const,
    createdAt: now,
    updatedAt: now,
  };

  const inactiveOperator = {
    _id: '507f1f77bcf86cd799439003',
    name: 'Inactive Operator',
    email: 'materials.inactive@softtouch.local',
    role: 'data_entry' as const,
    isActive: false,
    approvalStatus: 'approved' as const,
    createdAt: now,
    updatedAt: now,
  };

  const pendingOperator = {
    _id: '507f1f77bcf86cd799439004',
    name: 'Pending Operator',
    email: 'materials.pending@softtouch.local',
    role: 'data_entry' as const,
    isActive: true,
    approvalStatus: 'pending' as const,
    createdAt: now,
    updatedAt: now,
  };

  sharedUserMemoryStore.set(adminUser.email, adminUser);
  sharedUserMemoryStore.set(dataEntryUser.email, dataEntryUser);
  sharedUserMemoryStore.set(inactiveOperator.email, inactiveOperator);
  sharedUserMemoryStore.set(pendingOperator.email, pendingOperator);

  return {
    adminToken: generateToken({
      id: adminUser._id,
      email: adminUser.email,
      role: 'admin',
      name: adminUser.name,
    }),
    dataEntryToken: generateToken({
      id: dataEntryUser._id,
      email: dataEntryUser.email,
      role: 'data_entry',
      name: dataEntryUser.name,
    }),
    inactiveDataEntryToken: generateToken({
      id: inactiveOperator._id,
      email: inactiveOperator.email,
      role: 'data_entry',
      name: inactiveOperator.name,
    }),
    pendingDataEntryToken: generateToken({
      id: pendingOperator._id,
      email: pendingOperator.email,
      role: 'data_entry',
      name: pendingOperator.name,
    }),
  };
}

async function clearRawMaterialsState(): Promise<void> {
  sharedRawMaterialMemoryStore.clear();
  if (mongoose.connection.readyState === 1 && mongoose.models.RawMaterial) {
    await mongoose.models.RawMaterial.deleteMany({});
  }
}

async function runTests(): Promise<void> {
  const { default: app } = await import('../../../index');

  await clearRawMaterialsState();
  const tokens = seedTestUsers();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test HTTP server.');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    console.log('--- Starting Raw Materials Management Test Suite ---');

    console.log('1. Testing DTO validation & mass-assignment protection...');
    {
      const validCreate = validateCreateRawMaterialDto({
        name: '  Belgian   Linen   Fabric ',
        category: 'curtain',
        unit: 'mtr',
        description: '  Heavy drapery linen  ',
      });
      assert.strictEqual(validCreate.isValid, true);
      assert.strictEqual(validCreate.value?.name, 'Belgian Linen Fabric');
      assert.strictEqual(validCreate.value?.category, 'Curtain');
      assert.strictEqual(validCreate.value?.unit, 'Meter');
      assert.strictEqual(validCreate.value?.description, 'Heavy drapery linen');

      const emptyName = validateCreateRawMaterialDto({
        name: '    ',
        unit: 'Piece',
      });
      assert.strictEqual(emptyName.isValid, false);
      assert.ok(emptyName.errors?.name);

      const invalidUnit = validateCreateRawMaterialDto({
        name: 'Teak Battens',
        unit: 'Barrels',
      });
      assert.strictEqual(invalidUnit.isValid, false);
      assert.ok(invalidUnit.errors?.unit);

      const createMassAssignment = validateCreateRawMaterialDto({
        _id: '507f1f77bcf86cd799439099',
        id: '507f1f77bcf86cd799439099',
        isActive: false,
        createdAt: '2020-01-01T00:00:00.000Z',
        stockQuantity: 100,
        name: 'Foam Sheet',
        unit: 'Sheet',
      });
      assert.strictEqual(createMassAssignment.isValid, false);
      assert.ok(createMassAssignment.errors?._id);
      assert.ok(createMassAssignment.errors?.id);
      assert.ok(createMassAssignment.errors?.isActive);
      assert.ok(createMassAssignment.errors?.createdAt);
      assert.ok(createMassAssignment.errors?.stockQuantity);

      const updateMassAssignment = validateUpdateRawMaterialDto({
        name: 'Updated Foam Sheet',
        isActive: false,
        updatedAt: '2025-01-01T00:00:00.000Z',
      });
      assert.strictEqual(updateMassAssignment.isValid, false);
      assert.ok(updateMassAssignment.errors?.isActive);
      assert.ok(updateMassAssignment.errors?.updatedAt);

      const emptyUpdate = validateUpdateRawMaterialDto({});
      assert.strictEqual(emptyUpdate.isValid, false);
      assert.ok(emptyUpdate.errors?.body);

      const statusMassAssignment = validateUpdateRawMaterialStatusDto({
        isActive: false,
        name: 'Sneaky Rename',
      });
      assert.strictEqual(statusMassAssignment.isValid, false);
      assert.ok(statusMassAssignment.errors?.name);

      const listValidation = validateGetRawMaterialsDto({
        page: '0',
        limit: '500',
        category: 'UnknownCategory',
        isActive: 'maybe',
      });
      assert.strictEqual(listValidation.isValid, false);
      assert.ok(listValidation.errors?.page);
      assert.ok(listValidation.errors?.limit);
      assert.ok(listValidation.errors?.category);
      assert.ok(listValidation.errors?.isActive);
    }
    console.log('✓ DTO validation & mass-assignment checks passed.');

    console.log('2. Testing authentication & role enforcement across endpoints...');
    {
      const unauthList = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials',
      );
      assert.strictEqual(unauthList.status, 401);

      const unauthCreate = await sendJsonRequest(
        baseUrl,
        'POST',
        '/api/raw-materials',
        { body: { name: 'Velvet', unit: 'Meter' } },
      );
      assert.strictEqual(unauthCreate.status, 401);

      const inactiveUserRes = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials',
        { token: tokens.inactiveDataEntryToken },
      );
      assert.strictEqual(inactiveUserRes.status, 403);

      const pendingUserRes = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials',
        { token: tokens.pendingDataEntryToken },
      );
      assert.strictEqual(pendingUserRes.status, 403);

      const operatorCreate = await sendJsonRequest(
        baseUrl,
        'POST',
        '/api/raw-materials',
        {
          token: tokens.dataEntryToken,
          body: { name: 'Operator Attempt Material', unit: 'Piece' },
        },
      );
      assert.strictEqual(operatorCreate.status, 403);
    }
    console.log('✓ Authentication & role creation restrictions passed.');

    console.log('3. Testing material creation, normalization, and duplicate handling...');
    let sofaVelvetId = '';
    let curtainSheerId = '';
    let generalGlueId = '';
    let foamSheetId = '';
    {
      const createVelvet = await sendJsonRequest(
        baseUrl,
        'POST',
        '/api/raw-materials',
        {
          token: tokens.adminToken,
          body: {
            name: '  Italian   Cotton  Velvet ',
            category: 'Sofa',
            unit: 'Meter',
            description: 'Plush upholstery velvet',
          },
        },
      );
      assert.strictEqual(createVelvet.status, 201);
      const velvet = createVelvet.body.rawMaterial as Record<string, unknown>;
      assert.strictEqual(velvet.name, 'Italian Cotton Velvet');
      assert.strictEqual(velvet.category, 'Sofa');
      assert.strictEqual(velvet.unit, 'Meter');
      assert.strictEqual(velvet.description, 'Plush upholstery velvet');
      assert.strictEqual(velvet.isActive, true);
      assert.strictEqual(velvet.normalizedName, undefined);
      assert.strictEqual(velvet.stockQuantity, undefined);
      assert.ok(
        typeof velvet.id === 'string' && /^[a-f0-9]{24}$/i.test(velvet.id),
      );
      sofaVelvetId = velvet.id as string;

      const duplicateCaseWhitespace = await sendJsonRequest(
        baseUrl,
        'POST',
        '/api/raw-materials',
        {
          token: tokens.adminToken,
          body: {
            name: 'italian cotton    VELVET',
            category: 'Sofa',
            unit: 'Roll',
          },
        },
      );
      assert.strictEqual(duplicateCaseWhitespace.status, 409);
      assert.strictEqual(duplicateCaseWhitespace.body.error, 'Conflict');

      const createSheer = await sendJsonRequest(
        baseUrl,
        'POST',
        '/api/raw-materials',
        {
          token: tokens.adminToken,
          body: {
            name: 'Sheer Voile (300cm)',
            category: 'Curtain',
            unit: 'Roll',
          },
        },
      );
      assert.strictEqual(createSheer.status, 201);
      curtainSheerId = (createSheer.body.rawMaterial as Record<string, unknown>)
        .id as string;

      const createGlue = await sendJsonRequest(
        baseUrl,
        'POST',
        '/api/raw-materials',
        {
          token: tokens.adminToken,
          body: {
            name: 'Industrial Wood Adhesive',
            unit: 'Litre',
          },
        },
      );
      assert.strictEqual(createGlue.status, 201);
      const glue = createGlue.body.rawMaterial as Record<string, unknown>;
      assert.strictEqual(glue.category, null);
      generalGlueId = glue.id as string;

      const createFoam = await sendJsonRequest(
        baseUrl,
        'POST',
        '/api/raw-materials',
        {
          token: tokens.adminToken,
          body: {
            name: 'High Resilience Foam (40D)',
            category: 'Foam',
            unit: 'Sheet',
          },
        },
      );
      assert.strictEqual(createFoam.status, 201);
      foamSheetId = (createFoam.body.rawMaterial as Record<string, unknown>)
        .id as string;

      const simulatedRaceRepo: IRawMaterialsRepository = {
        async create(): Promise<IRawMaterial> {
          throw new DuplicateRawMaterialKeyError('Race Material');
        },
        async findMaterials() {
          return { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
        },
        async findById() {
          return null;
        },
        async findByIds() {
          return [];
        },
        async findByNormalizedName() {
          return null;
        },
        async updateById() {
          return null;
        },
      };
      const raceService = new RawMaterialsService(simulatedRaceRepo);
      await assert.rejects(
        () =>
          raceService.createRawMaterial(
            {
              name: 'Race Material',
              category: 'General',
              unit: 'Piece',
              description: '',
            },
            'admin',
          ),
        (err: unknown) =>
          err instanceof RawMaterialAlreadyExistsError &&
          !err.message.includes('E11000'),
      );
    }
    console.log('✓ Material creation, normalization, and duplicate handling passed.');

    console.log('4. Testing material updates, ID stability, and duplicate rename guard...');
    {
      const operatorUpdate = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${sofaVelvetId}`,
        {
          token: tokens.dataEntryToken,
          body: { description: 'Unauthorized edit' },
        },
      );
      assert.strictEqual(operatorUpdate.status, 403);

      const massAssignPatch = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${sofaVelvetId}`,
        {
          token: tokens.adminToken,
          body: { name: 'Valid Name', isActive: false },
        },
      );
      assert.strictEqual(massAssignPatch.status, 400);

      const collidingRename = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${generalGlueId}`,
        {
          token: tokens.adminToken,
          body: { name: '  italian cotton velvet ' },
        },
      );
      assert.strictEqual(collidingRename.status, 409);

      const selfCaseUpdate = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${sofaVelvetId}`,
        {
          token: tokens.adminToken,
          body: {
            name: 'Italian Cotton Velvet Premium',
            unit: 'Roll',
            description: 'Updated width 140cm roll',
          },
        },
      );
      assert.strictEqual(selfCaseUpdate.status, 200);
      const updatedVelvet = selfCaseUpdate.body.rawMaterial as Record<
        string,
        unknown
      >;
      assert.strictEqual(updatedVelvet.id, sofaVelvetId);
      assert.strictEqual(updatedVelvet.name, 'Italian Cotton Velvet Premium');
      assert.strictEqual(updatedVelvet.unit, 'Roll');
      assert.strictEqual(
        updatedVelvet.description,
        'Updated width 140cm roll',
      );
    }
    console.log('✓ Material updates, stable ID reference, and rename duplicate checks passed.');

    console.log('5. Testing listing, pagination, search, category filter, and sorting...');
    {
      const adminListAll = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials',
        { token: tokens.adminToken },
      );
      assert.strictEqual(adminListAll.status, 200);
      assert.strictEqual(adminListAll.body.total, 4);
      assert.strictEqual(adminListAll.body.page, 1);
      assert.strictEqual(adminListAll.body.limit, 20);
      assert.strictEqual(adminListAll.body.totalPages, 1);
      const items = adminListAll.body.items as Array<Record<string, unknown>>;
      assert.strictEqual(items.length, 4);
      assert.strictEqual(items[0].id, sofaVelvetId);

      const pagedPage1 = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?page=1&limit=2',
        { token: tokens.adminToken },
      );
      assert.strictEqual(pagedPage1.status, 200);
      assert.strictEqual(pagedPage1.body.total, 4);
      assert.strictEqual(pagedPage1.body.limit, 2);
      assert.strictEqual(pagedPage1.body.totalPages, 2);
      assert.strictEqual((pagedPage1.body.items as unknown[]).length, 2);

      const pagedPage2 = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?page=2&limit=2',
        { token: tokens.adminToken },
      );
      assert.strictEqual(pagedPage2.status, 200);
      assert.strictEqual((pagedPage2.body.items as unknown[]).length, 2);

      const regexSafeSearch = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?search=(40D)',
        { token: tokens.adminToken },
      );
      assert.strictEqual(regexSafeSearch.status, 200);
      assert.strictEqual(regexSafeSearch.body.total, 1);
      assert.strictEqual(
        ((regexSafeSearch.body.items as Array<Record<string, unknown>>)[0]).id,
        foamSheetId,
      );

      const curtainFilter = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?category=curtain',
        { token: tokens.dataEntryToken },
      );
      assert.strictEqual(curtainFilter.status, 200);
      assert.strictEqual(curtainFilter.body.total, 1);
      assert.strictEqual(
        ((curtainFilter.body.items as Array<Record<string, unknown>>)[0]).id,
        curtainSheerId,
      );

      const oversizedLimit = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?limit=101',
        { token: tokens.adminToken },
      );
      assert.strictEqual(oversizedLimit.status, 400);
    }
    console.log('✓ Listing, pagination, regex-safe search, category filter, and sorting passed.');

    console.log('6. Testing activation/deactivation, Data Entry restrictions, and voucher integration...');
    {
      const operatorDeactivateAttempt = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${curtainSheerId}/status`,
        {
          token: tokens.dataEntryToken,
          body: { isActive: false },
        },
      );
      assert.strictEqual(operatorDeactivateAttempt.status, 403);

      const deactivateRes = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${curtainSheerId}/status`,
        {
          token: tokens.adminToken,
          body: { isActive: false },
        },
      );
      assert.strictEqual(deactivateRes.status, 200);
      assert.strictEqual(
        (deactivateRes.body.rawMaterial as Record<string, unknown>).isActive,
        false,
      );

      const deleteAttempt = await sendJsonRequest(
        baseUrl,
        'DELETE',
        `/api/raw-materials/${curtainSheerId}`,
        { token: tokens.adminToken },
      );
      assert.strictEqual(deleteAttempt.status, 404);

      const adminListAllAfterDeactivate = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials',
        { token: tokens.adminToken },
      );
      assert.strictEqual(adminListAllAfterDeactivate.status, 200);
      assert.strictEqual(adminListAllAfterDeactivate.body.total, 4);

      const adminListInactiveOnly = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?status=inactive',
        { token: tokens.adminToken },
      );
      assert.strictEqual(adminListInactiveOnly.status, 200);
      assert.strictEqual(adminListInactiveOnly.body.total, 1);
      assert.strictEqual(
        ((adminListInactiveOnly.body.items as Array<Record<string, unknown>>)[0])
          .id,
        curtainSheerId,
      );

      const adminGetInactiveDetail = await sendJsonRequest(
        baseUrl,
        'GET',
        `/api/raw-materials/${curtainSheerId}`,
        { token: tokens.adminToken },
      );
      assert.strictEqual(adminGetInactiveDetail.status, 200);
      assert.strictEqual(
        (adminGetInactiveDetail.body.rawMaterial as Record<string, unknown>)
          .isActive,
        false,
      );

      const operatorListDefault = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials',
        { token: tokens.dataEntryToken },
      );
      assert.strictEqual(operatorListDefault.status, 200);
      assert.strictEqual(operatorListDefault.body.total, 3);
      const operatorIds = (
        operatorListDefault.body.items as Array<Record<string, unknown>>
      ).map((item) => item.id);
      assert.ok(!operatorIds.includes(curtainSheerId));

      const operatorListInactiveAttempt = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?status=inactive',
        { token: tokens.dataEntryToken },
      );
      assert.strictEqual(operatorListInactiveAttempt.status, 403);

      const operatorListIsActiveFalseAttempt = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?isActive=false',
        { token: tokens.dataEntryToken },
      );
      assert.strictEqual(operatorListIsActiveFalseAttempt.status, 403);

      const operatorListAllAttempt = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials?status=all',
        { token: tokens.dataEntryToken },
      );
      assert.strictEqual(operatorListAllAttempt.status, 403);

      const operatorGetActiveDetail = await sendJsonRequest(
        baseUrl,
        'GET',
        `/api/raw-materials/${sofaVelvetId}`,
        { token: tokens.dataEntryToken },
      );
      assert.strictEqual(operatorGetActiveDetail.status, 200);

      const operatorGetInactiveDetail = await sendJsonRequest(
        baseUrl,
        'GET',
        `/api/raw-materials/${curtainSheerId}`,
        { token: tokens.dataEntryToken },
      );
      assert.strictEqual(operatorGetInactiveDetail.status, 403);
      assert.strictEqual(operatorGetInactiveDetail.body.rawMaterial, undefined);

      const activeVoucherRef =
        await rawMaterialsService.getSelectableMaterialForPurchase(sofaVelvetId);
      assert.strictEqual(activeVoucherRef.id, sofaVelvetId);
      assert.strictEqual(
        activeVoucherRef.name,
        'Italian Cotton Velvet Premium',
      );
      assert.strictEqual(activeVoucherRef.unit, 'Roll');
      assert.strictEqual(activeVoucherRef.isActive, true);

      await assert.rejects(
        () =>
          rawMaterialsService.getSelectableMaterialForPurchase(curtainSheerId),
        (err: unknown) => err instanceof InactiveRawMaterialSelectionError,
      );

      const historicalVoucherRef =
        await rawMaterialsService.getMaterialReferenceById(curtainSheerId);
      assert.ok(historicalVoucherRef);
      assert.strictEqual(historicalVoucherRef?.id, curtainSheerId);
      assert.strictEqual(historicalVoucherRef?.name, 'Sheer Voile (300cm)');
      assert.strictEqual(historicalVoucherRef?.unit, 'Roll');
      assert.strictEqual(historicalVoucherRef?.isActive, false);

      const batchRefs = await rawMaterialsService.getMaterialReferencesByIds([
        sofaVelvetId,
        curtainSheerId,
      ]);
      assert.strictEqual(batchRefs.size, 2);

      const reactivateRes = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${curtainSheerId}/status`,
        {
          token: tokens.adminToken,
          body: { status: 'active' },
        },
      );
      assert.strictEqual(reactivateRes.status, 200);
      assert.strictEqual(
        (reactivateRes.body.rawMaterial as Record<string, unknown>).isActive,
        true,
      );

      const operatorGetReactivated = await sendJsonRequest(
        baseUrl,
        'GET',
        `/api/raw-materials/${curtainSheerId}`,
        { token: tokens.dataEntryToken },
      );
      assert.strictEqual(operatorGetReactivated.status, 200);
    }
    console.log('✓ Soft deactivation, reactivation, Data Entry restrictions, and voucher reference checks passed.');

    console.log('7. Testing invalid IDs and missing material error responses...');
    {
      const invalidGet = await sendJsonRequest(
        baseUrl,
        'GET',
        '/api/raw-materials/not-a-valid-objectid',
        { token: tokens.adminToken },
      );
      assert.strictEqual(invalidGet.status, 400);
      assert.strictEqual(invalidGet.body.error, 'Bad Request');

      const invalidPatch = await sendJsonRequest(
        baseUrl,
        'PATCH',
        '/api/raw-materials/12345',
        {
          token: tokens.adminToken,
          body: { name: 'Should Reject ID' },
        },
      );
      assert.strictEqual(invalidPatch.status, 400);

      const invalidStatusPatch = await sendJsonRequest(
        baseUrl,
        'PATCH',
        '/api/raw-materials/bad_id/status',
        {
          token: tokens.adminToken,
          body: { isActive: false },
        },
      );
      assert.strictEqual(invalidStatusPatch.status, 400);

      const missingId = '507f1f77bcf86cd799439099';

      const missingGet = await sendJsonRequest(
        baseUrl,
        'GET',
        `/api/raw-materials/${missingId}`,
        { token: tokens.adminToken },
      );
      assert.strictEqual(missingGet.status, 404);
      assert.strictEqual(missingGet.body.error, 'Not Found');

      const missingPatch = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${missingId}`,
        {
          token: tokens.adminToken,
          body: { description: 'Non-existent update' },
        },
      );
      assert.strictEqual(missingPatch.status, 404);

      const missingStatusPatch = await sendJsonRequest(
        baseUrl,
        'PATCH',
        `/api/raw-materials/${missingId}/status`,
        {
          token: tokens.adminToken,
          body: { isActive: false },
        },
      );
      assert.strictEqual(missingStatusPatch.status, 404);

      const directRepo = new RawMaterialsRepository();
      const missingRepoResult = await directRepo.findById('invalid');
      assert.strictEqual(missingRepoResult, null);
    }
    console.log('✓ Invalid ID (400) and missing material (404) checks passed.');

    console.log('8. Testing Mongoose schema validation & MongoDB E11000 error shielding...');
    {
      const validDoc = new RawMaterialModel({
        name: '  Seasoned   Teak   Plank ',
        category: 'Timber',
        unit: 'Piece',
        description: 'Kiln-dried frame timber',
      });
      await validDoc.validate();
      assert.strictEqual(validDoc.name, 'Seasoned Teak Plank');
      assert.strictEqual(validDoc.normalizedName, 'seasoned teak plank');
      assert.strictEqual(validDoc.isActive, true);

      const invalidEnumDoc = new RawMaterialModel({
        name: 'Unknown Unit Material',
        unit: 'UnsupportedUnit',
      });
      await assert.rejects(() => invalidEnumDoc.validate());

      const schemaIndexes = RawMaterialModel.schema.indexes();
      assert.ok(schemaIndexes.length >= 2);
      const normalizedPath = RawMaterialModel.schema.path('normalizedName');
      assert.ok(normalizedPath);
      assert.strictEqual(
        (normalizedPath as unknown as { options?: { unique?: boolean } }).options
          ?.unique,
        true,
      );
    }
    console.log('✓ Mongoose schema validation, pre-validate hook, and unique index definition passed.');

    console.log('=== ALL RAW MATERIALS MANAGEMENT TESTS PASSED ===');
  } finally {
    await clearRawMaterialsState();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runTests().catch((err) => {
  console.error('Raw materials test suite failed:', err);
  process.exit(1);
});
