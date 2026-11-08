#!/usr/bin/env node
'use strict';

/**
 * Резервное копирование и восстановление данных Money-Path.
 *
 * Требует Firebase Admin SDK и сервисный аккаунт (Project settings -> Service accounts -> Generate new private key).
 * Переменные окружения:
 *   FIREBASE_SERVICE_ACCOUNT — путь к JSON сервисного аккаунта (обязательно)
 *   BACKUP_DIR               — директория для архивов (по умолчанию ./backups)
 *   BACKUP_KEEP              — сколько последних архивов хранить на пользователя (по умолчанию 3)
 *
 * Команды:
 *   node scripts/backup.cjs backup [--user <uid>] [--all]
 *   node scripts/backup.cjs restore <file> [--user <uid>]
 *   node scripts/backup.cjs list [--user <uid>]
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT;
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const KEEP = parseInt(process.env.BACKUP_KEEP || '3', 10);

const COLLECTIONS = ['assets', 'liabilities', 'income', 'income_archive'];

let app;
let db;

function initAdmin() {
  if (app) return app;
  if (!SERVICE_ACCOUNT_PATH) {
    console.error(
      'Ошибка: укажите FIREBASE_SERVICE_ACCOUNT — путь к JSON сервисного аккаунта Firebase.\n' +
        'Получить: Firebase Console -> Project settings -> Service accounts -> Generate new private key'
    );
    process.exit(1);
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
  } catch (err) {
    console.error('Не удалось прочитать сервисный аккаунт из', SERVICE_ACCOUNT_PATH, err.message);
    process.exit(1);
  }
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  db = app.firestore();
  return app;
}

function userDocRef(userId) {
  return db.collection('users').doc(userId);
}

function collectionRef(userId, collectionName) {
  return userDocRef(userId).collection(collectionName);
}

function budgetPlanRef(userId) {
  // Сохраняется как документ в коллекции budget_plan с id users/<uid>/budget_plan (см. src/lib/budget.ts)
  return db.collection('budget_plan').doc(`users/${userId}/budget_plan`);
}

const nowStamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

const archiveFileName = (userId) => `money-path-backup-${userId}-${nowStamp()}.json`;

async function listUsers() {
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map((doc) => doc.id);
}

async function fetchUserData(userId) {
  const collections = {};
  let total = 0;
  for (const name of COLLECTIONS) {
    const snapshot = await collectionRef(userId, name).get();
    const items = snapshot.docs.map((doc) => doc.data());
    collections[name] = items;
    total += items.length;
  }
  const budgetSnap = await budgetPlanRef(userId).get();
  const budgetPlan = budgetSnap.exists ? budgetSnap.data() : null;
  return { collections, budgetPlan, total };
}

async function rotateBackups(userId) {
  const userDir = path.join(BACKUP_DIR, userId);
  if (!fs.existsSync(userDir)) return;
  const files = fs
    .readdirSync(userDir)
    .filter((f) => f.startsWith(`money-path-backup-${userId}-`) && f.endsWith('.json'))
    .sort()
    .reverse(); // новые первыми (метка времени в имени)
  const toDelete = files.slice(KEEP);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(userDir, f));
  }
  return files.slice(0, KEEP);
}

function listBackupFiles(userId) {
  const userDir = path.join(BACKUP_DIR, userId);
  if (!fs.existsSync(userDir)) return [];
  return fs
    .readdirSync(userDir)
    .filter((f) => f.startsWith(`money-path-backup-${userId}-`) && f.endsWith('.json'))
    .sort()
    .reverse();
}

async function cmdBackup({ user, allUsers }) {
  initAdmin();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const userIds = allUsers ? await listUsers() : [user];
  if (!userIds.length) {
    console.log('Пользователи не найдены.');
    return;
  }

  for (const userId of userIds) {
    const { collections, budgetPlan, total } = await fetchUserData(userId);
    const archive = {
      version: 1,
      userId,
      createdAt: new Date().toISOString(),
      source: 'firestore',
      collections,
      budgetPlan,
    };

    const userDir = path.join(BACKUP_DIR, userId);
    fs.mkdirSync(userDir, { recursive: true });
    const fileName = archiveFileName(userId);
    const filePath = path.join(userDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(archive, null, 2));

    await rotateBackups(userId);
    console.log(
      `[backup] ${userId}: ${total} записей -> ${filePath} (хранится последнии ${KEEP})`
    );
  }
}

async function cmdRestore({ file, user }) {
  initAdmin();
  let archive;
  try {
    archive = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error('Не удалось прочитать файл архива:', file, err.message);
    process.exit(1);
  }

  const userId = user || archive.userId;
  if (!userId) {
    console.error('Ошибка: укажите --user <uid> (в архиве нет userId).');
    process.exit(1);
  }

  const batch = db.batch();
  let collectionsCount = 0;

  for (const name of COLLECTIONS) {
    const items = archive.collections && archive.collections[name];
    if (!Array.isArray(items)) continue;
    const colRef = collectionRef(userId, name);
    // Очищаем существующие документы коллекции перед восстановлением
    const snapshot = await colRef.get();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    items.forEach((item) => {
      batch.set(colRef.doc(item.id), { ...item, userId });
    });
    collectionsCount += items.length;
  }

  if (archive.budgetPlan && Array.isArray(archive.budgetPlan.items)) {
    batch.set(budgetPlanRef(userId), { ...archive.budgetPlan, userId });
  }

  await batch.commit();
  console.log(
    `[restore] ${userId}: восстановлено ${collectionsCount} записей в коллекциях, бюджетный план ${
      archive.budgetPlan ? 'восстановлен' : 'пропущен'
    }`
  );
}

async function cmdList({ user }) {
  initAdmin();
  const userIds = user ? [user] : await listUsers();
  for (const userId of userIds) {
    const files = listBackupFiles(userId);
    console.log(`Пользователь ${userId}:`);
    if (!files.length) {
      console.log('  архивов нет');
      continue;
    }
    for (const f of files) {
      console.log(`  ${path.join(BACKUP_DIR, userId, f)}`);
    }
  }
}

const command = process.argv[2];
const args = process.argv.slice(3);

const parseArgs = () => {
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user' && args[i + 1]) {
      opts.user = args[++i];
    } else if (args[i] === '--all') {
      opts.allUsers = true;
    } else if (!opts.file && !args[i].startsWith('--')) {
      opts.file = args[i];
    }
  }
  return opts;
};
const opts = parseArgs();

(async () => {
  try {
    if (command === 'backup') {
      await cmdBackup({ user: opts.user, allUsers: opts.allUsers });
    } else if (command === 'restore') {
      if (!opts.file) {
        console.error('Использование: node scripts/backup.cjs restore <file> [--user <uid>]');
        process.exit(1);
      }
      await cmdRestore({ file: opts.file, user: opts.user });
    } else if (command === 'list') {
      await cmdList({ user: opts.user });
    } else {
      console.log(
        'Использование:\n' +
          '  node scripts/backup.cjs backup [--user <uid>] [--all]   — создать резервные копии\n' +
          '  node scripts/backup.cjs restore <file> [--user <uid>]   — восстановить из архива\n' +
          '  node scripts/backup.cjs list [--user <uid>]             — список архивов\n' +
          '\nПеременные: FIREBASE_SERVICE_ACCOUNT, BACKUP_DIR, BACKUP_KEEP'
      );
      process.exit(1);
    }
  } catch (err) {
    console.error('Ошибка:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
