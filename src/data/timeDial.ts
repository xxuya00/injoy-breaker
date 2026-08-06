// DAY 3 · 시간의 다이얼
//
// 전도서는 원을 그리는 책이다. "바람은 이리 돌며 저리 돌아 그 불던 곳으로 돌아가고"(1:6),
// "해 아래에는 새 것이 없나니"(1:9). 그래서 마지막 두드림은 판을 하나 더 푸는 게 아니라
// 원을 돌려보는 일이다. 세 겹의 링이 서로 물려 있어서, 하나를 돌리면 다른 하나가 어긋난다.
//
// 다이얼 전체가 주제말씀의 주소다. 가운데 판이 책 이름(전도서), 바깥 링이 장(열두 칸짜리
// 시계판이 곧 12장), 그리고 시계에 없는 열세 번째 칸이 절이다. 세 링을 다 맞춰 12에 세우면
// "전도서 12"까지 읽히고, 거기서 한 칸을 더 밀어야 원이 깨지며 13이 밖으로 나온다.
// 전도서 12:13 — 일의 결국은 해 아래를 도는 원 안에 있지 않았다.

/** 링 하나에 놓인 칸 수. 시계판 그대로 열둘이고, 주제말씀의 장 번호이기도 하다. */
export const SLOTS = 12;

/** 바깥 링. 시계판 그대로다. 표식은 원이 닫히는 자리이자 마지막 장 번호인 12. */
export const OUTER_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * 가운데 링. DAY 3의 이름 BREAKTHROUGH를 한 글자씩 새겼다 — 세어보면 정확히 열두 글자다.
 * 표식인 B가 12시에 서면 나머지도 제자리라, 링을 시계방향으로 읽으면 그날의 이름이 된다.
 */
export const MIDDLE_WORD = 'BREAKTHROUGH'.split('');

/**
 * 안쪽 링. 이쪽도 딱 열두 글자다.
 * DAY 1의 아홉 자물쇠가 BACK TO GOD를 만들었던 것과 짝을 이룬다 — 돌아감에서 머묾으로.
 */
export const INNER_WORD = 'FOREVERINGOD'.split('');

/** 시계판에 없는 열세 번째 칸. 열둘을 다 맞춘 자리에서 한 칸을 더 밀어야 원 밖으로 나온다. */
export const THIRTEENTH = '13';

export type RingId = 'outer' | 'middle' | 'inner';

/** 각 링이 제자리에서 몇 칸 돌아가 있는지. 셋 다 0이면 표식 셋이 12시에 모인 상태다. */
export interface DialOffsets {
  outer: number;
  middle: number;
  inner: number;
}

export const SOLVED: DialOffsets = { outer: 0, middle: 0, inner: 0 };

/**
 * 링 하나를 돌리면 다른 링도 딸려 돈다. 셋이 고리처럼 물려 있는 게 이 퍼즐의 전부다:
 * 바깥은 안쪽을 반대로 끌고, 가운데는 바깥을 같이 끌고, 안쪽은 가운데를 반대로 끈다.
 * 어느 쪽에서 시작하든 "하나씩 차례로 맞추기"가 통하지 않는다.
 *
 * 손가락이 잡은 링은 언제나 1:1로 따라온다(각 규칙에서 자기 자신은 항상 1). 안 그러면 손맛이 어긋난다.
 */
const COUPLING: Record<RingId, DialOffsets> = {
  outer: { outer: 1, middle: 0, inner: -1 },
  middle: { outer: 1, middle: 1, inner: 0 },
  inner: { outer: 0, middle: -1, inner: 1 },
};

const RING_IDS: RingId[] = ['outer', 'middle', 'inner'];
const DIRS: (1 | -1)[] = [1, -1];

const mod = (n: number) => ((n % SLOTS) + SLOTS) % SLOTS;

export function turn(s: DialOffsets, ring: RingId, dir: 1 | -1): DialOffsets {
  const c = COUPLING[ring];
  return {
    outer: mod(s.outer + c.outer * dir),
    middle: mod(s.middle + c.middle * dir),
    inner: mod(s.inner + c.inner * dir),
  };
}

export const isSolved = (s: DialOffsets) => s.outer === 0 && s.middle === 0 && s.inner === 0;

/**
 * 지금 열두 시부터 시계방향으로 읽으면 가운데 링이 뭐라고 말하는지.
 * 어긋나 있는 동안엔 "ROUGHBREAKTH" 같은 소리가 나고, 다 맞으면 BREAKTHROUGH가 된다.
 * 표식이 무슨 뜻인지 설명하지 않아도 이 줄만 보면 무엇을 맞추는 중인지 알게 된다.
 */
export function readMiddle(offsetMiddle: number): string {
  return Array.from({ length: SLOTS }, (_, pos) => MIDDLE_WORD[mod(pos - offsetMiddle)]).join('');
}

export interface Move {
  ring: RingId;
  dir: 1 | -1;
}

const keyOf = (s: DialOffsets) => s.outer * 144 + s.middle * 12 + s.inner;

/**
 * 풀린 상태에서 폭 우선 탐색을 한 번 돌려, 어떤 상태에서든 "지금 어느 링을 어느 쪽으로
 * 돌리면 한 걸음 가까워지는지"를 통째로 구해둔다. 상태가 12³=1728개뿐이라 순식간이다.
 * 힌트가 정말 최단 경로인지 사람이 손으로 검산할 필요가 없어진다.
 *
 * 링이 물려 있는 탓에 1728개가 전부 도달 가능하지는 않다. 표에 없는 상태는 애초에
 * 만들어지면 안 되는 배치라는 뜻이라, shuffle()이 그런 걸 절대 만들지 않는 것으로 대응한다.
 */
let solveTable: Map<number, { move: Move | null; dist: number }> | null = null;

function buildSolveTable() {
  const table = new Map<number, { move: Move | null; dist: number }>();
  table.set(keyOf(SOLVED), { move: null, dist: 0 });
  let frontier: DialOffsets[] = [SOLVED];
  while (frontier.length) {
    const next: DialOffsets[] = [];
    for (const s of frontier) {
      const dist = table.get(keyOf(s))!.dist + 1;
      for (const ring of RING_IDS) {
        for (const dir of DIRS) {
          const n = turn(s, ring, dir);
          const k = keyOf(n);
          if (table.has(k)) continue;
          // n에서 반대로 돌리면 방금 온 s로 돌아간다 = 풀린 쪽으로 한 걸음.
          table.set(k, { move: { ring, dir: (-dir) as 1 | -1 }, dist });
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return table;
}

function lookup(s: DialOffsets) {
  solveTable ??= buildSolveTable();
  return solveTable.get(keyOf(s));
}

/** 지금 상태에서 한 걸음 가까워지는 조작. 이미 풀렸으면 null. */
export function hintMove(s: DialOffsets): Move | null {
  return lookup(s)?.move ?? null;
}

/** 남은 최소 조작 횟수. 다이얼 아래에 "몇 걸음 남았는지" 대신 쓰지는 않고, 섞을 때만 쓴다. */
export function stepsLeft(s: DialOffsets): number {
  return lookup(s)?.dist ?? Infinity;
}

/**
 * 섞기는 반드시 "실제로 돌려서" 한다. 세 링이 물려 있어서 아무 숫자나 세 개 넣으면
 * 영영 맞출 수 없는 배치가 나오기 때문이다.
 * 너무 쉽게 풀리는 배치가 걸리면 다시 섞어, 적어도 minSteps번은 돌려야 하도록 한다.
 */
export function shuffle(minSteps = 5): DialOffsets {
  for (let attempt = 0; attempt < 40; attempt++) {
    let s = SOLVED;
    for (let i = 0; i < 20; i++) {
      s = turn(s, RING_IDS[Math.floor(Math.random() * RING_IDS.length)], Math.random() < 0.5 ? 1 : -1);
    }
    if (stepsLeft(s) >= minSteps) return s;
  }
  // 여기까지 왔다면 난수가 유난히 안 도와준 것뿐이다. 확실히 풀리는 배치 하나로 대신한다.
  return turn(turn(turn(SOLVED, 'outer', 1), 'middle', 1), 'inner', -1);
}

/** 다이얼이 열린 뒤 이어지는 이야기. 화면 여러 곳에서 같은 문구를 써야 해서 여기에 모아둔다. */
export const DIAL_STORY = {
  ref: '전도서 12:13',
  verse:
    '일의 결국을 다 들었으니 하나님을 경외하고 그의 명령들을 지킬지어다 이것이 모든 사람의 본분이니라',
  word: 'FOREVER IN GOD',
  /** 가운데 판에 새기는 책 이름. 다이얼 자체가 말씀의 주소라, 여기가 그 첫 칸이다. */
  book: '전도서',
  /** 열두 칸이 다 맞은 순간 가운데 판에 뜨는 장 번호 */
  chapter: '12',
  /** 한 칸을 더 민 뒤 가운데 판이 완성하는 주소 */
  refShort: '12:13',
  /** 열두 칸을 다 맞춘 순간, 아직 한 칸이 남았다고 알려주는 말 */
  pushHint: '열두 칸이 모두 제자리입니다. 그런데 시계에는 열세 번째 칸이 없어요. 13절은 이 원 안에 앉지 못합니다.',
  /** 마지막 한 칸을 어떻게 넘기는지. 버튼이 아니라 손으로 미는 동작이라 한 줄로 짚어준다. */
  pushAction: '링을 시계 방향으로 한 칸 더 밀어보세요',
  /** 결단 기록을 미션 기록과 같은 곳에 저장할 때 쓰는 키 */
  recordId: 'd3_decision',
  recordTitle: '마지막 열쇠',
};
