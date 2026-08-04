import { IDOL_ORDER, IDOL_QUESTIONS, type IdolKey } from '../data/typeTest';

// 결과 화면에 새로 붙는 두 가지 — 유형 글자(IDOL-X의 X 자리)와 응답의 일관도 — 를 계산한다.
// 화면(TypeTest.tsx)에서 분리해둔 이유는 순수 계산이라 화면 구성이 바뀌어도 그대로 쓰이고,
// 시트에 보낼 값도 여기서 한 번에 뽑기 때문이다.

// ---------------------------------------------------------------------------
// 결(walk) — 묵상과 기도를 관통하는 두 축의 4분면
// ---------------------------------------------------------------------------

// 묵상·기도 유형은 각각 2문항짜리 축으로 나뉘지만, 리듬과 표현은 두 영역에 공통으로 있다.
// 그래서 묵상 2 + 기도 2 = 축당 4문항으로 모아 계산한다. 문항이 두 배라 덜 흔들린다.
// AB 척도는 A쪽이 음수, B쪽이 양수다(AB_SCALE). 두 축 모두 A쪽이 규칙/밖으로에 해당한다.
const WALK_RHYTHM_KEYS = ['med_r_0', 'med_r_1', 'pray_r_0', 'pray_r_1'];
const WALK_EXPRESSION_KEYS = ['med_m_0', 'med_m_1', 'pray_e_0', 'pray_e_1'];

type WalkCode = 'B' | 'D' | 'F' | 'S';

export interface WalkMeta {
  code: WalkCode;
  /** 화면에 보이는 이름. 우상 유형처럼 사람에게 붙는 칭호가 아니라 "방식"을 가리키도록 '결'로 쓴다. */
  name: string;
  /** 글자의 근거가 되는 영어 동사. B는 Build의 B다. */
  en: string;
  rhythm: '규칙' | '흐름';
  expression: '밖으로' | '안으로';
  /** 한 줄로 줄인 묵상 방식 */
  tagline: string;
  /** 우상 진단과 이어 붙는 처방 본문 — "이 우상으로 지친 나를 어떻게 회복할 것인가" */
  fusion: string;
  /** 오늘 당장 해볼 수 있는 두 가지 */
  guides: [string, string];
}

// 네 동사에 두 축이 모두 읽히도록 골랐다.
//  · 쌓다·흐르다 = 밖으로 나오는 움직임 / 머물다·스미다 = 안에 남는 움직임
//  · 쌓다·머물다 = 한 자리가 전제된 동사 / 흐르다·스미다 = 자리가 정해지지 않은 동사
export const WALK_TYPES: Record<WalkCode, WalkMeta> = {
  B: {
    code: 'B',
    name: '쌓는 결',
    en: 'Build',
    rhythm: '규칙',
    expression: '밖으로',
    tagline: '기록하고 선포하며 정돈된 자리를 쌓아가는 묵상',
    fusion:
      '마음속 우상으로 인해 내면이 복잡하고 쉽게 흔들릴 때, 당신은 눈에 보이는 정돈된 자리와 구체적인 행동을 통해 영적 안정을 되찾는 사람입니다. 생각과 감정이 우상의 유혹에 휘말리지 않도록 지정된 장소에서 노트에 적고, 말씀을 소리 내어 읽으며 차곡차곡 영적 기둥을 세워보세요. 밖으로 표현되고 기록된 말씀의 흔적들이 당신을 뒤흔드는 우상의 목소리를 침묵시키고, 하나님과의 단단한 약속으로 마음을 지켜줄 것입니다.',
    guides: [
      '매일 정해진 시간, 정해진 장소(골방, 책상)에 앉아 묵상합니다.',
      '말씀을 직접 손으로 적거나(필사), 나지막이 입으로 선포하며 기록으로 남깁니다.',
    ],
  },
  D: {
    code: 'D',
    name: '머무는 결',
    en: 'Dwell',
    rhythm: '규칙',
    expression: '안으로',
    tagline: '침묵과 묵상 속에서 정해진 자리를 지키는 묵상',
    fusion:
      '우상의 요구와 세상의 소음이 거세게 밀려올 때, 당신은 잠잠히 하나님의 임재 안에 머무름으로써 영혼의 평안을 회복하는 사람입니다. 외부의 자극이나 표현보다 정해진 공간과 시간에 조용히 무릎 꿇고 마음의 깊은 곳으로 들어가는 시간이 필요합니다. 소리 내어 외치지 않아도 좋습니다. 하나님을 향해 마음을 개방하고 그분의 세미한 음성에 가만히 귀 기울일 때, 마음을 채우고 있던 우상의 욕망들이 힘을 잃고 오직 주님의 평강만이 남게 됩니다.',
    guides: [
      '정해진 장소에서 조명을 낮추고 깊은 침묵 기도로 묵상을 시작합니다.',
      '한 문장의 말씀이나 하나님의 성호를 마음속으로 반복하며 묵상(관상)합니다.',
    ],
  },
  F: {
    code: 'F',
    name: '흐르는 결',
    en: 'Flow',
    rhythm: '흐름',
    expression: '밖으로',
    tagline: '일상 속 삶의 순간마다 소리와 표현으로 흘려보내는 묵상',
    fusion:
      '정형화된 틀이나 갇힌 공간보다, 당신은 일상의 동선과 감정의 흐름 속에서 자유롭게 표현할 때 우상의 매임에서 가장 쉽게 벗어나는 사람입니다. 길을 걷거나 대중교통을 이용할 때, 혹은 문득 우상의 생각이 마음에 침투할 때 그 순간 즉시 찬양을 중얼거리거나 짧은 기도 문장을 소리 내어 읊어보세요. 내 마음의 상태를 그때그때 밖으로 솔직하게 표현하고 흘려보낼 때, 우상이 뿌리내릴 틈 없이 당신의 삶 전체가 하나님의 리듬으로 채워집니다.',
    guides: [
      '이동 시간이나 일상의 유연한 순간을 활용해 말씀 팟캐스트나 찬양을 듣습니다.',
      '짧은 감동이나 기도를 음성 메모나 SNS, 즉각적인 스포큰 워드로 표현해 봅니다.',
    ],
  },
  S: {
    code: 'S',
    name: '스미는 결',
    en: 'Soak',
    rhythm: '흐름',
    expression: '안으로',
    tagline: '일상 속 순간마다 마음 깊은 곳에 말씀을 젖게 하는 묵상',
    fusion:
      '당신은 형식이나 장소에 매이지 않고, 일상의 문득 찾아오는 순간마다 마음으로 하나님을 생각하며 은혜를 스며들게 하는 사람입니다. 우상의 유혹이나 마찰이 일어나는 바로 그 현장에서, 잠시 숨을 고르고 마음에 말씀을 되새겨보세요. 굳이 밖으로 티 내거나 거창한 형식을 갖추지 않더라도, 순간순간 마음의 시선을 하나님께 돌리는 작은 호흡만으로도 우상의 영적 압박은 힘을 잃습니다. 스펀지에 물이 스며들듯 일상 전체에 하나님의 은혜가 자연스럽게 젖어들게 하세요.',
    guides: [
      '스마트폰 배경화면에 단 하나의 구절을 띄워두고 수시로 마음으로 읊조립니다.',
      '일하다가 스트레스를 받거나 우상의 동기가 올라올 때, 3초간 멈추고 속으로 ‘주님’을 부르는 묵상을 합니다.',
    ],
  },
};

function sumOf(answers: Record<string, number>, keys: string[]) {
  return keys.reduce((s, k) => s + (answers[k] ?? 0), 0);
}

// 합이 정확히 0이면 A극으로 본다(기존 axisPole의 `sum <= 0 ? a : b`와 같은 관례).
export function computeWalk(answers: Record<string, number>): WalkMeta {
  const free = sumOf(answers, WALK_RHYTHM_KEYS) > 0; // 규칙 ↔ 흐름
  const inward = sumOf(answers, WALK_EXPRESSION_KEYS) > 0; // 밖으로 ↔ 안으로
  if (free) return inward ? WALK_TYPES.S : WALK_TYPES.F;
  return inward ? WALK_TYPES.D : WALK_TYPES.B;
}

// ---------------------------------------------------------------------------
// 응답의 결 — 일관도 / 선명도
// ---------------------------------------------------------------------------

// "얼마나 솔직했나"가 아니라 "결과가 얼마나 또렷하게 나왔나"를 재는 값이다.
// 사람이 아니라 결과를 평가하는 지표라서, 낮게 나와도 흠이 아니라 정보로 읽힌다.
export type QualityBand = 'high' | 'mid' | 'low';

interface ResponseQuality {
  /** 같은 주제 안에서 답이 얼마나 모였는지 (0~100). 시트 저장용 정밀값. */
  consistency: number;
  /** 주제끼리 얼마나 갈렸는지 (0~100). 낮으면 어떤 유형도 뚜렷하지 않다는 뜻. */
  clarity: number;
  /** 거의 모든 문항에 같은 답을 준 경우. 화면에는 쓰지 않고 인도자용으로만 남긴다. */
  flat: boolean;
  band: QualityBand;
}

function mean(vals: number[]) {
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stdev(vals: number[]) {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(mean(vals.map((v) => (v - m) ** 2)));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// 1~7 척도에서 나올 수 있는 최대 표준편차는 3이다(절반이 1, 절반이 7일 때).
const SD_MAX = 3;

// 밴드 경계는 응답 패턴을 모의로 돌려 잡았다(카테고리당 15문항, 40회 반복).
//   · 아무렇게나 찍은 응답      → 일관도 30~42 (이론상 균등분포 표준편차 2.0 근처)
//   · 주제별 성향은 뚜렷하되 느슨 → 일관도 57~65
//   · 주제별로 또렷한 응답        → 일관도 71~77
// 42와 57 사이가 비어 있어 그 한가운데인 50을 낮음 경계로 둔다.
// 이론값 2.0을 그대로 쓰면 무작위 응답 절반이 '중간'으로 새어 들어간다 —
// 주제당 15문항뿐이라 표본 흔들림으로 무작위도 1.74까지 내려오기 때문이다.
// 실제 참가자 데이터가 쌓이면 시트의 consistency 분포를 보고 다시 조정하면 된다.
const SD_TIGHT = 1.05; // 일관도 65
const SD_LOOSE = 1.5; //  일관도 50
// 주제 간 표준편차는 실제로 1.5를 넘기 어려워, 그 지점을 선명도 만점으로 둔다.
const BETWEEN_SD_FULL = 1.5;

export function computeResponseQuality(answers: Record<string, number>): ResponseQuality {
  const byCat = {} as Record<IdolKey, number[]>;
  IDOL_ORDER.forEach((c) => {
    byCat[c] = [];
  });
  IDOL_QUESTIONS.forEach((q, i) => {
    const v = answers['idol_' + i];
    if (v !== undefined) byCat[q.cat].push(v);
  });

  const answered = IDOL_ORDER.filter((c) => byCat[c].length > 0);
  const all = answered.flatMap((c) => byCat[c]);
  // 아직 거의 안 푼 상태(미리보기 등)에서는 판단하지 않고 중간으로 둔다.
  if (all.length < 10) return { consistency: 0, clarity: 0, flat: false, band: 'mid' };

  // 일관도: 한 주제 안의 15문항이 서로 얼마나 가까운 답을 받았는지.
  const withinSd = mean(answered.map((c) => stdev(byCat[c])));
  const consistency = Math.round(clamp01(1 - withinSd / SD_MAX) * 100);

  // 선명도: 주제별 평균끼리 얼마나 벌어졌는지. 전부 비슷하면 1위와 2위도 의미가 옅다.
  const betweenSd = stdev(answered.map((c) => mean(byCat[c])));
  const clarity = Math.round(clamp01(betweenSd / BETWEEN_SD_FULL) * 100);

  // 답이 두 종류 이하로만 나왔으면 문항을 읽지 않았을 가능성이 높다.
  // 표준편차만 보면 "전부 4번"이 오히려 완벽한 일관도로 잡히므로 따로 표시해둔다.
  const flat = new Set(all).size <= 2;

  const band: QualityBand = withinSd < SD_TIGHT ? 'high' : withinSd < SD_LOOSE ? 'mid' : 'low';
  return { consistency, clarity, flat, band };
}

// 밴드는 글자로 말하지 않고 조합 알약의 색으로만 전한다. '신뢰성 낮음' 같은 등급을
// 화면에 박아두면 참가자가 자기 답변이 채점당했다고 읽기 때문이다.
// 아래 설명은 그 알약을 눌러봤을 때만 나오는 보충 설명이라, 낮은 밴드도 나무람이 아니라
// 결과를 어떻게 받아들이면 되는지 알려주는 쪽으로 썼다.
export const QUALITY_NOTE: Record<QualityBand, string> = {
  high: '처음부터 끝까지 흔들림 없이 한 방향으로 답하셨어요. 그만큼 결과도 또렷해요.',
  mid: '대체로 일관되면서도, 문항에 따라 마음이 조금씩 다르게 움직였어요. 자연스러운 모습이에요.',
  low: '같은 주제 안에서도 답이 여러 갈래로 나뉘었어요. 결과는 참고로만 보시고, 마음이 좀 더 잔잔할 때 다시 해보셔도 좋아요.',
};
