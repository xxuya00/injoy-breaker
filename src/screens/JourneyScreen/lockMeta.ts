// LOCKS에서 파생되는 표. 목록을 손으로 다시 적지 않고 뽑아내야, 자물쇠가 바뀌어도
// 날짜별 개수·QR 인식 범위가 저절로 따라온다.
import { LOCKS, FINAL_REQUIRED } from '../../data/locks';
import type { Day } from '../../types';

// 자물쇠 id → 그 자물쇠가 속한 날. QR로 다른 날의 자물쇠를 바로 열 때, 지금 보고 있는 날이 아니라
// 그 자물쇠가 속한 날의 잠금을 봐야 해서 미리 만들어 둔다.
export const ITEM_DAY: Record<string, Day> = (() => {
  const map: Record<string, Day> = {};
  ([1, 2, 3] as Day[]).forEach((d) => {
    LOCKS[d].items.forEach((it) => {
      map[it.id] = d;
    });
  });
  return map;
})();

// 다이얼을 여는 데 필요한 자물쇠(FINAL_REQUIRED)를 날짜별로 나눠둔 것. DAY 3의 되짚기 줄이
// "DAY 1 · 7/9"처럼 날마다 몇 개가 남았는지 적을 때 쓴다.
// 목록을 직접 적지 않고 FINAL_REQUIRED에서 파생시킨다 — 필요한 자물쇠가 바뀌면 되짚기 줄의
// 숫자도 같이 따라와야, 다 채웠는데 다이얼이 안 열리는(혹은 그 반대의) 줄이 되지 않는다.
export const FINAL_BY_DAY: { day: Day; ids: string[] }[] = ([1, 2, 3] as Day[])
  .map((day) => ({ day, ids: FINAL_REQUIRED.filter((id) => ITEM_DAY[id] === day) }))
  .filter((g) => g.ids.length > 0);

// Day1의 자물쇠 9개를 하나씩 깰 때마다, 그 칸 안에서 바로 BACKTOGOD의 글자가 순서대로 드러난다.
export const BACKTOGOD_WORD = 'BACKTOGOD'.split('');
export const DAY1_IDS = LOCKS[1].items.map((i) => i.id);

export const DAY_LABELS: Record<Day, string> = { 1: 'BREAK AWAY', 2: 'BREAK DOWN', 3: 'BREAK THROUGH' };
export const DAY2_MISSIONS = LOCKS[2].items.filter((i) => i.type === 'mission');
export const DAY2_MISSION_IDS = DAY2_MISSIONS.map((i) => i.id);
const ALL_LOCK_IDS = new Set(([1, 2, 3] as Day[]).flatMap((d) => LOCKS[d].items.map((i) => i.id)));

// 카메라로 스캔한 문자열에서 미션 id를 뽑아낸다. 전체 URL(?qr=d2a)이든 id만 담긴 문자열이든 둘 다 받아준다.
export function parseQrText(text: string): string | null {
  let raw = text.trim();
  try {
    const url = new URL(raw);
    const q = url.searchParams.get('qr');
    if (q) raw = q;
  } catch {
    const m = raw.match(/[?&]qr=([a-zA-Z0-9_-]+)/);
    if (m) raw = m[1];
  }
  return ALL_LOCK_IDS.has(raw) ? raw : null;
}
