import assert from 'node:assert';
import http from 'node:http';
import app from '../../../index.js';
import { connectDB } from '../../../config/db.js';
import { generateToken } from '../../../middleware/auth.js';
import { validateListActivitiesQuery } from '../dto/activity.dto.js';

async function sendRequest(
  server: http.Server,
  path: string,
  token?: string
): Promise<{ status: number; body: any }> {
  const address = server.address() as any;
  const port = address.port;

  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      `http://127.0.0.1:${port}${path}`,
      { method: 'GET', headers },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const body = rawData ? JSON.parse(rawData) : null;
            resolve({ status: res.statusCode || 500, body });
          } catch {
            resolve({ status: res.statusCode || 500, body: rawData });
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function runActivityEndpointTests() {
  console.log('--- Testing Activity History Endpoints & DTO Validation ---');

  // 1. DTO Unit Tests
  console.log('1. Testing validateListActivitiesQuery edge cases...');

  // Missing page/limit
  const q1 = validateListActivitiesQuery({});
  assert.strictEqual(q1.isValid, true);
  assert.strictEqual(q1.value?.page, 1, 'Missing page must default to 1');
  assert.strictEqual(q1.value?.limit, 10, 'Missing limit must default to 10');

  // String page
  const q2 = validateListActivitiesQuery({ page: '2', limit: '10' });
  assert.strictEqual(q2.isValid, true);
  assert.strictEqual(q2.value?.page, 2);
  assert.strictEqual(q2.value?.limit, 10);

  // Invalid / non-integer / negative / function string page
  const q3 = validateListActivitiesQuery({ page: '0' });
  assert.strictEqual(q3.isValid, true);
  assert.strictEqual(q3.value?.page, 1, '0 should normalize safely to 1');

  const q4 = validateListActivitiesQuery({ page: '-5' });
  assert.strictEqual(q4.isValid, true);
  assert.strictEqual(q4.value?.page, 1, 'Negative numbers should normalize to 1');

  const q5 = validateListActivitiesQuery({ page: 'invalid_string' });
  assert.strictEqual(q5.isValid, true);
  assert.strictEqual(q5.value?.page, 1, 'Invalid string should normalize to 1');

  const q6 = validateListActivitiesQuery({ page: '(p) => Math.max(1, p - 1)' });
  assert.strictEqual(q6.isValid, true);
  assert.strictEqual(
    q6.value?.page,
    1,
    'Callback string representation should normalize safely to 1'
  );

  console.log('✓ DTO validations handled edge cases safely without throwing 400.');

  // 2. Integration HTTP Tests
  console.log('2. Testing live /api/activities endpoint with various queries...');
  await connectDB();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const adminToken = generateToken({
      id: 'usr_admin_001',
      email: 'admin@softtouchsofas.com',
      role: 'admin',
      name: 'Admin User',
      approvalStatus: 'approved',
    });

    // Default fetch
    const listRes1 = await sendRequest(server, '/api/activities', adminToken);
    assert.strictEqual(listRes1.status, 200, 'Default list must return status 200');
    assert(Array.isArray(listRes1.body.items), 'items must be an array');
    assert.strictEqual(typeof listRes1.body.total, 'number');
    assert.strictEqual(listRes1.body.page, 1);
    assert(listRes1.body.summary, 'summary object must be present');
    assert.strictEqual(typeof listRes1.body.summary.total, 'number');
    assert.strictEqual(typeof listRes1.body.summary.today, 'number');
    assert.strictEqual(typeof listRes1.body.summary.projects, 'number');
    assert.strictEqual(typeof listRes1.body.summary.financial, 'number');
    console.log(
      `✓ Default list returned ${listRes1.body.items.length} items (total ${listRes1.body.total}), summary:`,
      listRes1.body.summary
    );

    // Edge-case query parameters: page=0, page=-1, page=function string
    const listRes2 = await sendRequest(server, '/api/activities?page=0', adminToken);
    assert.strictEqual(listRes2.status, 200, 'page=0 must succeed safely');
    assert.strictEqual(listRes2.body.page, 1);

    const listRes3 = await sendRequest(
      server,
      '/api/activities?page=%28p%29%20%3D%3E%20Math.max%281%2C%20p%20-%201%29',
      adminToken
    );
    assert.strictEqual(
      listRes3.status,
      200,
      'function string in page parameter must not cause 400 error'
    );
    assert.strictEqual(listRes3.body.page, 1);

    // Query with search and filter
    const listRes4 = await sendRequest(
      server,
      '/api/activities?entityType=project&limit=5',
      adminToken
    );
    assert.strictEqual(listRes4.status, 200);
    assert(listRes4.body.items.length <= 5);

    console.log('✓ All /api/activities integration edge cases passed flawlessly!');
  } finally {
    server.close();
  }

  console.log('--- All Activity Endpoint Tests Passed Successfully! ---');
  process.exit(0);
}

runActivityEndpointTests().catch((err) => {
  console.error('Activity tests failed:', err);
  process.exit(1);
});
