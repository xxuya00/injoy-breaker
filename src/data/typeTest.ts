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
  { cat: 'people', text: '나는 하루나 한 주의 일정을 계획할 때, 하나님과의 시간보다 사람들과의 약속을 먼저 채우는 편이다.' },
  { cat: 'people', text: '하루를 돌아보면 사람들과 함께했던 시간이 가장 기억에 남고 만족스럽다.' },
  { cat: 'people', text: '내가 하는 많은 선택은 사람들과의 관계를 지키는 방향으로 이루어진다.' },
  { cat: 'people', text: '나에게 중요한 것은 내가 무엇을 이루었는지보다 누구와 함께했는지이다.' },
  { cat: 'people', text: '사람들과의 만남이 없는 날은 하루가 평소보다 덜 의미 있게 느껴질 때가 있다.' },
  // 인정
  { cat: 'approval', text: '다른 사람과 비교하게 되는 순간이 있다.' },
  { cat: 'approval', text: '다른 사람의 칭찬이나 인정을 받지 못하면 하루 종일 기분이 가라앉는다.' },
  { cat: 'approval', text: '주변 사람들이 나를 어떻게 평가하는지에 따라 내 자존감이 높아지거나 낮아진다.' },
  { cat: 'approval', text: '내가 이룬 것들을 사람들이 알아줬으면 좋겠어서 SNS에 올린 적이 있다.', weight: true },
  { cat: 'approval', text: '나는 부모님께 인정받는 것이 중요하다.' },
  { cat: 'approval', text: '내가 한 일에 아무도 반응하지 않으면 아쉽다.' },
  { cat: 'approval', text: '사람들에게 좋은 모습으로 기억되고 싶다.' },
  { cat: 'approval', text: '인정받았다는 느낌이 들면 큰 힘이 난다.' },
  { cat: 'approval', text: 'SNS 반응(좋아요, 댓글)에 내 감정이 크게 좌우된다.' },
  { cat: 'approval', text: '나는 사회적으로 존경받거나 인정받는 직업을 갖고 싶다.' },
  {
    cat: 'approval',
    text: '나는 하나님 안에서 내 존재 자체로 사랑받는다는 사실보다, 내가 이뤄낸 성과나 시험 점수, 스펙이 내 진짜 가치를 결정한다고 믿는다.',
    weight: true,
  },
  { cat: 'approval', text: '나는 사역을 할 때도 무엇보다 잘하는 게 중요하다.' },
  { cat: 'approval', text: '나는 시험 결과(또는 열심히 한 일의 결과)가 좋지 않으면 하나님과 멀어진다. (하나님이 원망스럽다)', weight: true },
  { cat: 'approval', text: '나는 결과가 하나님께 달려있음을 알지만 원하는 결과를 얻지 못할까 봐 쉽게 불안해하고 조급해한다.' },
  { cat: 'approval', text: '나는 남이 나보다 더 인정받거나 앞서나가는 모습을 보면, 순수하게 축하해주기보다 시기와 질투, 열등감을 느낀다.' },
  { cat: 'approval', text: '나는 시험 기간이나 중요한 프로젝트를 앞두고 있을 때, 기도나 예배, 말씀 시간부터 가장 먼저 줄이거나 포기한다.', weight: true },
  { cat: 'approval', text: '나는 하나님을 내 인생의 주인이 아니라, 내가 원하는 성공과 목표를 위한 수단으로 여길 때가 많다.', weight: true },
  {
    cat: 'approval',
    text: '나는 하나님의 뜻을 이루기 위한 공부/일이라 말하지만, 솔직한 마음 깊은 곳에서는 내가 세상에서 빛나고 인정받고 싶은 욕망이 더 크다.',
    weight: true,
  },
  { cat: 'approval', text: '나는 남들에게 보여지는 사역은 해도, 남들이 알아줄 수 없는 사역(예: 교회 청소, 방송실 등)은 별로 하고 싶지 않다.' },
  { cat: 'approval', text: '나는 내 이미지가 중요하다.' },
  { cat: 'approval', text: '섬김의 자리에서 사람의 칭찬을 신경 쓴 적이 많다.' },
  { cat: 'approval', text: '예배 시간에 늦더라도 꾸미는 것(머리 만지기·옷 고르기·화장하기)이 중요하다.' },
  { cat: 'approval', text: '내 일정 대신 주일을 지키는 것이 아까웠던 적이 있다.', weight: true },
  // 돈
  { cat: 'money', text: '내 삶의 만족과 성공 여부는 결국 경제적인 여유와 연결되어 있다고 느낀다.' },
  { cat: 'money', text: '경제적으로 손해를 보더라도 하나님의 뜻을 따르는 선택은 쉽게 하기 어렵다.' },
  { cat: 'money', text: '시간적 여유가 생기면 말씀을 읽고 기도하는 것보다 돈을 벌거나 관리하는 방법을 찾는 데 더 많은 시간을 쓰는 편이다.' },
  { cat: 'money', text: '내가 가진 돈을 하나님께 드리거나 누군가를 돕는 것보다 나 자신을 위해 사용하는 것이 더 자연스럽다.' },
  { cat: 'money', text: '월급이나 용돈을 받으면 하나님께 어떻게 사용할지 생각하기보다 내가 무엇을 살지 먼저 생각한다.' },
  // 사랑
  { cat: 'love', text: '연애할 때 스마트폰을 자주 확인한다 (1시간에 10번 이상).' },
  { cat: 'love', text: '누군가와 가까워질수록 다른 일보다 그 사람이 우선이 된다.' },
  { cat: 'love', text: '외로움을 빨리 채우고 싶다는 생각이 들 때가 있다.' },
  { cat: 'love', text: '이성 친구(연인)와의 관계가 잘 풀리지 않으면 신앙생활 전체가 흔들린다.', weight: true },
  { cat: 'love', text: '요즘 잘 되고 있는 사람이나 좋아하는 사람이 없으면 인생에 재미가 없다.' },
  { cat: 'love', text: '나를 위한 소비보다 이성친구(연인)를 위해 돈을 쓸 때 더 큰 보람과 만족을 느낀다.' },
  { cat: 'love', text: '이성친구와 관계가 불편해지면 내 하루 전체의 기분과 일과가 크게 흔들린다.' },
  { cat: 'love', text: '호감 있는 상대의 SNS, 카톡 프로필, 답장 시간 등의 변화에 신경을 많이 쓰고 있다.' },
  { cat: 'love', text: '가까운 사람 한 명만 있어도 괜찮다고 느낄 때가 있다.' },
  { cat: 'love', text: '연애(썸 포함)에 대한 생각이 하루 중 큰 비중을 차지한다.' },
  { cat: 'love', text: '친구들이랑 하는 대화의 대부분이 연애 관련된 이야기다.' },
  { cat: 'love', text: '하나님보다 잘생긴/예쁜 (내 이상형의) 연인이 내 인생을 더 행복하게 해줄 수 있을 것 같다.', weight: true },
  { cat: 'love', text: '나는 원하는 사람과 잘 안되면 하나님이 원망스럽다.', weight: true },
  // 권력
  { cat: 'power', text: '내 의견이 받아들여지지 않으면 아쉽다.' },
  { cat: 'power', text: '어떤 일을 함에 있어서 내가 주도하는 것이 편하다.' },
  { cat: 'power', text: '내가 상황을 주도하거나 결정권을 갖지 못하면 불편하고 불안하다.' },
  { cat: 'power', text: '조직·모임에서 내 영향력이나 위치가 신앙보다 더 신경 쓰일 때가 있다.', weight: true },
  { cat: 'power', text: '남의 지시를 받으며 높은 연봉/보상을 받는 것보다, 보상이 적더라도 내 마음대로 주도할 수 있는 위치에 있는 것을 선호한다.' },
  {
    cat: 'power',
    text: '주말이나 개인 시간에 누군가와 감정을 나누는 것보다, 내 영향력을 키우거나 내 위치를 공고히 할 수 있는 활동에 투자하는 편을 택할 것이다.',
  },
  { cat: 'power', text: '누군가 밑에서 “일 잘한다”는 칭찬을 들으며 인정받기보다는, 조금 고단하더라도 내가 직접 판을 짜고 결정하는 위치에 서고 싶다.' },
  {
    cat: 'power',
    text: '사람들과 어울려 친밀해지는 것에서 오는 따뜻함보다, 내 말 한마디에 상황이나 사람들의 행동이 움직일 때 느끼는 만족감이 더 크다.',
  },
  { cat: 'power', text: '중요한 결정에 영향을 미치는 사람이 되고 싶다.' },
  { cat: 'power', text: '사람들이 나를 믿고 따라줄 때 만족스럽다.' },
  { cat: 'power', text: '나는 하나님의 뜻이어도 논리적으로 이해되거나 납득되지 않으면 순종하기 어렵다.', weight: true },
  { cat: 'power', text: '인생이 내 뜻대로 되지 않을 때 많이 불안하다.' },
  { cat: 'power', text: '내가 하지 않은 일에 대해서도 조직이나 공동체를 위해 나서서 사과할 수 있다.' },
  // 도파민
  { cat: 'dopamine', text: '지루한 시간을 오래 견디기 어렵다.' },
  { cat: 'dopamine', text: '해야 할 일이 있어도 재미있는 것을 먼저 찾을 때가 있다.' },
  { cat: 'dopamine', text: '잠깐이라도 시간이 비면 습관적으로 휴대폰(게임, 영상 등)을 켠다.', weight: true },
  { cat: 'dopamine', text: '기분이 다운되면 바로 즐길 거리를 찾는다.' },
  {
    cat: 'dopamine',
    text: '“잠깐만 봐야지” 하고 숏폼(릴스/쇼츠)이나 영상을 켜지만, 정신을 차려보면 몇 시간이 흘러있어 자책할 때가 많다.',
  },
  {
    cat: 'dopamine',
    text: '사람들을 만나 이야기를 나누는 것에서 오는 즐거움도 좋지만, 타인을 신경 쓸 필요 없이 영상을 보거나 게임하는 시간이 요즘 내 삶에서 우선이다.',
  },
  { cat: 'dopamine', text: '잔잔한 휴식보다는, 물건을 쇼핑하거나 맛있는 음식을 찾아다니며 마음을 들뜨게 만드는 일에 일상의 에너지를 가장 많이 쓴다.' },
  { cat: 'dopamine', text: '평범한 일상은 금방 심심하게 느껴져서, “지금 무슨 재밌는 일 없나” 하며 최신 이슈를 끊임없이 들여다보게 된다.' },
  { cat: 'dopamine', text: '주변 사람들과의 진지한 대화보다는 흥미진진한 화제거리를 주고받는 편이 지금 나에게 더 매력적으로 다가온다.' },
  {
    cat: 'dopamine',
    text: '예배 시간과 월드컵 결승전, 한국시리즈 7차전, 또는 롤드컵 결승전이 겹친다면, 예배 시간 중 휴대전화로 경기 상황을 찾아볼 것 같다.',
    weight: true,
  },
  { cat: 'dopamine', text: '나는 말씀 읽고 기도할 시간은 바쁘다는 핑계로 계속 미루지만, SNS(릴스)는 틈틈이 본다.', weight: true },
  { cat: 'dopamine', text: '예배 시간에 예배보다 다른 생각을 한 적이 많다.' },
  { cat: 'dopamine', text: '예배 시간에 카톡·전화가 오면 반드시 확인해야 한다.', weight: true },
  { cat: 'dopamine', text: '잔잔한 찬양보다 신나는 찬양이 더 좋다.' },
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
