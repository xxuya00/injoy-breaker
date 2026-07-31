export type Shape = 0 | 1 | 2;
export type ComboColor = 0 | 1 | 2;
export type Fill = 0 | 1 | 2;

export interface ComboCard {
  shape: Shape;
  color: ComboColor;
  fill: Fill;
}

function randAttr(): 0 | 1 | 2 {
  return Math.floor(Math.random() * 3) as 0 | 1 | 2;
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 세 값이 셋 다 같거나 셋 다 달라야 유효한 조합(카드게임 "SET" 규칙).
function attrTriple(): [number, number, number] {
  if (Math.random() < 0.5) {
    const v = randAttr();
    return [v, v, v];
  }
  return shuffleArr([0, 1, 2]) as [number, number, number];
}

function makeGuaranteedTriple(): ComboCard[] {
  const shapes = attrTriple();
  const colors = attrTriple();
  const fills = attrTriple();
  return [0, 1, 2].map((i) => ({ shape: shapes[i] as Shape, color: colors[i] as ComboColor, fill: fills[i] as Fill }));
}

export function generateComboBoard(size = 9): ComboCard[] {
  const cards: ComboCard[] = makeGuaranteedTriple();
  while (cards.length < size) {
    cards.push({ shape: randAttr(), color: randAttr(), fill: randAttr() });
  }
  return shuffleArr(cards);
}

export function checkCombo(cards: ComboCard[]): boolean {
  if (cards.length !== 3) return false;
  const [a, b, c] = cards;
  const same = (x: number, y: number, z: number) => (x === y && y === z) || (x !== y && y !== z && x !== z);
  return same(a.shape, b.shape, c.shape) && same(a.color, b.color, c.color) && same(a.fill, b.fill, c.fill);
}

// 남아있는 카드들 중 유효한 합(조합)이 하나라도 있는지 전수 확인한다.
// 없으면 "결" 상태 — 더 이상 찾을 조합이 없다는 뜻.
export function hasAnyCombo(cards: ComboCard[]): boolean {
  const n = cards.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        if (checkCombo([cards[i], cards[j], cards[k]])) return true;
      }
    }
  }
  return false;
}
