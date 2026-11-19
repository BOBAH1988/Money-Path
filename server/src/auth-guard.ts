import type { FastifyInstance } from 'fastify';
import type { AuthUser, TokenVerifier } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

export const authError = (message: string) => ({
  code: 'UNAUTHENTICATED' as const,
  message,
});

const bearerToken = (header: string | undefined): string | null => {
  if (!header) return null;
  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;
  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
};

/**
 * Проверяет ID-token на каждом запросе, кроме публичных путей.
 * uid всегда берётся из результата проверки токена — клиент не может его подменить.
 */
export const registerAuthGuard = (app: FastifyInstance, verifier: TokenVerifier): void => {
  app.decorateRequest('authUser', null);

  app.addHook('onRequest', async (request, reply) => {
    if (request.routeOptions.url === '/health') return;

    const token = bearerToken(request.headers.authorization);
    if (!token) {
      return reply.code(401).send(authError('Требуется авторизация'));
    }

    try {
      request.authUser = await verifier.verify(token);
    } catch {
      return reply.code(401).send(authError('Сессия недействительна или истекла'));
    }

    if (!request.authUser.emailVerified) {
      return reply.code(403).send({
        code: 'FORBIDDEN',
        message: 'Подтвердите адрес электронной почты',
      });
    }
  });
};
