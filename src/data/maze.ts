export interface MazeStage {
  rows: number;
  cols: number;
}

// 단계가 오를수록 판이 커지고, 마지막 단계는 최단경로보다 살짝 돌아가는 여유(PATH_SLACK)까지 둬서 난이도를 높인다.
export const MAZE_STAGES: MazeStage[] = [
  { rows: 3, cols: 3 },
  { rows: 5, cols: 5 },
  { rows: 7, cols: 5 },
];
const PATH_SLACK = [0, 0, 2];

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 시작(0,0)에서 도착(rows-1, cols-1)까지 이어지는 임의의 통로(랜덤워크)를 하나 만든다.
// 막다른 길에 몰리거나 길이가 목표 범위를 벗어나면 null을 돌려주고 재시도한다.
function tryWalk(rows: number, cols: number, maxLen: number): [number, number][] | null {
  const start: [number, number] = [0, 0];
  const end: [number, number] = [rows - 1, cols - 1];
  const visited = new Set<string>([`${start[0]},${start[1]}`]);
  const path: [number, number][] = [start];
  let cur = start;

  while (!(cur[0] === end[0] && cur[1] === end[1])) {
    const [r, c] = cur;
    const candidates = shuffleArr([
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ] as [number, number][]).filter(
      ([nr, nc]) => nr >= 0 && nc >= 0 && nr < rows && nc < cols && !visited.has(`${nr},${nc}`),
    );
    if (candidates.length === 0) return null;

    let next = candidates[0];
    if (path.length >= maxLen - 1) {
      const dist = (p: [number, number]) => Math.abs(p[0] - end[0]) + Math.abs(p[1] - end[1]);
      const closer = candidates.find((p) => dist(p) < dist(cur));
      if (!closer) return null;
      next = closer;
    }
    visited.add(`${next[0]},${next[1]}`);
    path.push(next);
    cur = next;
    if (path.length > maxLen) return null;
  }
  return path;
}

export function generateMazePath(stageIdx: number): [number, number][] {
  const stage = MAZE_STAGES[stageIdx] ?? MAZE_STAGES[MAZE_STAGES.length - 1];
  const { rows, cols } = stage;
  const minLen = rows - 1 + (cols - 1) + 1;
  const maxLen = minLen + (PATH_SLACK[stageIdx] ?? 0);

  for (let attempt = 0; attempt < 2000; attempt++) {
    const path = tryWalk(rows, cols, maxLen);
    if (path && path.length >= minLen && path.length <= maxLen) return path;
  }
  // 안전망: 위 시도로 못 찾으면 항상 성립하는 계단식 경로를 반환한다.
  const fallback: [number, number][] = [[0, 0]];
  let r = 0;
  let c = 0;
  while (r !== rows - 1 || c !== cols - 1) {
    if (c < cols - 1) c++;
    else r++;
    fallback.push([r, c]);
  }
  return fallback;
}
