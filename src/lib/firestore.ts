import { firestoreDb, firebaseError } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';

export const COLLECTIONS = {
  assets: 'assets',
  liabilities: 'liabilities',
  income: 'income',
  incomeArchive: 'income_archive',
  budgetPlan: 'budget_plan',
};

export type FirestoreCollection = string;

const storageKey = (collectionName: string) => `denegnyj_put_${collectionName}`;

const loadFromLocalStorage = <T extends { id: string }>(
  collectionName: string
): T[] => {
  try {
    const raw = localStorage.getItem(storageKey(collectionName));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const saveToLocalStorage = <T extends { id: string }>(
  collectionName: string,
  items: T[]
): void => {
  try {
    localStorage.setItem(storageKey(collectionName), JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
};

export const saveToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[]
) => {
  saveToLocalStorage(collectionName, items);
  if (!firestoreDb) return;
  try {
    const colRef = collection(firestoreDb, collectionName);
    const batch = items.map((item) =>
      setDoc(doc(colRef, item.id), item as Record<string, unknown>)
    );
    await Promise.all(batch);
  } catch {
    // Firestore недоступен, localStorage уже сохранён
  }
};

export const loadFromFirestore = async <T extends { id: string } = { id: string }>(
  collectionName: string
): Promise<T[]> => {
  if (!firestoreDb) {
    return loadFromLocalStorage<T>(collectionName);
  }
  try {
    const colRef = collection(firestoreDb, collectionName);
    const q = query(colRef, orderBy('id'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(
      (docSnap) => docSnap.data() as unknown as T
    );
    saveToLocalStorage(collectionName, data);
    return data;
  } catch {
    return loadFromLocalStorage<T>(collectionName);
  }
};

export const deleteFromFirestore = async (collectionName: string, id: string) => {
  try {
    const raw = localStorage.getItem(storageKey(collectionName));
    if (raw) {
      const items = JSON.parse(raw) as { id: string }[];
      const filtered = items.filter((it) => it.id !== id);
      localStorage.setItem(storageKey(collectionName), JSON.stringify(filtered));
    }
  } catch {
    // ignore
  }
  if (!firestoreDb) return;
  try {
    await deleteDoc(doc(firestoreDb, collectionName, id));
  } catch {
    // ignore
  }
};

export { firestoreDb, firebaseError };
