import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createFirebaseVerifier } from '../auth.js';

/**
 * Живая проверка авторизации против настоящего Firebase.
 *
 * По умолчанию создаёт временного пользователя email/пароль, получает от Google
 * настоящий ID-token, прогоняет его через тот же `verifyIdToken(token, true)`,
 * которым пользуется сервер, и удаляет пользователя. Пароль и токены в вывод
 * не попадают, следов в проекте не остаётся.
 *
 * С `--uid=<uid>` выпускает custom-token для существующего пользователя. Этот путь
 * требует включённого IAM Service Account Credentials API.
 *
 * Запуск:
 *   GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... \
 *   VITE_FIREBASE_API_KEY=... npx tsx src/scripts/verify-live-auth.ts
 */

interface IdentityToolkitResponse {
  idToken?: string;
  localId?: string;
  error?: { message?: string };
}

const uidFromArgs = (): string | undefined =>
  process.argv.slice(2).find((arg) => arg.startsWith('--uid='))?.slice('--uid='.length);

/**
 * Ключ приложения ограничен по HTTP referer (он браузерный), поэтому запрос из Node
 * должен выглядеть как запрос со сайта — иначе Google отвечает 403.
 */
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://bobah1988.github.io';

const identityToolkit = async (path: string, apiKey: string, body: unknown): Promise<IdentityToolkitResponse> => {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'referer': `${APP_ORIGIN}/`,
      'origin': APP_ORIGIN,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as IdentityToolkitResponse;
  if (!response.ok || !payload.idToken) {
    throw new Error(`Google отказал (${response.status}): ${payload.error?.message ?? 'без описания'}`);
  }
  return payload;
};

/** Подделанный токен должен быть отклонён — иначе проверка ничего не стоит. */
const rejectsForgedToken = async (idToken: string, projectId: string): Promise<boolean> =>
  createFirebaseVerifier({ projectId })
    .verify(`${idToken.slice(0, -4)}beef`)
    .then(() => false)
    .catch(() => true);

const main = async (): Promise<void> => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const apiKey = process.env.VITE_FIREBASE_API_KEY ?? process.env.FIREBASE_WEB_API_KEY;
  const existingUid = uidFromArgs();

  if (!projectId) throw new Error('FIREBASE_PROJECT_ID не задан');
  if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY не задан — без него Google не выдаст токен');

  const app = initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth(app);

  const email = `migration-check-${Date.now()}@example.invalid`;
  const password = randomBytes(18).toString('base64url');

  let createdUid: string | null = null;
  let idToken: string;
  let expectedUid: string;

  try {
    if (existingUid) {
      const customToken = await auth.createCustomToken(existingUid);
      console.log('[auth] custom-token выпущен');
      idToken = (await identityToolkit('signInWithCustomToken', apiKey, {
        token: customToken,
        returnSecureToken: true,
      })).idToken!;
      expectedUid = existingUid;
    } else {
      const signedUp = await identityToolkit('signUp', apiKey, { email, password, returnSecureToken: true });
      createdUid = signedUp.localId ?? null;
      idToken = signedUp.idToken!;
      expectedUid = createdUid ?? '';
      console.log('[auth] временный пользователь создан:', createdUid);
    }

    console.log('[auth] получен настоящий ID-token от Google, длина', idToken.length);

    const user = await createFirebaseVerifier({ projectId }).verify(idToken);
    console.log('[auth] verifyIdToken с checkRevoked=true прошёл:', JSON.stringify(user));

    if (user.uid !== expectedUid) throw new Error(`uid не совпал: ожидался ${expectedUid}, получен ${user.uid}`);

    const rejected = await rejectsForgedToken(idToken, projectId);
    console.log('[auth] подделанный токен отклонён:', rejected);
    if (!rejected) throw new Error('Подделанный токен был принят — проверка не работает');

    console.log('[auth] OK: живая авторизация работает');
  } finally {
    if (createdUid) {
      await auth.deleteUser(createdUid);
      console.log('[auth] временный пользователь удалён');
    }
  }
};

main().catch((error: unknown) => {
  console.error('[auth] проверка не пройдена:', error instanceof Error ? error.message : error);
  process.exit(1);
});
