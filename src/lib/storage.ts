import type { AppState } from '../types';

const LAST_ID_KEY = 'breaker:lastId';
const GROUP_KEY = 'breaker:group';
// 개요를 이미 본 기기인지. 앱을 켤 때마다 개요가 처음부터 다시 나오면 성가시므로
// 한 번 끝까지(또는 건너뛰기로) 본 뒤에는 바로 등록 화면에서 시작한다.
// 등록 화면의 "개요 다시 보기"로는 언제든 다시 볼 수 있다.
const INTRO_SEEN_KEY = 'breaker:introSeen';

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

export function hasSeenIntro(): boolean {
  return localStorage.getItem(INTRO_SEEN_KEY) === '1';
}

export function markIntroSeen() {
  localStorage.setItem(INTRO_SEEN_KEY, '1');
}

// DAY 3 다이얼의 흐림이 걷히는 순간은 한 번뿐이다. 마지막 자물쇠를 깬 뒤 처음으로 DAY 3을
// 열었을 때만 재생하고, 그 뒤로는 앱을 다시 켜도 처음부터 또렷한 다이얼로 시작한다.
const DIAL_REVEAL_KEY = 'breaker:dialReveal';

export function hasDialRevealed(id: string): boolean {
  return localStorage.getItem(`${DIAL_REVEAL_KEY}:${id}`) === '1';
}

export function markDialRevealed(id: string) {
  localStorage.setItem(`${DIAL_REVEAL_KEY}:${id}`, '1');
}

export function saveGroup(group: string) {
  localStorage.setItem(GROUP_KEY, group);
}

export function loadGroup(): string | null {
  return localStorage.getItem(GROUP_KEY);
}

// "함께 기도하기"를 이미 누른 기도제목 id들. 시트에는 숫자만 쌓이고 누가 눌렀는지는
// 남지 않으므로, 같은 사람이 여러 번 누르는 건 이 기기 기록으로만 막는다.
// (기기를 바꾸거나 저장소를 비우면 다시 누를 수 있다 — 정확한 집계가 아니라 마음을 보태는 표시다.)
const PRAYED_KEY = 'breaker:prayed';

export function loadPrayedIds(): string[] {
  const raw = localStorage.getItem(PRAYED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function savePrayedIds(ids: string[]) {
  localStorage.setItem(PRAYED_KEY, JSON.stringify(ids));
}

// 타임어택형 미니게임의 누적 경과시간(ms).
// 화면을 보고 있는 동안만 흐르고, 나가면 그 지점에서 멈췄다가 다시 들어오면 이어서 흐른다.
// 도전 횟수는 세지 않는다 — 몇 번을 다시 해도 순위에는 본인 최고 기록 하나만 남으므로
// (사람마다 문서 하나, 더 좋은 기록일 때만 덮어씀), 횟수를 제한할 이유가 없다.
function gameElapsedKey(lockId: string) {
  return `breaker:gameElapsed:${lockId}`;
}

export function getAccumulatedMs(lockId: string): number {
  const v = localStorage.getItem(gameElapsedKey(lockId));
  return v ? Number(v) : 0;
}

export function setAccumulatedMs(lockId: string, ms: number) {
  localStorage.setItem(gameElapsedKey(lockId), String(ms));
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

// 검사를 마쳤을 때 결론만 따로 남겨둔다. 나눔 화면은 "내 1위 유형이 무엇인가"만 알면 되는데,
// 답변 전체를 다시 채점하려면 문항 구성(version)까지 알아야 해서 검사 화면과 얽히게 된다.
// 문항이 바뀌어도 이미 받은 결과는 그대로 두는 편이 낫기 때문에 version도 걸지 않는다.
export interface StoredTypeSummary {
  primary: string;
  secondary: string;
  comboName: string;
  /**
   * 묵상의 결(B/D/F/S). 나눔 자리에서 실천 가이드를 다시 펴 보려면 이 글자 하나면 된다.
   * 예전에 검사를 마친 사람의 기록에는 없으므로 없을 수도 있는 값으로 둔다.
   */
  walkCode?: string;
}

function typeSummaryKey(id: string) {
  return `breaker:typeSummary:${id}`;
}

export function saveTypeSummary(id: string, summary: StoredTypeSummary) {
  localStorage.setItem(typeSummaryKey(id), JSON.stringify(summary));
}

export function loadTypeSummary(id: string): StoredTypeSummary | null {
  const raw = localStorage.getItem(typeSummaryKey(id));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredTypeSummary;
    return parsed.primary ? parsed : null;
  } catch {
    return null;
  }
}

// 나눔을 마쳤는지. 나눔은 앱 밖(둘러앉아 이야기하는 자리)에서 일어나는 일이라 앱이 끝을
// 알 방법이 없다. 그래서 나눔 화면 끝의 "나눔 마치기"를 누른 것만 표시로 남긴다 —
// 화면에 들어온 것만으로 마쳤다고 치면, 질문을 훑어보러 들른 사람도 다음 걸음으로 넘어가 버린다.
function shareDoneKey(id: string) {
  return `breaker:shareDone:${id}`;
}

export function markShareDone(id: string) {
  localStorage.setItem(shareDoneKey(id), '1');
}

export function hasShareDone(id: string): boolean {
  return localStorage.getItem(shareDoneKey(id)) === '1';
}

// 나눔 자리에서 적는 메모. 같은 유형 나눔에서 정리한 우리 유형이 조 나눔에서 소개할 재료가
// 되므로, 앞의 나눔에서 적은 글이 뒤의 나눔에서도 그대로 펴져야 한다.
// 남에게 보여줄 글이 아니라 내가 말할 거리를 붙들어두는 메모라서 시트에도 Firestore에도
// 올리지 않고 이 기기에만 둔다. key는 나눔 세션 키('same' | 'group').
function shareMemoKey(id: string) {
  return `breaker:shareMemo:${id}`;
}

export function saveShareMemo(id: string, memo: Record<string, string>) {
  localStorage.setItem(shareMemoKey(id), JSON.stringify(memo));
}

export function loadShareMemo(id: string): Record<string, string> {
  const raw = localStorage.getItem(shareMemoKey(id));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

// 잠언을 남겼는지. 글 자체는 Firestore에 있지만, 여정 화면에서 "세 걸음 중 어디까지 왔나"를
// 보여주자고 목록 전체를 실시간 구독할 이유는 없다. 남긴 순간에 이 기기에 표시만 남긴다.
// 기기를 옮겨 왔다면 잠언 화면에 들어가 내 글을 만나는 순간 그때 표시가 생긴다.
function proverbWrittenKey(id: string) {
  return `breaker:proverbWritten:${id}`;
}

export function markProverbWritten(id: string) {
  localStorage.setItem(proverbWrittenKey(id), '1');
}

export function hasProverbWritten(id: string): boolean {
  return localStorage.getItem(proverbWrittenKey(id)) === '1';
}

// 자기소개지를 올렸는지. 사진 자체는 Firestore에 있지만, 여정 화면 한 줄에 표시 하나를
// 켜자고 원본을 받아올 수는 없다(한 장이 수백 KB다). 올린 순간에 이 기기에 표시만 남긴다.
// "나만 보기"로 올린 사진은 목록에 오르지 않으므로, 이 표시가 아니면 여정에서는 알 길이 없다.
// 기기를 옮겨 왔다면 자기소개 화면에 들어가 내 것을 만나는 순간 그때 표시가 생긴다.
function introSheetKey(id: string) {
  return `breaker:introSheet:${id}`;
}

export function markIntroSheetUploaded(id: string, uploaded: boolean) {
  if (uploaded) localStorage.setItem(introSheetKey(id), '1');
  else localStorage.removeItem(introSheetKey(id));
}

export function hasIntroSheet(id: string): boolean {
  return localStorage.getItem(introSheetKey(id)) === '1';
}

// 아침 큐티에 적은 답변. 인도자에게 내는 기록이 아니라 본인만 보는 글이라
// 시트에도 Firestore에도 올리지 않고 이 기기에만 둔다.
// key는 `${일차}_${섹션}_${질문}` — 문항이 바뀌면 예전 답이 엉뚱한 질문에 붙지만,
// 유형검사와 달리 본인이 읽고 지우면 그만이라 버전을 따로 두지 않는다.
function qtAnswersKey(id: string) {
  return `breaker:qt:${id}`;
}

export function saveQtAnswers(id: string, answers: Record<string, string>) {
  localStorage.setItem(qtAnswersKey(id), JSON.stringify(answers));
}

export function loadQtAnswers(id: string): Record<string, string> {
  const raw = localStorage.getItem(qtAnswersKey(id));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}
