export const ITEM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export interface BalanceStage {
  items: number;
  weighings: number;
}

// 단계가 오를수록 물건 수와 저울질 횟수가 늘어난다.
export const BALANCE_STAGES: BalanceStage[] = [
  { items: 4, weighings: 2 },
  { items: 6, weighings: 2 },
  { items: 8, weighings: 3 },
];

export type WeighResult = 'left' | 'right' | 'balanced';

export interface Weighing {
  left: number[];
  right: number[];
  result: WeighResult;
}

export interface BalanceRound {
  itemCount: number;
  weighings: Weighing[];
  fakeIndex: number; // 정답: 무게가 다른(더 무거운) 물건
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 각 저울질마다 물건을 좌/우/보류로 무작위로 나눠(양쪽 개수는 항상 같게) 물건마다
// 저울질별 위치(좌:1, 우:-1, 보류:0)로 이뤄진 코드를 부여한다. 이 코드가 물건마다
// 전부 달라야만, 실제 결과(가짜의 코드)만 보고 어떤 물건인지 유일하게 추릴 수 있다.
function buildWeighings(itemCount: number, numWeighings: number): { codes: number[][]; groups: { left: number[]; right: number[] }[] } {
  const groupSize = Math.max(1, Math.floor(itemCount / 3));
  for (let attempt = 0; attempt < 2000; attempt++) {
    const groups: { left: number[]; right: number[] }[] = [];
    const codes: number[][] = Array.from({ length: itemCount }, () => []);
    for (let w = 0; w < numWeighings; w++) {
      const shuffled = shuffleArr(Array.from({ length: itemCount }, (_, i) => i));
      const left = shuffled.slice(0, groupSize);
      const right = shuffled.slice(groupSize, groupSize * 2);
      groups.push({ left, right });
      for (let i = 0; i < itemCount; i++) {
        codes[i].push(left.includes(i) ? 1 : right.includes(i) ? -1 : 0);
      }
    }
    const codeKeys = codes.map((c) => c.join(','));
    if (new Set(codeKeys).size === itemCount) return { codes, groups };
  }
  // 안전망: 못 찾으면 저울질을 하나 더 늘려 표현 가능한 경우의 수를 넓힌다.
  return buildWeighings(itemCount, numWeighings + 1);
}

export function generateBalanceRound(stageIdx: number): BalanceRound {
  const stage = BALANCE_STAGES[stageIdx] ?? BALANCE_STAGES[BALANCE_STAGES.length - 1];
  const { codes, groups } = buildWeighings(stage.items, stage.weighings);
  const fakeIndex = Math.floor(Math.random() * stage.items);
  const fakeCode = codes[fakeIndex];
  const weighings: Weighing[] = groups.map((g, i) => ({
    left: g.left,
    right: g.right,
    result: fakeCode[i] === 1 ? 'left' : fakeCode[i] === -1 ? 'right' : 'balanced',
  }));
  return { itemCount: stage.items, weighings, fakeIndex };
}
