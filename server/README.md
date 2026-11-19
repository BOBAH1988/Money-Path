# Money-Path server

Бэкенд для Money-Path: Fastify + TypeScript, Postgres (с этапа 3).
План переезда — [`PLAN.md`](./PLAN.md).

## Требования

- Node.js 22+; рабочая версия — 24 (`.nvmrc` в корне и в `server/`).
- Postgres 17 — через Docker Compose либо локально (`brew install postgresql@17`).

## Запуск

```bash
cd server
npm ci
cp .env.example .env      # заполнить значения
npm run dev               # http://127.0.0.1:8080/health
```

Переменные окружения — в `.env.example`: `DATABASE_URL`, `TEST_DATABASE_URL`,
`FIREBASE_PROJECT_ID`, `ADMIN_UIDS`, `PORT`/`HOST`/`LOG_LEVEL`.

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

### Админская аналитика

`GET /admin/stats` отдаёт только агрегаты — `{ total, active30, new30, new7 }`, без почт и uid.
Доступ есть у uid из `ADMIN_UIDS=uid1,uid2` (пусто — эндпоинт закрыт для всех, отвечает `403`).
UI показывает окно аналитики по своей проверке (`VITE_ADMIN_EMAIL`), но данные получает
с сервера: если uid не совпал, окно скажет «Недостаточно прав».

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
В контейнере миграции запускаются скомпилированным файлом:

```bash
docker compose run --rm api node dist/scripts/db-migrate.js
```

`docker compose up` сам миграции не применяет, и сервис `api` не получает
`FIREBASE_PROJECT_ID`/`GOOGLE_APPLICATION_CREDENTIALS` — до этапа 6 это предстоит
дописать в `docker-compose.yml`.

## Снимок и проверка перед переездом

```bash
# Полный снимок Firestore: все документы со всеми полями + sha256, пишется в backups/
GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... \
  npx tsx src/scripts/snapshot-firestore.ts

# Сухой прогон импорта: только чтение, печатает счётчики по пользователям
GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... \
  npx tsx src/scripts/migrate-firestore.ts --dry-run

# Живая проверка авторизации: настоящий ID-token от Google через verifyIdToken
GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... VITE_FIREBASE_API_KEY=... \
  npx tsx src/scripts/verify-live-auth.ts
```

`snapshot-firestore.ts` пишет документы как есть, включая профили и поля, которых нет
в приложении, — этим он отличается от `scripts/backup.cjs` (формат для восстановления
из интерфейса). Каталог `backups/` в `.gitignore`.

`verify-live-auth.ts` создаёт временного пользователя email/пароль, проверяет его токен
и удаляет пользователя. Ключ приложения ограничен по referer, поэтому скрипт подставляет
`APP_ORIGIN` (по умолчанию `https://bobah1988.github.io`). Режим `--uid=<uid>` выпускает
custom-token и требует включённого IAM Service Account Credentials API.

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
