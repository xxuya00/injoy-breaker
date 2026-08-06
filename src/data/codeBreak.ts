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
  // 이 판에 등장하는 도형들. 힌트를 계산할 때 쓴다.
  shapes: ShapeId[];
}

// 힌트로 내줄 수 있는, "이 판에서 반드시 참인" 사실들.
// 유일한 것은 최종식의 답뿐이고 도형 하나하나의 값은 여러 조합이 나올 수 있다.
// 그래서 아무 조합이나 골라 "이 도형은 3이에요"라고 알려주면, 다르게(그러나 똑같이 옳게)
// 추리한 사람에게는 틀린 말이 된다. 여기서는 모든 조합에서 값이 같은 것만 골라낸다.
export interface CodeBreakFacts {
  /** 어떤 조합에서도 값이 하나로 고정되는 도형 */
  fixed: { shape: ShapeId; value: number }[];
  /** 값은 안 정해져도 두 도형의 관계는 항상 같은 경우 (예: ★ - ◆ = 3) */
  relations: { a: ShapeId; b: ShapeId; op: CodeBreakOp; result: number }[];
}

interface CodeBreakStage {
  shapes: number;
  hints: number;
  ops: CodeBreakOp[];
}

// 단계가 오를수록 도형과 힌트가 는다.
//
// 곱셈은 모든 단계에 최소 한 번 들어간다. 더하기·빼기만 쓰면 힌트가 전부 1차식이라
// 최종식의 답이 늘 "힌트 결과들의 ± 조합"으로 떨어진다 — 식을 풀지 않고 화면의 숫자만
// 더해도 답이 나온다는 뜻이다(측정: 3도형 판의 99%가 그랬고, 그중 절반은 그냥 두 수의 합).
// 곱셈이 하나만 섞여도 그 지름길이 막힌다.
export const CODEBREAK_STAGES: CodeBreakStage[] = [
  { shapes: 3, hints: 2, ops: ['+', '-', '×'] },
  { shapes: 4, hints: 3, ops: ['+', '-', '×'] },
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

// 화면의 힌트 숫자들을 그냥 ±로 더해서 답이 나와버리는 판인지 본다.
// 이런 판은 도형이 무슨 뜻인지 몰라도 숫자만 만지면 맞아서, 추리 문제가 산수 요행이 된다.
function answerIsJustSums(hints: CodeBreakHint[], answer: number): boolean {
  const rs = hints.map((h) => h.result);
  for (let mask = 1; mask < 1 << rs.length; mask++) {
    const picked = rs.filter((_, i) => mask & (1 << i));
    for (let signs = 0; signs < 1 << picked.length; signs++) {
      const sum = picked.reduce((acc, r, k) => acc + (signs & (1 << k) ? -r : r), 0);
      if (sum === answer) return true;
    }
  }
  return false;
}

// 힌트를 하나씩 빼보면서, 하나라도 없어도 답이 정해지는지 본다.
// 없어도 되는 힌트가 섞여 있으면 그건 푸는 사람에게 "읽을 필요 없는 줄"이고,
// 실제로 4도형 판의 75%가 그랬다.
function everyHintNeeded(
  shapes: ShapeId[],
  hints: CodeBreakHint[],
  final: { a: ShapeId; b: ShapeId },
  answer: number,
): boolean {
  return hints.every((_, k) => !hasUniqueAnswer(shapes, hints.filter((__, j) => j !== k), final, answer));
}

// 실제 숫자를 먼저 정하고 거기서 힌트를 뽑은 뒤, 조건을 다 만족하는 판만 통과시킨다.
// strict를 끄면 "답이 하나로 정해진다"는 최소 조건만 보고 내준다 — 운이 나빠 좋은 판을
// 못 뽑았을 때 쓰는 두 번째 그물이다.
function tryGenerate(stage: CodeBreakStage, attempts: number, strict: boolean): CodeBreakRound | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
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

    // 아래는 싼 검사부터 차례로 건다. 마지막 두 검사가 판 전체를 훑어서 제일 비싸다.

    // 최종식이 힌트에 그대로 적혀 있으면 문제가 되지 않는다.
    const givenAway = hints.some((h) => h.op === '+' && ((h.a === y && h.b === z) || (h.a === z && h.b === y)));
    if (givenAway) continue;
    // 같은 식이 두 번 나오면 힌트 하나를 버리는 셈이라 다시 뽑는다.
    const seen = new Set(hints.map((h) => `${h.a}${h.op}${h.b}`));
    if (seen.size !== hints.length) continue;
    // 힌트에 한 번도 안 나오는 도형은 판을 채우는 장식일 뿐이다.
    if (new Set(hints.flatMap((h) => [h.a, h.b])).size !== stage.shapes) continue;
    // 곱셈이 하나도 없으면 힌트가 전부 1차식이라 숫자만 더해도 답이 나온다.
    if (!hints.some((h) => h.op === '×')) continue;
    if (strict && answerIsJustSums(hints, answer)) continue;
    if (!hasUniqueAnswer(shapes, hints, final, answer)) continue;
    if (strict && !everyHintNeeded(shapes, hints, final, answer)) continue;

    return { hints, final, answer, shapeCount: stage.shapes, shapes };
  }
  return null;
}

export function generateCodeBreakRound(stageIdx = 0): CodeBreakRound {
  const stage = CODEBREAK_STAGES[stageIdx] ?? CODEBREAK_STAGES[CODEBREAK_STAGES.length - 1];

  // 조건이 늘어 한 번에 통과하는 판이 줄었다. 실측 평균 시도는 12~130회라 넉넉히 잡아둔다.
  const strict = tryGenerate(stage, 5000, true);
  if (strict) return strict;
  const loose = tryGenerate(stage, 2000, false);
  if (loose) return loose;

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
    shapes,
  };
}

// 힌트 식을 모두 만족하는 도형값 조합을 전부 모은다. 도형이 최대 5개(30240가지)라 그냥 다 세어본다.
function allAssignments(round: CodeBreakRound): Map<ShapeId, number>[] {
  const { shapes, hints } = round;
  const out: Map<ShapeId, number>[] = [];
  const used = new Array(10).fill(false);
  const value = new Map<ShapeId, number>();
  const checkAt = shapes.map((_, i) => {
    const known = new Set(shapes.slice(0, i + 1));
    const before = new Set(shapes.slice(0, i));
    return hints.filter((h) => known.has(h.a) && known.has(h.b) && !(before.has(h.a) && before.has(h.b)));
  });

  const walk = (i: number) => {
    if (i === shapes.length) {
      out.push(new Map(value));
      return;
    }
    for (let d = 0; d < 10; d++) {
      if (used[d]) continue;
      used[d] = true;
      value.set(shapes[i], d);
      if (checkAt[i].every((h) => apply(h.op, value.get(h.a)!, value.get(h.b)!) === h.result)) walk(i + 1);
      used[d] = false;
    }
  };
  walk(0);
  return out;
}

// 이 판에서 무조건 참인 사실만 추려 힌트 재료로 넘긴다.
// 최종식(두 도형의 합)은 답 그 자체라 관계식에서 빼둔다.
export function codeBreakFacts(round: CodeBreakRound): CodeBreakFacts {
  const assignments = allAssignments(round);
  const fixed: CodeBreakFacts['fixed'] = [];
  const relations: CodeBreakFacts['relations'] = [];
  if (assignments.length === 0) return { fixed, relations };

  for (const shape of round.shapes) {
    const first = assignments[0].get(shape)!;
    if (assignments.every((m) => m.get(shape) === first)) fixed.push({ shape, value: first });
  }

  // 덧셈은 좌우를 바꿔도 같은 식이라, 이미 보여준 식인지 볼 때 순서를 맞춰서 담는다.
  // 안 그러면 화면에 이미 있는 식을 힌트라고 한 번 더 내주게 된다.
  const key = (a: ShapeId, b: ShapeId, op: CodeBreakOp) =>
    op === '+' ? `${Math.min(a, b)}+${Math.max(a, b)}` : `${a}${op}${b}`;
  const shown = new Set(round.hints.map((h) => key(h.a, h.b, h.op)));
  const isFinalPair = (a: ShapeId, b: ShapeId) =>
    (a === round.final.a && b === round.final.b) || (a === round.final.b && b === round.final.a);

  for (const a of round.shapes) {
    for (const b of round.shapes) {
      if (a === b) continue;
      for (const op of ['+', '-'] as CodeBreakOp[]) {
        // 덧셈은 좌우를 바꿔도 같은 식이라 한 방향만 본다.
        if (op === '+' && (a > b || isFinalPair(a, b))) continue;
        if (shown.has(key(a, b, op))) continue;
        const first = apply(op, assignments[0].get(a)!, assignments[0].get(b)!);
        if (first < 0) continue;
        if (assignments.every((m) => apply(op, m.get(a)!, m.get(b)!) === first)) {
          relations.push({ a, b, op, result: first });
        }
      }
    }
  }
  return { fixed, relations };
}
