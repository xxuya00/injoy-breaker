export type GemId = 0 | 1 | 2 | 3;

export const GEMS: GemId[] = [0, 1, 2, 3];
export const GEM_LABELS = ['A', 'B', 'C', 'D'];

export interface BalanceHint {
  heavy: GemId;
  light: GemId;
}

export interface BalanceRound {
  weights: number[]; // weights[gem] = 1..4, 정답을 계산할 때만 내부적으로 사용
  order: GemId[]; // 무거운 순서(1위→4위) — 정답
  hints: BalanceHint[];
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 무게 순으로 인접한 쌍을 힌트로 주면(A>B>C>D 형태의 연쇄) 3개 힌트만으로
// 4개 순서가 항상 유일하게 결정된다.
export function generateBalanceRound(): BalanceRound {
  const weights = shuffleArr([1, 2, 3, 4]);
  const order = [...GEMS].sort((a, b) => weights[b] - weights[a]);
  const hints: BalanceHint[] = [];
  for (let i = 0; i < order.length - 1; i++) {
    hints.push({ heavy: order[i], light: order[i + 1] });
  }
  return { weights, order, hints };
}
