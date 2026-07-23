import { doc, getDoc, setDoc, serverTimestamp, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import type { Day } from '../types';

export { firebaseEnabled };

interface RemoteProgress {
  nick: string;
  day: Day;
  opened: Record<string, boolean>;
  score: number;
}

export async function saveRemoteProgress(id: string, nick: string, day: Day, opened: Record<string, boolean>) {
  if (!firebaseEnabled || !db) return;
  await setDoc(
    doc(db, 'players', id),
    { nick, day, opened, score: Object.keys(opened).length, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function loadRemoteProgress(id: string): Promise<RemoteProgress | null> {
  if (!firebaseEnabled || !db) return null;
  const snap = await getDoc(doc(db, 'players', id));
  if (!snap.exists()) return null;
  return snap.data() as RemoteProgress;
}

export interface LeaderboardEntry {
  id: string;
  nick: string;
  score: number;
}

export function subscribeLeaderboard(cb: (entries: LeaderboardEntry[]) => void): () => void {
  if (!firebaseEnabled || !db) return () => {};
  const q = query(collection(db, 'players'), orderBy('score', 'desc'), limit(20));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, nick: d.data().nick, score: d.data().score })));
  });
}
