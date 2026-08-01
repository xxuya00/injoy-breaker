export const FLASH_WORD_POOL = ['믿음', '소망', '사랑', '은혜', '기쁨', '평강', '인내', '지혜', '겸손', '감사'];

export interface FlashRound {
  sequence: string[]; // 기억해야 할 순서 (4개)
  choices: string[]; // 화면에 뿌려질 선택지 (8개, 정답 4 + 오답 4)
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateFlashRound(): FlashRound {
  const pool = shuffleArr(FLASH_WORD_POOL);
  const sequence = pool.slice(0, 4);
  const decoys = pool.slice(4, 8);
  const choices = shuffleArr([...sequence, ...decoys]);
  return { sequence, choices };
}
