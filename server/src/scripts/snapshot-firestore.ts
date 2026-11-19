import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { loadEnv } from '../config.js';

/**
 * Полный снимок Firestore перед переездом на собственный сервер.
 *
 * В отличие от `scripts/backup.cjs` (формат для восстановления из интерфейса)
 * здесь сохраняются документы как есть: профили со всеми полями, коллекции,
 * документы budget_plan — включая поля, которых нет в приложении. Такой снимок
 * нужен, чтобы после переезда можно было сверить данные и откатиться без потерь.
 *
 * Запуск:
 *   GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... \
 *     npx tsx src/scripts/snapshot-firestore.ts
 *
 * Файл пишется в `backups/` (каталог в .gitignore) и только читает Firestore.
 */

const USER_COLLECTIONS = ['assets', 'liabilities', 'income', 'income_archive'] as const;

interface DocDump {
  id: string;
  data: Record<string, unknown>;
}

interface UserSnapshot {
  uid: string;
  profile: Record<string, unknown> | null;
  collections: Record<string, DocDump[]>;
  budgetPlan: DocDump | null;
}

const dumpDocs = (docs: { id: string; data: () => Record<string, unknown> | undefined }[]): DocDump[] =>
  docs.map((doc) => ({ id: doc.id, data: doc.data() ?? {} }));

/** Старое расположение плана: budget_plan/users/<uid>/budget_plan. */
const budgetPlanDoc = async (db: Firestore, uid: string): Promise<DocDump | null> => {
  const paths = [`users/${uid}/budget_plan/budget_plan`, `budget_plan/users/${uid}/budget_plan`];
  for (const docPath of paths) {
    const snapshot = await db.doc(docPath).get();
    if (snapshot.exists) return { id: snapshot.id, data: snapshot.data() ?? {} };
  }
  return null;
};

const main = async (): Promise<void> => {
  const env = loadEnv();
  const app = initializeApp({ credential: applicationDefault(), projectId: env.FIREBASE_PROJECT_ID });
  const db = getFirestore(app);

  const usersSnapshot = await db.collection('users').get();
  const users: UserSnapshot[] = [];
  const counts: Record<string, number> = { users: usersSnapshot.size };

  for (const doc of usersSnapshot.docs) {
    const uid = doc.id;
    const collections: Record<string, DocDump[]> = {};

    for (const name of USER_COLLECTIONS) {
      const items = dumpDocs((await db.collection(`users/${uid}/${name}`).get()).docs);
      collections[name] = items;
      counts[name] = (counts[name] ?? 0) + items.length;
    }

    const plan = await budgetPlanDoc(db, uid);
    if (plan) counts.budgetPlan = (counts.budgetPlan ?? 0) + 1;

    users.push({ uid, profile: doc.data() ?? null, collections, budgetPlan: plan });
  }

  const snapshot = {
    version: 1,
    project: env.FIREBASE_PROJECT_ID ?? null,
    createdAt: new Date().toISOString(),
    counts,
    users,
  };

  const json = `${JSON.stringify(snapshot, null, 2)}\n`;
  const checksum = createHash('sha256').update(json).digest('hex');

  const dir = path.join(process.cwd(), 'backups');
  await mkdir(dir, { recursive: true });
  const stamp = snapshot.createdAt.replace(/[:.]/g, '-');
  const file = path.join(dir, `firestore-snapshot-${stamp}.json`);
  await writeFile(file, json, 'utf8');
  await writeFile(`${file}.sha256`, `${checksum}  ${path.basename(file)}\n`, 'utf8');

  console.log(`[snapshot] ${file}`);
  console.log(`[snapshot] записей: ${JSON.stringify(counts)}`);
  console.log(`[snapshot] sha256: ${checksum}`);
};

main().catch((error: unknown) => {
  console.error('Снимок не создан:', error);
  process.exit(1);
});
