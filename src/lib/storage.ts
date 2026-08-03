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

// 구글 시트(진짜 DB)에 해당 id의 기록이 없을 때 호출한다.
// 클리어 여부는 시트가 기준이므로, 시트에 없으면 이 기기에 남아있던 흔적을 전부 지운다.
// 진행도만 지우고 조·게임 기록·유형검사 답변을 남겨두면 다시 등록했을 때
// 지운 적 없는 예전 기록이 되살아나 보이므로, breaker: 로 시작하는 키를 통째로 비운다.
export function clearLocalPlayer() {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('breaker:')) keys.push(key);
  }
  keys.forEach((key) => localStorage.removeItem(key));
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

// 유형검사 진행 상황. 문항을 풀다가 앱을 나가거나 새로고침해도 보던 화면 그대로 이어서
// 풀 수 있도록, 그리고 검사를 마친 뒤엔 결과를 다시 볼 수 있도록 이 기기에 남겨둔다.
// order: 우상 문항이 섞인 순서. 다시 들어올 때 새로 섞으면 idx가 엉뚱한 문항을 가리키므로 함께 저장한다.
// idx: 마지막으로 보고 있던 화면. version은 전체 화면 수 —
// 문항이 바뀌면 예전 답변은 다른 질문에 대한 답이 되므로 통째로 버린다.
export interface StoredTypeProgress {
  version: number;
  order: number[];
  idx: number;
  answers: Record<string, number>;
}

function typeProgressKey(id: string) {
  return `breaker:typeAnswers:${id}`;
}

export function saveTypeProgress(id: string, progress: StoredTypeProgress) {
  localStorage.setItem(typeProgressKey(id), JSON.stringify(progress));
}

export function loadTypeProgress(id: string, version: number): StoredTypeProgress | null {
  const raw = localStorage.getItem(typeProgressKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredTypeProgress;
    if (parsed.version !== version) return null;
    // 예전 버전에는 order/idx가 없었다. 답변만 남은 기록은 이어풀기를 할 수 없으므로 버린다.
    if (!Array.isArray(parsed.order) || typeof parsed.idx !== 'number' || !parsed.answers) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearTypeProgress(id: string) {
  localStorage.removeItem(typeProgressKey(id));
}
