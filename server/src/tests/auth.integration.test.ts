/**
 * Integration tests for authentication / authorization.
 * Requires a real PostgreSQL database (TEST_DATABASE_URL or DATABASE_URL).
 */

import request from 'supertest';
import app from '../app';
import { db } from '../config/database';
import { hashPassword } from '../models/User';
import { generateToken, sha256, hashIpSubnet, hashUA } from '../services/crypto.service';
import { createSession } from '../models/Session';

let adminCookie: string;
let doctorACookie: string;
let doctorBCookie: string;
let adminId: string;
let doctorAId: string;
let doctorBId: string;
let patientAId: string;

const TEST_UA = 'TestAgent/1.0';
const TEST_IP = '127.0.0.1';

async function createTestUser(email: string, role: 'admin' | 'doctor'): Promise<string> {
  const hash = await hashPassword('StrongP@ss1234!');
  const row = await db.one<{ id: string }>(
    `INSERT INTO users (email, password_hash, role, totp_enabled, totp_verified, session_version)
     VALUES ($1, $2, $3, FALSE, FALSE, 0) RETURNING id`,
    [email, hash, role]
  );
  return row.id;
}

async function createTestSession(userId: string, ua = TEST_UA, scope: string[] = []): Promise<string> {
  const raw = generateToken(32);
  const sessionId = sha256(raw);
  const user = await db.one<{ session_version: number }>('SELECT session_version FROM users WHERE id = $1', [userId]);
  await createSession({
    id: sessionId,
    userId,
    sessionVersion: user.session_version,
    ipHash: hashIpSubnet(TEST_IP),
    uaHash: hashUA(ua),
    scope,
  });
  return raw;
}

beforeAll(async () => {
  await db.none("DELETE FROM users WHERE email LIKE '%@test.brainphone%'");
  await db.none('DELETE FROM rate_limits');

  adminId   = await createTestUser('admin@test.brainphone', 'admin');
  doctorAId = await createTestUser('doctora@test.brainphone', 'doctor');
  doctorBId = await createTestUser('doctorb@test.brainphone', 'doctor');

  const adminToken   = await createTestSession(adminId);
  const doctorAToken = await createTestSession(doctorAId);
  const doctorBToken = await createTestSession(doctorBId);

  adminCookie   = `sid=${adminToken}`;
  doctorACookie = `sid=${doctorAToken}`;
  doctorBCookie = `sid=${doctorBToken}`;

  const r = await db.one<{ id: string }>(
    `INSERT INTO patients (id, patient_name, age, gender, chief_complaint, created_by)
     VALUES ($1, 'Test Patient', '50', 'male', 'Test complaint', $2) RETURNING id`,
    [`PAT-TEST-${Date.now()}`, doctorAId]
  );
  patientAId = r.id;
}, 30000);

afterAll(async () => {
  await db.none("DELETE FROM users WHERE email LIKE '%@test.brainphone%'");
  await db.none('DELETE FROM patients WHERE patient_name = $1', ['Test Patient']);
  await db.none('DELETE FROM rate_limits');
  await db.$pool.end();
});

// ─── 1. Unauthenticated access ────────────────────────────────────────────────
describe('Unauthenticated access', () => {
  const protectedRoutes = [
    ['GET',    '/api/patients'],
    ['POST',   '/api/patients'],
    ['GET',    '/api/admin/users'],
    ['POST',   '/api/admin/invites'],
    ['GET',    '/api/auth/me'],
    ['POST',   '/api/auth/logout'],
    ['POST',   '/api/auth/totp/setup'],
  ];

  test.each(protectedRoutes)(
    '%s %s returns 401 without auth',
    async (method, path) => {
      const req = (request(app) as any)[method.toLowerCase()](path).set('User-Agent', TEST_UA);
      const res = await req;
      expect(res.status).toBe(401);
    }
  );

  test('Public routes accessible without auth', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    const r = await request(app).post('/api/auth/login').send({ email: 'x', password: 'y' });
    expect([400, 401, 429]).toContain(r.status);
  }, 15000);
});

// ─── 2. Role-based access control ────────────────────────────────────────────
describe('Role-based access control', () => {
  test('Doctor cannot GET /api/admin/users → 403', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', doctorACookie).set('User-Agent', TEST_UA);
    expect(res.status).toBe(403);
  });

  test('Admin can GET /api/admin/users → 200', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', adminCookie).set('User-Agent', TEST_UA);
    expect(res.status).toBe(200);
  });
});

// ─── 3. IDOR protection ───────────────────────────────────────────────────────
describe('IDOR protection', () => {
  test("Doctor B cannot read Doctor A's patient → 404", async () => {
    const res = await request(app)
      .get(`/api/patients/${patientAId}`)
      .set('Cookie', doctorBCookie).set('User-Agent', TEST_UA);
    expect(res.status).toBe(404);
  });

  test("Doctor A can read their own patient → 200", async () => {
    const res = await request(app)
      .get(`/api/patients/${patientAId}`)
      .set('Cookie', doctorACookie).set('User-Agent', TEST_UA);
    expect(res.status).toBe(200);
  });

  test("Doctor B's patient list excludes Doctor A's patients", async () => {
    const res = await request(app)
      .get('/api/patients')
      .set('Cookie', doctorBCookie).set('User-Agent', TEST_UA);
    expect(res.status).toBe(200);
    const ids = res.body.data.patients.map((p: any) => p.id);
    expect(ids).not.toContain(patientAId);
  });
});

// ─── 4. Session invalidation ──────────────────────────────────────────────────
describe('Session invalidation', () => {
  test('Old session rejected after session_version bump', async () => {
    const userId = await createTestUser('verstest@test.brainphone', 'doctor');
    const token = await createTestSession(userId);
    const cookie = `sid=${token}`;

    expect((await request(app).get('/api/auth/me').set('Cookie', cookie).set('User-Agent', TEST_UA)).status).toBe(200);

    await db.none('UPDATE users SET session_version = session_version + 1 WHERE id = $1', [userId]);

    expect((await request(app).get('/api/auth/me').set('Cookie', cookie).set('User-Agent', TEST_UA)).status).toBe(401);

    await db.none('DELETE FROM users WHERE id = $1', [userId]);
  });
});

// ─── 5. Session binding ───────────────────────────────────────────────────────
describe('Session binding', () => {
  test('Cookie with different User-Agent is rejected', async () => {
    const userId = await createTestUser('uatest@test.brainphone', 'doctor');
    const token = await createTestSession(userId, 'OriginalAgent/1.0');
    const cookie = `sid=${token}`;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .set('User-Agent', 'DifferentAgent/2.0');
    expect(res.status).toBe(401);

    await db.none('DELETE FROM users WHERE id = $1', [userId]);
  });
});

// ─── 6. Rate limiting ─────────────────────────────────────────────────────────
describe('Rate limiting', () => {
  test('5+ login failures trigger 429', async () => {
    const testEmail = `ratelimit${Date.now()}@test.com`;

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .set('User-Agent', TEST_UA)
        .send({ email: testEmail, password: 'wrong' });
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', TEST_UA)
      .send({ email: testEmail, password: 'wrong' });

    expect(blocked.status).toBe(429);
    await db.none('DELETE FROM rate_limits');
  }, 60000);
});

// ─── 7. No public registration ────────────────────────────────────────────────
describe('No public registration', () => {
  const paths = ['/signup', '/register', '/api/auth/signup', '/api/auth/register'];
  test.each(paths.map((p) => [p]))(
    '%s returns 404 or 401',
    async (path) => {
      const res = await request(app).post(path).send({ email: 'h@x.com', password: 'pass' });
      expect([401, 404]).toContain(res.status);
    }
  );
});

// ─── 8. Scoped session (totp_setup flow) ─────────────────────────────────────
describe('Scoped session: totp_setup', () => {
  test('Scoped session cannot access /api/patients → 403 with requiresTotpSetup', async () => {
    const userId = await createTestUser('scoped@test.brainphone', 'admin');
    const token = await createTestSession(userId, TEST_UA, ['totp_setup']);
    const cookie = `sid=${token}`;

    const res = await request(app)
      .get('/api/patients')
      .set('Cookie', cookie)
      .set('User-Agent', TEST_UA);
    expect(res.status).toBe(403);
    expect(res.body.requiresTotpSetup).toBe(true);

    await db.none('DELETE FROM users WHERE id = $1', [userId]);
  });

  test('Scoped session can access /api/auth/me → 200 with scope in response', async () => {
    const userId = await createTestUser('scopedme@test.brainphone', 'admin');
    const token = await createTestSession(userId, TEST_UA, ['totp_setup']);
    const cookie = `sid=${token}`;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .set('User-Agent', TEST_UA);
    expect(res.status).toBe(200);
    expect(res.body.scope).toContain('totp_setup');

    await db.none('DELETE FROM users WHERE id = $1', [userId]);
  });

  test('Scoped session cannot access /api/admin/users → 403', async () => {
    const userId = await createTestUser('scopedadmin@test.brainphone', 'admin');
    const token = await createTestSession(userId, TEST_UA, ['totp_setup']);
    const cookie = `sid=${token}`;

    const res = await request(app)
      .get('/api/admin/users')
      .set('Cookie', cookie)
      .set('User-Agent', TEST_UA);
    expect(res.status).toBe(403);

    await db.none('DELETE FROM users WHERE id = $1', [userId]);
  });
});

// ─── 9. Account lockout ───────────────────────────────────────────────────────
describe('Account lockout', () => {
  test('Account locked after 10 failures returns 423', async () => {
    const userId = await createTestUser('locktest@test.brainphone', 'doctor');
    const email = 'locktest@test.brainphone';

    // Simulate 10 failures via the DB (incrementFailedAttempts)
    await db.none(
      `UPDATE users SET failed_attempts = 10, locked_until = NOW() + INTERVAL '1 hour' WHERE id = $1`,
      [userId]
    );

    const res = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', TEST_UA)
      .send({ email, password: 'StrongP@ss1234!' });

    expect(res.status).toBe(423);

    await db.none('DELETE FROM users WHERE id = $1', [userId]);
    await db.none('DELETE FROM rate_limits');
  });
});

// ─── 10. Admin path protection ───────────────────────────────────────────────
describe('Admin path protection', () => {
  test('Doctor cannot access /api/admin/invites', async () => {
    const res = await request(app)
      .post('/api/admin/invites')
      .set('Cookie', doctorACookie)
      .set('User-Agent', TEST_UA)
      .send({ email: 'new@test.com', role: 'doctor' });
    expect(res.status).toBe(403);
  });

  test('Admin can access /api/admin/invites', async () => {
    const res = await request(app)
      .post('/api/admin/invites')
      .set('Cookie', adminCookie)
      .set('User-Agent', TEST_UA)
      .send({ email: `new-${Date.now()}@test.brainphone`, role: 'doctor' });
    expect([201, 409]).toContain(res.status); // 201 created or 409 already exists
  });
});
