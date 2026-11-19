import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

describeDb('routes /me/profile (Postgres)', () => {
  let handle: DbHandle;
  const apps: FastifyInstance[] = [];

  const appFor = (uid: string, email: string | null = null): FastifyInstance => {
    const app = createTestApp(verifierReturning({ uid, email, emailVerified: true }), handle.db);
    apps.push(app);
    return app;
  };

  beforeAll(async () => {
    handle = createDb(databaseUrl!);
    await migrate(handle.db, { migrationsFolder });
  });

  beforeEach(async () => {
    await handle.db.execute(sql`truncate table profiles`);
  });

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  afterAll(async () => {
    await handle.pool.end();
  });

  it('создаёт профиль при первом чтении и берёт uid из токена', async () => {
    const response = await appFor('u1', 'user@example.com').inject({
      method: 'GET',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ uid: 'u1', email: 'user@example.com', avatar: null });

    const rows = await handle.db.select().from(profiles);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.uid).toBe('u1');
  });

  it('сохраняет аватар и email, затем отдаёт их из GET', async () => {
    const app = appFor('u1', 'user@example.com');

    const saved = await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
      payload: { email: 'new@example.com', avatar: 'data:image/png;base64,AAA' },
    });
    expect(saved.statusCode).toBe(204);

    const read = await app.inject({
      method: 'GET',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
    });
    expect(read.json()).toMatchObject({ uid: 'u1', email: 'new@example.com', avatar: 'data:image/png;base64,AAA' });
  });

  it('не затирает аватар, если поле не прислали', async () => {
    const app = appFor('u1', 'user@example.com');
    await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
      payload: { avatar: 'data:image/png;base64,AAA' },
    });
    await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
      payload: { email: 'only-email@example.com' },
    });

    const read = await app.inject({
      method: 'GET',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
    });
    expect(read.json()).toMatchObject({
      email: 'only-email@example.com',
      avatar: 'data:image/png;base64,AAA',
    });
  });

  it('avatar: null удаляет аватар', async () => {
    const app = appFor('u1', 'user@example.com');
    await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
      payload: { avatar: 'data:image/png;base64,AAA' },
    });
    await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
      payload: { avatar: null },
    });

    const read = await app.inject({
      method: 'GET',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
    });
    expect(read.json()).toMatchObject({ avatar: null });
  });

  it('не даёт записать данные под чужим uid', async () => {
    const app = appFor('u1', 'user@example.com');
    const response = await app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: { authorization: 'Bearer token' },
      payload: { uid: 'u2', email: 'attacker@example.com' },
    });

    expect(response.statusCode).toBe(422);
    const rows = await handle.db.select().from(profiles);
    expect(rows).toHaveLength(0);
  });
});
