const GAS_URL = import.meta.env.VITE_GAS_URL as string | undefined;

export const gasEnabled = Boolean(GAS_URL);

// 배포된 Apps Script가 모르는 action을 받으면 HTTP 200 + {"error":"unknown action"}을 돌려준다.
// (스크립트 파일만 고치고 "배포 관리 → 새 버전"을 안 하면 실제로 이 상태가 된다.)
// 그대로 두면 저장이 성공한 것처럼 보여서 시트에 아무것도 안 들어가는 걸 아무도 눈치채지 못하므로,
// 여기서 응답 본문까지 확인해 실패를 확실히 던진다.
async function gasFetch(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`GAS 요청 실패 (HTTP ${res.status})`);
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Apps Script는 스크립트 오류·권한 문제일 때 JSON이 아니라 HTML 오류 페이지를 돌려준다.
    throw new Error('GAS 응답을 해석할 수 없어요 (JSON이 아님)');
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(`GAS 오류: ${String((data as { error: unknown }).error)}`);
  }
  return data;
}

// 쓰기 요청은 성공했을 때 반드시 {ok:true}가 온다. 그 외 응답은 실패로 본다
// (배포가 오래돼 action을 모르는 경우가 조용한 성공으로 둔갑하지 않도록).
function assertOk(data: unknown, what: string) {
  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) {
    throw new Error(`${what} 저장이 시트에 반영되지 않았어요`);
  }
}

async function gasGet(params: Record<string, string>) {
  if (!GAS_URL) return null;
  const qs = new URLSearchParams(params).toString();
  return gasFetch(`${GAS_URL}?${qs}`);
}

async function gasPost(body: Record<string, unknown>) {
  if (!GAS_URL) return null;
  return gasFetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
}

interface RemoteProgress {
  nick: string;
  nickname?: string;
  group?: string;
  /** 등록할 때 적은 "나의 다짐". 다짐 칸이 생기기 전에 등록한 사람은 값이 없다. */
  vow?: string;
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
  vow?: string,
): Promise<SavePlayerResult> {
  if (!gasEnabled) return {};
  const res = (await gasPost({
    action: 'savePlayer',
    id,
    nick,
    day,
    opened,
    score: Object.keys(opened).length,
    nickname,
    group,
    create,
    vow,
  })) as SavePlayerResult | null;
  // missing은 정상 응답이다(시트에 행이 없다는 뜻) — 그 외에는 {ok:true}가 와야 저장된 것이다.
  if (res?.missing) return res;
  assertOk(res, '진행도');
  return res ?? {};
}

export async function loadRemoteProgress(id: string): Promise<RemoteProgress | null> {
  if (!gasEnabled) return null;
  const data = await gasGet({ action: 'getPlayer', id });
  // 시트에 행이 없으면 null이 온다. 이건 오류가 아니라 "등록되지 않은 id"라는 정상 응답이다.
  return (data as RemoteProgress | null) ?? null;
}

export interface PrayerEntry {
  id: string;
  group: string;
  nick: string;
  text: string;
  createdAt: string;
  // 조원들이 "함께 기도하기"를 누른 횟수. pray_count 칸이 생기기 전에 쌓인 행은 값이 없다.
  prayCount: number;
}

export async function fetchPrayers(group: string): Promise<PrayerEntry[]> {
  if (!gasEnabled) return [];
  const data = await gasGet({ action: 'getPrayers', group });
  if (!Array.isArray(data)) throw new Error('기도제목 목록 형식이 올바르지 않아요');
  return (data as PrayerEntry[]).map((p) => ({ ...p, prayCount: Number(p.prayCount) || 0 }));
}

export async function addPrayer(group: string, nick: string, text: string) {
  if (!gasEnabled) return;
  assertOk(await gasPost({ action: 'addPrayer', group, nick, text }), '기도제목');
}

// 눌린 횟수만 1 올린다. 누가 눌렀는지는 시트에 남기지 않으므로,
// 같은 사람이 두 번 누르는 건 기기에 저장한 목록으로 막는다(storage.ts).
export async function prayFor(id: string): Promise<number | null> {
  if (!gasEnabled) return null;
  const res = (await gasPost({ action: 'prayFor', id })) as { ok?: boolean; prayCount?: number } | null;
  assertOk(res, '함께 기도하기');
  return typeof res?.prayCount === 'number' ? res.prayCount : null;
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
  if (!Array.isArray(data)) throw new Error('공지 목록 형식이 올바르지 않아요');
  return data as NoticeEntry[];
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
  if (!Array.isArray(data)) throw new Error('자물쇠 목록 형식이 올바르지 않아요');
  const map: Record<string, LockGate> = {};
  (data as { id: string; unlockAt?: string | null; locked?: boolean }[]).forEach((row) => {
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
  // 코드만 보낸다. 이름('말씀 저널러' 등)은 이 코드에서 그대로 나오는 데다
  // 결과 화면에서 칭호를 뺀 뒤로는 참가자가 본 적 없는 값이라 시트에 남기지 않는다.
  medType: string;
  prayType: string;
  medTime: string;
  prayTime: string;
  // 묵상+기도를 글자 하나로 요약한 유형 (B 쌓는 자 / D 머무는 자 / F 흐르는 자 / S 스미는 자).
  walkCode: string;
  // 화면에는 한 줄 설명으로 나오지만 그동안 시트에는 안 남던 값들.
  medSocial: string;
  prayFocus: string;
  // 1·2위만으로는 분포를 볼 수 없어서 6개 카테고리 원점수도 함께 남긴다.
  idolScores: Record<string, number>;
  // 응답의 결. 참가자 화면에는 3단계 밴드로만 나가고, 정확한 숫자는 인도자용으로 여기에만 남는다.
  consistency: number;
  clarity: number;
  flat: boolean;
  // 결과를 그리는 데 쓰인 원본 답변. 기기 캐시가 지워지거나 다른 기기로 들어와도
  // 이 답변만 있으면 결과 화면을 그대로 되살릴 수 있어서 함께 백업해둔다.
  answers: Record<string, number>;
  version: number;
}

export async function saveTypeResult(payload: TypeResultPayload) {
  if (!gasEnabled) return;
  assertOk(await gasPost({ action: 'saveTypeResult', ...payload }), '유형검사 결과');
}

export interface RemoteTypeResult {
  version: number;
  answers: Record<string, number>;
}

// 시트에 백업해둔 유형검사 답변을 되찾아온다. 답변이 없던 시절(구버전)에 저장된 행이면 null.
export async function loadTypeResult(playerId: string): Promise<RemoteTypeResult | null> {
  if (!gasEnabled) return null;
  const data = (await gasGet({ action: 'getTypeResult', playerId })) as {
    answers?: Record<string, number>;
    version?: unknown;
  } | null;
  if (!data || !data.answers) return null;
  return { version: Number(data.version) || 0, answers: data.answers };
}

export async function sendMessage(playerId: string, nick: string, text: string, urgent: boolean) {
  if (!gasEnabled) return;
  assertOk(await gasPost({ action: 'addMessage', playerId, nick, text, urgent }), '메시지');
}
