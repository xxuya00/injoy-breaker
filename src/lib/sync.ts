import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, firebaseEnabled } from './firebase';
import { loadGroup } from './storage';
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
    { nick, day, opened, score: Object.keys(opened).length, group: loadGroup() ?? null, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// 순위판은 구글 시트가 아니라 Firestore를 보고 그린다.
// 관리자가 시트에서 참가자를 지워도 이 문서가 남아 있으면 조별 순위판에 계속 인원·점수로 잡히므로,
// 시트에 기록이 없는 것이 확인되면 이 문서도 함께 지운다.
export async function deleteRemotePlayer(id: string) {
  if (!firebaseEnabled || !db) return;
  await deleteDoc(doc(db, 'players', id));
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
  group: string | null;
}

export function subscribeLeaderboard(
  cb: (entries: LeaderboardEntry[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  if (!firebaseEnabled || !db) return () => {};
  const q = query(collection(db, 'players'), orderBy('score', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, nick: d.data().nick, score: d.data().score, group: d.data().group ?? null })));
    },
    onError,
  );
}

// 타임어택형 미니게임(수식 만들기/결합/라이트아웃) 전용 개인 기록판.
// 게임별로 컬렉션을 분리해서(gameTimes_수식만들기 등) where절 없이 단순 orderBy만 쓴다 —
// Firestore 복합 색인 설정 없이도 바로 동작하게 하기 위함.
export interface GameTimeEntry {
  id: string;
  nick: string;
  elapsedMs: number;
}

// 처음 3번의 시도까지만 호출되며(JourneyScreen 쪽에서 제한), 그중 가장 빠른 기록만 남긴다.
export async function saveGameTime(gameId: string, playerId: string, nick: string, elapsedMs: number) {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, `gameTimes_${gameId}`, playerId);
  const existing = await getDoc(ref);
  if (existing.exists() && (existing.data().elapsedMs as number) <= elapsedMs) return;
  await setDoc(ref, { nick, elapsedMs, updatedAt: serverTimestamp() });
}

// QR 미션에 적어낸 답변. 플레이어 1명당 문서 1개, 미션 id를 key로 두어 한 번의 읽기로 전부 불러올 수 있게 한다.
export interface MissionAnswer {
  name: string;
  answer: string;
}
export type MissionAnswers = Record<string, MissionAnswer>;

export async function saveMissionAnswer(playerId: string, missionId: string, missionName: string, answer: string) {
  if (!firebaseEnabled || !db) return;
  await setDoc(
    doc(db, 'missionAnswers', playerId),
    { [missionId]: { name: missionName, answer, updatedAt: serverTimestamp() } },
    { merge: true },
  );
}

export async function loadMissionAnswers(playerId: string): Promise<MissionAnswers | null> {
  if (!firebaseEnabled || !db) return null;
  const snap = await getDoc(doc(db, 'missionAnswers', playerId));
  return snap.exists() ? (snap.data() as MissionAnswers) : null;
}

export function subscribeGameLeaderboard(
  gameId: string,
  cb: (entries: GameTimeEntry[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  if (!firebaseEnabled || !db) return () => {};
  const q = query(collection(db, `gameTimes_${gameId}`), orderBy('elapsedMs', 'asc'), limit(3));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, nick: d.data().nick, elapsedMs: d.data().elapsedMs })));
    },
    onError,
  );
}
