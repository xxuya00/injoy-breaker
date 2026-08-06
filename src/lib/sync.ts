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
  hints: number;
}

// 순위는 "힌트를 적게 쓴 사람이 먼저, 같은 횟수면 빠른 사람이 먼저"다.
// 두 값으로 정렬하려면 Firestore 복합 색인이 필요하므로, 하나의 정렬용 숫자로 접어서 저장한다.
// 하루치 ms를 힌트 한 번의 무게로 두면 — 어떤 기록도 하루를 넘길 수 없으니 —
// 힌트를 한 번이라도 더 쓴 기록은 시간과 무관하게 반드시 뒤로 밀린다.
const HINT_WEIGHT_MS = 24 * 60 * 60 * 1000;

export function gameRankKey(elapsedMs: number, hints: number): number {
  const clamped = Math.min(Math.max(0, elapsedMs), HINT_WEIGHT_MS - 1);
  return Math.max(0, hints) * HINT_WEIGHT_MS + clamped;
}

// 판을 깰 때마다 몇 번이든 호출된다. 문서 id가 playerId라 사람마다 칸이 하나뿐이고,
// 지금 것이 더 좋을 때만 덮어쓰므로 순위판에는 각자의 최고 기록 하나씩만 오른다
// (한 사람이 잘한 판 여럿으로 1·2·3등을 다 채우는 일이 구조적으로 불가능하다).
export async function saveGameTime(
  gameId: string,
  playerId: string,
  nick: string,
  elapsedMs: number,
  hints: number,
) {
  if (!firebaseEnabled || !db) return;
  const ref = doc(db, `gameTimes_${gameId}`, playerId);
  const rankKey = gameRankKey(elapsedMs, hints);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const d = existing.data();
    // rankKey가 없던 시절의 기록도 같은 잣대로 비교할 수 있게 그 자리에서 환산한다.
    const prev = (d.rankKey as number | undefined) ?? gameRankKey(d.elapsedMs ?? 0, d.hints ?? 0);
    if (prev <= rankKey) return;
  }
  await setDoc(ref, { nick, elapsedMs, hints, rankKey, updatedAt: serverTimestamp() });
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

// 유형 나눔을 마친 뒤 각자 남기는 "나만의 잠언". 미션 기록과 달리 서로 읽으라고 쓰는 글이라
// 플레이어 1명당 문서 1개를 그대로 열어두고, 화면에서 유형·조로 걸러 본다.
// (한 사람이 여러 개를 쓰지 않고 하나를 고쳐 쓰는 글이라 문서 id를 playerId로 둔다.)
export interface ProverbEntry {
  id: string;
  nick: string;
  /** 쓴 사람의 조. 없으면(예전 등록) 조 필터에서만 빠진다. */
  group: string | null;
  /** 쓴 사람의 1위 우상 유형 키. 유형 필터에 쓴다. */
  idol: string | null;
  text: string;
}

export async function saveProverb(
  playerId: string,
  nick: string,
  group: string | null,
  idol: string | null,
  text: string,
) {
  if (!firebaseEnabled || !db) return;
  await setDoc(doc(db, 'proverbs', playerId), { nick, group, idol, text, updatedAt: serverTimestamp() });
}

// 잠언은 쓰는 도중에도 옆 사람 글이 올라온다. 목록을 새로고침으로 받아오게 두면
// 나눔이 끝난 자리에서 아무도 다시 안 들어오므로, 실시간 구독으로 그대로 흘려보낸다.
export function subscribeProverbs(
  cb: (entries: ProverbEntry[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  if (!firebaseEnabled || !db) return () => {};
  const q = query(collection(db, 'proverbs'), orderBy('updatedAt', 'desc'), limit(300));
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          nick: d.data().nick ?? '',
          group: d.data().group ?? null,
          idol: d.data().idol ?? null,
          text: d.data().text ?? '',
        })),
      );
    },
    onError,
  );
}

// ---- 자기소개지 (DAY 1) ----
//
// 첫날 나눔에 쓰는 자기소개지를 찍어 올리고 서로 본다. 사진 하나가 세 곳에 나뉘어 담긴다.
//  · introSheets      — 이름·조·공개범위뿐인 목록 뼈대. 그림이 없어 수십 명이어도 몇 KB다.
//  · introSheetThumbs — 목록 칸에 까는 작은 그림. 그 칸이 화면에 들어올 때 한 장씩 받아온다.
//  · introSheetImages — 원본. 눌러서 크게 볼 때만 받아온다.
//
// 셋을 한 문서에 담으면 여정 화면이 "몇 명 올렸나" 한 줄을 그리려고 원본 수십 장을 통째로
// 내려받게 된다. 여정은 모두가 앉아 있는 화면이라 그 값을 치를 수 없다.
//
// Firebase Storage를 쓰는 게 정석이지만 이 프로젝트에서 Storage를 켜려면 유료 전환이 필요해서,
// 이미 쓰고 있는 Firestore에 base64로 담는다. 문서 하나가 1MB를 넘을 수 없으므로
// 올리기 전에 docScan.toJpegUnder가 그 안에 들도록 깎는다.
export type SheetScope = 'all' | 'group' | 'me';

export interface IntroSheetEntry {
  /** 참가자 id. 문서 하나가 사람 하나라, 여러 장을 올리는 대신 한 장을 갈아 끼운다. */
  id: string;
  /** 자기소개지에는 본명이 적혀 있으므로 목록에도 본명을 쓴다. */
  nick: string;
  group: string | null;
  scope: SheetScope;
  /** 가로/세로 비. 목록 칸을 미리 그 비율로 잡아둬야 그림이 도착할 때 줄이 밀리지 않는다. */
  ratio: number;
}

export interface MyIntroSheet extends IntroSheetEntry {
  thumb: string;
  image: string;
}

function entryFrom(id: string, d: Record<string, unknown>): IntroSheetEntry {
  return {
    id,
    nick: (d.nick as string) ?? '',
    group: (d.group as string) ?? null,
    scope: (d.scope as SheetScope) ?? 'all',
    ratio: Number(d.ratio) || 0.72,
  };
}

// "나만 보기"는 목록 문서도 썸네일 문서도 만들지 않는다. 목록에 올려두고 화면에서만 걸러 보여주면,
// 고른 사람에게는 감춘 것처럼 보이지만 실제로는 아무나 꺼내볼 수 있는 자리에 놓인 셈이 된다.
async function writeIndex(playerId: string, entry: IntroSheetEntry, thumb: string) {
  if (!firebaseEnabled || !db) return;
  const indexRef = doc(db, 'introSheets', playerId);
  const thumbRef = doc(db, 'introSheetThumbs', playerId);
  if (entry.scope === 'me') {
    await Promise.all([deleteDoc(indexRef).catch(() => {}), deleteDoc(thumbRef).catch(() => {})]);
    return;
  }
  // 썸네일을 먼저 넣는다 — 목록에는 떴는데 그림 칸만 영영 비어 있는 순서가 생기지 않도록.
  await setDoc(thumbRef, { thumb });
  await setDoc(indexRef, {
    nick: entry.nick,
    group: entry.group,
    scope: entry.scope,
    ratio: entry.ratio,
    updatedAt: serverTimestamp(),
  });
}

export async function saveIntroSheet(
  playerId: string,
  nick: string,
  group: string | null,
  scope: SheetScope,
  thumb: string,
  image: string,
  ratio: number,
) {
  if (!firebaseEnabled || !db) return;
  await setDoc(doc(db, 'introSheetImages', playerId), {
    nick,
    group,
    scope,
    thumb,
    image,
    ratio,
    updatedAt: serverTimestamp(),
  });
  await writeIndex(playerId, { id: playerId, nick, group, scope, ratio }, thumb);
}

/** 올린 뒤에 공개 범위만 바꾼다. 사진은 그대로 두고 어디까지 보일지만 옮긴다. */
export async function setIntroSheetScope(playerId: string, scope: SheetScope) {
  if (!firebaseEnabled || !db) return;
  const snap = await getDoc(doc(db, 'introSheetImages', playerId));
  if (!snap.exists()) return;
  const data = snap.data();
  const cur = entryFrom(playerId, data);
  await setDoc(doc(db, 'introSheetImages', playerId), { scope, updatedAt: serverTimestamp() }, { merge: true });
  await writeIndex(playerId, { ...cur, scope }, (data.thumb as string) ?? '');
}

export async function deleteIntroSheet(playerId: string) {
  if (!firebaseEnabled || !db) return;
  await Promise.all([
    deleteDoc(doc(db, 'introSheets', playerId)).catch(() => {}),
    deleteDoc(doc(db, 'introSheetThumbs', playerId)).catch(() => {}),
  ]);
  await deleteDoc(doc(db, 'introSheetImages', playerId));
}

/** 내가 올린 것. 목록에 없는 "나만 보기"도 여기서는 그대로 나온다. */
export async function loadMyIntroSheet(playerId: string): Promise<MyIntroSheet | null> {
  if (!firebaseEnabled || !db) return null;
  const snap = await getDoc(doc(db, 'introSheetImages', playerId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { ...entryFrom(playerId, d), thumb: (d.thumb as string) ?? '', image: (d.image as string) ?? '' };
}

/** 목록 칸이 화면에 들어올 때 한 장씩 받아오는 작은 그림. */
export async function loadIntroSheetThumb(playerId: string): Promise<string | null> {
  if (!firebaseEnabled || !db) return null;
  const snap = await getDoc(doc(db, 'introSheetThumbs', playerId));
  return snap.exists() ? ((snap.data().thumb as string) ?? null) : null;
}

/** 남의 것을 눌렀을 때 그제서야 받아오는 원본. */
export async function loadIntroSheetImage(playerId: string): Promise<string | null> {
  if (!firebaseEnabled || !db) return null;
  const snap = await getDoc(doc(db, 'introSheetImages', playerId));
  if (!snap.exists()) return null;
  return (snap.data().image as string) ?? null;
}

// 자기소개지는 나눔이 진행되는 동안 계속 올라온다. 새로고침으로 받아오게 두면
// 먼저 들어온 사람 화면에는 나중에 올린 사람이 끝내 안 보인다.
export function subscribeIntroSheets(
  cb: (entries: IntroSheetEntry[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  if (!firebaseEnabled || !db) return () => {};
  const q = query(collection(db, 'introSheets'), orderBy('updatedAt', 'desc'), limit(300));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => entryFrom(d.id, d.data()))), onError);
}

export function subscribeGameLeaderboard(
  gameId: string,
  cb: (entries: GameTimeEntry[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  if (!firebaseEnabled || !db) return () => {};
  const q = query(collection(db, `gameTimes_${gameId}`), orderBy('rankKey', 'asc'), limit(3));
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map((d) => ({
          id: d.id,
          nick: d.data().nick,
          elapsedMs: d.data().elapsedMs,
          hints: d.data().hints ?? 0,
        })),
      );
    },
    onError,
  );
}
