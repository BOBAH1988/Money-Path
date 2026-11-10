# Рабочий процесс разработки

Этот документ описывает локальную разработку, обязательные проверки и публикацию Money-Path. Авторитетные версии Node.js и Firebase CLI задаются workflow в `.github/workflows/deploy.yml`; при расхождении следуйте настройкам CI.

## Требования

- Node.js версии, настроенной в CI (сейчас Node.js 24).
- npm.
- Для локальных тестов Firestore Rules — Java 21 или новее и Firebase CLI.

## Настройка

```bash
git clone https://github.com/BOBAH1988/Money-Path.git
cd Money-Path
npm ci
npm run dev
```

Vite выведет локальный URL, обычно `http://localhost:5173/`.

## Проверки

Перед коммитом выполните:

```bash
npm run check
```

Команда запускает oxlint, тесты Vitest и TypeScript/Vite production-сборку. Тесты правил Firestore пропускаются, если эмулятор не доступен. Для полного набора используйте локальный эмулятор:

```bash
npx --yes firebase-tools@14.22.0 emulators:exec \
  --only firestore \
  --project demo-money-path \
  --non-interactive \
  'FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npm test -- --run rules-tests/firestore.rules.test.ts'
```

Тестовый проект `demo-money-path` предназначен для эмулятора; не подменяйте его production-проектом.

Отдельные проверки доступны через `npm run lint`, `npm test` и `npm run build`.

## Версия

Версия приложения находится в `package.json` и использует формат `major.minor.patch`. Pre-commit hook автоматически увеличивает patch-часть и синхронизирует версию в `package-lock.json`. Установка hook выполняется npm-скриптом `prepare`; если hook отсутствует после установки зависимостей, проверьте, не отключены ли npm lifecycle scripts.

## Публикация

Push в `main` запускает GitHub Actions. Workflow выполняет lint, тесты, сборку, Firestore Emulator suite и после успешной проверки публикует `dist/` в GitHub Pages.

- Состояние workflow: [GitHub Actions](https://github.com/BOBAH1988/Money-Path/actions).
- Production URL: [BOBAH1988.github.io/Money-Path](https://BOBAH1988.github.io/Money-Path/).
- Для ручного включения Pages выберите **Settings → Pages → Build and deployment → GitHub Actions**.
- Vite base path должен оставаться `/Money-Path/`, пока сайт обслуживается из подпути GitHub Pages.

Не выполняйте повторный push в ответ на неуспешный workflow, не изучив упавший job и commit SHA. Исправление публикуется отдельным commit; проверьте успешный workflow именно для нового SHA.

## Если проверки или деплой завершились ошибкой

1. Найдите упавший шаг в GitHub Actions и сохраните commit SHA, тип проверки и очищенный от персональных данных текст ошибки.
2. Локально воспроизведите проблему (`npm run lint`, `npm test`, `npm run build` либо Firestore Emulator suite).
3. Исправьте причину, повторите необходимые проверки и проверьте `git diff --check`.
4. После push убедитесь, что проверки и deploy завершились успешно для ожидаемого SHA.

Для ошибок синхронизации, потери данных и восстановления следуйте [операционному runbook](operations.md). Не очищайте localStorage/IndexedDB и очередь синхронизации до проверки резервной копии. Ключевые исправления и известные ограничения перечислены в [журнале ошибок](incident-log.md).
