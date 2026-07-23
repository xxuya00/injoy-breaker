import type { AppState } from '../types';

const LAST_ID_KEY = 'breaker:lastId';

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
