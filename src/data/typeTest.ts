export const IDOL_ORDER = ['people', 'love', 'money', 'power', 'approval', 'dopamine'] as const;
export type IdolKey = (typeof IDOL_ORDER)[number];

interface IdolMeta {
  label: string;
  verse: string;
}

export const IDOL_META: Record<IdolKey, IdolMeta> = {
  people: { label: '사람', verse: '마태복음 10:37' },
  love: { label: '사랑', verse: '고린도전서 13장' },
  money: { label: '돈', verse: '마태복음 6:24, 33' },
  power: { label: '권력', verse: '빌립보서 2:5-8' },
  approval: { label: '인정', verse: '갈라디아서 1:10' },
  dopamine: { label: '도파민', verse: '시편 46:10' },
};

interface IdolCombo {
  name: string;
  desc: string;
}

// [주유형][보조유형] 조합별 이름·설명 (30가지 = 6 × 5)
export const IDOL_COMBOS: Record<IdolKey, Partial<Record<IdolKey, IdolCombo>>> = {
  people: {
    love: { name: '목마른 환대자', desc: '사람의 온기를 사랑으로 채우려 해요.' },
    money: { name: '너그러운 채권자', desc: '관계 뒤에 계산이 숨어 있어요.' },
    power: { name: '다정한 지배자', desc: '사람을 품으면서 위에 서려 해요.' },
    approval: { name: '헌신적인 구경꾼', desc: '타인의 시선 안에서 살아가요.' },
    dopamine: { name: '충실한 군중꾼', desc: '사람과 함께할 때만 살아있어요.' },
  },
  love: {
    people: { name: '낭만적인 의존자', desc: '사랑이 관계의 전부가 되어버려요.' },
    money: { name: '현실적인 연인', desc: '마음보다 조건이 먼저 움직여요.' },
    power: { name: '부드러운 소유자', desc: '사랑 안에서 주도권을 놓지 않아요.' },
    approval: { name: '절박한 수신자', desc: '사랑받아야만 존재가 완성돼요.' },
    dopamine: { name: '열렬한 방랑자', desc: '설렘이 식으면 떠나고 싶어져요.' },
  },
  money: {
    people: { name: '관대한 투자자', desc: '물질로 사람의 마음을 사려 해요.' },
    love: { name: '안전한 동반자', desc: '돈이 사랑의 기준이 되어 있어요.' },
    power: { name: '야심찬 축재자', desc: '재물과 지위를 함께 쌓아 올려요.' },
    approval: { name: '성실한 증명자', desc: '성과로 자신의 가치를 말해요.' },
    dopamine: { name: '만족 모르는 수집가', desc: '채워도 또 비워지는 항아리예요.' },
  },
  power: {
    people: { name: '인자한 군주', desc: '관계 안에서 왕좌를 원해요.' },
    love: { name: '자상한 정복자', desc: '사랑조차 승패로 읽어버려요.' },
    money: { name: '냉철한 건축가', desc: '지위와 재물이 서로를 강화해요.' },
    approval: { name: '고독한 등대지기', desc: '높아야만 인정받는다고 믿어요.' },
    dopamine: { name: '능숙한 조종자', desc: '통제하는 쾌감에 길들여져 있어요.' },
  },
  approval: {
    people: { name: '예민한 거울', desc: '타인의 눈빛 하나에 하루가 달려요.' },
    love: { name: '갈급한 수취인', desc: '사랑받음으로만 완성되는 자아예요.' },
    money: { name: '단단한 외투', desc: '성과로 자신을 보호하려 해요.' },
    power: { name: '우아한 등반가', desc: '인정은 항상 높은 곳에서 와요.' },
    dopamine: { name: '달콤한 허영자', desc: '칭찬받는 순간이 가장 살아있어요.' },
  },
  dopamine: {
    people: { name: '활기찬 불꽃놀이꾼', desc: '사람의 반응에서 자극을 얻어요.' },
    love: { name: '격렬한 로맨티스트', desc: '불꽃 없는 사랑은 사랑이 아니에요.' },
    money: { name: '충동적인 수확자', desc: '더 많이, 더 빨리를 멈출 수 없어요.' },
    power: { name: '쾌활한 독재자', desc: '내 뜻대로 되는 것의 단맛을 알아요.' },
    approval: { name: '중독된 발신자', desc: '반응이 없으면 숨이 막혀요.' },
  },
};

export interface IdolQuestion {
  cat: IdolKey;
  text: string;
  weight?: boolean;
}

export const IDOL_QUESTIONS: IdolQuestion[] = [
  // 사람
  { cat: 'people', text: '혼자 있으면 괜히 마음이 허전하다.' },
  { cat: 'people', text: '사람들과 잘 지내고 있다는 느낌이 들면 마음이 편하다.' },
  { cat: 'people', text: '누군가와의 관계가 틀어지면 다른 무엇보다 크게 흔들린다.' },
  { cat: 'people', text: '중요한 결정을 내릴 때, 하나님보다 특정 인물(부모님, 연인, 친구 등)의 반응이나 의견을 먼저 의식한다.', weight: true },
  { cat: 'people', text: '친구(또는 가족)와의 사이가 안 좋아질까봐, 혹은 그들의 시선이 신경 쓰여서 하나님의 뜻을 모른 척 한 적이 있다.' },
  // 인정
  { cat: 'approval', text: '다른 사람과 비교하게 되는 순간이 있다.' },
  { cat: 'approval', text: '다른 사람의 칭찬이나 인정을 받지 못하면 하루 종일 기분이 가라앉는다.' },
  { cat: 'approval', text: '주변 사람들이 나를 어떻게 평가하는지에 따라 내 자존감이 높아지거나 낮아진다.' },
  { cat: 'approval', text: '내가 이룬 것들을 사람들이 알아줬으면 좋겠어서 SNS에 올린 적이 있다.', weight: true },
  { cat: 'approval', text: '나는 부모님께 인정받는 것이 중요하다.' },
  // 돈
  { cat: 'money', text: '경제적으로 불안하면 다른 일도 잘 손에 잡히지 않는다.' },
  { cat: 'money', text: '선택할 때 비용을 가장 먼저 생각하는 편이다.' },
  { cat: 'money', text: '미래를 생각하면 가장 먼저 경제적인 부분이 떠오른다.', weight: true },
  { cat: 'money', text: '하나님 없이는 살 수 있어도 돈 없이는 살 수 없을 것 같다.' },
  // 사랑
  { cat: 'love', text: '연애할 때 스마트폰을 자주 확인한다 (1시간에 10번 이상).' },
  { cat: 'love', text: '누군가와 가까워질수록 다른 일보다 그 사람이 우선이 된다.' },
  { cat: 'love', text: '외로움을 빨리 채우고 싶다는 생각이 들 때가 있다.' },
  { cat: 'love', text: '이성 친구(연인)와의 관계가 잘 풀리지 않으면 신앙생활 전체가 흔들린다.', weight: true },
  { cat: 'love', text: '요즘 잘 되고 있는 사람이나 좋아하는 사람이 없으면 인생에 재미가 없다.' },
  // 권력
  { cat: 'power', text: '내 의견이 받아들여지지 않으면 아쉽다.' },
  { cat: 'power', text: '어떤 일을 함에 있어서 내가 주도하는 것이 편하다.' },
  { cat: 'power', text: '내가 상황을 주도하거나 결정권을 갖지 못하면 불편하고 불안하다.' },
  { cat: 'power', text: '조직·모임에서 내 영향력이나 위치가 신앙보다 더 신경 쓰일 때가 있다.', weight: true },
  // 도파민
  { cat: 'dopamine', text: '지루한 시간을 오래 견디기 어렵다.' },
  { cat: 'dopamine', text: '해야 할 일이 있어도 재미있는 것을 먼저 찾을 때가 있다.' },
  { cat: 'dopamine', text: '잠깐이라도 시간이 비면 습관적으로 휴대폰(게임, 영상 등)을 켠다.', weight: true },
  { cat: 'dopamine', text: '기분이 다운되면 바로 즐길 거리를 찾는다.' },
];

export const LIKERT_LABELS = ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다'];

export const AB_SCALE = [
  { v: -2, label: 'A쪽 강함' },
  { v: -1, label: 'A쪽 약간' },
  { v: 0, label: '중립' },
  { v: 1, label: 'B쪽 약간' },
  { v: 2, label: 'B쪽 강함' },
];

export interface AbQuestion {
  a: string;
  b: string;
}

export const MED_AXIS_ROUTINE: AbQuestion[] = [
  { a: '매일 정해진 시간과 장소에서 말씀을 읽으려고 한다', b: '특별히 정해두지 않고, 생각날 때 자연스럽게 말씀을 읽는다' },
  { a: '계획한 말씀 읽기표(성경통독표 등)를 따라가는 편이다', b: '그날그날 마음이 가는 본문을 자유롭게 읽는 편이다' },
];
export const MED_AXIS_METHOD: AbQuestion[] = [
  { a: '말씀을 읽고 노트에 적거나 필사하며 정리한다', b: '말씀을 읽고 마음속으로 곱씹으며 느낀다' },
  { a: '묵상 앱·노트에 깨달은 것을 기록해야 마음이 정리된다', b: '굳이 기록하지 않아도 마음에 새기며 지나간다' },
];
export const MED_AXIS_SOCIAL: AbQuestion[] = [
  { a: '함께 말씀을 나누며 묵상할 경우 더 은혜를 받는다', b: '혼자 조용히 말씀을 묵상할 경우 더 은혜를 받는다' },
];
export const MED_TIME_OPTIONS = ['5분 이하', '5~15분', '15~30분', '30분 이상'];

export const PRAY_AXIS_ROUTINE: AbQuestion[] = [
  { a: '정해진 기도 시간(새벽기도, 취침 전 등)을 지키려 한다', b: '정해진 시간 없이 생각날 때마다 기도한다' },
  { a: '기도 목록·기도제목 노트를 만들어 체계적으로 기도한다', b: '그때그때 떠오르는 마음을 자유롭게 아뢴다' },
];
export const PRAY_AXIS_EXPR: AbQuestion[] = [
  { a: '혼자 있을 때 소리 내어 기도하는 것이 편하다', b: '마음속으로 조용히 기도하는 것이 편하다' },
  { a: '찬양하며 소리 내어 기도할 때 은혜를 크게 느낀다', b: '침묵 중에 마음으로 기도할 때 하나님과 더 깊이 만난다' },
];
export const PRAY_AXIS_FOCUS: AbQuestion[] = [
  { a: '대부분의 시간을 나의 삶과 고민을 위해 기도한다', b: '나를 위한 기도와 다른 사람을 위한 기도를 비슷한 비중으로 한다' },
];
export const PRAY_TIME_OPTIONS = ['5분 이하', '5~15분', '15~30분', '30분 이상'];

interface TypeMeta {
  name: string;
  desc: string;
}

export const MED_TYPES: Record<string, TypeMeta> = {
  R_W: { name: '말씀 저널러', desc: '정해진 시간에 말씀을 펴고, 떠오르는 생각을 손으로 적어 내려가며 정리하는 스타일이에요. 규칙성과 기록이 만나 꾸준함의 힘을 만들어냅니다.' },
  R_M: { name: '고요한 묵상가', desc: '정해진 시간, 조용한 공간에서 말씀을 마음에 깊이 새기는 스타일이에요. 기록보다는 그 순간의 침묵과 여운을 소중히 여겨요.' },
  S_W: { name: '떠오르는 대로 적는 자', desc: '특별히 정해두지 않아도 말씀이 떠오를 때마다 짧게라도 기록하며 삶 속에서 은혜를 붙잡는 스타일이에요.' },
  S_M: { name: '일상 속 묵상러', desc: '출퇴근길, 걷는 길, 잠들기 전... 일상 곳곳에서 자연스럽게 말씀을 떠올리고 마음에 담아두는 스타일이에요.' },
};

export const PRAY_TYPES: Record<string, TypeMeta> = {
  R_V: { name: '기도의 용사', desc: '정해진 시간을 지켜 소리 내어 기도하는, 뜨겁고 꾸준한 기도의 사람이에요.' },
  R_Si: { name: '골방의 사람', desc: '정해진 시간, 조용한 자리에서 마음으로 하나님과 깊이 교제하는 스타일이에요. 마태복음 6장의 ‘골방 기도’와 닮아있어요.' },
  S_V: { name: '언제나 기도쟁이', desc: '때와 장소를 가리지 않고, 마음이 움직일 때마다 소리 내어 기도로 반응하는 스타일이에요.' },
  S_Si: { name: '마음의 기도자', desc: '정해진 형식 없이, 일상 속에서 조용히 마음으로 하나님께 아뢰는 스타일이에요.' },
};
