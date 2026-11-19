import 'dotenv/config';
import { loadEnv } from '../config.js';
import { createDb } from '../db/index.js';
import { toArchiveRow, toItemRow, type ArchiveRow, type ItemRow } from '../db/normalize.js';
import { applyUserDump, type UserDump } from '../db/user-dump.js';
import { listUserIds, openFirestore, readFirestoreUser, type FirestoreUser } from './firestore-source.js';

interface Args {
  dryRun: boolean;
  uid?: string;
}

const parseArgs = (argv: string[]): Args => ({
  dryRun: argv.includes('--dry-run'),
  uid: argv.find((arg) => arg.startsWith('--uid='))?.slice('--uid='.length),
});

const toUserDump = (uid: string, raw: FirestoreUser, now: Date): UserDump => {
  const profile = raw.profile ?? {};

  const items = (docs: FirestoreUser['assets']): ItemRow[] =>
    docs
      .map((doc) => toItemRow({ ...doc.data, id: doc.id }))
      .filter((row): row is ItemRow => row !== null);

  return {
    uid,
    email: typeof profile.email === 'string' ? profile.email : '',
    createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : undefined,
    lastActive: typeof profile.lastActive === 'string' ? profile.lastActive : undefined,
    avatar: typeof profile.avatar === 'string' ? profile.avatar : null,
    acceptedTermsVersion:
      typeof profile.acceptedTermsVersion === 'string' ? profile.acceptedTermsVersion : null,
    acceptedPrivacyVersion:
      typeof profile.acceptedPrivacyVersion === 'string' ? profile.acceptedPrivacyVersion : null,
    consentUpdatedAt: typeof profile.consentUpdatedAt === 'string' ? profile.consentUpdatedAt : null,
    assets: items(raw.assets),
    liabilities: items(raw.liabilities),
    income: items(raw.income),
    incomeArchive: raw.incomeArchive
      .map((doc) => toArchiveRow({ ...doc.data, id: doc.id }, now))
      .filter((row): row is ArchiveRow => row !== null),
    budgetPlan: raw.budgetPlan,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();

  const fsdb = openFirestore(env.FIREBASE_PROJECT_ID);

  if (!args.dryRun && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL не задан: перенос данных невозможен (используйте --dry-run для проверки чтения)');
  }

  const handle = !args.dryRun && env.DATABASE_URL ? createDb(env.DATABASE_URL) : null;
  const now = new Date();

  try {
    const uids = args.uid ? [args.uid] : await listUserIds(fsdb);

    let total = 0;
    for (const uid of uids) {
      const raw = await readFirestoreUser(fsdb, uid);
      if (!raw.profile && args.uid) {
        throw new Error(`Пользователь ${uid} не найден в Firestore`);
      }

      const dump = toUserDump(uid, raw, now);
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
