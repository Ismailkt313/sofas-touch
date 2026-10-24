import assert from 'assert';
import mongoose from 'mongoose';
import app from '../../../index';
import { connectDB } from '../../../config/db';
import { generateToken } from '../../../middleware/auth';
import { validateListUsersDto } from '../dto/list-users.dto';
import { validateCreateUserDto } from '../dto/create-user.dto';
import { validateUpdateUserDto } from '../dto/update-user.dto';
import { validateUpdateStatusDto } from '../dto/update-status.dto';

async function runTests() {
  await connectDB();
  console.log('--- Starting User Management Module Test Suite ---');

  // Generate test tokens
  const adminToken = generateToken({
    id: 'usr_admin_001',
    email: 'admin@softtouchsofas.com',
    role: 'admin',
    name: 'Admin User',
  });

  const dataEntryToken = generateToken({
    id: 'usr_data_entry_002',
    email: 'dataentry@softtouchsofas.com',
    role: 'data_entry',
    name: 'Data Entry User',
  });

  // 1. DTO Unit Tests
  console.log('Testing DTO validations...');
  {
    // ListUsersDto
    const validList = validateListUsersDto({ page: '2', limit: '20', search: 'john', role: 'admin', status: 'active' });
    assert.strictEqual(validList.isValid, true);
    assert.strictEqual(validList.value?.page, 2);
    assert.strictEqual(validList.value?.limit, 20);
    assert.strictEqual(validList.value?.search, 'john');
    assert.strictEqual(validList.value?.role, 'admin');
    assert.strictEqual(validList.value?.status, 'active');

    const invalidList = validateListUsersDto({ page: '-1', limit: '200', role: 'superuser', status: 'banned' });
    assert.strictEqual(invalidList.isValid, false);
    assert.ok(invalidList.errors?.page);
    assert.ok(invalidList.errors?.limit);
    assert.ok(invalidList.errors?.role);
    assert.ok(invalidList.errors?.status);

    // CreateUserDto
    const validCreate = validateCreateUserDto({
      name: 'Operator One',
      email: 'operator@example.com',
      password: 'StrongPassword1',
      phone: '+44 7123 456789',
    });
    assert.strictEqual(validCreate.isValid, true);
    assert.strictEqual(validCreate.value?.role, 'data_entry');

    // Privilege escalation attempt in CreateUserDto
    const adminEscalate = validateCreateUserDto({
      name: 'Rogue Operator',
      email: 'rogue@example.com',
      password: 'StrongPassword1',
      role: 'admin',
    });
    assert.strictEqual(adminEscalate.isValid, false);
    assert.ok(adminEscalate.errors?.role);

    // UpdateUserDto
    const validUpdate = validateUpdateUserDto({ name: 'Updated Name', role: 'admin' });
    assert.strictEqual(validUpdate.isValid, true);
    assert.strictEqual(validUpdate.value?.name, 'Updated Name');
    assert.strictEqual(validUpdate.value?.role, 'admin');

    const emptyUpdate = validateUpdateUserDto({});
    assert.strictEqual(emptyUpdate.isValid, false);
    assert.ok(emptyUpdate.errors?.body);

    // UpdateStatusDto
    const validStatus = validateUpdateStatusDto({ isActive: false });
    assert.strictEqual(validStatus.isValid, true);
    assert.strictEqual(validStatus.value?.isActive, false);

    const validStatusStr = validateUpdateStatusDto({ status: 'active' });
    assert.strictEqual(validStatusStr.isValid, true);
    assert.strictEqual(validStatusStr.value?.isActive, true);

    const invalidStatus = validateUpdateStatusDto({});
    assert.strictEqual(invalidStatus.isValid, false);
  }
  console.log('✓ DTO validations passed.');

  // 2. HTTP Server Endpoint Tests
  console.log('Testing HTTP /api/users endpoints...');
  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}`;

  try {
    // Test A: Authentication & Authorization
    console.log('Testing auth guards on /api/users...');
    const unauthRes = await fetch(`${baseUrl}/api/users`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must be 401');

    const forbiddenRes = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${dataEntryToken}` },
    });
    assert.strictEqual(forbiddenRes.status, 403, 'Non-admin request must be 403 Forbidden');

    // Test B: GET /api/users (Listing & Filters)
    console.log('Testing GET /api/users listing and pagination...');
    const listRes = await fetch(`${baseUrl}/api/users?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listData: any = await listRes.json();
    assert.ok(Array.isArray(listData.users));
    assert.ok(listData.pagination);
    assert.strictEqual(listData.pagination.page, 1);
    assert.strictEqual(listData.pagination.limit, 5);
    // Ensure no password hashes exposed
    for (const u of listData.users) {
      assert.strictEqual(u.password, undefined);
      assert.strictEqual(u.passwordHash, undefined);
    }

    // Test C: POST /api/users (Create Data Entry Operator)
    console.log('Testing POST /api/users (Create Data Entry Operator)...');
    const newEmail = `operator_${Date.now()}@softtouchsofas.com`;
    const createRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'New Operator',
        email: newEmail,
        password: 'Password123',
        phone: '+44 7987 654321',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createData: any = await createRes.json();
    assert.strictEqual(createData.message, 'User created successfully.');
    assert.strictEqual(createData.user.name, 'New Operator');
    assert.strictEqual(createData.user.email, newEmail);
    assert.strictEqual(createData.user.role, 'data_entry');
    assert.strictEqual(createData.user.isActive, true);
    assert.strictEqual(createData.user.password, undefined);
    const createdUserId = createData.user.id;

    // Test C2: Block Admin privilege escalation in POST /api/users
    const escalateRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Admin',
        email: `admin_escalate_${Date.now()}@example.com`,
        password: 'Password123',
        role: 'admin',
      }),
    });
    assert.strictEqual(escalateRes.status, 400);
    const escalateData: any = await escalateRes.json();
    assert.ok(escalateData.errors?.role);

    // Test C3: Duplicate email in POST /api/users returns 409
    const dupRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Duplicate Operator',
        email: newEmail,
        password: 'Password123',
      }),
    });
    assert.strictEqual(dupRes.status, 409);

    // Test D: GET /api/users/:id
    console.log('Testing GET /api/users/:id...');
    const getRes = await fetch(`${baseUrl}/api/users/${createdUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(getRes.status, 200);
    const getData: any = await getRes.json();
    assert.strictEqual(getData.user.id, createdUserId);
    assert.strictEqual(getData.user.email, newEmail);
    assert.strictEqual(getData.user.password, undefined);

    // Non-existent ID returns 404
    const notFoundRes = await fetch(`${baseUrl}/api/users/non_existent_id_999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(notFoundRes.status, 404);

    // Test E: PATCH /api/users/:id (Update Details)
    console.log('Testing PATCH /api/users/:id...');
    const patchRes = await fetch(`${baseUrl}/api/users/${createdUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Updated Operator Name',
        phone: '+44 7111 222333',
        role: 'admin',
      }),
    });
    assert.strictEqual(patchRes.status, 200);
    const patchData: any = await patchRes.json();
    assert.strictEqual(patchData.user.name, 'Updated Operator Name');
    assert.strictEqual(patchData.user.phone, '+44 7111 222333');
    assert.strictEqual(patchData.user.role, 'admin');

    // Test E2: Self-demotion prevention (Admin cannot demote own role)
    const selfDemoteRes = await fetch(`${baseUrl}/api/users/usr_admin_001`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        role: 'data_entry',
      }),
    });
    assert.strictEqual(selfDemoteRes.status, 400);
    const selfDemoteData: any = await selfDemoteRes.json();
    assert.ok(selfDemoteData.message.includes('demote'));

    // Test F: PATCH /api/users/:id/status (Activate / Deactivate)
    console.log('Testing PATCH /api/users/:id/status...');
    // 1. Deactivate created user
    const deactRes = await fetch(`${baseUrl}/api/users/${createdUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.strictEqual(deactRes.status, 200);
    const deactData: any = await deactRes.json();
    assert.strictEqual(deactData.user.isActive, false);

    // 2. Verify deactivated user cannot log in
    const deactLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        password: 'Password123',
      }),
    });
    assert.strictEqual(deactLoginRes.status, 403, 'Inactive account must be rejected with 403 Forbidden');

    // 3. Prevent Admin from deactivating their own account
    const selfDeactRes = await fetch(`${baseUrl}/api/users/usr_admin_001/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.strictEqual(selfDeactRes.status, 400, 'Self deactivation must return 400');
    const selfDeactData: any = await selfDeactRes.json();
    assert.ok(selfDeactData.message.includes('own administrative account'));

    // 4. Reactivate user
    const reactRes = await fetch(`${baseUrl}/api/users/${createdUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.strictEqual(reactRes.status, 200);
    const reactData: any = await reactRes.json();
    assert.strictEqual(reactData.user.isActive, true);

  } finally {
    server.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }

  console.log('✓ All HTTP /api/users tests passed.');
  console.log('--- User Management Test Suite Completed Successfully! ---');
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('Test suite failed:', err);
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
