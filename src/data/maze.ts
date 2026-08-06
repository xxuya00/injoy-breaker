export interface MazeStage {
  rows: number;
  cols: number;
  /** 최단경로보다 몇 칸까지 더 돌아갈 수 있는지. 경로 길이는 이 범위 안에서만 나온다. */
  slack: number;
  /** 최소 방향 전환 횟수. */
  minTurns: number;
  /** 한 방향으로 연달아 갈 수 있는 최대 칸수. */
  maxStraight: number;
  /** 길을 한 칸씩 켤 때, 한 칸이 켜져 있는 시간(ms). 판이 커지면 조금씩 빨라진다. */
  stepMs: number;
  /** 켜기가 끝난 뒤 걷기로 넘어가기 전 잠깐 두는 시간(ms). */
  tailMs: number;
  /** 출구가 아니라 시작점으로, 즉 본 순서를 거꾸로 되짚어 걸어야 하는 단계. */
  reverse?: boolean;
}

// 길이만 최단 근처로 묶어두면 판이 커질수록 오히려 쉬워진다 — 한 열을 쭉 내려가고 한 행을 쭉 가로지르는
// "ㄴ자" 한 줄로 굳어버려서, 큰 판인데 외울 게 두 토막밖에 없다.
// 그래서 길이와 별개로 꺾임 횟수(minTurns)와 직선 구간 길이(maxStraight)까지 조건으로 건다.
//
// 길을 통째로 한 번 보여주면 사람은 "순서"가 아니라 "모양" 하나로 외워버려서, 판을 키워도 잘 안 어려워졌다.
// 그래서 시작 칸부터 한 칸씩 차례로 켰다 끄고, 마지막 단계는 그 순서를 거꾸로 되짚어 걷게 한다.
export const MAZE_STAGES: MazeStage[] = [
  { rows: 3, cols: 3, slack: 0, minTurns: 1, maxStraight: 2, stepMs: 430, tailMs: 500 },
  { rows: 5, cols: 5, slack: 2, minTurns: 5, maxStraight: 2, stepMs: 380, tailMs: 500 },
  { rows: 7, cols: 5, slack: 2, minTurns: 7, maxStraight: 2, stepMs: 340, tailMs: 500 },
  // 마지막은 판을 더 키우는 대신 같은 7x5를 거꾸로 걷게 한다.
  // 판이 커지면 외울 게 늘 뿐이지만, 뒤집으면 이미 외운 것을 되짚어야 해서 결이 다른 어려움이 붙는다.
  { rows: 7, cols: 5, slack: 2, minTurns: 7, maxStraight: 2, stepMs: 340, tailMs: 700, reverse: true },
];

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

/** 꺾인 횟수와 가장 긴 직선 구간(칸 수)을 센다. */
function pathShape(path: [number, number][]): { turns: number; longestStraight: number } {
  const dirs = path.slice(1).map((p, i) => `${p[0] - path[i][0]},${p[1] - path[i][1]}`);
  let turns = 0;
  let longestStraight = 1;
  let run = 1;
  for (let i = 1; i < dirs.length; i++) {
    if (dirs[i] !== dirs[i - 1]) {
      turns++;
      run = 1;
    } else {
      run++;
      if (run > longestStraight) longestStraight = run;
    }
  }
  return { turns, longestStraight };
}

export function generateMazePath(stageIdx: number): [number, number][] {
  const stage = MAZE_STAGES[stageIdx] ?? MAZE_STAGES[MAZE_STAGES.length - 1];
  const { rows, cols } = stage;
  const minLen = rows - 1 + (cols - 1) + 1;
  const maxLen = minLen + stage.slack;

  // 1차: 길이·꺾임·직선 조건을 전부 만족하는 길. 실측으로 거의 항상 여기서 끝난다.
  for (let attempt = 0; attempt < 4000; attempt++) {
    const path = tryWalk(rows, cols, maxLen);
    if (!path || path.length < minLen) continue;
    const { turns, longestStraight } = pathShape(path);
    if (turns >= stage.minTurns && longestStraight <= stage.maxStraight) return path;
  }
  // 2차: 운이 나빴으면 길이 조건만 맞는 길이라도 내준다.
  for (let attempt = 0; attempt < 2000; attempt++) {
    const path = tryWalk(rows, cols, maxLen);
    if (path && path.length >= minLen) return path;
  }
  // 안전망: 항상 성립하는 지그재그 계단. 한 방향으로 쭉 미는 ㄱ자보다는 외울 거리가 남는다.
  const fallback: [number, number][] = [[0, 0]];
  let r = 0;
  let c = 0;
  while (r !== rows - 1 || c !== cols - 1) {
    if (c < cols - 1 && (r === rows - 1 || (r + c) % 2 === 0)) c++;
    else r++;
    fallback.push([r, c]);
  }
  return fallback;
}
