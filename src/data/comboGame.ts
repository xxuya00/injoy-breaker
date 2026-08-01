// 카드게임 "SET" 규칙: 모양·색·배경 세 속성이 세 장 모두 같거나 모두 달라야 유효한 "결합"이다.
export type Shape = 0 | 1 | 2; // 0: 동그라미, 1: 세모, 2: 네모
export type ShapeColor = 0 | 1 | 2; // 0: 빨강, 1: 파랑, 2: 노랑
export type BgColor = 0 | 1 | 2; // 0: 밝은 톤, 1: 따뜻한 톤, 2: 어두운 톤

export interface ComboCard {
  id: string;
  shape: Shape;
  color: ShapeColor;
  bg: BgColor;
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 27장 전체 고유 카드덱 (모양 3 × 색 3 × 배경 3, 중복 없음).
function createFullDeck(): ComboCard[] {
  const deck: ComboCard[] = [];
  for (let s = 0; s < 3; s++) {
    for (let c = 0; c < 3; c++) {
      for (let b = 0; b < 3; b++) {
        deck.push({ id: `card-${s}-${c}-${b}`, shape: s as Shape, color: c as ShapeColor, bg: b as BgColor });
      }
    }
  }
  return deck;
}

export function checkCombo(cards: [ComboCard, ComboCard, ComboCard]): boolean {
  const [a, b, c] = cards;
  const isValidTriple = (x: number, y: number, z: number) => (x === y && y === z) || (x !== y && y !== z && x !== z);
  return (
    isValidTriple(a.shape, b.shape, c.shape) &&
    isValidTriple(a.color, b.color, c.color) &&
    isValidTriple(a.bg, b.bg, c.bg)
  );
}

// 보드에 존재하는 모든 유효한 결합의 인덱스 조합을 찾는다.
export function findAllCombos(board: ComboCard[]): [number, number, number][] {
  const combos: [number, number, number][] = [];
  const n = board.length;
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        if (checkCombo([board[i], board[j], board[k]])) combos.push([i, j, k]);
      }
    }
  }
  return combos;
}

// 9장을 무작위로 뽑는다. 결합이 하나도 없는 보드("결")도 정상적인 문제로 그대로 나온다.
function generateBoard(): ComboCard[] {
  return shuffleArr(createFullDeck()).slice(0, 9);
}

// 총 count세트(기본 5세트)의 게임판을 한번에 생성한다. 세트마다 독립적으로 새로 섞인 보드다.
export function generateComboRounds(count = 5): ComboCard[][] {
  return Array.from({ length: count }, () => generateBoard());
}
