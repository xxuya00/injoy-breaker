// 미니게임 아홉 개의 조율값과, 게임을 열기 전에 보여주는 설명·재시작·힌트 문구.
// 값 하나를 바꾸면 안내 문구의 숫자까지 같이 따라오도록 문구는 값에서 파생시킨다.
import { EQ_STAGES } from '../../data/equationGame';
import { MAZE_STAGES } from '../../data/maze';
import { CODEBREAK_STAGES } from '../../data/codeBreak';
import { BASEBALL_STAGES } from '../../data/numberBaseball';
import type { DialOffsets } from '../../data/timeDial';
import type { LockType } from '../../types';

// 문제 수 = 난이도 단계 수. 한 문제 풀 때마다 다음 단계로 올라간다.
export const EQ_TARGET_STREAK = EQ_STAGES.length;
export const LO_STAGES = [3, 4, 5];
export const COMBO_ROUNDS = 3;
// 오답 한 번의 값. 어느 게임이든 같은 무게로 얹는다 — 게임마다 값이 다르면
// "어느 게임에서 틀리는 게 덜 손해인지"를 계산하게 된다.
export const WRONG_PENALTY_MS = 10000;
export const WRONG_PENALTY_SEC = WRONG_PENALTY_MS / 1000;
// 순발력만 값이 다르다. 한 판이 10초 남짓이라 다른 게임과 같은 무게를 얹으면
// 헛탭 한 번에 기록이 두 배가 된다. 연타로 문지르는 걸 막는 데는 이만큼이면 충분하다.
export const REFLEX_PENALTY_MS = 500;
export const REFLEX_PENALTY_SEC = REFLEX_PENALTY_MS / 1000;
// 숫자야구에는 오답 벌시간이 없다. 여기서 빗나간 답은 실수가 아니라 다음 수를 좁히는
// 정보라, 틀렸다고 벌하면 게임을 하는 것 자체를 벌하는 꼴이 된다. 대신 물어보는 값을
// 받는다 — 맞힌 마지막 한 번까지 시도 한 번에 같은 값이 얹힌다. 그래야 아무 숫자나
// 던져 좁히는 쪽보다 한 번 더 따져보고 무는 쪽이 앞선다.
// 오답 벌시간(10초)의 절반이다. 한 판이 열 번 남짓 걸리는 게임이라 같은 무게를 얹으면
// 추리의 결과인 시간보다 시도 수가 기록을 통째로 결정해버린다.
export const BASEBALL_TRY_MS = 5000;
export const BASEBALL_TRY_SEC = BASEBALL_TRY_MS / 1000;
export const TIMED_KINDS = new Set([
  'equation',
  'combo',
  'lightsout',
  'reflex',
  'crossmath',
  'codebreak',
  'baseball',
  'maze',
  'memory',
]);
// 힌트 한 번의 값. 경과시간에 그대로 얹히고, 한 번이라도 쓰면 그 판은 순위판에 올리지 않는다.
export const HINT_PENALTY_MS = 30000;
// 단어를 한꺼번에 띄우면 스크린샷 한 장에 세트 전체가 담겨 버린다.
// 그래서 한 개씩 차례로 띄우고 사이를 비운다 — 캡처해도 한 장에 한 단어뿐이고,
// 단어 수가 늘어나는 뒤 라운드일수록 총 노출시간은 자연히 길어져 공평해진다.
export const FLASH_WORD_MS = 750;
export const FLASH_GAP_MS = 250;
export const FLASH_ROUNDS = [4, 6, 8];
export const REFLEX_TARGET_HITS = 10;
export const REFLEX_GRID = 9;
export const REFLEX_ON_MS = 650;
export const REFLEX_GAP_MS = 250;
// 맞았을 때 판이 한 번 부풀었다 가라앉는 시간. 틀렸을 때의 흔들림(shake 0.4s)과 길이를 맞춘다 —
// 맞은 쪽이 더 오래 남으면 다음 문제가 이미 떠 있는데 앞 판의 표시가 아직 돌고 있다.
export const OK_FX_MS = 420;
// 순발력 타격에서 명중한 칸이 초록으로 물들었다 돌아오는 시간. 다음 칸이 켜지기 전에는 끝나야 한다.
export const REFLEX_HIT_FX_MS = 300;
// 경과시간을 로컬에 흘려쓰는 주기이자, 분:초로 보여주는 게임의 화면 갱신 주기.
export const TIMER_FLUSH_MS = 500;
// 1/100초까지 보여주는 게임의 화면 갱신 주기.
export const PRECISE_TICK_MS = 40;

// 미로 판 크기를 안내에 쓸 때는 같은 크기가 연달아 나오면 한 번만 적는다.
// 마지막 단계는 판을 키우는 대신 앞 단계와 같은 판을 거꾸로 걷는 것이라,
// 그대로 늘어놓으면 "7x5 → 7x5"처럼 커지다 만 것처럼 읽힌다.
const MAZE_SIZES = MAZE_STAGES.map((s) => `${s.rows}x${s.cols}`).filter((size, i, all) => size !== all[i - 1]);

// 9개 미니게임은 탭하면 바로 시작하지 않고, 먼저 이 설명을 보여주고 "게임 시작"을 눌러야 시작한다.
//
// 설명은 짧게 — 규칙 한 줄, 벌칙 한 마디, 어디까지 가면 열리는지. 그 이상은 아래 미리보기가 맡는다.
// 글이 길어지면 정작 읽어야 할 규칙이 문장 속에 묻히고, 미리보기가 화면 밖으로 밀려난다.
// 벌칙은 "경과시간에 n초가 더해져요" 대신 +n초로 적는다 — 힌트 버튼의 +30초와 같은 표기라 한눈에 읽힌다.
//
// rules는 속성마다 조건을 따로 짚어야 하는 게임(결합 찾기)에만 쓴다. 세 속성을 한 문장에 이어 붙이면
// "각각"이 어디에 걸리는지가 흐려져서, 2장만 같은 조합을 계속 눌러보게 된다. note는 그 뒤에 붙는 벌칙·통과 조건.
export const GAME_INTRO: Partial<
  Record<LockType, { pill: string; title: string; desc: string; rules?: string[]; note?: string }>
> = {
  crossmath: {
    pill: '십자 연산',
    title: '1~9를 겹치지 않게 채워 합을 맞추세요',
    desc: `빈칸을 탭하고 아래 숫자패드로 채우세요. 오른쪽·아래 숫자가 그 줄의 목표 합이에요. 다 채웠는데 합이 안 맞으면 +${WRONG_PENALTY_SEC}초.`,
  },
  maze: {
    pill: '기억의 미로',
    title: '켜지는 순서를 기억해서 길을 되짚어 가세요',
    desc: `안전한 칸이 하나씩 차례로 켜졌다 꺼져요. 모양이 아니라 순서를 기억해 바로 다음 칸으로만 걸으세요. 벗어나면 +${WRONG_PENALTY_SEC}초, 판은 그대로예요. ${MAZE_SIZES.join(
      ' → ',
    )}로 커지고 마지막 ${MAZE_STAGES.length}단계는 거꾸로 걸어요 — 들어가기 전에 한 번 멈춰 알려드려요.`,
  },
  codebreak: {
    pill: '부호 해독',
    title: '마지막 식의 답을 알아내세요',
    desc: `도형마다 0~9 중 겹치지 않는 숫자가 숨어 있어요. 힌트를 모두 쓰면 답이 하나로 정해져요 — 도형값을 다 알아낼 필요는 없어요. 틀리면 +${WRONG_PENALTY_SEC}초. 도형이 ${CODEBREAK_STAGES.map(
      (s) => `${s.shapes}개`,
    ).join(' → ')}로 늘어나요.`,
  },
  memory: {
    pill: '플래시 기억',
    title: '단어가 한 개씩 스쳐 지나가요',
    desc: `다 지나가면 본 순서 그대로 탭하세요. 틀리면 +${WRONG_PENALTY_SEC}초, 맞힌 데까지는 그대로 두고 이어서 골라요. ${FLASH_ROUNDS.join(
      ' → ',
    )}개로 늘어나요.`,
  },
  reflex: {
    pill: '순발력',
    title: '빛나는 칸을 최대한 빠르게 탭하세요',
    desc: `${REFLEX_TARGET_HITS}번 맞히면 열려요. 엉뚱한 칸을 누르면 +${REFLEX_PENALTY_SEC}초.`,
  },
  baseball: {
    pill: '숫자야구',
    title: '숨겨진 숫자를 추리해 맞히세요',
    desc: `0~9 중 서로 다른 숫자로 만든 비밀번호예요. 채울 자리를 누르고 숫자를 고르세요 — 순서에 상관없이 아무 자리나 먼저 채우고 고칠 수 있어요. 숫자와 자리가 다 맞으면 S, 숫자만 맞으면 B. 틀려도 벌시간은 없지만 시도 한 번마다 +${BASEBALL_TRY_SEC}초 — 적게 물어볼수록 앞서요. ${BASEBALL_STAGES.map(
      (s) => `${s.digits}자리`,
    ).join(' → ')}를 차례로 맞히면 열려요.`,
  },
  combo: {
    pill: '결합 찾기',
    title: '보이는 합을 모두 찾으세요',
    desc: '3장을 골랐을 때 세 속성이 각각 "3장 모두 같음"이거나 "3장 모두 다름"이어야 합이 성립해요. 2장만 같고 1장만 다르면 안 돼요.',
    rules: [
      '모양 — 3장 모두 같은 모양이거나, 3장 모두 다른 모양',
      '색상 — 3장 모두 같은 색이거나, 3장 모두 다른 색',
      '배경 — 3장 모두 같은 배경이거나, 3장 모두 다른 배경',
      '결 — 9장 중 더 이상 합이 없으면 "결"을 눌러 넘어가요',
    ],
    note: `오답이면 +${WRONG_PENALTY_SEC}초. ${COMBO_ROUNDS}세트를 넘기면 열려요.`,
  },
  equation: {
    pill: '수식 만들기',
    title: '주어진 숫자로 목표 숫자를 만드세요',
    desc: `숫자 ${EQ_STAGES[0].count}개를 전부 한 번씩만 써서 목표를 만드세요. 괄호도 쓸 수 있어요. 틀리면 +${WRONG_PENALTY_SEC}초. ${EQ_TARGET_STREAK}문제를 연속으로 풀면 열려요. 뒤로 갈수록 숫자는 커지고 목표는 작아져서, 곱하기보다 나누고 빼야 닿아요.`,
  },
  lightsout: {
    pill: '라이트 아웃',
    title: '불을 전부 꺼보세요',
    desc: '칸을 누르면 자신과 상하좌우가 함께 반전돼요. 3→4→5단계를 전부 깨면 열려요.',
  },
};

// 여러 단계·세트로 나뉜 게임들. 재시작할 때 "이 단계만"과 "처음부터"를 구분해서 물어본다.
// 여기 없는 게임(십자 연산·순발력)은 한 판짜리라 곧바로 처음부터 다시 시작한다.
// "처음부터"는 진행도와 시간을 모두 반납하고 게임 설명 화면으로 되돌아간다.
//
// 메뉴에 적는 말은 이름 한 마디와 각주 한 줄까지다. 급할 때 여는 메뉴라 문장이 길면
// 두 줄을 다 읽는 대신 위쪽을 눌러버리고, 그게 시간을 통째로 반납하는 쪽일 수도 있다.
export const STAGED_GAMES: Partial<Record<LockType, { unit: string; allNote: string }>> = {
  maze: { unit: '단계', allNote: '시간도 0부터' },
  baseball: { unit: '단계', allNote: '시간도 0부터' },
  lightsout: { unit: '단계', allNote: '시간도 0부터' },
  codebreak: { unit: '단계', allNote: '시간도 0부터' },
  memory: { unit: '세트', allNote: '시간도 0부터' },
  combo: { unit: '세트', allNote: '시간도 0부터' },
  equation: { unit: '문제', allNote: '시간도 0부터' },
};

// 힌트를 줄 수 있는 게임. 순발력·플래시 기억은 힌트라는 게 성립하지 않아 빠져 있다.
export const HINT_LABELS: Partial<Record<LockType, string>> = {
  crossmath: '한 칸 채워주기',
  codebreak: '확실한 것 하나 알려주기',
  maze: '순서 다시 보기',
  baseball: '고른 자리 숫자 공개',
  combo: '못 찾은 합 하나',
  equation: '첫 계산 알려주기',
  lightsout: '누를 칸 짚어주기',
};

// 글자가 터지고, 아홉 글자가 다 모였다면 그 위에 단어 완성 연출이 이어진다. 두 연출의 길이와 사이 간격.
export const LETTER_FX_MS = 1100;
export const WORD_FX_DELAY_MS = 700;
export const WORD_FX_MS = 2200;
// 흐렸던 다이얼이 초점을 찾는 데 걸리는 시간. 한 번뿐인 장면이라 조금 길게 끈다.
export const DIAL_FX_MS = 1600;

// 여정 화면에 얹는 DAY 3 다이얼은 보여주기용이라 매번 새로 섞지 않는다.
// 아무렇게나 어긋나 있기만 하면 되므로 고정값 하나로 충분하다.
export const DIAL_PREVIEW: DialOffsets = { outer: 4, middle: 9, inner: 2 };
