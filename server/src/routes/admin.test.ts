import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, type DbHandle } from '../db/index.js';
import { profiles } from '../db/schema.js';
import { createTestApp, verifierReturning } from '../test-support.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

describe('GET /admin/stats без базы', () => {
  const app = (uid: string): FastifyInstance =>
    createTestApp(verifierReturning({ uid, email: null, emailVerified: true }), null, ['admin-1']);

  it('обычному пользователю отвечает 403', async () => {
    const response = await app('u1').inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN' });
    await Promise.resolve();
  });

  it('администратору без базы отвечает 503, а не 403', async () => {
    const response = await app('admin-1').inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'INTERNAL' });
  });
});

describeDb('GET /admin/stats (Postgres)', () => {
  let handle: DbHandle;

  beforeAll(async () => {
    handle = createDb(databaseUrl!);
    await migrate(handle.db, { migrationsFolder });
  });

  beforeEach(async () => {
    await handle.db.execute(sql`truncate table profiles`);
    await handle.db.insert(profiles).values([
      { uid: 'u-old', email: 'old@example.com', createdAt: daysAgo(40), lastActive: daysAgo(1) },
      { uid: 'u-fresh', email: 'fresh@example.com', createdAt: daysAgo(2), lastActive: daysAgo(2) },
      { uid: 'u-sleepy', email: 'sleepy@example.com', createdAt: daysAgo(20), lastActive: daysAgo(40) },
    ]);
  });

  afterAll(async () => {
    await handle.pool.end();
  });

  it('считает только агрегаты, без почт и uid', async () => {
    const app = createTestApp(
      verifierReturning({ uid: 'admin-1', email: 'admin@example.com', emailVerified: true }),
      handle.db,
      ['admin-1'],
    );

    const response = await app.inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ total: 3, active30: 2, new30: 2, new7: 1 });
    expect(JSON.stringify(response.json())).not.toContain('example.com');
    await app.close();
  });

  it('закрыт для обычного пользователя даже с базой', async () => {
    const app = createTestApp(
      verifierReturning({ uid: 'u1', email: 'u1@example.com', emailVerified: true }),
      handle.db,
      ['admin-1'],
    );

    const response = await app.inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('без ADMIN_UIDS закрыт всем', async () => {
    const app = createTestApp(
      verifierReturning({ uid: 'admin-1', email: 'admin@example.com', emailVerified: true }),
      handle.db,
    );

    const response = await app.inject({
      method: 'GET',
      url: '/admin/stats',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
