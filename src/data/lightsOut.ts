export interface LightsOutRound {
  size: number;
  initial: boolean[][];
  // 아직 눌러야 하는 칸들. 누른 칸을 여기서 뒤집어 두면 판이 어떻게 흘러가든 항상 "지금 남은 정답"이 된다.
  // (같은 칸을 두 번 누르면 서로 상쇄되므로, 정답 집합은 처음 섞은 칸들과 지금까지 누른 칸들의 차집합이다.)
  solution: boolean[][];
}

export function toggleLight(board: boolean[][], r: number, c: number, size: number): boolean[][] {
  const next = board.map((row) => [...row]);
  const deltas: [number, number][] = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  deltas.forEach(([dr, dc]) => {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      next[nr][nc] = !next[nr][nc];
    }
  });
  return next;
}

// 항상 "전부 꺼진 상태"에서 시작해 무작위로 N번 눌러 섞는다.
// XOR 연산은 자기 자신이 역원이라, 같은 칸들을 (순서 무관하게) 다시 누르면 반드시 풀린다 — 항상 풀리는 문제만 나옴.
export function generateLightsOut(size = 5, presses = 9): LightsOutRound {
  let board: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const solution: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  for (let i = 0; i < presses; i++) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    board = toggleLight(board, r, c, size);
    solution[r][c] = !solution[r][c];
  }
  if (board.every((row) => row.every((v) => !v))) {
    return generateLightsOut(size, presses);
  }
  return { size, initial: board, solution };
}
