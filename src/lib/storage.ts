import type { AppState } from '../types';

const LAST_ID_KEY = 'breaker:lastId';
const GROUP_KEY = 'breaker:group';

function stateKey(id: string) {
  return `breaker:state:${id}`;
}

export function saveLastId(id: string) {
  localStorage.setItem(LAST_ID_KEY, id);
}

export function loadLastId(): string | null {
  return localStorage.getItem(LAST_ID_KEY);
}

export function saveState(id: string, state: AppState) {
  localStorage.setItem(stateKey(id), JSON.stringify(state));
}

export function loadState(id: string): AppState | null {
  const raw = localStorage.getItem(stateKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

export function saveGroup(group: string) {
  localStorage.setItem(GROUP_KEY, group);
}

export function loadGroup(): string | null {
  return localStorage.getItem(GROUP_KEY);
}

// 타임어택형 미니게임(수식 만들기/결합/라이트아웃)의 시작 시각.
// 앱을 나갔다 들어와도 이 시각 기준으로 경과시간이 그대로 흐르도록 최초 1회만 저장한다.
function gameStartKey(lockId: string) {
  return `breaker:gameStart:${lockId}`;
}
function gameDoneKey(lockId: string) {
  return `breaker:gameDone:${lockId}`;
}

export function getGameStart(lockId: string): number | null {
  const v = localStorage.getItem(gameStartKey(lockId));
  return v ? Number(v) : null;
}

export function setGameStartIfAbsent(lockId: string): number {
  const existing = getGameStart(lockId);
  if (existing) return existing;
  const now = Date.now();
  localStorage.setItem(gameStartKey(lockId), String(now));
  return now;
}

export function isGameTimeRecorded(lockId: string): boolean {
  return localStorage.getItem(gameDoneKey(lockId)) === '1';
}

export function markGameTimeRecorded(lockId: string) {
  localStorage.setItem(gameDoneKey(lockId), '1');
}
