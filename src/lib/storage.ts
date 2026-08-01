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

// 타임어택형 미니게임의 누적 경과시간(ms).
// 화면을 보고 있는 동안만 흐르고, 나가면 그 지점에서 멈췄다가 다시 들어오면 이어서 흐른다.
function gameElapsedKey(lockId: string) {
  return `breaker:gameElapsed:${lockId}`;
}
// 순위에 반영되는 시도 횟수. 처음 3번의 시도까지만 기록되고, 그중 가장 빠른 기록이 순위판에 남는다.
function gameAttemptsKey(lockId: string) {
  return `breaker:gameAttempts:${lockId}`;
}

export function getAccumulatedMs(lockId: string): number {
  const v = localStorage.getItem(gameElapsedKey(lockId));
  return v ? Number(v) : 0;
}

export function setAccumulatedMs(lockId: string, ms: number) {
  localStorage.setItem(gameElapsedKey(lockId), String(ms));
}

export function getGameAttempts(lockId: string): number {
  const v = localStorage.getItem(gameAttemptsKey(lockId));
  return v ? Number(v) : 0;
}

export function incrementGameAttempts(lockId: string): number {
  const next = getGameAttempts(lockId) + 1;
  localStorage.setItem(gameAttemptsKey(lockId), String(next));
  return next;
}
