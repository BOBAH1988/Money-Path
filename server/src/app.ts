import Fastify, { type FastifyInstance } from 'fastify';

export interface AppOptions {
  logLevel: string;
}

export const buildApp = ({ logLevel }: AppOptions): FastifyInstance => {
  const app = Fastify({ logger: { level: logLevel } });

  app.get('/health', async () => ({ status: 'ok' }));

  return app;
};
