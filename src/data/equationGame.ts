export type EqToken = { kind: 'num'; value: number; cardIdx: number } | { kind: 'op'; value: string };

export interface EquationRound {
  numbers: number[];
  target: number;
}

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

// 숫자 배열을 임의의 이진 트리로 묶어 값을 계산한다. 나눗셈은 나누어떨어질 때만 허용해
// 중간값이 항상 정수로 유지되도록 한다.
function buildExpr(nums: number[]): number | null {
  if (nums.length === 1) return nums[0];
  const i = randInt(1, nums.length - 1);
  const left = buildExpr(nums.slice(0, i));
  const right = buildExpr(nums.slice(i));
  if (left === null || right === null) return null;
  switch (randInt(0, 3)) {
    case 0:
      return left + right;
    case 1:
      return left - right;
    case 2:
      return left * right;
    default:
      return right !== 0 && left % right === 0 ? left / right : null;
  }
}

export function generateEquationRound(count = 4): EquationRound {
  for (let attempt = 0; attempt < 300; attempt++) {
    const nums = Array.from({ length: count }, () => randInt(1, 9));
    const target = buildExpr(shuffleArr(nums));
    if (target !== null && Number.isInteger(target) && target >= 1 && target <= 200) {
      return { numbers: nums, target };
    }
  }
  return { numbers: [1, 2, 3, 4], target: 10 };
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
