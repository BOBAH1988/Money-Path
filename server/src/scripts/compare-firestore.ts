import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { loadEnv } from '../config.js';
import { compareUser, type DbUser, type Difference } from '../db/compare.js';
import { createDb, type Database } from '../db/index.js';
import type { ArchiveRow, ItemRow } from '../db/normalize.js';
import { assets, budgetPlan, income, incomeArchive, liabilities, profiles } from '../db/schema.js';
import { listUserIds, openFirestore, readFirestoreUser } from './firestore-source.js';

interface Args {
  uid?: string;
  strict: boolean;
}

const parseArgs = (argv: string[]): Args => ({
  uid: argv.find((arg) => arg.startsWith('--uid='))?.slice('--uid='.length),
  strict: argv.includes('--strict'),
});

const pickItem = (row: { id: string; name: string; amount: number; monthly: number }): ItemRow => ({
  id: row.id,
  name: row.name,
  amount: row.amount,
  monthly: row.monthly,
});

const pickArchive = (row: { id: string; name: string; year: number; months: number[] }): ArchiveRow => ({
  id: row.id,
  name: row.name,
  year: row.year,
  months: row.months,
});

const readDbUser = async (db: Database, uid: string): Promise<DbUser> => {
  const [profileRows, assetRows, liabilityRows, incomeRows, archiveRows, planRows] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.uid, uid)),
    db.select().from(assets).where(eq(assets.userId, uid)),
    db.select().from(liabilities).where(eq(liabilities.userId, uid)),
    db.select().from(income).where(eq(income.userId, uid)),
    db.select().from(incomeArchive).where(eq(incomeArchive.userId, uid)),
    db.select().from(budgetPlan).where(eq(budgetPlan.userId, uid)),
  ]);

  const profile = profileRows[0];
  const plan = planRows[0];

  return {
    profile: profile
      ? {
          email: profile.email,
          createdAt: profile.createdAt,
          lastActive: profile.lastActive,
          avatar: profile.avatar,
          acceptedTermsVersion: profile.acceptedTermsVersion,
          acceptedPrivacyVersion: profile.acceptedPrivacyVersion,
          consentUpdatedAt: profile.consentUpdatedAt,
        }
      : null,
    assets: assetRows.map(pickItem),
    liabilities: liabilityRows.map(pickItem),
    income: incomeRows.map(pickItem),
    incomeArchive: archiveRows.map(pickArchive),
    budgetPlan: plan ? { items: plan.items, updatedAt: plan.updatedAt } : null,
  };
};

const icons: Record<Difference['kind'], string> = {
  missing: '!',
  extra: '!',
  changed: '~',
  'unknown-field': '?',
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();

  if (!env.DATABASE_URL) throw new Error('DATABASE_URL не задан: сверять не с чем');

  const fsdb = openFirestore(env.FIREBASE_PROJECT_ID);
  const handle = createDb(env.DATABASE_URL);
  const now = new Date();

  try {
    const uids = args.uid ? [args.uid] : await listUserIds(fsdb);
    let fatal = 0;
    let warnings = 0;
    const unknown = new Map<string, number>();

    for (const uid of uids) {
      const raw = await readFirestoreUser(fsdb, uid);
      const db = await readDbUser(handle.db, uid);
      const diffs = compareUser(raw, db, { uid, now });

      const counts = {
        assets: db.assets.length,
        liabilities: db.liabilities.length,
        income: db.income.length,
        archive: db.incomeArchive.length,
        plan: db.budgetPlan ? 1 : 0,
      };
      console.log(`\n[${uid}] ${JSON.stringify(counts)}`);

      if (diffs.length === 0) console.log('  расхождений нет');

      for (const diff of diffs) {
        const where = [diff.collection, diff.id, diff.field].filter(Boolean).join('.');
        console.log(`  ${icons[diff.kind]} ${where}: ${diff.message}`);
        if (diff.kind === 'unknown-field') {
          warnings += 1;
          const key = `${diff.collection}.${diff.field}`;
          unknown.set(key, (unknown.get(key) ?? 0) + 1);
        } else {
          fatal += 1;
        }
      }
    }

    if (unknown.size > 0) {
      console.log('\nПоля Firestore без места в Postgres:');
      for (const [field, count] of unknown) console.log(`  ${field} — ${count} док.`);
    }

    console.log(`\nИтого: расхождений ${fatal}, предупреждений ${warnings}`);

    if (fatal > 0 || (args.strict && warnings > 0)) process.exitCode = 1;
  } finally {
    await handle.pool.end();
  }
};

main().catch((error: unknown) => {
  console.error('Сверка не выполнена:', error);
  process.exit(1);
});
