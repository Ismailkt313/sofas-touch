import assert from 'node:assert';
import app from '../../../index';
import { generateToken } from '../../../middleware/auth';
import { sharedUserMemoryStore } from '../../auth/models/user.model';
import { validateUpdateProjectStatusDto } from '../dto/update-status.dto';

async function testProjectStatus() {
  console.log('--- Testing Project Status DTO & Logic ---');

  const validInProgress = validateUpdateProjectStatusDto({ status: 'In Progress' });
  assert.strictEqual(validInProgress.isValid, true);
  assert.strictEqual(validInProgress.value?.status, 'In Progress');

  const validUnderReview = validateUpdateProjectStatusDto({ status: 'Under Review' });
  assert.strictEqual(validUnderReview.isValid, true);
  assert.strictEqual(validUnderReview.value?.status, 'Under Review');

  const validCompleted = validateUpdateProjectStatusDto({ status: 'Completed' });
  assert.strictEqual(validCompleted.isValid, true);
  assert.strictEqual(validCompleted.value?.status, 'Completed');

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
  const defaultOperatorId = 'usr_status_test_de_default';
  sharedUserMemoryStore.set(defaultOperatorId, {
    _id: defaultOperatorId as any,
    name: 'Default Operator',
    email: 'default.operator@softtouchsofas.com',
    role: 'data_entry',
    isActive: true,
    approvalStatus: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const authorizedEditorId = 'usr_status_test_de_editor';
  sharedUserMemoryStore.set(authorizedEditorId, {
    _id: authorizedEditorId as any,
    name: 'Status Editor',
    email: 'status.editor@softtouchsofas.com',
    role: 'data_entry',
    isActive: true,
    approvalStatus: 'approved',
    permissionOverrides: {
      grant: ['projects.create', 'projects.edit'],
      revoke: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const defaultDataEntryToken = generateToken({
    id: defaultOperatorId,
    email: 'default.operator@softtouchsofas.com',
    role: 'data_entry',
    name: 'Default Operator',
    approvalStatus: 'approved',
  });

  const authorizedEditorToken = generateToken({
    id: authorizedEditorId,
    email: 'status.editor@softtouchsofas.com',
    role: 'data_entry',
    name: 'Status Editor',
    approvalStatus: 'approved',
  });

  const server = app.listen(0);
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}/api/projects`;

  try {
    const unauthRes = await fetch(`${baseUrl}/PRJ-9999/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.strictEqual(unauthRes.status, 401);

    const forbiddenDefaultRes = await fetch(`${baseUrl}/PRJ-9999/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${defaultDataEntryToken}`,
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.strictEqual(forbiddenDefaultRes.status, 403);

    const forbiddenContractValueRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authorizedEditorToken}`,
      },
      body: JSON.stringify({
        name: 'Status Test Sectional',
        clientName: 'Status Test Client',
        category: 'Modular Sofa',
        contractValue: 15000,
        status: 'In Progress',
      }),
    });
    assert.strictEqual(forbiddenContractValueRes.status, 403);

    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authorizedEditorToken}`,
      },
      body: JSON.stringify({
        name: 'Status Test Sectional',
        clientName: 'Status Test Client',
        category: 'Modular Sofa',
        status: 'In Progress',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createdProject = ((await createRes.json()) as any).project;
    const testProjectId = createdProject.projectId;
    assert.strictEqual(createdProject.status, 'In Progress');

    const invalidStatusRes = await fetch(`${baseUrl}/${testProjectId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authorizedEditorToken}`,
      },
      body: JSON.stringify({ status: 'NotAStatus' }),
    });
    assert.strictEqual(invalidStatusRes.status, 400);

    const patchUnderReviewRes = await fetch(`${baseUrl}/${testProjectId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authorizedEditorToken}`,
      },
      body: JSON.stringify({ status: 'Under Review' }),
    });
    assert.strictEqual(patchUnderReviewRes.status, 200);
    const underReviewJson = (await patchUnderReviewRes.json()) as any;
    assert.strictEqual(underReviewJson.project.status, 'Under Review');
    assert.ok(underReviewJson.message.includes('successfully'));

    const patchCompletedRes = await fetch(`${baseUrl}/${testProjectId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authorizedEditorToken}`,
      },
      body: JSON.stringify({ status: 'Completed' }),
    });
    assert.strictEqual(patchCompletedRes.status, 200);
    const completedJson = (await patchCompletedRes.json()) as any;
    assert.strictEqual(completedJson.project.status, 'Completed');

    const notFoundRes = await fetch(`${baseUrl}/PRJ-NONEXISTENT-99999/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authorizedEditorToken}`,
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
