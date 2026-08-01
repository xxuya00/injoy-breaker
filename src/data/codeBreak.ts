export type ShapeId = 0 | 1 | 2 | 3 | 4;

export const SHAPES: ShapeId[] = [0, 1, 2, 3, 4];

export interface CodeBreakHint {
  a: ShapeId;
  b: ShapeId;
  op: '+' | '-';
  result: number;
}

export interface CodeBreakRound {
  hint1: CodeBreakHint;
  hint2: CodeBreakHint;
  final: { a: ShapeId; b: ShapeId };
  answer: number;
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 두 힌트 모두 공통 도형(X)을 낀 채로 구성해, X 값을 몰라도 최종식(Y+Z)이
// 대수적으로 소거되어 항상 유일하게 풀리도록 만든다.
export function generateCodeBreakRound(): CodeBreakRound {
  const digits = shuffleArr([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 5);
  const values: Record<ShapeId, number> = { 0: digits[0], 1: digits[1], 2: digits[2], 3: digits[3], 4: digits[4] };
  const [x, y, z] = shuffleArr(SHAPES).slice(0, 3);
  const vx = values[x];
  const vy = values[y];
  const vz = values[z];
  const answer = vy + vz;

  const hint1: CodeBreakHint = { a: x, b: y, op: '+', result: vx + vy };
  let hint2: CodeBreakHint;
  if (Math.random() < 0.5) {
    // [Z] - [X] = Q → Z = Q + X → Y+Z = (P-X)+(Q+X) = P+Q
    hint2 = { a: z, b: x, op: '-', result: vz - vx };
  } else {
    // [X] - [Z] = Q → Z = X - Q → Y+Z = (P-X)+(X-Q) = P-Q
    hint2 = { a: x, b: z, op: '-', result: vx - vz };
  }

  return { hint1, hint2, final: { a: y, b: z }, answer };
}
