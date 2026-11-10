import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDEkZmGzUTl2FOfGBS8UDBDEXcdIPY1vxE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'money-path-af37c.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'money-path-af37c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'money-path-af37c.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1093832828420',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1093832828420:web:0d02feeb8adc2dab16b751',
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let firebaseError: Error | null = null;
let firestorePromise: Promise<Firestore> | null = null;

const isTestEnv = typeof import.meta.env !== 'undefined' && import.meta.env.MODE === 'test';

if (!isTestEnv) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (err) {
    firebaseError = err instanceof Error ? err : new Error(String(err));
  }
} else {
  firebaseError = new Error('Firebase disabled in test mode');
}

export const getFirestoreDb = async (): Promise<Firestore> => {
  if (!app) throw firebaseError ?? new Error('Firebase не инициализирован');
  if (!firestorePromise) {
    firestorePromise = import('firebase/firestore').then((firestore) =>
      firestore.initializeFirestore(app!, {
        localCache: firestore.persistentLocalCache({
          tabManager: firestore.persistentMultipleTabManager(),
        }),
      }),
    ).catch((err: unknown) => {
      firebaseError = err instanceof Error ? err : new Error(String(err));
      firestorePromise = null;
      throw firebaseError;
    });
  }
  return firestorePromise;
};

export const getFirebaseError = () => firebaseError;

export { app, auth, firebaseError };
