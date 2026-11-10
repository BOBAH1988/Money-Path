import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
} from 'firebase/firestore';

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

  it('synchronizes independent records and same-record edits between two devices for one account', async () => {
    const deviceA = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    const deviceB = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    const firstAsset = doc(deviceA, 'users/alice/assets/device-a');
    const secondAsset = doc(deviceB, 'users/alice/assets/device-b');

    await assertSucceeds(setDoc(firstAsset, { amount: 100 }));
    await assertSucceeds(setDoc(secondAsset, { amount: 200 }));

    const deviceBSeesFirst = await getDocFromServer(doc(deviceB, 'users/alice/assets/device-a'));
    const deviceASeesSecond = await getDocFromServer(doc(deviceA, 'users/alice/assets/device-b'));
    if (!deviceBSeesFirst.exists() || !deviceASeesSecond.exists()) {
      throw new Error('A device could not read another device’s synchronized record');
    }

    await assertSucceeds(setDoc(doc(deviceB, 'users/alice/assets/device-a'), { amount: 150 }));
    const updatedOnA = await getDocFromServer(firstAsset);
    if (updatedOnA.data()?.amount !== 150) {
      throw new Error('The updated record was not visible from the other device');
    }

    const independentRecord = await getDocFromServer(secondAsset);
    if (independentRecord.data()?.amount !== 200) {
      throw new Error('Updating one record unexpectedly changed another record');
    }
  });

  it('lets the admin list profiles but not read a profile directly or access financial data', async () => {
    const db = testEnv.authenticatedContext('admin', {
      email: adminEmail,
      email_verified: true,
    }).firestore();

    await assertSucceeds(getDocs(collection(db, 'users')));
    await assertFails(getDoc(doc(db, 'users/alice')));
    await assertFails(getDoc(doc(db, 'users/alice/assets/asset-1')));
    await assertFails(setDoc(doc(db, 'users/alice/assets/asset-1'), { amount: 1 }));
  });

  it('does not grant admin access to an unverified email', async () => {
    const db = testEnv.authenticatedContext('unverified-admin', {
      email: adminEmail,
      email_verified: false,
    }).firestore();

    await assertFails(getDocs(collection(db, 'users')));
  });

  it('denies unauthenticated access and only lets owners delete their own profile', async () => {
    const anonymousDb = testEnv.unauthenticatedContext().firestore();
    const ownerDb = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();

    await assertFails(getDoc(doc(anonymousDb, 'users/alice')));
    await assertFails(getDoc(doc(anonymousDb, 'users/alice/assets/asset-1')));
    await assertSucceeds(deleteDoc(doc(ownerDb, 'users/alice')));
    await assertFails(deleteDoc(doc(ownerDb, 'users/bob')));
  });

  it('lets an owner delete their own legacy budget plan but denies cross-account access', async () => {
    const ownerDb = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    const legacyOwnPlan = doc(ownerDb, 'budget_plan/users/alice/budget_plan');
    const legacyOtherPlan = doc(ownerDb, 'budget_plan/users/bob/budget_plan');

    await assertSucceeds(setDoc(legacyOwnPlan, { items: [] }));
    await assertSucceeds(deleteDoc(legacyOwnPlan));
    await assertFails(setDoc(legacyOtherPlan, { items: [] }));
  });
});
