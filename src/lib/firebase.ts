import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'REDACTED',
  authDomain: 'money-path-af37c.firebaseapp.com',
  projectId: 'money-path-af37c',
  storageBucket: 'money-path-af37c.firebasestorage.app',
  messagingSenderId: '1093832828420',
  appId: '1:1093832828420:web:0d02feeb8adc2dab16b751',
};

let app: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseError: Error | null = null;

const isTestEnv =
  typeof import.meta.env !== 'undefined' && import.meta.env.MODE === 'test';

if (!isTestEnv) {
  try {
    app = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(app);
  } catch (err) {
    firebaseError = err instanceof Error ? err : new Error(String(err));
  }
} else {
  firebaseError = new Error('Firebase disabled in test mode');
}

export { app, firestoreDb, firebaseError };
