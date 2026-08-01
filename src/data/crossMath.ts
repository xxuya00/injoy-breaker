export interface CrossMathRound {
  rowTargets: [number, number, number];
  colTargets: [number, number, number];
  hint: string;
}

const HINTS = [
  '전도서 3장은 "범사에 기한이 있다"고 말합니다.',
  '솔로몬은 잠언을 통해 지혜를 구하라 권합니다.',
  '전도서 1장 2절 — "헛되고 헛되도다."',
  '지혜자의 마음은 초상집에 있다 하였습니다(전도서 7:4).',
];

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateCrossMathRound(): CrossMathRound {
  const nums = shuffleArr([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const grid = [nums.slice(0, 3), nums.slice(3, 6), nums.slice(6, 9)];
  const rowTargets = grid.map((row) => row[0] + row[1] + row[2]) as [number, number, number];
  const colTargets = [0, 1, 2].map((c) => grid[0][c] + grid[1][c] + grid[2][c]) as [number, number, number];
  const hint = HINTS[Math.floor(Math.random() * HINTS.length)];
  return { rowTargets, colTargets, hint };
}

export function checkCrossMath(values: (number | null)[], round: CrossMathRound): boolean {
  if (values.some((v) => v === null)) return false;
  const v = values as number[];
  const grid = [v.slice(0, 3), v.slice(3, 6), v.slice(6, 9)];
  const rowOk = grid.every((row, r) => row[0] + row[1] + row[2] === round.rowTargets[r]);
  const colOk = [0, 1, 2].every((c) => grid[0][c] + grid[1][c] + grid[2][c] === round.colTargets[c]);
  return rowOk && colOk;
}
