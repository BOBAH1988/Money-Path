import app from './firebase';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';

const db = getFirestore(app);

export const COLLECTIONS = {
  assets: 'assets',
  liabilities: 'liabilities',
  income: 'income',
  incomeArchive: 'income_archive',
};

export type FirestoreCollection = string;

export const saveToFirestore = async <T extends { id: string }>(
  collectionName: string,
  items: T[]
) => {
  const colRef = collection(db, collectionName);
  const batch = items.map((item) => setDoc(doc(colRef, item.id), item as Record<string, unknown>));
  await Promise.all(batch);
};

export const loadFromFirestore = async <T extends { id: string } = { id: string }>(
  collectionName: string
): Promise<T[]> => {
  const colRef = collection(db, collectionName);
  const q = query(colRef, orderBy('id'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => docSnap.data() as unknown as T);
};

export const deleteFromFirestore = async (collectionName: string, id: string) => {
  await deleteDoc(doc(db, collectionName, id));
};

export { db };
