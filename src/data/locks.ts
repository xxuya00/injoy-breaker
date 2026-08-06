import type { Day, DayData } from '../types';

export const LOCKS: Record<Day, DayData> = {
  1: {
    caption: '첫째날, 솔로몬의 지혜를 구해 잠금장치를 break하세요.',
    items: [
      {
        id: 'd1a',
        name: '첫 번째 두드림',
        sub: '십자 연산 · 머리 굴리기',
        type: 'crossmath',
        reveal: '가로도 세로도 맞아야 풀립니다. 한쪽만 맞춘 하루는 아직 풀리지 않은 하루입니다.',
      },
      {
        id: 'd1b',
        name: '두 번째 두드림',
        sub: '기억의 미로 · 관찰력',
        type: 'maze',
        reveal: '길은 이미 사라졌는데 기억을 따라 걸었습니다. 믿음도 보이지 않는 길을 걷는 일입니다.',
      },
      {
        id: 'd1c',
        name: '세 번째 두드림',
        sub: '부호 해독 · 추론',
        type: 'codebreak',
        reveal: '보이는 것으로 보이지 않는 값을 알아냈습니다. 지혜란 그런 눈입니다.',
      },
      {
        id: 'd1d',
        name: '네 번째 두드림',
        sub: '플래시 암기 · 순간 집중',
        type: 'memory',
        reveal: '스쳐 지나간 것도 새기면 남습니다. 말씀도 그렇게 새겨야 합니다.',
      },
      {
        id: 'd1e',
        name: '다섯 번째 두드림',
        sub: '순발력 · 반응속도',
        type: 'reflex',
        reveal: '깨어 있는 만큼만 제때 반응할 수 있었습니다.',
      },
      {
        id: 'd1f',
        name: '여섯 번째 두드림',
        sub: '숫자야구 · 추리',
        type: 'baseball',
        reveal: '한 번에 맞힌 사람은 없습니다. 어긋난 답도 답으로 가는 걸음이었습니다.',
      },
      {
        id: 'd1g',
        name: '일곱 번째 두드림',
        sub: '결합 찾기 · 관찰과 조합',
        type: 'combo',
        reveal: '같음과 다름을 함께 봐야 비로소 보이는 것이 있습니다.',
      },
      {
        id: 'd1h',
        name: '여덟 번째 두드림',
        sub: '수식 만들기 · 목표를 향해',
        type: 'equation',
        reveal: '흩어진 숫자도 목표가 생기면 하나의 길이 됩니다.',
      },
      {
        id: 'd1i',
        name: '아홉 번째 두드림',
        sub: '라이트 아웃 · 하나씩 꺼가기',
        type: 'lightsout',
        reveal: '얽혀 보여도 순서를 찾으면 결국 다 꺼집니다.',
      },
    ],
  },
  2: {
    // 한 줄에 담기는 길이로 끊는다. 두 줄이 되면 "요."만 다음 줄로 떨어져 나가 보기 흉하다.
    caption: '둘째날, 숲과 계곡에 숨은 QR을 찾아 알을 break 하세요.',
    items: [
      {
        id: 'd2a',
        name: '계곡 근처',
        sub: 'QR 미션',
        type: 'mission',
        q: '흐르는 물소리에 귀를 대보세요. 물은 붙잡지 않아도 60초 내내 쉬지 않고 흘러갑니다. 그 소리를 그저 60초간 들어보세요.',
        hint: '다 들었다면 아래 버튼으로 알에 금을 냅니다. 속도는 중요하지 않아요.',
        reveal: '전도서 2:1 — 쾌락도 붙잡으면 물처럼 손가락 사이로 빠져나갑니다.',
      },
      {
        id: 'd2b',
        name: '숲길 벤치',
        sub: 'QR 미션',
        type: 'mission',
        q: '주변에서 아무도 값을 매기지 않았는데도 그 자리에 있는 것 하나(돌, 나뭇잎, 이끼 등)를 찾아보세요. 그것을 보며 "이게 없으면 불안한 것" 하나를 마음속으로 내려놓아 보세요.',
        hint: '내려놓았다면 아래 버튼으로 크랙을 냅니다.',
        reveal: '전도서 5:10 — 은을 사랑하는 자는 은으로 만족하지 못합니다.',
      },
      {
        id: 'd2c',
        name: '숙소 뒤편',
        sub: 'QR 미션',
        type: 'mission',
        q: '방금 지나온 길을 천천히 돌아보며, 평소라면 그냥 지나쳤을 것 하나(나무의 결, 벌레, 그림자 모양 등)를 찾아 기억하세요.',
        hint: '관찰이 곧 깨어남입니다. 찾았다면 크랙을 냅니다.',
        reveal: '전도서 1:18 — 지혜가 많으면 번뇌도 많더라. 지혜조차 답이 아니었습니다.',
      },
      {
        id: 'd2e',
        name: '만남의 장소',
        sub: 'QR 미션',
        type: 'mission',
        q: '함께 온 사람과 나란히 서서 같은 방향(하늘, 나무, 능선)을 30초간 바라본 뒤, 그 사람에게 감사한 점 하나를 직접 말해보세요.',
        hint: '말했다면 크랙이 생깁니다.',
        reveal: '전도서 4:9-10 — 두 사람이 한 사람보다 나음은 그들이 수고함으로 좋은 상을 얻을 것임이라.',
      },
      {
        id: 'd2f',
        name: '게시판 앞',
        sub: 'QR 미션',
        type: 'mission',
        q: '하늘을 30초간 올려다보세요. 구름은 누구에게 보이려고 그 모양이 되지 않았습니다. SNS에 자랑하고 싶었던 순간 하나를, 사람 대신 하나님께만 조용히 말해보세요.',
        hint: '마음속으로 말했다면 크랙을 냅니다.',
        reveal: '마태복음 6:1 — 사람에게 보이려고 그들 앞에서 의를 행하지 않도록 주의하라.',
      },
      {
        id: 'd2g',
        name: '전망대',
        sub: 'QR 미션',
        type: 'mission',
        q: '전망대에서 가장 멀리 보이는 산이나 능선 하나를 고르세요. 저것은 내가 어떻게 애써도 옮기거나 통제할 수 없습니다. 내가 통제할 수 없는 것 하나를 떠올리고, 하나님께 맡기는 짧은 기도를 해보세요.',
        hint: '기도했다면 알을 마저 깹니다.',
        reveal: '시편 127:1 — 여호와께서 집을 세우지 아니하시면 세우는 자의 수고가 헛되며.',
      },
    ],
  },
  3: {
    caption: '셋째날, 수련회를 통해 얻은 메시지는 무엇인가요?',
    items: [
      {
        id: 'd3a',
        name: '시간의 다이얼',
        sub: '마지막 두드림 · 열둘 다음의 한 칸',
        type: 'final',
        reveal: '',
      },
    ],
  },
};

// 여섯 개의 크랙이 모두 나서 알이 깨진 순간에 열리는 화면.
// QR 미션마다 남기는 기록은 "방금 그 자리에서 무엇을 했는가"지만, 이건 하루를 통과한 뒤의
// 마무리라 성격이 다르다. 그래서 등록할 때 적는 다짐(VOW_PROMPT)처럼 문구를 따로 둔다.
export const FIRST_LOVE_PROMPT = {
  /** 미션 기록과 같은 곳에 저장할 때 쓰는 키. 자물쇠 id와 겹치지 않도록 밑줄을 넣어둔다. */
  id: 'd2_first_love',
  pill: '알이 완전히 깨졌습니다',
  title: '초심',
  question: '여러분의 초심은 무엇이었나요?',
  body: '지금 이 순간, 내가 가장 좋아하는 말씀을 되새기고 잠잠히 묵상하며 기록해봐요.',
  placeholder: '가장 좋아하는 말씀과, 그 말씀 앞에 선 지금의 마음을 적어보세요…',
  /** 알이 깨진 뒤 이 기록을 다시 열어보는 자리에 붙는 말 */
  recallLabel: '내 초심 다시 보기',
};

/**
 * 껍질 조각 여섯 개에 한 글자씩 새겨진 말. 조각을 다 찾으면 "초심을 찾아서"가 완성되고,
 * 그 자리에서 곧바로 초심을 적게 된다(FIRST_LOVE_PROMPT).
 *
 * 조각은 알 좌우로 세 줄에 걸쳐 흩어지므로(JourneyScreen의 SHARD_SCATTER), 왼쪽에서 오른쪽으로,
 * 위에서 아래로 읽으면 이 순서 그대로 읽힌다 — 초 심 / 을 찾 / 아 서.
 */
export const SHARD_WORD = ['초', '심', '을', '찾', '아', '서'];

export const FINAL_REQUIRED = [
  'd1a', 'd1b', 'd1c', 'd1d', 'd1e', 'd1f', 'd1g', 'd1h', 'd1i',
  'd2a', 'd2b', 'd2c', 'd2e', 'd2f', 'd2g',
];

// ---- 시간 잠금(게이트) ----
// 미니게임 자물쇠(d1a…)처럼 locks 시트에서 열리는 시각을 정할 수 있는 "칸"들이다.
// 자물쇠 하나가 아니라 하루 전체나 화면 한 덩어리를 통째로 잠글 때 쓴다.
// 시트에 unlock_at을 적으면 그 시각에 열리고, locked에 TRUE를 적으면 시각과 무관하게 잠긴다.
export interface GateMeta {
  /** locks 시트의 id 칸에 들어가는 값 */
  id: string;
  /** locks 시트의 name 칸에 들어갈, 관리자가 알아볼 이름 */
  label: string;
  /** 아직 잠겨 있을 때 참가자에게 보여줄 안내 */
  lockedSub: string;
}

/** DAY 탭 전체. 잠겨 있으면 그 날 탭 자체를 열 수 없다. */
export const DAY_GATES: Record<Day, GateMeta> = {
  1: { id: 'day1', label: 'DAY 1 전체', lockedSub: '아직 열리지 않은 날이에요' },
  2: { id: 'day2', label: 'DAY 2 전체', lockedSub: '아직 열리지 않은 날이에요' },
  3: { id: 'day3', label: 'DAY 3 전체', lockedSub: '아직 열리지 않은 날이에요' },
};

/** 하루 안의 각 코너. 하루를 통째로 열어두고 코너별로 시간을 따로 줄 수 있다. */
export const SECTION_GATES = {
  d1Intro: { id: 'd1_intro', label: 'DAY 1 · 자기소개 나눔', lockedSub: '나눔 시간에 열려요' },
  d2Type: { id: 'd2_type', label: 'DAY 2 · IDOL-X 유형 검사', lockedSub: '아직 열리지 않았어요' },
  d2Qr: { id: 'd2_qr', label: 'DAY 2 · QR 스캔(알 깨기)', lockedSub: '아직 열리지 않았어요' },
  d2Share: { id: 'd2_share', label: 'DAY 2 · 유형 나눔', lockedSub: '나눔 시간에 열려요' },
  d3Decide: { id: 'd3_decide', label: 'DAY 3 · 마지막 열쇠(결단)', lockedSub: '아직 열리지 않았어요' },
} as const satisfies Record<string, GateMeta>;

// 위 id들을 locks 시트에 실제로 만들어주는 곳은 apps-script.gs의 setupLocksSheet()다.
// 여기에 게이트를 추가하면 그쪽 목록에도 같은 id를 넣어야 관리자 시트에 줄이 생긴다.
