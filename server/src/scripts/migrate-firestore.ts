import 'dotenv/config';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { loadEnv } from '../config.js';
import { createDb } from '../db/index.js';
import { toArchiveRow, toItemRow, type ArchiveRow, type ItemRow } from '../db/normalize.js';
import { applyUserDump, type UserDump } from '../db/user-dump.js';

interface Args {
  dryRun: boolean;
  uid?: string;
}

const parseArgs = (argv: string[]): Args => ({
  dryRun: argv.includes('--dry-run'),
  uid: argv.find((arg) => arg.startsWith('--uid='))?.slice('--uid='.length),
});

const readItems = async (fsdb: Firestore, path: string): Promise<ItemRow[]> => {
  const snapshot = await fsdb.collection(path).get();
  return snapshot.docs
    .map((doc) => toItemRow({ ...doc.data(), id: doc.id }))
    .filter((row): row is ItemRow => row !== null);
};

const readBudgetPlan = async (fsdb: Firestore, uid: string): Promise<UserDump['budgetPlan']> => {
  const paths = [`users/${uid}/budget_plan/budget_plan`, `budget_plan/users/${uid}/budget_plan`];

  for (const path of paths) {
    const snapshot = await fsdb.doc(path).get();
    if (!snapshot.exists) continue;
    const data = snapshot.data() as { items?: unknown[]; updatedAt?: string } | undefined;
    return { items: Array.isArray(data?.items) ? data.items : [], updatedAt: data?.updatedAt ?? '' };
  }
  return null;
};

const dumpUser = async (fsdb: Firestore, uid: string, now: Date): Promise<UserDump> => {
  const profileSnap = await fsdb.doc(`users/${uid}`).get();
  const profile = (profileSnap.data() ?? {}) as {
    email?: string;
    createdAt?: string;
    lastActive?: string;
    avatar?: string | null;
  };

  const [archiveDocs, assets, liabilities, income] = await Promise.all([
    fsdb.collection(`users/${uid}/income_archive`).get(),
    readItems(fsdb, `users/${uid}/assets`),
    readItems(fsdb, `users/${uid}/liabilities`),
    readItems(fsdb, `users/${uid}/income`),
  ]);

  const incomeArchive = archiveDocs.docs
    .map((doc) => toArchiveRow({ ...doc.data(), id: doc.id }, now))
    .filter((row): row is ArchiveRow => row !== null);

  return {
    uid,
    email: typeof profile.email === 'string' ? profile.email : '',
    createdAt: profile.createdAt,
    lastActive: profile.lastActive,
    avatar: typeof profile.avatar === 'string' ? profile.avatar : null,
    assets,
    liabilities,
    income,
    incomeArchive,
    budgetPlan: await readBudgetPlan(fsdb, uid),
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: env.FIREBASE_PROJECT_ID,
  });
  const fsdb = getFirestore(app);

  if (!args.dryRun && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL не задан: перенос данных невозможен (используйте --dry-run для проверки чтения)');
  }

  const handle = !args.dryRun && env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;
  const now = new Date();

  try {
    const docs = args.uid
      ? [await fsdb.doc(`users/${args.uid}`).get()]
      : (await fsdb.collection('users').get()).docs;

    let total = 0;
    for (const doc of docs) {
      if (!doc.exists && args.uid) {
        throw new Error(`Пользователь ${args.uid} не найден в Firestore`);
      }
      const uid = args.uid ?? doc.id;
      const dump = await dumpUser(fsdb, uid, now);
      const counts = {
        assets: dump.assets.length,
        liabilities: dump.liabilities.length,
        income: dump.income.length,
        incomeArchive: dump.incomeArchive.length,
        budgetPlan: dump.budgetPlan ? 1 : 0,
      };

      if (handle) {
        await applyUserDump(handle.db, dump);
        console.log(`[импорт] ${uid}: ${JSON.stringify(counts)}`);
      } else {
        console.log(`[dry-run] ${uid}: ${JSON.stringify(counts)}`);
      }
      total += 1;
    }

    console.log(`Готово: пользователей обработано ${total}${handle ? '' : ' (без записи в базу)'}`);
  } finally {
    await handle?.pool.end();
  }
};

main().catch((error: unknown) => {
  console.error('Перенос данных не выполнен:', error);
  process.exit(1);
});
