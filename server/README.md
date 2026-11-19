# Money-Path server

Бэкенд для Money-Path: Fastify + TypeScript, Postgres (с этапа 3).
План переезда — [`PLAN.md`](./PLAN.md).

## Требования

- Node.js 22+ (CI использует 24).
- Docker и Docker Compose — для локального Postgres.

## Запуск

```bash
cd server
npm ci
cp .env.example .env      # заполнить значения
npm run dev               # http://127.0.0.1:8080/health
```

## Проверки

```bash
npm run check             # oxlint + vitest + tsc
```

## Docker

```bash
docker compose up --build  # api + postgres
```

## Контракт

API описан в [`openapi.yaml`](./openapi.yaml) (OpenAPI 3.1). Спецификация закреплена тестом
`src/openapi.test.ts`: он проверяет наличие путей, `operationId` и резолв всех `$ref`.

## Структура

```
src/
  index.ts    точка входа, запуск и graceful shutdown
  app.ts      сборка Fastify-приложения (роуты)
  config.ts   разбор и валидация переменных окружения (zod)
```
