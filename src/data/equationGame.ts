export type EqToken = { kind: 'num'; value: number; cardIdx: number } | { kind: 'op'; value: string };

export interface EquationRound {
  numbers: number[];
  target: number;
  // 힌트용. 이 판을 만들 때 실제로 쓴 식과, 그 식에서 가장 먼저 계산되는 한 수.
  // 다른 식으로도 목표에 닿을 수 있지만, 힌트는 확실히 통하는 길 하나를 알려주면 된다.
  solution: string;
  firstStep: string;
}

export interface EquationStage {
  /** 이번 문제에 주어지는 숫자 개수 */
  count: number;
  /** 이 단계에서 식에 쓸 수 있는 연산 */
  ops: string[];
  /** 주어지는 숫자가 뽑히는 범위 */
  numRange: [number, number];
  /** 목표 숫자가 들어갈 범위 */
  target: [number, number];
  /** 정답 식에 반드시 한 번 이상 들어가야 하는 연산. */
  requireOps: string[];
}

// 세 문제를 연달아 푸는 게임이라, 문제 번호가 곧 난이도다. 숫자는 세 문제 내내 4개로 고정한다 —
// 개수를 늘리면 화면에 버튼만 늘 뿐 "어떻게 조합하지"라는 고민은 그대로였다.
//
// 예전에는 숫자를 1~9로 두고 목표만 키웠는데, 그러면 할 일이 "크게 만들기" 한 방향뿐이라
// 세 문제 내내 곱셈만 쓰게 됐다. 그래서 방향을 뒤집는다 — 주어지는 숫자를 키우고 목표는 오히려 줄인다.
// 큰 숫자 넷으로 작은 목표에 닿으려면 곱해서 키우는 게 아니라 나누고 빼서 줄여야 해서,
// 문제가 넘어갈수록 나눗셈과 빼기가 실제로 필요해진다.
export const EQ_STAGES: EquationStage[] = [
  { count: 4, ops: ['+', '-', '×'], numRange: [2, 12], target: [24, 90], requireOps: ['×'] },
  { count: 4, ops: ['+', '-', '×', '÷'], numRange: [2, 20], target: [12, 60], requireOps: ['÷'] },
  { count: 4, ops: ['+', '-', '×', '÷'], numRange: [3, 25], target: [6, 40], requireOps: ['÷', '-'] },
];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 만들어진 식을 그대로 들고 있는 트리. 값만 있으면 목표 숫자는 낼 수 있지만,
// "어디부터 손대야 하는지"를 힌트로 알려주려면 식 자체가 남아 있어야 한다.
type ExprNode =
  | { kind: 'num'; value: number }
  | { kind: 'op'; op: string; left: ExprNode; right: ExprNode; value: number };

// 두 값을 한 연산으로 잇는다. 계산이 성립하지 않거나(나누어떨어지지 않음), 있으나 마나 한
// 연산이면 null을 돌려 다시 뽑게 한다. 중간값은 언제나 1 이상의 정수로 유지된다.
//
// 이 걸러내기가 없으면 "필요한 연산"을 걸어둔 게 무색해진다 — 3 - 3 = 0을 4로 나누거나
// 10 ÷ 10 = 1을 곱하는 식으로, 연산자 칸만 채우고 아무 일도 하지 않는 판이 그대로 나왔다.
function joinExpr(op: string, left: ExprNode, right: ExprNode): ExprNode | null {
  const l = left.value;
  const r = right.value;
  switch (op) {
    case '+':
      return { kind: 'op', op, left, right, value: l + r };
    case '-':
      // 음수와 0은 아예 만들지 않는다. 암산하기 나쁘고, 0이 한 번 생기면 그 뒤 연산이 전부 헛돈다.
      return l - r < 1 ? null : { kind: 'op', op, left, right, value: l - r };
    case '×':
      return l === 1 || r === 1 ? null : { kind: 'op', op, left, right, value: l * r };
    default:
      // 1로 나누기·같은 수끼리 나누기는 값이 그대로거나 1이라, 나눗셈을 쓴 보람이 없다.
      if (r <= 1 || l === r || l % r !== 0) return null;
      return { kind: 'op', op, left, right, value: l / r };
  }
}

// 숫자 배열을 임의의 이진 트리로 묶어 값을 계산한다.
function buildExpr(nums: number[], ops: string[]): ExprNode | null {
  if (nums.length === 1) return { kind: 'num', value: nums[0] };
  const i = randInt(1, nums.length - 1);
  const left = buildExpr(nums.slice(0, i), ops);
  const right = buildExpr(nums.slice(i), ops);
  if (left === null || right === null) return null;
  return joinExpr(ops[randInt(0, ops.length - 1)], left, right);
}

// 식에 실제로 쓰인 연산들. 단계마다 걸어둔 requireOps를 확인하는 데 쓴다.
function usedOps(node: ExprNode, acc: Set<string> = new Set()): Set<string> {
  if (node.kind === 'num') return acc;
  acc.add(node.op);
  usedOps(node.left, acc);
  usedOps(node.right, acc);
  return acc;
}

// 하위 식은 전부 괄호로 감싼다. 우선순위를 따져 괄호를 아끼는 것보다, 계산 순서가 눈에 그대로 보이는 편이 힌트로 낫다.
function exprText(node: ExprNode, top = true): string {
  if (node.kind === 'num') return String(node.value);
  const body = `${exprText(node.left, false)} ${node.op} ${exprText(node.right, false)}`;
  return top ? body : `(${body})`;
}

// 계산 순서상 가장 먼저 손대는 한 수 — 양쪽이 모두 숫자인 첫 번째 연산.
function firstStepText(node: ExprNode): string {
  if (node.kind === 'num') return '';
  if (node.left.kind === 'num' && node.right.kind === 'num') {
    return `${node.left.value} ${node.op} ${node.right.value} = ${node.value}`;
  }
  return firstStepText(node.left) || firstStepText(node.right);
}

// stageIdx는 곧 몇 번째 문제인지다(0부터). 뒤로 갈수록 주어지는 숫자는 커지고 목표는 작아진다.
export function generateEquationRound(stageIdx = 0): EquationRound {
  const stage = EQ_STAGES[stageIdx] ?? EQ_STAGES[EQ_STAGES.length - 1];
  const [minTarget, maxTarget] = stage.target;
  // 네 숫자는 서로 다르게 뽑는다. 같은 수가 두 번 나오면 "×10 하고 ÷10" 처럼 서로를 되돌리는
  // 식이 정답으로 잡혀서, 실제로는 나머지 두 숫자만 가지고 푸는 싱거운 판이 된다.
  const pool: number[] = [];
  for (let n = stage.numRange[0]; n <= stage.numRange[1]; n++) pool.push(n);
  const draw = () => shuffleArr(pool).slice(0, stage.count);
  const hasRequired = (expr: ExprNode) => {
    const ops = usedOps(expr);
    return stage.requireOps.every((op) => ops.has(op));
  };

  for (let attempt = 0; attempt < 4000; attempt++) {
    const nums = draw();
    const expr = buildExpr(shuffleArr(nums), stage.ops);
    if (expr === null || !hasRequired(expr)) continue;
    const target = expr.value;
    if (Number.isInteger(target) && target >= minTarget && target <= maxTarget) {
      return { numbers: nums, target, solution: exprText(expr), firstStep: firstStepText(expr) };
    }
  }

  // 목표 범위를 못 맞춘 경우. 범위만 놓아주고 연산 조건은 그대로 지킨다 —
  // 이 단계를 이 단계답게 만드는 건 목표 숫자의 자릿수가 아니라 "무슨 연산을 쓰게 되는가"라서.
  for (let attempt = 0; attempt < 2000; attempt++) {
    const nums = draw();
    const expr = buildExpr(shuffleArr(nums), stage.ops);
    if (expr === null || !hasRequired(expr)) continue;
    if (Number.isInteger(expr.value) && expr.value >= 1 && expr.value <= 400) {
      return { numbers: nums, target: expr.value, solution: exprText(expr), firstStep: firstStepText(expr) };
    }
  }
  return { numbers: [18, 6, 5, 4], target: 11, solution: '((18 ÷ 6) × 5) - 4', firstStep: '18 ÷ 6 = 3' };
}

// UI에서 탭으로 쌓은 토큰 배열을 사칙연산 우선순위에 맞게 계산한다 (eval/Function 미사용).
export function evaluateTokens(tokens: EqToken[]): number | null {
  const toks = tokens.map((t) => (t.kind === 'num' ? String(t.value) : t.value));
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];

  function parseFactor(): number | null {
    if (peek() === '(') {
      next();
      const v = parseExpr();
      if (peek() !== ')') return null;
      next();
      return v;
    }
    const t = next();
    if (t === undefined) return null;
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() === '×' || peek() === '÷') {
      const op = next();
      const right = parseFactor();
      if (right === null) return null;
      if (op === '×') left = left * right;
      else {
        if (right === 0) return null;
        left = left / right;
      }
    }
    return left;
  }

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  const result = parseExpr();
  if (pos !== toks.length) return null;
  return result;
}
