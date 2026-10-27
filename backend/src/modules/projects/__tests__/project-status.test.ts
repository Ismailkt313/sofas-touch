import assert from 'node:assert';
import app from '../../../index';
import { generateToken } from '../../../middleware/auth';
import { sharedUserMemoryStore } from '../../auth/models/user.model';
import { validateUpdateProjectStatusDto } from '../dto/update-status.dto';

async function testProjectStatus() {
  console.log('--- Testing Project Status DTO & Logic ---');

  // 1. Valid DTOs
  const validInProgress = validateUpdateProjectStatusDto({ status: 'In Progress' });
  assert.strictEqual(validInProgress.isValid, true);
  assert.strictEqual(validInProgress.value?.status, 'In Progress');

  const validUnderReview = validateUpdateProjectStatusDto({ status: 'Under Review' });
  assert.strictEqual(validUnderReview.isValid, true);
  assert.strictEqual(validUnderReview.value?.status, 'Under Review');

  const validCompleted = validateUpdateProjectStatusDto({ status: 'Completed' });
  assert.strictEqual(validCompleted.isValid, true);
  assert.strictEqual(validCompleted.value?.status, 'Completed');

  // 2. Invalid DTOs
  const emptyStatus = validateUpdateProjectStatusDto({});
  assert.strictEqual(emptyStatus.isValid, false);
  assert.ok(emptyStatus.errors?.status);

  const invalidValue = validateUpdateProjectStatusDto({ status: 'Archived' });
  assert.strictEqual(invalidValue.isValid, false);
  assert.ok(invalidValue.errors?.status?.includes('Status must be one of:'));

  const whitespaceValue = validateUpdateProjectStatusDto({ status: '   ' });
  assert.strictEqual(whitespaceValue.isValid, false);
  assert.ok(whitespaceValue.errors?.status);

  const nonObject = validateUpdateProjectStatusDto(null);
  assert.strictEqual(nonObject.isValid, false);
  assert.ok(nonObject.errors?.body);

  console.log('✓ Project Status DTO validation tests passed successfully.');

  console.log('--- Testing HTTP PATCH /api/projects/:id/status ---');
  const userId = 'usr_status_test_de';
  sharedUserMemoryStore.set(userId, {
    _id: userId as any,
    name: 'Status Tester',
    email: 'status.tester@softtouchsofas.com',
    role: 'data_entry',
    isActive: true,
    approvalStatus: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const dataEntryToken = generateToken({
    id: userId,
    email: 'status.tester@softtouchsofas.com',
    role: 'data_entry',
    name: 'Status Tester',
    approvalStatus: 'approved',
  });

  const server = app.listen(0);
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/projects`;

  try {
    // 1. Unauthenticated request
    const unauthRes = await fetch(`${baseUrl}/PRJ-9999/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.strictEqual(unauthRes.status, 401);

    // 2. Invalid status value
    const invalidStatusRes = await fetch(`${baseUrl}/PRJ-9999/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({ status: 'NotAStatus' }),
    });
    assert.strictEqual(invalidStatusRes.status, 400);

    // 3. Create a test project to test status patching
    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({
        name: 'Status Test Sectional',
        clientName: 'Status Test Client',
        category: 'Modular Sofa',
        contractValue: 15000,
        status: 'In Progress',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createdProject = ((await createRes.json()) as any).project;
    const testProjectId = createdProject.projectId;
    assert.strictEqual(createdProject.status, 'In Progress');

    // 4. Update status to 'Under Review'
    const patchUnderReviewRes = await fetch(`${baseUrl}/${testProjectId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({ status: 'Under Review' }),
    });
    assert.strictEqual(patchUnderReviewRes.status, 200);
    const underReviewJson = (await patchUnderReviewRes.json()) as any;
    assert.strictEqual(underReviewJson.project.status, 'Under Review');
    assert.ok(underReviewJson.message.includes('successfully'));

    // 5. Update status to 'Completed'
    const patchCompletedRes = await fetch(`${baseUrl}/${testProjectId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.strictEqual(patchCompletedRes.status, 200);
    const completedJson = (await patchCompletedRes.json()) as any;
    assert.strictEqual(completedJson.project.status, 'Completed');

    // 6. Test 404 for non-existent project
    const notFoundRes = await fetch(`${baseUrl}/PRJ-NONEXISTENT-99999/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataEntryToken}`,
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.strictEqual(notFoundRes.status, 404);

    console.log('✓ All HTTP PATCH /api/projects/:id/status tests passed successfully!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  process.exit(0);
}

testProjectStatus().catch((err) => {
  console.error('Project Status test failed:', err);
  process.exit(1);
});
