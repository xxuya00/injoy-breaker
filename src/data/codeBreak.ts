export type ShapeId = 0 | 1 | 2 | 3 | 4;

export const SHAPES: ShapeId[] = [0, 1, 2, 3, 4];

export type CodeBreakOp = '+' | '-' | '×';

export interface CodeBreakHint {
  a: ShapeId;
  b: ShapeId;
  op: CodeBreakOp;
  result: number;
}

export interface CodeBreakRound {
  hints: CodeBreakHint[];
  final: { a: ShapeId; b: ShapeId };
  answer: number;
  // 이 판에 등장하는 도형 수. 안내 문구에 그대로 쓴다.
  shapeCount: number;
}

interface CodeBreakStage {
  shapes: number;
  hints: number;
  ops: CodeBreakOp[];
}

// 단계가 오를수록 도형과 힌트가 늘고, 마지막엔 곱셈까지 섞인다.
export const CODEBREAK_STAGES: CodeBreakStage[] = [
  { shapes: 3, hints: 2, ops: ['+', '-'] },
  { shapes: 4, hints: 3, ops: ['+', '-'] },
  { shapes: 5, hints: 4, ops: ['+', '-', '×'] },
];

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function apply(op: CodeBreakOp, x: number, y: number): number {
  return op === '+' ? x + y : op === '-' ? x - y : x * y;
}

// 힌트를 만족하는 숫자 배정을 전부 훑어서, 최종식의 답이 하나로만 나오는지 확인한다.
// 도형이 최대 5개라 경우의 수가 30240개뿐이라 그냥 다 세어보는 편이 안전하다.
function hasUniqueAnswer(
  shapes: ShapeId[],
  hints: CodeBreakHint[],
  final: { a: ShapeId; b: ShapeId },
  answer: number,
): boolean {
  const used = new Array(10).fill(false);
  const value = new Map<ShapeId, number>();
  // 각 단계에서 두 피연산자가 모두 정해진 힌트는 그 자리에서 걸러낸다.
  const checkAt = shapes.map((_, i) => {
    const known = new Set(shapes.slice(0, i + 1));
    return hints.filter((h) => known.has(h.a) && known.has(h.b) && !(shapes.slice(0, i).includes(h.a) && shapes.slice(0, i).includes(h.b)));
  });

  let solutions = 0;
  let unique = true;

  const walk = (i: number) => {
    if (!unique) return;
    if (i === shapes.length) {
      solutions++;
      if (value.get(final.a)! + value.get(final.b)! !== answer) unique = false;
      return;
    }
    for (let d = 0; d < 10; d++) {
      if (used[d]) continue;
      used[d] = true;
      value.set(shapes[i], d);
      const ok = checkAt[i].every((h) => apply(h.op, value.get(h.a)!, value.get(h.b)!) === h.result);
      if (ok) walk(i + 1);
      used[d] = false;
      if (!unique) return;
    }
  };

  walk(0);
  return unique && solutions > 0;
}

// 실제 숫자를 먼저 정하고 거기서 힌트를 뽑은 뒤, 답이 유일하게 정해지는 판만 통과시킨다.
export function generateCodeBreakRound(stageIdx = 0): CodeBreakRound {
  const stage = CODEBREAK_STAGES[stageIdx] ?? CODEBREAK_STAGES[CODEBREAK_STAGES.length - 1];

  for (let attempt = 0; attempt < 400; attempt++) {
    const shapes = shuffleArr(SHAPES).slice(0, stage.shapes);
    const digits = shuffleArr([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, stage.shapes);
    const value = new Map<ShapeId, number>();
    shapes.forEach((s, i) => value.set(s, digits[i]));

    const [y, z] = shuffleArr(shapes).slice(0, 2);
    const final = { a: y, b: z };
    const answer = value.get(y)! + value.get(z)!;

    // 첫 식엔 Y를, 마지막 식엔 Z를 반드시 넣어 두 도형이 힌트로 이어지게 한다.
    const hints: CodeBreakHint[] = [];
    for (let i = 0; i < stage.hints; i++) {
      const pool = shuffleArr(shapes);
      const a = i === 0 ? y : i === stage.hints - 1 ? z : pool[0];
      const b = pool.find((s) => s !== a)!;
      const op = stage.ops[Math.floor(Math.random() * stage.ops.length)];
      // 뺄셈은 음수가 나오지 않도록 큰 쪽을 앞에 세운다.
      const flip = op === '-' && value.get(a)! < value.get(b)!;
      const [l, r] = flip ? [b, a] : [a, b];
      hints.push({ a: l, b: r, op, result: apply(op, value.get(l)!, value.get(r)!) });
    }

    // 최종식이 힌트에 그대로 적혀 있으면 문제가 되지 않는다.
    const givenAway = hints.some((h) => h.op === '+' && ((h.a === y && h.b === z) || (h.a === z && h.b === y)));
    if (givenAway) continue;
    // 같은 식이 두 번 나오면 힌트 하나를 버리는 셈이라 다시 뽑는다.
    const seen = new Set(hints.map((h) => `${h.a}${h.op}${h.b}`));
    if (seen.size !== hints.length) continue;
    if (!hasUniqueAnswer(shapes, hints, final, answer)) continue;

    return { hints, final, answer, shapeCount: stage.shapes };
  }

  // 여기까지 오면 운이 나빴던 것뿐이다. 항상 풀리는 고전적인 형태로 되돌아간다.
  const shapes = shuffleArr(SHAPES).slice(0, 3);
  const digits = shuffleArr([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
  const [x, y, z] = shapes;
  const [vx, vy, vz] = digits;
  return {
    hints: [
      { a: x, b: y, op: '+', result: vx + vy },
      { a: z, b: x, op: '-', result: vz - vx },
    ],
    final: { a: y, b: z },
    answer: vy + vz,
    shapeCount: 3,
  };
}
