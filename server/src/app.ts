import Fastify, { type FastifyInstance } from 'fastify';
import { registerAuthGuard } from './auth-guard.js';
import type { TokenVerifier } from './auth.js';
import type { Database } from './db/index.js';
import { registerProfileRoutes } from './routes/profile.js';

export interface AppOptions {
  logLevel: string;
  verifier: TokenVerifier;
  db?: Database | null;
}

export const buildApp = ({ logLevel, verifier, db = null }: AppOptions): FastifyInstance => {
  const app = Fastify({ logger: { level: logLevel } });

  registerAuthGuard(app, verifier);

  app.get('/health', async () => ({ status: 'ok' }));

  registerProfileRoutes(app, db);

  return app;
};
