export const MAZE_SIZE = 5;
export const MAZE_START: [number, number] = [0, 0];
export const MAZE_END: [number, number] = [4, 4];

const PATH_LEN_MIN = 7;
const PATH_LEN_MAX = 9;

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 시작에서 도착까지 이어지는 임의의 통로(랜덤워크)를 하나 만든다.
// 막다른 길에 몰리거나 길이가 목표 범위를 벗어나면 null을 돌려주고 재시도한다.
function tryWalk(): [number, number][] | null {
  const visited = new Set<string>([`${MAZE_START[0]},${MAZE_START[1]}`]);
  const path: [number, number][] = [MAZE_START];
  let cur = MAZE_START;

  while (!(cur[0] === MAZE_END[0] && cur[1] === MAZE_END[1])) {
    const [r, c] = cur;
    const candidates = shuffleArr([
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ] as [number, number][]).filter(
      ([nr, nc]) => nr >= 0 && nc >= 0 && nr < MAZE_SIZE && nc < MAZE_SIZE && !visited.has(`${nr},${nc}`),
    );
    if (candidates.length === 0) return null;

    let next = candidates[0];
    if (path.length >= PATH_LEN_MAX - 1) {
      const dist = (p: [number, number]) => Math.abs(p[0] - MAZE_END[0]) + Math.abs(p[1] - MAZE_END[1]);
      const closer = candidates.find((p) => dist(p) < dist(cur));
      if (!closer) return null;
      next = closer;
    }
    visited.add(`${next[0]},${next[1]}`);
    path.push(next);
    cur = next;
    if (path.length > PATH_LEN_MAX) return null;
  }
  return path;
}

export function generateMazePath(): [number, number][] {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const path = tryWalk();
    if (path && path.length >= PATH_LEN_MIN && path.length <= PATH_LEN_MAX) return path;
  }
  // 안전망: 위 시도로 못 찾으면 항상 성립하는 계단식 경로를 반환한다.
  return [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [2, 2],
    [2, 3],
    [3, 3],
    [3, 4],
    [4, 4],
  ];
}
