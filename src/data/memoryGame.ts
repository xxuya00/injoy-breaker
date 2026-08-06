// 성경 인물 + 말씀 관련 단어. 짧은 추상어보다 헷갈리기 쉬워 라운드가 올라갈수록 난이도가 붙는다.
const FLASH_WORD_POOL = [
  '아브라함', '모세', '다윗', '솔로몬', '요셉', '다니엘', '에스더', '느헤미야', '십자가',
  '엘리야', '엘리사', '이사야', '예레미야', '베드로', '바울', '요한', '마리아', '예수님',
  '노아', '야곱', '이삭', '여호수아', '사무엘', '드보라', '룻', '한나', '삼손',
  '언약', '광야', '성전', '제사장', '선지자', '십계명', '만나', '홍해', '기드온',
];

export interface FlashRound {
  sequence: string[]; // 기억해야 할 순서
  choices: string[]; // 화면에 뿌려질 선택지 (정답 count개 + 오답 count개)
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateFlashRound(count: number): FlashRound {
  const pool = shuffleArr(FLASH_WORD_POOL);
  const sequence = pool.slice(0, count);
  const decoys = pool.slice(count, count * 2);
  const choices = shuffleArr([...sequence, ...decoys]);
  return { sequence, choices };
}
