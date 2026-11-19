import type { FastifyReply } from 'fastify';
import type { z } from 'zod';

export const sendError = (
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) => reply.code(status).send({ code, message, ...(details === undefined ? {} : { details }) });

export const unauthenticated = (reply: FastifyReply) =>
  sendError(reply, 401, 'UNAUTHENTICATED', 'Требуется авторизация');

export const noDatabase = (reply: FastifyReply) =>
  sendError(reply, 503, 'INTERNAL', 'База данных не настроена');

export const forbidden = (reply: FastifyReply, message = 'Недостаточно прав') =>
  sendError(reply, 403, 'FORBIDDEN', message);

export const notFound = (reply: FastifyReply, message = 'Ресурс не найден') =>
  sendError(reply, 404, 'NOT_FOUND', message);

export const validationError = (reply: FastifyReply, error: z.ZodError) =>
  sendError(
    reply,
    422,
    'VALIDATION_ERROR',
    'Некорректное тело запроса',
    error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );

/** Достаёт ошибку из результата разбора параметра пути (не тела). */
export const paramError = (reply: FastifyReply, message: string) =>
  sendError(reply, 422, 'VALIDATION_ERROR', message);
