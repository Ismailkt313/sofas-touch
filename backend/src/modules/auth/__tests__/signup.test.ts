import assert from 'assert';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import app from '../../../index';
import { connectDB } from '../../../config/db';
import { validateSignupDto } from '../dto/signup.dto';
import { AuthService, UserAlreadyExistsError } from '../service/auth.service';
import { AuthRepository } from '../repository/auth.repository';
import { authRepository } from '../index';

async function runTests() {
  await connectDB();
  console.log('--- Starting Signup Module Test Suite ---');

  // 1. Validation Tests (validateSignupDto)
  console.log('Testing validateSignupDto...');
  {
    // Valid input with name
    const validResult = validateSignupDto({
      name: 'Jane Doe',
      email: 'Jane.Doe@example.com',
      phone: '+44 20 7946 0123',
      password: 'SecurePassword123',
    });
    assert.strictEqual(validResult.isValid, true);
    assert.strictEqual(validResult.value?.name, 'Jane Doe');
    assert.strictEqual(validResult.value?.email, 'jane.doe@example.com');
    assert.strictEqual(validResult.value?.phone, '+44 20 7946 0123');
    assert.strictEqual(validResult.value?.password, 'SecurePassword123');

    // Valid input with fullName alias
    const fullNameResult = validateSignupDto({
      fullName: 'John Smith',
      email: 'john@example.com',
      password: 'Password99',
    });
    assert.strictEqual(fullNameResult.isValid, true);
    assert.strictEqual(fullNameResult.value?.name, 'John Smith');

    // Role tampering prevention in DTO
    const roleTamperResult = validateSignupDto({
      name: 'Hacker',
      email: 'hacker@example.com',
      password: 'Password123',
      role: 'admin',
    });
    assert.strictEqual(roleTamperResult.isValid, true);
    // TypeScript & value guarantee no role is passed
    assert.strictEqual((roleTamperResult.value as any).role, undefined);

    // Missing required fields
    const emptyResult = validateSignupDto({});
    assert.strictEqual(emptyResult.isValid, false);
    assert.ok(emptyResult.errors?.name);
    assert.ok(emptyResult.errors?.email);
    assert.ok(emptyResult.errors?.password);

    // Invalid email format
    const invalidEmailResult = validateSignupDto({
      name: 'Alice',
      email: 'not-an-email',
      password: 'Password123',
    });
    assert.strictEqual(invalidEmailResult.isValid, false);
    assert.ok(invalidEmailResult.errors?.email);

    // Weak password (too short)
    const shortPasswordResult = validateSignupDto({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'short',
    });
    assert.strictEqual(shortPasswordResult.isValid, false);
    assert.ok(shortPasswordResult.errors?.password);

    // Weak password (no number)
    const noNumberPasswordResult = validateSignupDto({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'PasswordOnly',
    });
    assert.strictEqual(noNumberPasswordResult.isValid, false);
    assert.ok(noNumberPasswordResult.errors?.password);

    // Password mismatch when confirmPassword is provided
    const mismatchResult = validateSignupDto({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'Password123',
      confirmPassword: 'Password456',
    });
    assert.strictEqual(mismatchResult.isValid, false);
    assert.ok(mismatchResult.errors?.confirmPassword);
  }
  console.log('✓ validateSignupDto tests passed.');

  // 2. AuthService Tests
  console.log('Testing AuthService.signup...');
  {
    const repo = new AuthRepository();
    const service = new AuthService(repo);

    // Attempting to signup with existing seed email throws UserAlreadyExistsError
    let threw = false;
    try {
      await service.signup({
        name: 'Duplicate Admin',
        email: 'admin@softtouchsofas.com',
        password: 'Password123',
      });
    } catch (err) {
      assert.ok(err instanceof UserAlreadyExistsError);
      threw = true;
    }
    assert.strictEqual(threw, true, 'Should reject existing user email');

    // Successful signup
    const signupResult = await service.signup({
      name: 'Brand New User',
      email: 'newuser@softtouchsofas.com',
      phone: '+1 555 123 4567',
      password: 'SecurePassword123',
    });

    assert.ok(signupResult.user);
    assert.strictEqual(signupResult.user.name, 'Brand New User');
    assert.strictEqual(signupResult.user.email, 'newuser@softtouchsofas.com');
    assert.strictEqual(signupResult.user.role, 'data_entry');
    assert.strictEqual(signupResult.user.isActive, true);
    assert.strictEqual((signupResult.user as any).password, undefined);
    assert.strictEqual((signupResult.user as any).passwordHash, undefined);

    // Verify password is encrypted in database/store and can authenticate
    const savedUserInRepo = await repo.findByEmail('newuser@softtouchsofas.com', true);
    assert.ok(savedUserInRepo);
    assert.notStrictEqual(savedUserInRepo.password, 'SecurePassword123');
    assert.ok(bcrypt.compareSync('SecurePassword123', savedUserInRepo.password!));

    // Verify duplicate signup with new user email now fails
    let threwDuplicate = false;
    try {
      await service.signup({
        name: 'Brand New User 2',
        email: 'newuser@softtouchsofas.com',
        password: 'SecurePassword123',
      });
    } catch (err) {
      assert.ok(err instanceof UserAlreadyExistsError);
      threwDuplicate = true;
    }
    assert.strictEqual(threwDuplicate, true, 'Should reject duplicate user email on second attempt');

    // Verify Mongo duplicate key error handling (code 11000) simulation
    const mockRepo: any = {
      findByEmail: async () => null,
      create: async () => {
        const error: any = new Error('E11000 duplicate key error');
        error.code = 11000;
        throw error;
      },
    };
    const mockService = new AuthService(mockRepo);
    let threw11000 = false;
    try {
      await mockService.signup({
        name: 'Concurrent User',
        email: 'concurrent@example.com',
        password: 'Password123',
      });
    } catch (err) {
      assert.ok(err instanceof UserAlreadyExistsError);
      threw11000 = true;
    }
    assert.strictEqual(threw11000, true, 'Concurrent 11000 code must translate to UserAlreadyExistsError');
  }
  console.log('✓ AuthService.signup tests passed.');

  // 3. HTTP Server Integration Tests
  console.log('Testing HTTP /api/auth/signup endpoint...');
  {
    const server = app.listen(0);
    const address = server.address() as any;
    const baseUrl = `http://localhost:${address.port}`;

    try {
      // Test 1: Successful registration
      const testEmail = `test_${Date.now()}@example.com`;
      const res1 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Integration Test User',
          email: testEmail,
          phone: '+44 7123 456789',
          password: 'ValidPassword123',
          role: 'admin', // Tamper attempt
        }),
      });
      const data1: any = await res1.json();
      assert.strictEqual(res1.status, 201, `Expected 201 Created but got ${res1.status}`);
      assert.strictEqual(data1.message, 'Account created successfully.');
      assert.strictEqual(data1.user.name, 'Integration Test User');
      assert.strictEqual(data1.user.email, testEmail);
      assert.strictEqual(data1.user.role, 'data_entry', 'Role must default to data_entry and ignore admin attempt');
      assert.strictEqual(data1.user.isActive, true);
      assert.strictEqual(data1.user.password, undefined);

      // Test 2: Duplicate registration returns 409 Conflict
      const res2 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Another User',
          email: testEmail,
          password: 'ValidPassword123',
        }),
      });
      const data2: any = await res2.json();
      assert.strictEqual(res2.status, 409, `Expected 409 Conflict but got ${res2.status}`);
      assert.strictEqual(data2.error, 'Conflict');
      assert.ok(data2.message.includes('already exists'));

      // Test 3: Validation failure returns 400 Bad Request
      const res3 = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'short',
        }),
      });
      const data3: any = await res3.json();
      assert.strictEqual(res3.status, 400);
      assert.strictEqual(data3.error, 'Bad Request');
      assert.ok(data3.errors.name);
      assert.ok(data3.errors.email);
      assert.ok(data3.errors.password);

      // Test 4: Verify created user can now login
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: 'ValidPassword123',
        }),
      });
      const loginData: any = await loginRes.json();
      assert.strictEqual(loginRes.status, 200);
      assert.strictEqual(loginData.authenticated, true);
      assert.ok(loginData.token);
      assert.strictEqual(loginData.user.role, 'data_entry');
    } finally {
      server.close();
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
    }
  }
  console.log('✓ HTTP endpoint tests passed.');

  console.log('--- All Tests Passed Successfully! ---');
  process.exit(0);
}

runTests().catch(async (err) => {
  console.error('Test suite failed:', err);
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(1);
});
