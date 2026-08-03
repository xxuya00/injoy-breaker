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
  nickname?: string;
  group?: string;
  day: number;
  opened: Record<string, boolean>;
  score: number;
}

// missing: 시트에 그 id의 행이 없어서 저장하지 않았다는 뜻.
// 관리자가 참가자를 지운 뒤에도 앱이 켜져 있던 기기가 진행도를 다시 써 넣어
// 지운 기록이 되살아나는 걸 막기 위해, 신규 등록(create)이 아닌 저장은 행을 새로 만들지 않는다.
export interface SavePlayerResult {
  missing?: boolean;
}

export async function saveRemoteProgress(
  id: string,
  nick: string,
  day: number,
  opened: Record<string, boolean>,
  nickname?: string,
  group?: string,
  create = false,
): Promise<SavePlayerResult> {
  if (!gasEnabled) return {};
  const res = await gasPost({
    action: 'savePlayer',
    id,
    nick,
    day,
    opened,
    score: Object.keys(opened).length,
    nickname,
    group,
    create,
  });
  return (res ?? {}) as SavePlayerResult;
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

// 자물쇠 하나(d1a…)뿐 아니라 하루 전체(day2)·구역(d2_qr 등)에도 같은 id 체계를 쓴다.
export interface LockGate {
  /** 이 시각이 지나야 열린다. 시각 없이 잠가둔 칸이면 없다. */
  unlockAt?: string;
  /** 시각과 무관하게 잠가둔 칸. 관리자가 직접 풀어줄 때까지 잠긴다. */
  locked: boolean;
}

export async function fetchLockGates(): Promise<Record<string, LockGate>> {
  if (!gasEnabled) return {};
  const data = await gasGet({ action: 'getLocks' });
  const map: Record<string, LockGate> = {};
  (data ?? []).forEach((row: { id: string; unlockAt?: string | null; locked?: boolean }) => {
    map[row.id] = { unlockAt: row.unlockAt ?? undefined, locked: !!row.locked };
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
  // 결과를 그리는 데 쓰인 원본 답변. 기기 캐시가 지워지거나 다른 기기로 들어와도
  // 이 답변만 있으면 결과 화면을 그대로 되살릴 수 있어서 함께 백업해둔다.
  answers: Record<string, number>;
  version: number;
}

export async function saveTypeResult(payload: TypeResultPayload) {
  if (!gasEnabled) return;
  await gasPost({ action: 'saveTypeResult', ...payload });
}

export interface RemoteTypeResult {
  version: number;
  answers: Record<string, number>;
}

// 시트에 백업해둔 유형검사 답변을 되찾아온다. 답변이 없던 시절(구버전)에 저장된 행이면 null.
export async function loadTypeResult(playerId: string): Promise<RemoteTypeResult | null> {
  if (!gasEnabled) return null;
  const data = await gasGet({ action: 'getTypeResult', playerId });
  if (!data || !data.answers) return null;
  return { version: Number(data.version) || 0, answers: data.answers as Record<string, number> };
}

export async function sendMessage(playerId: string, nick: string, text: string, urgent: boolean) {
  if (!gasEnabled) return;
  await gasPost({ action: 'addMessage', playerId, nick, text, urgent });
}
