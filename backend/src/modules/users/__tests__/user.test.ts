import assert from 'assert';
import mongoose from 'mongoose';
import app from '../../../index';
import { connectDB } from '../../../config/db';
import { generateToken } from '../../../middleware/auth';
import { validateListUsersDto } from '../dto/list-users.dto';
import { validateListPendingApprovalsDto } from '../dto/list-pending-approvals.dto';
import { validateRejectUserDto } from '../dto/reject-user.dto';
import { validateCreateUserDto } from '../dto/create-user.dto';
import { validateUpdateUserDto } from '../dto/update-user.dto';
import { validateUpdateStatusDto } from '../dto/update-status.dto';

async function runTests() {
  await connectDB();
  console.log('--- Starting User Management & Approvals Test Suite ---');

  // Generate test tokens
  const adminToken = generateToken({
    id: 'usr_admin_001',
    email: 'admin@softtouchsofas.com',
    role: 'admin',
    name: 'Admin User',
    approvalStatus: 'approved',
  });

  const dataEntryToken = generateToken({
    id: 'usr_data_entry_002',
    email: 'dataentry@softtouchsofas.com',
    role: 'data_entry',
    name: 'Data Entry User',
    approvalStatus: 'approved',
  });

  // 1. DTO Unit Tests
  console.log('Testing DTO validations...');
  {
    // ListUsersDto
    const validList = validateListUsersDto({
      page: '2',
      limit: '20',
      search: 'john',
      role: 'admin',
      status: 'active',
    });
    assert.strictEqual(validList.isValid, true);
    assert.strictEqual(validList.value?.page, 2);
    assert.strictEqual(validList.value?.limit, 20);
    assert.strictEqual(validList.value?.search, 'john');
    assert.strictEqual(validList.value?.role, 'admin');
    assert.strictEqual(validList.value?.status, 'active');

    const invalidList = validateListUsersDto({
      page: '-1',
      limit: '200',
      role: 'superuser',
      status: 'banned',
    });
    assert.strictEqual(invalidList.isValid, false);
    assert.ok(invalidList.errors?.page);
    assert.ok(invalidList.errors?.limit);
    assert.ok(invalidList.errors?.role);
    assert.ok(invalidList.errors?.status);

    // ListPendingApprovalsDto
    const validPendingDto = validateListPendingApprovalsDto({
      page: '1',
      limit: '15',
      search: 'operator',
    });
    assert.strictEqual(validPendingDto.isValid, true);
    assert.strictEqual(validPendingDto.value?.page, 1);
    assert.strictEqual(validPendingDto.value?.limit, 15);
    assert.strictEqual(validPendingDto.value?.search, 'operator');

    const invalidPendingDto = validateListPendingApprovalsDto({
      page: '0',
      limit: '500',
    });
    assert.strictEqual(invalidPendingDto.isValid, false);
    assert.ok(invalidPendingDto.errors?.page);
    assert.ok(invalidPendingDto.errors?.limit);

    // RejectUserDto
    const validRejectDto = validateRejectUserDto({
      reason: 'Missing verification documents',
    });
    assert.strictEqual(validRejectDto.isValid, true);
    assert.strictEqual(validRejectDto.value?.reason, 'Missing verification documents');

    const emptyRejectDto = validateRejectUserDto({});
    assert.strictEqual(emptyRejectDto.isValid, true);
    assert.strictEqual(emptyRejectDto.value?.reason, undefined);

    const tooLongRejectDto = validateRejectUserDto({
      reason: 'A'.repeat(501),
    });
    assert.strictEqual(tooLongRejectDto.isValid, false);
    assert.ok(tooLongRejectDto.errors?.reason);

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
    const validUpdate = validateUpdateUserDto({
      name: 'Updated Name',
      role: 'admin',
    });
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
    // Test A: Authentication & Authorization on /api/users
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
    for (const u of listData.users) {
      assert.strictEqual(u.password, undefined);
      assert.strictEqual(u.passwordHash, undefined);
    }

    // Test C: POST /api/users (Create Data Entry Operator via Admin)
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
    assert.strictEqual(createData.user.approvalStatus, 'approved', 'Admin-created user should be approved');
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

    // Test D: GET /api/users/pending-approvals (Admin-only listing of pending signups)
    console.log('Testing GET /api/users/pending-approvals...');
    // D1: Guard checks
    const pendingUnauth = await fetch(`${baseUrl}/api/users/pending-approvals`);
    assert.strictEqual(pendingUnauth.status, 401, 'Must reject unauthenticated request');

    const pendingForbidden = await fetch(`${baseUrl}/api/users/pending-approvals`, {
      headers: { Authorization: `Bearer ${dataEntryToken}` },
    });
    assert.strictEqual(pendingForbidden.status, 403, 'Must reject non-admin users');

    // D2: Register a new public signup user who will be in pending status
    const pendingUserEmail = `pending_user_${Date.now()}@example.com`;
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Pending Applicant',
        email: pendingUserEmail,
        password: 'ApplicantPass123',
        phone: '+44 7000 111222',
      }),
    });
    assert.strictEqual(signupRes.status, 201);
    const signupData: any = await signupRes.json();
    const pendingUserId = signupData.user.id;
    assert.strictEqual(signupData.user.approvalStatus, 'pending');

    // D3: Admin lists pending approvals and sees the new user
    const pendingListRes = await fetch(`${baseUrl}/api/users/pending-approvals?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(pendingListRes.status, 200);
    const pendingListData: any = await pendingListRes.json();
    assert.ok(Array.isArray(pendingListData.users));
    assert.ok(pendingListData.pagination);
    const foundPending = pendingListData.users.find((u: any) => u.email === pendingUserEmail);
    assert.ok(foundPending, 'Newly signed up user must be present in pending approvals list');
    assert.strictEqual(foundPending.approvalStatus, 'pending');

    // Test E: PATCH /api/users/:id/approve
    console.log('Testing PATCH /api/users/:id/approve...');
    // E1: Self-approval attempt by Admin must be blocked
    const selfApproveRes = await fetch(`${baseUrl}/api/users/usr_admin_001/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(selfApproveRes.status, 400);
    const selfApproveData: any = await selfApproveRes.json();
    assert.ok(selfApproveData.message.includes('approve'));

    // E2: Non-existent ID returns 404
    const notFoundApproveRes = await fetch(`${baseUrl}/api/users/non_existent_id/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(notFoundApproveRes.status, 404);

    // E3: Non-admin cannot approve
    const dataEntryApproveRes = await fetch(`${baseUrl}/api/users/${pendingUserId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${dataEntryToken}` },
    });
    assert.strictEqual(dataEntryApproveRes.status, 403);

    // E4: Admin successfully approves pending user
    const approveRes = await fetch(`${baseUrl}/api/users/${pendingUserId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(approveRes.status, 200);
    const approveData: any = await approveRes.json();
    assert.strictEqual(approveData.message, 'User account approved successfully.');
    assert.strictEqual(approveData.user.id, pendingUserId);
    assert.strictEqual(approveData.user.approvalStatus, 'approved');
    assert.strictEqual(approveData.user.role, 'data_entry', 'Approval must never change role to admin');
    assert.strictEqual(approveData.user.approvedBy, 'usr_admin_001');
    assert.ok(approveData.user.approvedAt);

    // E5: Already approved user cannot be approved again (returns 400)
    const repeatApproveRes = await fetch(`${baseUrl}/api/users/${pendingUserId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(repeatApproveRes.status, 400);
    const repeatApproveData: any = await repeatApproveRes.json();
    assert.ok(repeatApproveData.message.includes('already'));

    // E6: Approved user is no longer in pending approvals
    const pendingAfterApprove = await fetch(`${baseUrl}/api/users/pending-approvals`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const pendingAfterData: any = await pendingAfterApprove.json();
    const stillInPending = pendingAfterData.users.some((u: any) => u.email === pendingUserEmail);
    assert.strictEqual(stillInPending, false, 'Approved user must not appear in pending list');

    // Test F: PATCH /api/users/:id/reject
    console.log('Testing PATCH /api/users/:id/reject...');
    // F1: Register another user to test rejection
    const rejectTargetEmail = `reject_target_${Date.now()}@example.com`;
    const signupRejectTarget = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rejected Applicant',
        email: rejectTargetEmail,
        password: 'Password123',
      }),
    });
    assert.strictEqual(signupRejectTarget.status, 201);
    const rejectTargetData: any = await signupRejectTarget.json();
    const rejectTargetId = rejectTargetData.user.id;

    // F2: Self-rejection by Admin must be blocked
    const selfRejectRes = await fetch(`${baseUrl}/api/users/usr_admin_001/reject`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Self test' }),
    });
    assert.strictEqual(selfRejectRes.status, 400);

    // F3: Admin successfully rejects pending user with optional reason
    const rejectRes = await fetch(`${baseUrl}/api/users/${rejectTargetId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: 'Incomplete documentation provided during onboarding.',
      }),
    });
    assert.strictEqual(rejectRes.status, 200);
    const rejectResData: any = await rejectRes.json();
    assert.strictEqual(rejectResData.user.approvalStatus, 'rejected');
    assert.strictEqual(
      rejectResData.user.rejectionReason,
      'Incomplete documentation provided during onboarding.',
    );

    // F4: Rejected user login is blocked with 403 Forbidden and code ACCOUNT_REJECTED
    const rejectedLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: rejectTargetEmail,
        password: 'Password123',
      }),
    });
    assert.strictEqual(rejectedLoginRes.status, 403);
    const rejectedLoginData: any = await rejectedLoginRes.json();
    assert.strictEqual(rejectedLoginData.code, 'ACCOUNT_REJECTED');

    // F5: Cannot reject an already-rejected account (returns 400)
    const repeatRejectRes = await fetch(`${baseUrl}/api/users/${rejectTargetId}/reject`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: 'Already rejected' }),
    });
    assert.strictEqual(repeatRejectRes.status, 400);

    // Test G: PATCH /api/users/:id/status (Deactivate & Reactivate)
    console.log('Testing PATCH /api/users/:id/status...');
    const deactRes = await fetch(`${baseUrl}/api/users/${createdUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.strictEqual(deactRes.status, 200);

    const deactLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        password: 'Password123',
      }),
    });
    assert.strictEqual(deactLoginRes.status, 403);
    const deactLoginData: any = await deactLoginRes.json();
    assert.strictEqual(deactLoginData.code, 'ACCOUNT_INACTIVE');

    // Self-deactivation prevention for admin
    const selfDeactRes = await fetch(`${baseUrl}/api/users/usr_admin_001/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.strictEqual(selfDeactRes.status, 400);

    // Reactivate user
    const reactRes = await fetch(`${baseUrl}/api/users/${createdUserId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.strictEqual(reactRes.status, 200);

  } finally {
    server.close();
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }

  console.log('✓ All HTTP /api/users & approval tests passed.');
  console.log('--- User Management & Approvals Test Suite Completed Successfully! ---');
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('Test suite failed:', err);
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
