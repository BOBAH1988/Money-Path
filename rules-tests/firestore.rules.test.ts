import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const projectId = 'money-path-rules-test';
const adminEmail = '79042044926@ya.ru';
let testEnv: RulesTestEnvironment;
const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.skipIf(!emulatorAvailable)('Firestore security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/alice'), { email: 'alice@example.com' });
      await setDoc(doc(db, 'users/bob'), { email: 'bob@example.com' });
      await setDoc(doc(db, 'users/alice/assets/asset-1'), { amount: 100 });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('lets an owner read and update their profile and financial data', async () => {
    const db = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();

    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertSucceeds(getDoc(doc(db, 'users/alice/assets/asset-1')));
    await assertSucceeds(setDoc(doc(db, 'users/alice/assets/asset-1'), { amount: 200 }));
  });

  it('denies access to another user account and financial data', async () => {
    const db = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();

    await assertFails(getDoc(doc(db, 'users/bob')));
    await assertFails(setDoc(doc(db, 'users/bob/assets/asset-1'), { amount: 1 }));
    await assertFails(getDocs(collection(db, 'users/bob/assets')));
  });

  it('lets the admin list profiles but not read a profile directly or access financial data', async () => {
    const db = testEnv.authenticatedContext('admin', { email: adminEmail }).firestore();

    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertFails(getDoc(doc(db, 'users/alice')));
    await assertFails(getDoc(doc(db, 'users/alice/assets/asset-1')));
    await assertFails(setDoc(doc(db, 'users/alice/assets/asset-1'), { amount: 1 }));
  });

  it('denies unauthenticated access and profile deletion', async () => {
    const anonymousDb = testEnv.unauthenticatedContext().firestore();
    const ownerDb = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();

    await assertFails(getDoc(doc(anonymousDb, 'users/alice')));
    await assertFails(getDoc(doc(anonymousDb, 'users/alice/assets/asset-1')));
    await assertFails(deleteDoc(doc(ownerDb, 'users/alice')));
  });
});
