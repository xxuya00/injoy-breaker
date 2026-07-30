const GAS_URL = import.meta.env.VITE_GAS_URL as string | undefined;

export const gasEnabled = Boolean(GAS_URL);

async function gasGet(params: Record<string, string>) {
  if (!GAS_URL) return null;
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GAS_URL}?${qs}`);
  return res.json();
}

async function gasPost(body: Record<string, unknown>) {
  if (!GAS_URL) return null;
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return res.json();
}

interface RemoteProgress {
  nick: string;
  day: number;
  opened: Record<string, boolean>;
  score: number;
}

export async function saveRemoteProgress(id: string, nick: string, day: number, opened: Record<string, boolean>) {
  if (!gasEnabled) return;
  await gasPost({ action: 'savePlayer', id, nick, day, opened, score: Object.keys(opened).length });
}

export async function loadRemoteProgress(id: string): Promise<RemoteProgress | null> {
  if (!gasEnabled) return null;
  const data = await gasGet({ action: 'getPlayer', id });
  return data ?? null;
}

export interface PrayerEntry {
  id: string;
  group: string;
  nick: string;
  text: string;
  createdAt: string;
}

export async function fetchPrayers(group: string): Promise<PrayerEntry[]> {
  if (!gasEnabled) return [];
  const data = await gasGet({ action: 'getPrayers', group });
  return data ?? [];
}

export async function addPrayer(group: string, nick: string, text: string) {
  if (!gasEnabled) return;
  await gasPost({ action: 'addPrayer', group, nick, text });
}

export interface NoticeEntry {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export async function fetchNotices(): Promise<NoticeEntry[]> {
  if (!gasEnabled) return [];
  const data = await gasGet({ action: 'getNotices' });
  return data ?? [];
}

export async function fetchLockUnlockTimes(): Promise<Record<string, string>> {
  if (!gasEnabled) return {};
  const data = await gasGet({ action: 'getLocks' });
  const map: Record<string, string> = {};
  (data ?? []).forEach((row: { id: string; unlockAt: string }) => {
    map[row.id] = row.unlockAt;
  });
  return map;
}

export interface TypeResultPayload {
  playerId: string;
  nick: string;
  idolPrimary: string;
  idolSecondary: string;
  comboName: string;
  medType: string;
  medTypeName: string;
  prayType: string;
  prayTypeName: string;
  medTime: string;
  prayTime: string;
}

export async function saveTypeResult(payload: TypeResultPayload) {
  if (!gasEnabled) return;
  await gasPost({ action: 'saveTypeResult', ...payload });
}

export async function sendMessage(playerId: string, nick: string, text: string, urgent: boolean) {
  if (!gasEnabled) return;
  await gasPost({ action: 'addMessage', playerId, nick, text, urgent });
}
