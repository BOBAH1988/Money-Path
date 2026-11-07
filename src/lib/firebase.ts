import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let auth: Auth | null = null;
let firebaseError: Error | null = null;

const isTestEnv =
  typeof import.meta.env !== 'undefined' && import.meta.env.MODE === 'test';

if (!isTestEnv) {
  try {
    app = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(app);
    auth = getAuth(app);
    // Офлайн- persistence: данные доступны без интернета, синхронизируются при возврате связи.
    enableIndexedDbPersistence(firestoreDb).catch((err) => {
      // Multiple tabs or already enabled — неcritical.
      console.warn('[firestore] offline persistence:', err);
    });
  } catch (err) {
    firebaseError = err instanceof Error ? err : new Error(String(err));
  }
} else {
  firebaseError = new Error('Firebase disabled in test mode');
}

export { app, firestoreDb, auth, firebaseError };
