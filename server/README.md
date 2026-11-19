# Money-Path server

Бэкенд для Money-Path: Fastify + TypeScript, Postgres (с этапа 3).
План переезда — [`PLAN.md`](./PLAN.md).

## Требования

- Node.js 22+ (CI использует 24).
- Postgres 17 — через Docker Compose либо локально (`brew install postgresql@17`).

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

Интеграционные тесты (БД, маршруты, импорт) без `TEST_DATABASE_URL` пропускаются.
Чтобы прогнать их локально:

```bash
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/psql -d postgres \
  -c "create role money_path login password 'money_path'"
/opt/homebrew/opt/postgresql@17/bin/createdb -O money_path money_path_test

TEST_DATABASE_URL=postgres://money_path:money_path@127.0.0.1:5432/money_path_test \
  npm run check
```

Тесты чистят таблицы в `beforeEach`, поэтому файлы идут последовательно
(`fileParallelism: false` в `vitest.config.ts`) — иначе параллельные файлы
сносят данные друг друга.

## Docker

```bash
docker compose up --build  # api + postgres
```

## Авторизация

Все маршруты, кроме `/health`, требуют `Authorization: Bearer <Firebase ID token>`.
`uid` берётся только из проверенного токена; поле `uid` в теле запроса отклоняется с `422`.
Неподтверждённая почта возвращает `403`, отозванный токен — `401`.
Проверка идёт с `checkRevoked=true` и требует учётных данных сервисного аккаунта
(`GOOGLE_APPLICATION_CREDENTIALS`).

## База данных

```bash
export DATABASE_URL=postgres://money_path:change_me@127.0.0.1:5432/money_path

npm run db:generate              # миграция из изменений src/db/schema.ts
npm run db:migrate               # применить миграции
npm run db:import -- --dry-run   # прочитать Firestore без записи в базу
npm run db:import                # перенести данные
npm run db:import -- --uid=<uid> # один пользователь
```

Импорт требует `GOOGLE_APPLICATION_CREDENTIALS` — сервисный аккаунт с правом чтения проекта.
В контейнере миграции запускаются скомпилированным файлом: `node dist/scripts/db-migrate.js`.

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
