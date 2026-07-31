export interface LightsOutRound {
  size: number;
  initial: boolean[][];
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
  for (let i = 0; i < presses; i++) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    board = toggleLight(board, r, c, size);
  }
  if (board.every((row) => row.every((v) => !v))) {
    return generateLightsOut(size, presses);
  }
  return { size, initial: board };
}
