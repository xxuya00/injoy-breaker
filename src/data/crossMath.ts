export interface CrossMathRound {
  rowTargets: [number, number, number];
  colTargets: [number, number, number];
  // 이 판을 만들 때 쓴 배치(9칸). 합만 같으면 다른 배치도 정답이 될 수 있지만,
  // 힌트는 "적어도 이 배치로는 풀린다"는 한 줄기를 잡아주는 용도라 이거면 충분하다.
  solution: number[];
}

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
  return { rowTargets, colTargets, solution: nums };
}

// 한 줄(가로/세로)이 다 채워졌고 합까지 맞으면 그 줄을 "완성"으로 본다.
// 화면에서 완성된 줄만 초록으로 표시해 어디까지 맞췄는지 바로 보이게 하려는 용도.
export interface CrossMathLines {
  rows: [boolean, boolean, boolean];
  cols: [boolean, boolean, boolean];
}

export function crossMathLines(values: (number | null)[], round: CrossMathRound): CrossMathLines {
  const lineDone = (cells: (number | null)[], target: number) =>
    cells.every((v) => v !== null) && (cells as number[]).reduce((a, b) => a + b, 0) === target;
  const rows = [0, 1, 2].map((r) =>
    lineDone([values[r * 3], values[r * 3 + 1], values[r * 3 + 2]], round.rowTargets[r]),
  ) as [boolean, boolean, boolean];
  const cols = [0, 1, 2].map((c) =>
    lineDone([values[c], values[c + 3], values[c + 6]], round.colTargets[c]),
  ) as [boolean, boolean, boolean];
  return { rows, cols };
}

export function checkCrossMath(values: (number | null)[], round: CrossMathRound): boolean {
  if (values.some((v) => v === null)) return false;
  const v = values as number[];
  const grid = [v.slice(0, 3), v.slice(3, 6), v.slice(6, 9)];
  const rowOk = grid.every((row, r) => row[0] + row[1] + row[2] === round.rowTargets[r]);
  const colOk = [0, 1, 2].every((c) => grid[0][c] + grid[1][c] + grid[2][c] === round.colTargets[c]);
  return rowOk && colOk;
}
