// 숫자야구. 서로 다른 숫자로 이뤄진 비밀번호를 맞히면 자리·숫자가 모두 맞으면 스트라이크,
// 숫자만 있고 자리가 다르면 볼로 알려준다. 0도 쓴다 — 수가 아니라 자리마다 하나씩 놓인 부호라
// 첫 자리에 와도 아무 문제가 없고, 후보가 아홉에서 열로 늘어 한 번의 추리가 그만큼 덜 좁혀진다.
// 순서는 1~9 다음에 0 — 전화기 숫자판과 같은 차례라 손이 먼저 안다(패드가 5칸씩 두 줄로 떨어진다).
export const BASEBALL_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export interface BaseballStage {
  digits: number;
}

// 3자리로 감을 잡고, 4자리에서 본격적으로 좁히고, 5자리로 마무리한다.
// 자리가 하나 늘 때마다 경우의 수는 720 → 5040 → 30240으로 뛰지만 한 수에서 얻는 단서도 함께 늘어서,
// 잘 물어보면 시도 수는 그만큼 가파르게 늘지 않는다 — 마지막 단계가 추리의 값을 가장 크게 가른다.
export const BASEBALL_STAGES: BaseballStage[] = [{ digits: 3 }, { digits: 4 }, { digits: 5 }];

export interface BaseballGuess {
  digits: number[];
  strikes: number;
  balls: number;
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateBaseballSecret(stageIdx: number): number[] {
  const stage = BASEBALL_STAGES[stageIdx] ?? BASEBALL_STAGES[BASEBALL_STAGES.length - 1];
  return shuffleArr(BASEBALL_DIGITS).slice(0, stage.digits);
}

export function judgeBaseball(secret: number[], guess: number[]): { strikes: number; balls: number } {
  let strikes = 0;
  let balls = 0;
  guess.forEach((d, i) => {
    if (secret[i] === d) strikes++;
    else if (secret.includes(d)) balls++;
  });
  return { strikes, balls };
}

/** 스트라이크도 볼도 없을 때 쓰는 표기. */
export function baseballResultText(strikes: number, balls: number): string {
  if (strikes === 0 && balls === 0) return '아웃';
  const parts: string[] = [];
  if (strikes > 0) parts.push(`${strikes}S`);
  if (balls > 0) parts.push(`${balls}B`);
  return parts.join(' ');
}
