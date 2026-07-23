export const IDOL_ORDER = ['people', 'love', 'money', 'power', 'approval', 'dopamine'] as const;
export type IdolKey = (typeof IDOL_ORDER)[number];

interface IdolMeta {
  label: string;
  noun: string;
  mod: string;
  desc: string;
  flavor: string;
  verse: string;
}

export const IDOL_META: Record<IdolKey, IdolMeta> = {
  people: {
    label: '사람', noun: '관계러', mod: '정 많은',
    desc: '당신에게 가장 큰 영향을 주는 것은 ‘사람’이에요. 관계 속에서 사랑받고 연결되어 있다는 느낌이 삶의 중요한 기준이 되곤 해요. 그 마음 자체는 나쁘지 않지만, 사람의 반응이 하나님보다 더 크게 나를 흔들고 있지는 않은지 돌아볼 때예요.',
    flavor: '여기에 더해 사람들과의 관계 역시 당신에게 꽤 중요한 영향을 미치고 있어요.',
    verse: '마태복음 10:37',
  },
  love: {
    label: '사랑', noun: '로맨티스트', mod: '설레는',
    desc: '당신의 마음 중심에는 ‘사랑(연애)’이 자리하고 있어요. 누군가와의 특별한 관계가 삶에 설렘과 의미를 주지만, 그 관계의 온도에 따라 하나님과의 관계까지 흔들리고 있지는 않은지 점검이 필요해요.',
    flavor: '동시에 로맨틱한 관계에 대한 마음도 은근히 크게 자리잡고 있어요.',
    verse: '고린도전서 13장',
  },
  money: {
    label: '돈', noun: '머니러', mod: '계산적인',
    desc: '당신에게는 ‘돈과 재정’이 마음의 큰 기준입니다. 안정감을 추구하는 건 자연스럽지만, 통장 잔고가 곧 나의 평안이 되어버리진 않았는지, 재물보다 하나님을 더 신뢰하고 있는지 돌아볼 필요가 있어요.',
    flavor: '동시에 재정적인 안정에 대한 생각도 꽤 신경 쓰이는 편이에요.',
    verse: '마태복음 6:24, 33',
  },
  power: {
    label: '권력', noun: '파워러', mod: '야망 있는',
    desc: '당신은 ‘주도권과 영향력’에 마음이 크게 반응하는 사람이에요. 리더십과 책임감은 좋은 은사이지만, 내가 통제할 수 없을 때 느끼는 불안이 하나님을 신뢰하지 못하는 마음에서 오는 건 아닌지 살펴볼 때예요.',
    flavor: '동시에 주도권을 잃지 않으려는 마음도 함께 작용하고 있어요.',
    verse: '빌립보서 2:5-8',
  },
  approval: {
    label: '인정', noun: '인정러', mod: '인정 목마른',
    desc: '당신의 마음은 ‘인정과 칭찬’에 민감하게 반응해요. 사람들의 반응 하나하나가 크게 다가오지만, 하나님 앞에서 이미 사랑받고 있다는 사실보다 사람의 평가가 더 크게 자리잡고 있지는 않은지 돌아볼 때예요.',
    flavor: '동시에 사람들의 인정과 반응에도 은근히 마음이 쓰이는 편이에요.',
    verse: '갈라디아서 1:10',
  },
  dopamine: {
    label: '도파민', noun: '자극러', mod: '짜릿한',
    desc: '당신은 ‘즉각적인 자극과 즐거움’에 마음이 쉽게 이끌려요. 게임, 휴대폰, 운동, 쇼핑 같은 짜릿함이 지루함과 공허함을 채워주지만, 그 순간의 자극이 하나님과의 조용한 시간을 자꾸 밀어내고 있지는 않은지 점검이 필요해요.',
    flavor: '동시에 즉각적인 자극과 재미도 무시할 수 없는 요소예요.',
    verse: '시편 46:10',
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
