import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  LOCKS,
  FINAL_REQUIRED,
  DAY_GATES,
  SECTION_GATES,
  FIRST_LOVE_PROMPT,
  SHARD_WORD,
  type GateMeta,
} from '../data/locks';
import { generateFlashRound, type FlashRound } from '../data/memoryGame';
import { MAZE_STAGES, generateMazePath, type MazeStage } from '../data/maze';
import { generateComboRounds, checkCombo, findAllCombos, type ComboCard } from '../data/comboGame';
import { generateEquationRound, evaluateTokens, EQ_STAGES, type EquationRound, type EqToken } from '../data/equationGame';
import { generateLightsOut, toggleLight } from '../data/lightsOut';
import { generateCrossMathRound, checkCrossMath, crossMathLines, type CrossMathRound } from '../data/crossMath';
import {
  generateCodeBreakRound,
  codeBreakFacts,
  CODEBREAK_STAGES,
  type CodeBreakRound,
  type CodeBreakOp,
  type ShapeId,
} from '../data/codeBreak';
import {
  BASEBALL_DIGITS,
  BASEBALL_STAGES,
  baseballResultText,
  generateBaseballSecret,
  judgeBaseball,
  type BaseballGuess,
} from '../data/numberBaseball';
import { VOW_PROMPT } from '../data/intro';
import { SOLVED as DIAL_SOLVED, type DialOffsets } from '../data/timeDial';
import { letterChime, wordChime } from '../lib/feedback';
import { fetchLockGates, type LockGate } from '../lib/gas';
import {
  getAccumulatedMs,
  hasDialRevealed,
  hasIntroSheet,
  hasProverbWritten,
  hasShareDone,
  loadTypeSummary,
  markDialRevealed,
  setAccumulatedMs,
} from '../lib/storage';
import {
  firebaseEnabled,
  saveGameTime,
  subscribeGameLeaderboard,
  saveMissionAnswer,
  loadMissionAnswers,
  loadIntroSheetThumb,
  subscribeIntroSheets,
  type GameTimeEntry,
  type IntroSheetEntry,
  type MissionAnswers,
} from '../lib/sync';
import type { Day, LockItem, LockType } from '../types';
import Sheet from '../components/Sheet';
import { useScrollFit } from '../components/FitBox';
import RevealCard from '../components/RevealCard';
import EggCrack from '../components/EggCrack';
import TimeDial from '../components/TimeDial';
import QrScanner from '../components/QrScanner';
import { useToast } from '../context/ToastContext';
import styles from './JourneyScreen.module.css';

// 문제 수 = 난이도 단계 수. 한 문제 풀 때마다 다음 단계로 올라간다.
const EQ_TARGET_STREAK = EQ_STAGES.length;
const LO_STAGES = [3, 4, 5];
const COMBO_ROUNDS = 3;
// 오답 한 번의 값. 어느 게임이든 같은 무게로 얹는다 — 게임마다 값이 다르면
// "어느 게임에서 틀리는 게 덜 손해인지"를 계산하게 된다.
const WRONG_PENALTY_MS = 10000;
const WRONG_PENALTY_SEC = WRONG_PENALTY_MS / 1000;
// 순발력만 값이 다르다. 한 판이 10초 남짓이라 다른 게임과 같은 무게를 얹으면
// 헛탭 한 번에 기록이 두 배가 된다. 연타로 문지르는 걸 막는 데는 이만큼이면 충분하다.
const REFLEX_PENALTY_MS = 500;
const REFLEX_PENALTY_SEC = REFLEX_PENALTY_MS / 1000;
// 숫자야구에는 오답 벌시간이 없다. 여기서 빗나간 답은 실수가 아니라 다음 수를 좁히는
// 정보라, 틀렸다고 벌하면 게임을 하는 것 자체를 벌하는 꼴이 된다. 대신 물어보는 값을
// 받는다 — 맞힌 마지막 한 번까지 시도 한 번에 같은 값이 얹힌다. 그래야 아무 숫자나
// 던져 좁히는 쪽보다 한 번 더 따져보고 무는 쪽이 앞선다.
// 오답 벌시간(10초)의 절반이다. 한 판이 열 번 남짓 걸리는 게임이라 같은 무게를 얹으면
// 추리의 결과인 시간보다 시도 수가 기록을 통째로 결정해버린다.
const BASEBALL_TRY_MS = 5000;
const BASEBALL_TRY_SEC = BASEBALL_TRY_MS / 1000;
const TIMED_KINDS = new Set([
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
const HINT_PENALTY_MS = 30000;
// 단어를 한꺼번에 띄우면 스크린샷 한 장에 세트 전체가 담겨 버린다.
// 그래서 한 개씩 차례로 띄우고 사이를 비운다 — 캡처해도 한 장에 한 단어뿐이고,
// 단어 수가 늘어나는 뒤 라운드일수록 총 노출시간은 자연히 길어져 공평해진다.
const FLASH_WORD_MS = 750;
const FLASH_GAP_MS = 250;
const FLASH_ROUNDS = [4, 6, 8];
const REFLEX_TARGET_HITS = 10;
const REFLEX_GRID = 9;
const REFLEX_ON_MS = 650;
const REFLEX_GAP_MS = 250;
// 맞았을 때 판이 한 번 부풀었다 가라앉는 시간. 틀렸을 때의 흔들림(shake 0.4s)과 길이를 맞춘다 —
// 맞은 쪽이 더 오래 남으면 다음 문제가 이미 떠 있는데 앞 판의 표시가 아직 돌고 있다.
const OK_FX_MS = 420;
// 순발력 타격에서 명중한 칸이 초록으로 물들었다 돌아오는 시간. 다음 칸이 켜지기 전에는 끝나야 한다.
const REFLEX_HIT_FX_MS = 300;
// 경과시간을 로컬에 흘려쓰는 주기이자, 분:초로 보여주는 게임의 화면 갱신 주기.
const TIMER_FLUSH_MS = 500;
// 1/100초까지 보여주는 게임의 화면 갱신 주기.
const PRECISE_TICK_MS = 40;

type TimedKind = 'equation' | 'combo' | 'lightsout' | 'reflex' | 'crossmath' | 'codebreak' | 'baseball' | 'maze' | 'memory';
type TimedSheetState = Extract<SheetState, { kind: TimedKind }>;
function isTimedSheet(s: SheetState | null): s is TimedSheetState {
  return !!s && TIMED_KINDS.has(s.kind);
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 순발력 타격은 분 단위가 의미 없고 찰나로 승부가 갈려서, 분:초 대신 초·1/100초로 보여준다.
function formatPreciseElapsed(ms: number): string {
  const total = Math.max(0, ms);
  const sec = Math.floor(total / 1000);
  const hundredths = Math.floor((total % 1000) / 10);
  return `${sec}.${String(hundredths).padStart(2, '0')}초`;
}

// 이 게임은 초 단위 아래까지 보여준다.
function isPreciseGame(type: string): boolean {
  return type === 'reflex';
}

function formatKST(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${m}분`;
}

type SheetState =
  | { kind: 'quiz'; item: LockItem }
  | { kind: 'mission'; item: LockItem }
  | { kind: 'memory'; item: LockItem }
  | { kind: 'maze'; item: LockItem }
  | { kind: 'combo'; item: LockItem }
  | { kind: 'equation'; item: LockItem }
  | { kind: 'lightsout'; item: LockItem }
  | { kind: 'crossmath'; item: LockItem }
  | { kind: 'codebreak'; item: LockItem }
  | { kind: 'baseball'; item: LockItem }
  | { kind: 'reflex'; item: LockItem }
  | { kind: 'intro'; item: LockItem }
  | { kind: 'reveal'; item: LockItem }
  // 알이 다 깨진 순간에 열리는 "초심" 화면. 자물쇠 하나에 딸린 화면이 아니라
  // 여섯 개를 통과한 뒤의 마무리라, 마지막으로 깬 자물쇠를 들고 다니지 않는다.
  | { kind: 'eggComplete' };

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
const GAME_INTRO: Partial<
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
const STAGED_GAMES: Partial<Record<LockType, { unit: string; allNote: string }>> = {
  maze: { unit: '단계', allNote: '시간도 0부터' },
  baseball: { unit: '단계', allNote: '시간도 0부터' },
  lightsout: { unit: '단계', allNote: '시간도 0부터' },
  codebreak: { unit: '단계', allNote: '시간도 0부터' },
  memory: { unit: '세트', allNote: '시간도 0부터' },
  combo: { unit: '세트', allNote: '시간도 0부터' },
  equation: { unit: '문제', allNote: '시간도 0부터' },
};

// 힌트를 줄 수 있는 게임. 순발력·플래시 기억은 힌트라는 게 성립하지 않아 빠져 있다.
const HINT_LABELS: Partial<Record<LockType, string>> = {
  crossmath: '한 칸 채워주기',
  codebreak: '확실한 것 하나 알려주기',
  maze: '순서 다시 보기',
  baseball: '고른 자리 숫자 공개',
  combo: '못 찾은 합 하나',
  equation: '첫 계산 알려주기',
  lightsout: '누를 칸 짚어주기',
};

// 부호 해독 힌트로 화면에 띄워둔 사실. 도형 하나가 확정된 경우, 두 도형의 관계만 확정된 경우,
// 그리고 둘 다 없을 때 답 자체에 대해 말해줄 수 있는 것(푸는 법·홀짝·범위)이 있다.
type CbFact =
  | { kind: 'fixed'; shape: ShapeId; value: number }
  | { kind: 'rel'; a: ShapeId; b: ShapeId; op: CodeBreakOp; result: number }
  | { kind: 'note'; id: string; text: string };

// 경과시간 배지 앞의 작은 표시. 시계가 멈춰 있는 동안은 일시정지 모양으로 바뀌어,
// 숫자가 안 움직이는 게 고장이 아니라 멈춰둔 것임을 알린다.
function TimerIcon({ paused }: { paused: boolean }) {
  return (
    <svg className={styles.timerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {paused ? (
        <>
          <rect x="7" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
          <rect x="13" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="12" cy="13.5" r="8" />
          <path d="M12 9.5v4.5l3 1.5M9 2h6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

// 힌트 버튼 앞의 전구. 이모지 대신 SVG로 둬야 기기마다 그림이 달라지지 않고 글자 색을 그대로 따라온다.
function BulbIcon() {
  return (
    <svg
      className={styles.hintIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a6 6 0 0 0-3.4 10.9c.6.4.9 1 .9 1.7h5c0-.7.3-1.3.9-1.7A6 6 0 0 0 12 3z" />
      <path d="M9.5 18.5h5M10.5 21h3" />
    </svg>
  );
}

// 결과 화면의 "다시 플레이"에 붙는 되감기 화살표. 시트 머리말의 재시작 아이콘과 같은 그림이라
// 둘이 같은 일을 한다는 게 그림만으로 읽힌다.
function ReplayIcon() {
  return (
    <svg
      className={styles.btnIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg
      className={styles.btnIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

function LockIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24">
      <path d="M7 11V8a5 5 0 0 1 9.9-1" />
      <rect x="4" y="11" width="16" height="10" rx="2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// 알 아래에 나란히 놓이는 세 걸음(나의 우상은? · 유형 나눔 · 나만의 잠언).
//
// 상자를 걷어냈다. 알은 그림인데 그 아래에 테두리와 배경을 두른 카드 셋이 서면, 한 화면에서
// 서로 다른 두 가지 그림 언어가 부딪힌다 — 폭 104px짜리 상자에 번호·표제·이름·화살표·잠금까지
// 다섯 가지를 밀어 넣던 것이 원인이었다. 이제 동그란 그림 하나와 이름 한 줄만 남긴다.
//
// 순서는 원과 원을 잇는 실선이 말한다. 번호를 떼도 왼쪽에서 오른쪽으로 이어진 한 줄기로 읽힌다.
// 상태는 원에 붙는 작은 표시 하나로 갈린다 — 마친 걸음에는 체크, 잠긴 걸음에는 자물쇠.
// next("지금 할 차례")는 한 걸음에만 켜서 원 둘레가 은은하게 숨 쉬게 한다(잠긴 걸음에는 켜지 않는다).
//
// done은 "마쳤다"를 아는 걸음에만 켠다 — 나눔은 앱 밖에서 일어나는 일이라, 나눔 화면 끝의
// "나눔 마치기"를 누른 것을 끝으로 삼는다.
function DayLinkTile({
  step,
  icon,
  label,
  name,
  onClick,
  locked = false,
  lockedSub,
  done = false,
  next = false,
}: {
  step: number;
  icon: React.ReactNode;
  /** 그림 아래 보이는 표제(IDOL-X·SHARE·WRITE). */
  label: string;
  /** 화면을 읽어주는 기기에 넘기는 이름. 표제만으로는 무슨 코너인지 알 수 없어 한글로 둔다. */
  name: string;
  onClick: () => void;
  locked?: boolean;
  lockedSub?: string;
  done?: boolean;
  next?: boolean;
}) {
  return (
    <div className={styles.linkStep}>
      {/* 앞 걸음과 이어주는 실선. 원 바깥(칸 사이 간격)에 놓이므로 바깥 상자가 들고 있는다. */}
      {step > 1 && <span className={styles.linkConnect} aria-hidden="true" />}
      <button
        className={[styles.linkTile, locked ? styles.linkTileLocked : '', next ? styles.linkTileNext : '']
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
        aria-disabled={locked || undefined}
        aria-label={`${step}번째 걸음 · ${name}${done ? ' · 마침' : ''}${locked ? ' · 잠김' : next ? ' · 지금 할 차례' : ''}`}
      >
        <span className={styles.linkIcon}>
          {icon}
          {/* 마침·잠김은 원 오른쪽 아래에 작은 표시로 얹는다. 그림을 덮지 않으므로
              "무엇을 하는 걸음인지"와 "지금 어떤 상태인지"를 한눈에 같이 읽는다. */}
          {done && !locked && (
            <span className={`${styles.linkBadge} ${styles.linkBadgeDone}`} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 12.5l5 5 9-10.5" />
              </svg>
            </span>
          )}
          {locked && (
            <span className={`${styles.linkBadge} ${styles.linkBadgeLock}`} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="9" rx="2.2" />
                <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
              </svg>
            </span>
          )}
        </span>
        {/* 그림 아래에는 표제만 둔다. 짧은 영문 대문자라 폭을 거의 쓰지 않아 세 걸음이
            가볍게 서고, 무슨 코너인지는 위 그림과 짝을 이뤄 읽힌다.
            (화면을 읽어주는 기기에는 위 aria-label로 한글 이름이 그대로 나간다.) */}
        <span className={styles.linkName}>{label}</span>
        {locked && <span className={styles.linkSub}>{lockedSub ?? '아직 열리지 않았어요'}</span>}
      </button>
    </div>
  );
}

// DAY 1 캡션 아래에 놓이는 자기소개 나눔 한 줄.
//
// 아홉 칸이 화면 폭을 다 쓰며 아래까지 내려앉는 날이라, 그리드 아래에 두면 첫날 첫 순서인 코너가
// 스크롤 밖으로 나간다. 그래서 캡션 바로 아래, 세로 한 줄만 쓰는 자리에 놓는다 —
// 실제 순서(자기소개 먼저 → 게임)와도 이 자리가 맞다.
//
// 오른쪽에 겹쳐 놓은 작은 동그라미는 방금 올라온 자기소개지 셋이다. 종이를 크게 깔면
// 이 어두운 화면에서 하얀 종이가 제일 밝은 덩어리가 되어 그날의 주인공(아홉 칸)을 덮는다.
// 22px짜리 동그라미로만 비치면 밝기를 흔들지 않으면서 "누가 올렸는지"는 그대로 읽힌다.
const INTRO_FACES = 3;

function IntroSheetRow({
  myId,
  myGroup,
  locked,
  lockedSub,
  onOpen,
}: {
  myId: string | null;
  myGroup: string;
  locked: boolean;
  /** 잠겨 있을 때 대신 보여줄 한 줄(열리는 시각 등). */
  lockedSub: string;
  onOpen: () => void;
}) {
  const [entries, setEntries] = useState<IntroSheetEntry[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // 이미 받아오기 시작한 그림. 여정 화면은 자주 다시 그려지므로, 이게 없으면 같은 그림을
  // 그릴 때마다 새로 요청한다.
  const requested = useRef<Set<string>>(new Set());
  const uploaded = myId ? hasIntroSheet(myId) : false;

  // 목록 뼈대만 받는 구독이라 사람마다 수백 바이트다. 그림은 아래에서 세 장만 따로 받아온다.
  useEffect(() => subscribeIntroSheets(setEntries, () => {}), []);

  const visible = entries.filter((e) => e.scope === 'all' || e.group === myGroup);
  const faces = visible.slice(0, INTRO_FACES);
  const faceKey = faces.map((e) => e.id).join(',');

  useEffect(() => {
    let cancelled = false;
    faceKey
      .split(',')
      .filter((id) => id && !requested.current.has(id))
      .forEach((id) => {
        requested.current.add(id);
        loadIntroSheetThumb(id)
          .then((url) => {
            if (cancelled || !url) return;
            setThumbs((prev) => ({ ...prev, [id]: url }));
          })
          .catch(() => requested.current.delete(id));
      });
    return () => {
      cancelled = true;
    };
  }, [faceKey]);

  const sub = !firebaseEnabled
    ? '지금은 연결이 없어 볼 수 없어요'
    : locked
      ? lockedSub
      : visible.length === 0
        ? '첫 번째로 올려보세요'
        : uploaded
          ? `${visible.length}명이 올렸어요`
          : `${visible.length}명이 올렸어요 · 나도 올리기`;

  return (
    <button
      className={`${styles.introRow} ${locked ? styles.introRowLocked : ''}`}
      onClick={onOpen}
      aria-disabled={locked || undefined}
      aria-label={`자기소개 나눔 · ${sub}`}
    >
      <span className={styles.introIcon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="M4 8a2 2 0 0 1 2-2h1.6l1.2-1.6h6.4L16.4 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
          <circle cx="12" cy="13" r="3.4" />
        </svg>
        {uploaded && !locked && (
          <span className={styles.introDone} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 12.5l5 5 9-10.5" />
            </svg>
          </span>
        )}
      </span>
      <span className={styles.introText}>
        <span className={styles.introName}>자기소개 나눔</span>
        <span className={styles.introSub}>{sub}</span>
      </span>
      {faces.length > 0 ? (
        <span className={styles.introFaces} aria-hidden="true">
          {faces.map((e) => (
            <span key={e.id} className={styles.introFace}>
              {thumbs[e.id] && <img src={thumbs[e.id]} alt="" />}
            </span>
          ))}
        </span>
      ) : (
        <svg className={styles.introArrow} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </button>
  );
}

// 자물쇠 id → 그 자물쇠가 속한 날. QR로 다른 날의 자물쇠를 바로 열 때, 지금 보고 있는 날이 아니라
// 그 자물쇠가 속한 날의 잠금을 봐야 해서 미리 만들어 둔다.
const ITEM_DAY: Record<string, Day> = (() => {
  const map: Record<string, Day> = {};
  ([1, 2, 3] as Day[]).forEach((d) => {
    LOCKS[d].items.forEach((it) => {
      map[it.id] = d;
    });
  });
  return map;
})();

// 다이얼을 여는 데 필요한 자물쇠(FINAL_REQUIRED)를 날짜별로 나눠둔 것. DAY 3의 되짚기 줄이
// "DAY 1 · 7/9"처럼 날마다 몇 개가 남았는지 적을 때 쓴다.
// 목록을 직접 적지 않고 FINAL_REQUIRED에서 파생시킨다 — 필요한 자물쇠가 바뀌면 되짚기 줄의
// 숫자도 같이 따라와야, 다 채웠는데 다이얼이 안 열리는(혹은 그 반대의) 줄이 되지 않는다.
const FINAL_BY_DAY: { day: Day; ids: string[] }[] = ([1, 2, 3] as Day[])
  .map((day) => ({ day, ids: FINAL_REQUIRED.filter((id) => ITEM_DAY[id] === day) }))
  .filter((g) => g.ids.length > 0);

// Day1의 자물쇠 9개를 하나씩 깰 때마다, 그 칸 안에서 바로 BACKTOGOD의 글자가 순서대로 드러난다.
const BACKTOGOD_WORD = 'BACKTOGOD'.split('');
const DAY1_IDS = LOCKS[1].items.map((i) => i.id);
// 글자가 터지고, 아홉 글자가 다 모였다면 그 위에 단어 완성 연출이 이어진다. 두 연출의 길이와 사이 간격.
const LETTER_FX_MS = 1100;
const WORD_FX_DELAY_MS = 700;
const WORD_FX_MS = 2200;
// 흐렸던 다이얼이 초점을 찾는 데 걸리는 시간. 한 번뿐인 장면이라 조금 길게 끈다.
const DIAL_FX_MS = 1600;

// 여정 화면에 얹는 DAY 3 다이얼은 보여주기용이라 매번 새로 섞지 않는다.
// 아무렇게나 어긋나 있기만 하면 되므로 고정값 하나로 충분하다.
const DIAL_PREVIEW: DialOffsets = { outer: 4, middle: 9, inner: 2 };

const COMBO_COLORS = ['var(--danger)', 'var(--accent-blue)', 'var(--accent-yellow)'];

function ComboShape({ card, size = 36 }: { card: ComboCard; size?: number }) {
  const color = COMBO_COLORS[card.color];
  // 카드 배경이 흰색/회색/검정으로 바뀌어도 도형이 또렷이 보이도록 옅은 외곽선을 둔다.
  const stroke = { stroke: 'rgba(0, 0, 0, 0.3)', strokeWidth: 1.5 };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      {card.shape === 0 && <circle cx="20" cy="20" r="14" fill={color} {...stroke} />}
      {card.shape === 1 && <polygon points="20,6 34,32 6,32" fill={color} {...stroke} />}
      {card.shape === 2 && <rect x="7" y="7" width="26" height="26" rx="3" fill={color} {...stroke} />}
    </svg>
  );
}

const SHAPE_COLORS = ['var(--accent)', 'var(--ok)', 'var(--accent-blue)', 'var(--accent-yellow)', 'var(--accent-purple)'];

function ShapeIcon({ shape, size = 30 }: { shape: ShapeId; size?: number }) {
  const color = SHAPE_COLORS[shape];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      {shape === 0 && <rect x="7" y="7" width="26" height="26" rx="3" fill={color} />}
      {shape === 1 && <polygon points="20,6 34,32 6,32" fill={color} />}
      {shape === 2 && <circle cx="20" cy="20" r="15" fill={color} />}
      {shape === 3 && (
        <polygon
          points="20,4 24.7,15.3 37,16.5 27.7,24.7 30.5,37 20,30.5 9.5,37 12.3,24.7 3,16.5 15.3,15.3"
          fill={color}
        />
      )}
      {shape === 4 && <rect x="10" y="10" width="20" height="20" rx="2" fill={color} transform="rotate(45 20 20)" />}
    </svg>
  );
}

// 숫자야구 한 자리. 십자 연산의 칸과 같은 물건이다 — 눌러서 고르고, 숫자패드로 채우고, 다시 눌러 고친다.
// 힌트로 알아낸 자리는 따로 표시해, 내가 짚은 숫자와 알려준 숫자를 판 위에서 구분할 수 있게 한다.
function BaseballSlot({
  pos,
  digit,
  hinted,
  active,
  onClick,
}: {
  pos: number;
  digit?: number | null;
  hinted?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.bbSlot} ${hinted ? styles.bbSlotHint : ''} ${active ? styles.bbSlotActive : ''}`}
      onClick={onClick}
      aria-label={`${pos + 1}번째 자리 ${digit == null ? '비어 있음' : digit}`}
      aria-pressed={active}
    >
      {digit ?? ''}
    </button>
  );
}

// 인트로 화면에서 텍스트 설명만으로는 감이 안 오니, 고정된 예시 상황을 CSS 루프로 반복 재생해
// "이런 식으로 진행된다"를 짧게 보여준다. 실제 랜덤 로직과는 무관한 순수 연출용.
//
// 미리보기와 실제 판이 조금이라도 다르면, 안내를 읽고 들어온 사람이 처음 보는 화면 앞에서 한 번 더
// 헤맨다. 그래서 판 모양(3x3 아홉 장, 숫자패드, 단어 한 장씩)은 실제 게임 그대로 축소해서 쓴다.
//
// 실제 판과 똑같이 아홉 장을 3x3으로 깔고, 그 위에서 결합 네 개를 차례로 찾아간다.
// 결합이 성립하는 네 가지 경우(셋 다 다름 / 색만 같음 / 모양만 같음 / 모양·배경이 같고 색만 다름)를
// 한 판 안에서 모두 보여줘야, 한 가지 유형만 눈에 익어 나머지를 지나치는 일이 없다.
// 이 아홉 장에 성립하는 결합은 정확히 이 넷뿐이라, 마지막에 "결"을 누르는 것까지 그대로 맞는 흐름이다.
//
// 판을 고를 때 실제 판에서 늘 일어나는 두 가지를 같이 담았다 — ①한 장이 결합 두 개에 겹쳐 쓰이고
// ②아무 결합에도 안 들어가는 장이 남는다(5번). 이 둘이 빠진 판을 예시로 들면 "한 장은 한 결합에만,
// 아홉 장을 남김없이" 쓰는 게임으로 잘못 배우고 들어와서, 이미 쓴 카드를 아예 후보에서 지워버린다.
const COMBO_DEMO_BOARD: ComboCard[] = [
  { id: 'cbx0', shape: 1, color: 2, bg: 1 },
  { id: 'cbx1', shape: 0, color: 1, bg: 0 },
  { id: 'cbx2', shape: 0, color: 2, bg: 0 },
  { id: 'cbx3', shape: 2, color: 2, bg: 1 },
  { id: 'cbx4', shape: 1, color: 1, bg: 2 },
  { id: 'cbx5', shape: 0, color: 1, bg: 1 },
  { id: 'cbx6', shape: 0, color: 0, bg: 0 },
  { id: 'cbx7', shape: 1, color: 0, bg: 0 },
  { id: 'cbx8', shape: 1, color: 2, bg: 2 },
];
// 찾아가는 순서대로의 결합 넷. 아래 캡션과 순서가 같고, "찾은 결합" 줄에도 이 순서로 쌓인다.
const COMBO_DEMO_SETS: [number, number, number][] = [
  [3, 4, 6],
  [2, 3, 8],
  [0, 4, 7],
  [1, 2, 6],
];
// 카드마다 언제 선택 표시가 켜지는지가 다 달라서, 칸 번호로 클래스를 하나씩 짚어준다.
// 2·3·4·6번은 결합 두 개에 걸쳐 있어 선택 구간이 두 번이라 전용 클래스를 쓴다.
const COMBO_DEMO_MARK: string[] = [
  styles.demoCbx0,
  styles.demoCbx1,
  styles.demoCbx2,
  styles.demoCbx3,
  styles.demoCbx4,
  // 5번은 어느 결합에도 안 들어간다 — 한 바퀴 내내 아무 표시도 붙지 않는 게 맞다.
  '',
  styles.demoCbx6,
  styles.demoCbx7,
  styles.demoCbx8,
];
const COMBO_DEMO_CAPTIONS = [
  '모양·색·배경이 셋 다 달라요',
  '색이 셋 다 같아요',
  '모양이 셋 다 같아요',
  '모양·배경이 같고 색만 달라요 · 앞서 쓴 카드도 다시 써요',
];
// 실제 판처럼 한 칸씩 차례로 켜지는 걸 보여줘야 해서, 안전한 칸을 집합이 아니라 순서대로 들고 있는다.
const MAZE_DEMO_PATH = [0, 3, 4, 5, 8];
const MAZE_DEMO_STEP_S = 0.35;
const RX_DEMO_HIT: Record<number, string> = { 4: styles.demoRxHit1, 1: styles.demoRxHit2, 7: styles.demoRxHit3 };
// 두 번 탭해서 실제로 전부 꺼지는 것(=클리어)까지 보여준다.
// 점등 {0,4,5,7} → 가운데(4) 탭 → {0,1,3} → 좌상단(0) 탭 → 전부 꺼짐.
// 칸마다 "켜짐/꺼짐"이 세 단계로 어떻게 바뀌는지에 따라 A~C 세 패턴으로 나뉜다.
const LO_DEMO_CELL: Record<number, 'demoLoTap2' | 'demoLoB' | 'demoLoTap1' | 'demoLoC'> = {
  0: 'demoLoTap2', // 켜짐 → 켜짐 → 꺼짐 (두 번째 탭 위치)
  1: 'demoLoB', // 꺼짐 → 켜짐 → 꺼짐
  3: 'demoLoB',
  4: 'demoLoTap1', // 켜짐 → 꺼짐 → 꺼짐 (첫 번째 탭 위치)
  5: 'demoLoC',
  7: 'demoLoC',
};
// 1~9를 한 번씩 쓴 배치. 오른쪽엔 행 합, 아래엔 열 합이 붙는 실제 판과 같은 모양.
// 빈칸은 두 개(5와 4)를 두고 차례로 채운다 — 한 칸만 채우면 "골라서 → 눌러서 → 줄이 초록으로"라는
// 한 바퀴가 한 번밖에 안 돌아, 무엇이 무엇을 바꾼 건지 눈이 못 따라간다.
const CM_DEMO_CELLS = [1, 5, 9, 8, 2, 4, 3, 7, 6];
const CM_DEMO_BLANKS = [1, 5];
const CM_DEMO_ROW_SUMS = [15, 14, 16];
const CM_DEMO_COL_SUMS = [12, 14, 19];
// 처음부터 초록인 줄은 2개(3행·1열 — 이미 다 채워져 있다), 첫 칸을 채우면 4개, 둘째 칸까지 채우면 6개.
const CM_DEMO_COUNTS = [2, 4, 6];
// 각 칸이 몇 번째 단계에서 초록으로 굳는지. 0은 처음부터.
const CM_DEMO_CELL_STEP = [0, 1, 1, 0, 1, 2, 0, 0, 0];

// 실제 게임처럼 ①단어가 한 개씩 스쳐 지나가고 ②본 순서 그대로 선택지를 탭하는, 두 단계를 그대로 보여준다.
// 선택지는 정답 4개 + 오답 4개로 실제 첫 세트와 같은 수다.
const FLASH_DEMO_SEQ = ['모세', '다윗', '요셉', '룻'];
const FLASH_DEMO_CHOICES = ['만나', '요셉', '모세', '룻', '언약', '다윗', '광야', '한나'];

// 실제 화면과 같은 순서로 보여준다 — 목표 숫자 → 식이 쌓이는 칸 → 숫자 4개 → 연산자 → 확인.
// 큰 숫자 넷으로 작은 목표에 닿는 판이라, 예시도 나눗셈과 빼기를 쓰는 쪽으로 든다 —
// 여기서 곱셈만 늘어놓으면 실제 판에서 곱하기부터 눌러보다 한참 헤맨다.
const EQ_DEMO_NUMBERS = [18, 6, 5, 4];
const EQ_DEMO_TOKENS = ['18', '÷', '6', '×', '5', '-', '4'];
const EQ_DEMO_TARGET = 11;
// 정답이 4-7-1인 판. 한 줄씩 차례로 떠오르며 S/B를 어떻게 읽는지 보여준다.
const BB_DEMO_ROWS = [
  { digits: [1, 2, 3], result: '1B', note: '1은 있지만 자리가 달라요' },
  { digits: [4, 5, 6], result: '1S', note: '4는 자리까지 맞아요' },
  { digits: [4, 7, 1], result: '3S', note: '전부 맞았어요 · 다음 단계' },
];

function GameDemo({ type }: { type: LockType }) {
  switch (type) {
    case 'maze':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoMzGrid}>
            {Array.from({ length: 9 }).map((_, i) => {
              const step = MAZE_DEMO_PATH.indexOf(i);
              return (
                <div
                  key={i}
                  className={`${styles.demoMzCell} ${step >= 0 ? styles.demoMzSafe : ''}`}
                  style={step >= 0 ? { animationDelay: `${step * MAZE_DEMO_STEP_S}s` } : undefined}
                />
              );
            })}
            <span className={styles.demoMzFlag} />
            <span className={styles.demoMzDot} />
          </div>
        </div>
      );
    case 'lightsout':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoLoGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`${styles.demoLoCell} ${LO_DEMO_CELL[i] ? styles[LO_DEMO_CELL[i]] : ''}`} />
            ))}
          </div>
          <span className={styles.demoLoTag}>전부 꺼짐 · 클리어</span>
        </div>
      );
    case 'crossmath': {
      // 빈칸 고르기 → 숫자패드 누르기 → 그 줄이 초록으로 굳기, 를 두 번 돌린다.
      // 줄이 하나 완성될 때마다 아래 "맞춘 줄 n/6"도 같이 올라가서, 무엇을 세는 게임인지가 같이 읽힌다.
      const stepClass = [null, styles.demoCmOn1, styles.demoCmOn2];
      const targetStepClass = [null, styles.demoCmTgtOn1, styles.demoCmTgtOn2];
      // 행: 0번은 첫 칸을 채울 때, 1번은 둘째 칸을 채울 때, 2번은 처음부터 완성.
      const rowStep = [1, 2, 0];
      const colStep = [0, 1, 2];
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoCmGrid}>
            {Array.from({ length: 4 }).map((_, r) =>
              Array.from({ length: 4 }).map((_, c) => {
                const key = `${r}-${c}`;
                if (r < 3 && c < 3) {
                  const idx = r * 3 + c;
                  const blank = CM_DEMO_BLANKS.indexOf(idx);
                  const step = CM_DEMO_CELL_STEP[idx];
                  const done = step === 0 ? styles.demoCmDone : stepClass[step];
                  if (blank >= 0) {
                    // 빈칸은 고르기 표시와 초록 굳히기를 한 클래스에 묶어둔다(위 done은 안 쓴다).
                    return (
                      <div
                        key={key}
                        className={`${styles.demoCmCell} ${blank === 0 ? styles.demoCmBlank1 : styles.demoCmBlank2}`}
                      >
                        <span className={blank === 0 ? styles.demoCmQ1 : styles.demoCmQ2}>?</span>
                        <span className={blank === 0 ? styles.demoCmFill1 : styles.demoCmFill2}>
                          {CM_DEMO_CELLS[idx]}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className={`${styles.demoCmCell} ${done}`}>
                      {CM_DEMO_CELLS[idx]}
                    </div>
                  );
                }
                if (r < 3 && c === 3) {
                  const step = rowStep[r];
                  return (
                    <div
                      key={key}
                      className={`${styles.demoCmTarget} ${step === 0 ? styles.demoCmTgtDone : targetStepClass[step]}`}
                    >
                      {CM_DEMO_ROW_SUMS[r]}
                    </div>
                  );
                }
                if (r === 3 && c < 3) {
                  const step = colStep[c];
                  return (
                    <div
                      key={key}
                      className={`${styles.demoCmTarget} ${step === 0 ? styles.demoCmTgtDone : targetStepClass[step]}`}
                    >
                      {CM_DEMO_COL_SUMS[c]}
                    </div>
                  );
                }
                return <div key={key} />;
              }),
            )}
          </div>
          {/* 세 문장을 같은 칸에 겹쳐두고 켜고 끄기만 한다 — 글자 수가 달라도 높이가 흔들리지 않는다. */}
          <div className={styles.demoCmCountWrap}>
            {CM_DEMO_COUNTS.map((n, i) => (
              <span key={n} className={`${styles.demoCmCount} ${styles[`demoCmCount${i + 1}`]}`}>
                맞춘 줄 {n} / 6
              </span>
            ))}
          </div>
          {/* 실제 판과 같은 1~9 숫자패드. 이미 판에 올라간 숫자는 눌리지 않는다는 것까지 그대로 보여준다. */}
          <div className={styles.demoCmPad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              const blank = CM_DEMO_BLANKS.findIndex((idx) => CM_DEMO_CELLS[idx] === n);
              return (
                <div
                  key={n}
                  className={`${styles.demoCmKey} ${
                    blank === 0 ? styles.demoCmKeyTap1 : blank === 1 ? styles.demoCmKeyTap2 : styles.demoCmKeyUsed
                  }`}
                >
                  {n}
                </div>
              );
            })}
          </div>
          <span className={styles.demoCmTag}>여섯 줄 모두 초록 · 클리어</span>
        </div>
      );
    }
    case 'codebreak':
      // ▲+●=12, ■-▲=2 이면 ▲ 값을 몰라도 ●+■는 항상 14로 결정된다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoCbList}>
            <div className={styles.demoCbRow}>
              <ShapeIcon shape={1} size={20} />
              <span className={styles.demoCbOp}>+</span>
              <ShapeIcon shape={2} size={20} />
              <span className={styles.demoCbOp}>=</span>
              <span className={styles.demoCbNum}>12</span>
            </div>
            <div className={styles.demoCbRow}>
              <ShapeIcon shape={0} size={20} />
              <span className={styles.demoCbOp}>−</span>
              <ShapeIcon shape={1} size={20} />
              <span className={styles.demoCbOp}>=</span>
              <span className={styles.demoCbNum}>2</span>
            </div>
            <div className={`${styles.demoCbRow} ${styles.demoCbFinal}`}>
              <ShapeIcon shape={2} size={20} />
              <span className={styles.demoCbOp}>+</span>
              <ShapeIcon shape={0} size={20} />
              <span className={styles.demoCbOp}>=</span>
              <span className={styles.demoCbAnsWrap}>
                <span className={styles.demoCbQ}>?</span>
                <span className={styles.demoCbAns}>14</span>
              </span>
            </div>
          </div>
        </div>
      );
    case 'memory':
      // 실제 게임은 ①큰 글씨 한 장씩 스쳐 지나가기 ②선택지 판에서 본 순서대로 탭하기, 두 화면으로 나뉜다.
      // 두 단계를 같은 칸에 겹쳐두고 번갈아 켠다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoMemStage}>
            <div className={`${styles.demoMemPhase} ${styles.demoMemPhaseShow}`}>
              <span className={styles.demoMemStep}>① 한 개씩 스쳐 지나가요</span>
              <div className={styles.demoMemWordBox}>
                {FLASH_DEMO_SEQ.map((w, i) => (
                  <span key={w} className={`${styles.demoMemWord} ${styles[`demoMemWord${i + 1}`]}`}>
                    {w}
                  </span>
                ))}
              </div>
              <div className={styles.demoMemDots}>
                {FLASH_DEMO_SEQ.map((w, i) => (
                  <span key={w} className={`${styles.demoMemDot} ${styles[`demoMemDot${i + 1}`]}`} />
                ))}
              </div>
            </div>
            <div className={`${styles.demoMemPhase} ${styles.demoMemPhasePick}`}>
              <span className={styles.demoMemStep}>② 본 순서 그대로 탭해요</span>
              <div className={styles.demoMemGrid}>
                {FLASH_DEMO_CHOICES.map((w) => {
                  const order = FLASH_DEMO_SEQ.indexOf(w);
                  return (
                    <span
                      key={w}
                      className={`${styles.demoMemChip} ${order >= 0 ? styles[`demoMemPick${order + 1}`] : ''}`}
                    >
                      {w}
                    </span>
                  );
                })}
              </div>
              <span className={styles.demoMemTag}>{FLASH_DEMO_SEQ.length}개 모두 순서대로 · 다음 세트</span>
            </div>
          </div>
        </div>
      );
    case 'reflex':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoRxGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`${styles.demoRxCell} ${RX_DEMO_HIT[i] ?? ''}`} />
            ))}
          </div>
        </div>
      );
    case 'baseball':
      // 정답이 4-7-1일 때 세 번의 시도가 어떻게 읽히는지 그대로 보여준다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoBbList}>
            {BB_DEMO_ROWS.map((row, i) => (
              <div key={row.digits.join('')} className={`${styles.demoBbRow} ${styles[`demoBbRow${i + 1}`]}`}>
                <span className={styles.demoBbDigits}>
                  {row.digits.map((d, j) => (
                    <span key={j} className={styles.demoBbDigit}>
                      {d}
                    </span>
                  ))}
                </span>
                <span className={styles.demoBbResult}>{row.result}</span>
                <span className={styles.demoBbNote}>{row.note}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'combo':
      // 실제 판 그대로 아홉 장을 깔아두고, 그 위에서 결합 넷을 차례로 찾아 마지막에 "결"을 누른다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoCbxGrid}>
            {COMBO_DEMO_BOARD.map((card, i) => (
              <div key={card.id} className={`${styles.demoCbxCard} ${styles[`comboCardBg${card.bg}`]} ${COMBO_DEMO_MARK[i]}`}>
                <ComboShape card={card} size={22} />
              </div>
            ))}
          </div>
          {/* 다섯 문장을 같은 칸에 겹쳐두고 차례로 켠다. 판은 그대로 두고 설명만 갈아끼워야
              "같은 아홉 장에서 결합이 여러 개 나온다"가 그림으로 읽힌다. */}
          <div className={styles.demoCbxCapWrap}>
            {COMBO_DEMO_CAPTIONS.map((label, p) => (
              <span key={label} className={`${styles.demoCbxCap} ${styles[`demoCbxCap${p + 1}`]}`}>
                {label}
              </span>
            ))}
            <span className={`${styles.demoCbxCap} ${styles.demoCbxCap5}`}>
              남는 카드가 있어도 더 찾을 합이 없으면 다음 세트
            </span>
          </div>
          <span className={styles.demoCbxPassBtn}>결</span>
          {/* 찾은 결합은 판이 아니라 아래 줄에 쌓인다 — 실제 게임에서 "찾은 결합"이 놓이는 그 자리다.
              판 위에 초록 표시를 남겨두면 넷을 다 찾은 뒤 아홉 장이 통째로 초록이 되어,
              한 장씩 소모해가는 게임처럼 보인다. 아래 줄로 내려두면 같은 카드가 두 칸에 다시 나오는 것도
              그대로 보인다. */}
          <div className={styles.demoCbxFoundRow}>
            <span className={styles.demoCbxFoundLabel}>찾은 합</span>
            {COMBO_DEMO_SETS.map((triple, s) => (
              // 빈 칸 넷은 처음부터 놓여 있고 카드만 나중에 채워진다 — 몇 개를 찾아야 하는 판인지가
              // 첫 화면에서 바로 읽히고, 칸이 늘었다 줄었다 하며 아래를 밀지도 않는다.
              <span key={triple.join('')} className={styles.demoCbxFoundChip}>
                {triple.map((idx) => {
                  const card = COMBO_DEMO_BOARD[idx];
                  return (
                    <span
                      key={idx}
                      className={`${styles.demoCbxFoundSwatch} ${styles[`comboCardBg${card.bg}`]} ${
                        styles[`demoCbxFound${s + 1}`]
                      }`}
                    >
                      <ComboShape card={card} size={11} />
                    </span>
                  );
                })}
              </span>
            ))}
          </div>
        </div>
      );
    case 'equation':
      // 실제 화면과 같은 순서로 쌓는다 — 목표 숫자 → 식이 쌓이는 칸 → 숫자 4개 → 연산자 → 확인.
      // 쓴 숫자가 하나씩 흐려지는 것까지 그대로라, "전부 한 번씩만"이 글이 아니라 그림으로 읽힌다.
      return (
        <div className={styles.introDemo}>
          <span className={styles.demoEqTarget}>
            목표 숫자 <b>{EQ_DEMO_TARGET}</b>
          </span>
          <div className={styles.demoEqDisplay}>
            {EQ_DEMO_TOKENS.map((t, i) => (
              <span key={i} className={`${styles.demoEqTok} ${styles[`demoEqTok${i + 1}`]}`}>
                {t}
              </span>
            ))}
            <span className={styles.demoEqEq}>= {EQ_DEMO_TARGET}</span>
          </div>
          <div className={styles.demoEqNumRow}>
            {EQ_DEMO_NUMBERS.map((n, i) => (
              <span key={n} className={`${styles.demoEqNum} ${styles[`demoEqNum${i + 1}`]}`}>
                {n}
              </span>
            ))}
          </div>
          <div className={styles.demoEqOpRow}>
            {['+', '-', '×', '÷'].map((op) => (
              <span
                key={op}
                className={`${styles.demoEqOp} ${
                  op === '×' ? styles.demoEqOpMul : op === '+' ? styles.demoEqOpAdd : ''
                }`}
              >
                {op}
              </span>
            ))}
          </div>
          <span className={styles.demoEqConfirm}>확인</span>
        </div>
      );
    default:
      return null;
  }
}

// 시상대(높이가 다른 세 블록)는 자리를 크게 먹으면서 정작 읽어야 할 값 — 이름·시간·힌트 —
// 은 블록 위에 얹힌 잔글씨로 밀려났다. 게다가 기록이 한둘뿐이면 이 빠진 시상대가 된다.
// 순위는 결국 줄 세우기라, 한 줄에 한 명씩 놓는 목록이 짧고 정확하다.
// meId는 아직 등록 전(null)일 수 있다. 그때는 어느 줄과도 같지 않아 내 줄 강조만 빠진다.
function GameRanking({ gameId, meId }: { gameId: string; meId?: string | null }) {
  const [entries, setEntries] = useState<GameTimeEntry[]>([]);
  useEffect(() => {
    const unsub = subscribeGameLeaderboard(gameId, setEntries, () => {});
    return unsub;
  }, [gameId]);
  // 아직 아무 기록도 없으면 제목까지 통째로 감춘다. 제목만 남고 아래가 비면 고장난 화면처럼 보인다.
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div className={styles.sectionLabel}>이 게임 TOP {entries.length}</div>
      <ol className={styles.rankList}>
        {entries.map((entry, i) => (
          <li key={entry.id} className={`${styles.rankRow} ${entry.id === meId ? styles.rankRowMe : ''}`}>
            <span className={styles.rankNum}>{i + 1}</span>
            <span className={styles.rankNick}>{entry.nick}</span>
            {/* 순위를 가른 첫 잣대가 힌트 횟수라, 시간만 보여주면 왜 이 순서인지 알 수 없다. */}
            <span className={styles.rankHints}>힌트 {entry.hints}</span>
            <span className={styles.rankTime}>
              {isPreciseGame(gameId) ? formatPreciseElapsed(entry.elapsedMs) : formatElapsed(entry.elapsedMs)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const DAY_LABELS: Record<Day, string> = { 1: 'BREAK AWAY', 2: 'BREAK DOWN', 3: 'BREAK THROUGH' };
const DAY2_MISSIONS = LOCKS[2].items.filter((i) => i.type === 'mission');
const DAY2_MISSION_IDS = DAY2_MISSIONS.map((i) => i.id);
const ALL_LOCK_IDS = new Set(([1, 2, 3] as Day[]).flatMap((d) => LOCKS[d].items.map((i) => i.id)));

// 카메라로 스캔한 문자열에서 미션 id를 뽑아낸다. 전체 URL(?qr=d2a)이든 id만 담긴 문자열이든 둘 다 받아준다.
function parseQrText(text: string): string | null {
  let raw = text.trim();
  try {
    const url = new URL(raw);
    const q = url.searchParams.get('qr');
    if (q) raw = q;
  } catch {
    const m = raw.match(/[?&]qr=([a-zA-Z0-9_-]+)/);
    if (m) raw = m[1];
  }
  return ALL_LOCK_IDS.has(raw) ? raw : null;
}

// 알에서 떨어져 나온 껍질 조각. 크기도 변 수도 저마다 달라서, 같은 도장을 여섯 번 찍은 게
// 아니라 실제로 한 알이 깨져 나온 파편들로 보인다.
// cx·cy는 그 조각에 새길 글자가 앉을 자리다. 도형마다 무게중심이 달라서 상자 한가운데(12,12)에
// 두면 어떤 조각에서는 글자가 가장자리에 걸친다.
const SHARD_SHAPES = [
  { d: 'M12,1 L22,7 L19,18 L7,22 L2,12 Z', cx: 12.4, cy: 12 },
  { d: 'M3,5 L15,2 L22,11 L11,22 L2,15 Z', cx: 11, cy: 11.4 },
  { d: 'M6,2 L21,6 L22,17 L10,22 L2,13 Z', cx: 12.2, cy: 12 },
  { d: 'M2,10 L11,2 L22,9 L17,21 L6,19 Z', cx: 11.8, cy: 12.2 },
  { d: 'M10,1 L22,10 L12,23 L4,11 Z', cx: 12, cy: 11.6 },
  { d: 'M2,7 L14,3 L22,14 L13,20 L5,16 Z', cx: 11.4, cy: 12 },
];
// 조각에 새기는 글자의 실제 크기(px). 조각마다 크기가 달라서, 그림 좌표(24칸)로 환산해
// 어느 조각에 새기든 글자만은 같은 크기로 서게 한다 — 여섯 글자가 한 말이라 크기가 흔들리면 안 된다.
const SHARD_CHAR_PX = 15;

// 몇 번째 조각이고 어느 자리였는지는 aria-label과, 조각을 눌러 연 미션·기록 화면이 말해준다.
// 조각 옆에 번호를 붙여봤지만 그 숫자가 뜻하는 게 없었다 — 순서대로 찾는 것도 아니고
// 자리 이름도 아니어서 걷어냈다. 그 자리에 지금 들어가 있는 건 "초심을 찾아서" 여섯 글자다.
const SHARD_ORDINALS = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째', '여섯 번째'];

// 조각이 알 좌우에 세 개씩 자로 잰 듯 줄 서 있으면 깨진 껍질이 아니라 목록으로 보인다.
// 그래서 알 둘레 아무 데나 흩어 놓는다. x·y는 알 중심에서 떨어진 거리의 배수이고(실제 px는
// CSS의 --shard-x/--shard-y가 기기 폭에 맞춰 정한다), 기울기와 크기도 조각마다 어긋나게 둔다.
// 자리는 left/top으로 잡고 기울기는 아이콘에만 준다 — 조각이 튀어나오는 연출(shardFly)이
// transform을 쓰고 있어서, 자리까지 transform으로 잡으면 서로 덮어쓴다.
const SHARD_SCATTER = [
  { x: -1.12, y: -0.72, rot: -22, size: 46 },
  { x: 1.06, y: -0.86, rot: 27, size: 36 },
  { x: -1.26, y: 0.14, rot: 13, size: 34 },
  { x: 1.2, y: -0.04, rot: -31, size: 52 },
  { x: -0.92, y: 0.9, rot: 36, size: 40 },
  { x: 1.0, y: 0.82, rot: -11, size: 44 },
];

// QR을 찾으면 알에 금이 가고, 그 자리에서 껍질 조각 하나가 튀어나와 알 둘레에 흩어져 붙는다.
// 찾은 조각이 곧 기록의 손잡이라 목록을 따로 펼칠 일이 없다.
// 아직 못 찾은 조각은 자리조차 없다 — 빈 칸 여섯 개가 미리 서 있으면 "찾아냈다"가
// "칸을 채웠다"로 바뀌고, 남은 개수까지 세어 보여서 찾는 재미가 먼저 닳는다.
// 기록까지 남기면 조각에 불이 들어온다.
function EggStage({
  items,
  answers,
  opened,
  onWrite,
  onRead,
  children,
}: {
  items: LockItem[];
  answers: MissionAnswers;
  opened: Record<string, boolean>;
  onWrite: (item: LockItem) => void;
  onRead: (item: LockItem) => void;
  children: React.ReactNode;
}) {
  // 방금 찾은 조각 하나만 튀어나오는 걸 보여준다. 화면에 들어올 때마다 여섯 개가 전부
  // 다시 튀면 처음 온 사람과 다 찾은 사람이 같은 장면을 보게 된다.
  const foundIds = items.filter((i) => opened[i.id]).map((i) => i.id);
  const prevIds = useRef(foundIds);
  const [freshId, setFreshId] = useState<string | null>(null);
  useEffect(() => {
    const added = foundIds.find((id) => !prevIds.current.includes(id));
    prevIds.current = foundIds;
    if (!added) return;
    setFreshId(added);
    const t = setTimeout(() => setFreshId(null), 900);
    return () => clearTimeout(t);
    // foundIds는 매 렌더 새 배열이라 join한 값으로 비교한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundIds.join(',')]);

  // 여섯 조각을 다 찾으면 흩어져 있던 글자가 "초심을 찾아서" 한 말이 된다. 그때 여섯 글자에
  // 차례로 불이 들어와, 조각을 다 모았다는 걸 개수가 아니라 읽히는 말로 알린다.
  const allFound = items.every((i) => opened[i.id]);

  return (
    <div className={`${styles.eggStage} ${allFound ? styles.eggStageDone : ''}`}>
      <div className={styles.eggSlot}>{children}</div>
      {items.map((item, idx) => {
        // 못 찾은 조각은 아예 그리지 않는다. 자리만 비워두는 게 아니라 없는 것이다.
        if (!opened[item.id]) return null;
        const answered = Boolean(answers[item.id]);
        const scatter = SHARD_SCATTER[idx % SHARD_SCATTER.length];
        const shape = SHARD_SHAPES[idx % SHARD_SHAPES.length];
        const char = SHARD_WORD[idx % SHARD_WORD.length];
        return (
          <button
            key={item.id}
            className={[styles.shard, answered ? styles.shardOn : '', freshId === item.id ? styles.shardFly : '']
              .filter(Boolean)
              .join(' ')}
            style={
              {
                '--x': scatter.x,
                '--y': scatter.y,
                '--rot': `${scatter.rot}deg`,
                '--shard-size': `${scatter.size}px`,
                '--i': idx,
              } as React.CSSProperties
            }
            onClick={() => (answered ? onRead(item) : onWrite(item))}
            // 눈에는 조각 모양과 글자만 보이지만, 화면을 읽어주는 기기에는 어느 자리인지까지 말해준다.
            aria-label={`${SHARD_ORDINALS[idx]} 조각 ${char} · ${item.name} · ${answered ? '기록함' : '기록하기'}`}
          >
            <svg className={styles.shardIcon} viewBox="0 0 24 24">
              <path d={shape.d} />
              {/* 조각은 저마다 기울어 있지만 글자는 똑바로 서 있어야 읽힌다.
                  그래서 조각에 준 기울기를 글자에서만 제자리로 되돌린다(TimeDial의 링 글자와 같은 방식). */}
              <text className={styles.shardChar} x={shape.cx} y={shape.cy} fontSize={(SHARD_CHAR_PX * 24) / scatter.size}>
                {char}
              </text>
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export default function JourneyScreen() {
  const { state, selectDay, openLock, goScreen, setTab, logout } = useApp();
  // 날마다 담을 내용의 길이가 크게 다르다(DAY 1은 자물쇠 아홉 칸, DAY 2는 알·QR·기록까지).
  // 화면 높이에 맞춰 줄였다 키웠다 하면 날짜 탭만 눌러도 글씨 크기가 통째로 달라지므로,
  // 원래 크기로 두고 넘치는 만큼만 스크롤한다. 날짜를 바꾸면 맨 위에서 다시 시작한다.
  //
  // 남는 높이를 판이 나눠 갖게 해본 적이 있는데(가운데 정렬), 그날의 판이 각주에서 멀어져
  // 화면 한가운데에 떠 있는 것처럼 보였다. 판은 "며칠에 무엇을 하는 날"이라는 한 줄 바로
  // 아래에 붙어 있어야 그 날의 일로 읽힌다. 아래에 남는 여백은 그대로 둔다.
  useScrollFit(state.day);
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // 진행 중(아직 완료 전)인 자물쇠 id. X로 닫았다가 같은 자물쇠를 다시 열면
  // 처음부터 다시 만들지 않고 하던 판을 그대로 이어서 보여준다.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [restartMenuOpen, setRestartMenuOpen] = useState(false);
  const [answered, setAnswered] = useState<{ idx: number; correct: boolean } | null>(null);

  // 맞았을 때 판에 잠깐 붙는 표시. 게임마다 판은 달라도 붙이는 값은 하나뿐이라
  // 한 번에 한 게임만 열리는 이 화면에서는 이 하나로 아홉 게임을 다 덮는다.
  const [okFx, setOkFx] = useState(false);
  const okFxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 기억의 미로
  const [mazeStageIdx, setMazeStageIdx] = useState(0);
  const mazeStage = MAZE_STAGES[mazeStageIdx] ?? MAZE_STAGES[MAZE_STAGES.length - 1];
  // 길을 순서대로 켜고, 순서대로만 걷게 하려면 "안전한 칸의 집합"으로는 부족하다.
  // 집합만 보면 길이 자기 자신과 이웃하는 곳(ㄷ자·U자 구간)에서 순서를 건너뛰고 질러갈 수 있다.
  // 그래서 지나온 차례 그대로 들고 있고, 지금 몇 번째 칸에 서 있는지(mazeStep)를 함께 센다.
  const [mazeOrder, setMazeOrder] = useState<[number, number][]>([]);
  const [mazeStep, setMazeStep] = useState(0);
  const mazePos = mazeOrder[mazeStep] ?? [0, 0];
  // notice는 거꾸로 걷는 단계에 들어가기 전 한 번 세우는 확인 화면이다. 앞 단계와 판 크기가 같아서
  // 안내를 글줄로만 흘리면 그대로 앞 단계처럼 걷다가 첫 칸에서 벌시간을 먹는다.
  const [mazePhase, setMazePhase] = useState<'notice' | 'reveal' | 'move'>('reveal');
  const [mazeWrong, setMazeWrong] = useState(false);
  // 지금 켜져 있는 칸의 순번. null이면 아무 칸도 안 켜져 있다.
  const [mazeSeqIdx, setMazeSeqIdx] = useState<number | null>(null);
  const mazeSeqTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mazeRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 플래시 기억
  const [flashRoundIdx, setFlashRoundIdx] = useState(0);
  const [flashRound, setFlashRound] = useState<FlashRound | null>(null);
  const [flashPhase, setFlashPhase] = useState<'ready' | 'show' | 'choose'>('ready');
  const [flashProgress, setFlashProgress] = useState(0);
  const [flashWrong, setFlashWrong] = useState(false);
  // show 단계에서 지금 몇 번째 단어를 띄우는 중인지 + 단어 사이 빈 화면인지
  const [flashCursor, setFlashCursor] = useState(0);
  const [flashBlank, setFlashBlank] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 십자 연산
  const [cmRound, setCmRound] = useState<CrossMathRound | null>(null);
  const [cmValues, setCmValues] = useState<(number | null)[]>(new Array(9).fill(null));
  const [cmSelected, setCmSelected] = useState<number | null>(null);
  const [cmWrong, setCmWrong] = useState(false);
  const cmLines = cmRound
    ? crossMathLines(cmValues, cmRound)
    : { rows: [false, false, false] as [boolean, boolean, boolean], cols: [false, false, false] as [boolean, boolean, boolean] };

  // 시각 부호 해독. 힌트로 이미 내준 사실들은 cbHinted에 쌓인다.
  const [cbStageIdx, setCbStageIdx] = useState(0);
  const [cbRound, setCbRound] = useState<CodeBreakRound | null>(null);
  const [cbInput, setCbInput] = useState('');
  const [cbWrong, setCbWrong] = useState(false);

  // 숫자야구
  const [bbStageIdx, setBbStageIdx] = useState(0);
  const [bbSecret, setBbSecret] = useState<number[]>([]);
  // 자리마다 하나씩. 아직 안 채운 자리는 null이라, 가운데를 비워둔 채로도 판을 만들 수 있다.
  const [bbInput, setBbInput] = useState<(number | null)[]>([]);
  // 지금 고른 자리. 숫자패드와 힌트는 모두 이 자리에 대고 일한다.
  const [bbSel, setBbSel] = useState<number | null>(null);
  const [bbGuesses, setBbGuesses] = useState<BaseballGuess[]>([]);
  // 두 단계를 통틀어 몇 번 물어봤는지. 기록에 얹히는 값이라 단계가 넘어가도 이어서 센다
  // (단계별 기록판인 bbGuesses는 단계마다 비워진다).
  const [bbTries, setBbTries] = useState(0);
  // 스트라이크도 볼도 없는 수를 냈을 때 잠깐 켜진다.
  const [bbOut, setBbOut] = useState(false);
  // 힌트로 공개된 자리. 자리별 숫자(공개 안 된 자리는 null).
  const [bbRevealed, setBbRevealed] = useState<(number | null)[]>([]);

  // 순발력 타격
  const [reflexHits, setReflexHits] = useState(0);
  const [reflexActiveCell, setReflexActiveCell] = useState<number | null>(null);
  const [reflexMiss, setReflexMiss] = useState(false);
  // 방금 맞힌 칸. 꺼지는 순간 초록으로 한 번 물들었다 돌아간다.
  const [reflexHitCell, setReflexHitCell] = useState<number | null>(null);
  const reflexSpawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reflexClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reflexHitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [comboRounds, setComboRounds] = useState<ComboCard[][]>([]);
  const [comboRoundIdx, setComboRoundIdx] = useState(0);
  const [comboSelected, setComboSelected] = useState<number[]>([]);
  const [comboFound, setComboFound] = useState<[number, number, number][]>([]);
  const [comboWrong, setComboWrong] = useState(false);
  const [eqRound, setEqRound] = useState<EquationRound | null>(null);
  const [eqTokens, setEqTokens] = useState<EqToken[]>([]);
  const [eqNumUsed, setEqNumUsed] = useState<boolean[]>([]);
  const [eqStreak, setEqStreak] = useState(0);
  const [eqWrong, setEqWrong] = useState(false);
  const [loGrid, setLoGrid] = useState<boolean[][] | null>(null);
  const [loSize, setLoSize] = useState(5);
  const [loStageIdx, setLoStageIdx] = useState(0);
  // 아직 눌러야 하는 칸들. 누를 때마다 뒤집어 두면 언제 힌트를 눌러도 지금 시점의 정답이 나온다.
  const [loSolution, setLoSolution] = useState<boolean[][] | null>(null);

  // 힌트 — 이 판에서 몇 번 썼는지와, 게임마다 지금 화면에 띄워둔 힌트 표시.
  const [hintCount, setHintCount] = useState(0);
  const [cmHinted, setCmHinted] = useState<number[]>([]);
  const [cbHinted, setCbHinted] = useState<CbFact[]>([]);
  const [comboHintCards, setComboHintCards] = useState<number[]>([]);
  const [eqHintText, setEqHintText] = useState<string | null>(null);
  const [loHintCell, setLoHintCell] = useState<[number, number] | null>(null);
  // 마지막으로 끝낸 판에서 쓴 힌트 횟수. 완료 화면에 그대로 보여준다.
  const [lastHints, setLastHints] = useState(0);
  // 타임어택 게임의 누적 경과시간(ms) + 지금 보고 있는 세션이 시작된 시각.
  // 화면을 벗어나면 accumulatedBase에 지금까지의 시간을 더해두고 sessionStart를 비워 "정지"시킨다.
  const [accumulatedBase, setAccumulatedBase] = useState(0);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [lastElapsed, setLastElapsed] = useState<number | null>(null);
  const [lockGates, setLockGates] = useState<Record<string, LockGate>>({});
  const warnedLockFetch = useRef(false);
  const [missionAnswers, setMissionAnswers] = useState<MissionAnswers>({});
  const [answerDraft, setAnswerDraft] = useState('');
  // 알이 다 깨졌을 때 적는 "초심". 미션 기록과 같은 곳에 저장하지만 문항이 아니라 하루의
  // 마무리라, 적다 만 글이 미션 칸으로 새어 들어가지 않도록 초안을 따로 들고 있는다.
  const [firstLoveDraft, setFirstLoveDraft] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  // 등록할 때 적은 "나의 다짐"과 내 정보(복구 코드·로그아웃)를 꺼내 보는 시트.
  // 게임용 시트와 성격이 달라서 따로 연다.
  const [vowOpen, setVowOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [logoutArmed, setLogoutArmed] = useState(false);
  const qrHandled = useRef(false);
  // 세 걸음 중 마친 것. 이 화면은 앱이 켜질 때부터 계속 떠 있으므로(다른 화면으로 가도
  // 언마운트되지 않는다) 여정으로 돌아올 때마다 다시 읽어야 방금 마친 검사가 반영된다.
  const [stepsDone, setStepsDone] = useState({ type: false, share: false, proverb: false });
  useEffect(() => {
    if (!state.id || state.screen !== 'journey') return;
    setStepsDone({
      type: !!loadTypeSummary(state.id),
      share: hasShareDone(state.id),
      proverb: hasProverbWritten(state.id),
    });
  }, [state.id, state.screen]);

  // 방금 글자가 드러난 칸(0~8)과, 아홉 글자가 다 모인 순간의 단어 연출.
  // 자물쇠를 깬 그 순간에는 완료 시트가 화면을 덮고 있어서, 그 아래에서 글자가 떠오르는 걸
  // 아무도 보지 못한다. 그래서 어느 칸이 열렸는지만 적어두고(pendingLetter),
  // 시트를 닫아 여정 화면이 다시 드러나는 순간에 터뜨린다.
  const [letterFx, setLetterFx] = useState<number | null>(null);
  const [wordFx, setWordFx] = useState(false);
  const pendingLetter = useRef<number | null>(null);
  const prevDay1Open = useRef<string[] | null>(null);

  // 앞선 이틀을 다 깨기 전까지 DAY 3의 다이얼은 흐려져 있다.
  const dialSealed = FINAL_REQUIRED.some((k) => !state.opened[k]);
  // 흐림이 걷히는 연출. 글자 연출과 같은 이유로 "걷을 게 남았다"만 적어두고 나중에 재생한다.
  const [dialFx, setDialFx] = useState(false);
  const pendingDial = useRef(false);

  // 시트를 닫으면 로그아웃 확인 단계도 처음으로 되돌린다(다음에 열었을 때 확인 문구가 떠 있지 않도록).
  const closeVow = () => {
    setVowOpen(false);
    setLogoutArmed(false);
    setCodeCopied(false);
  };

  const copyCode = async () => {
    if (!state.id) return;
    try {
      await navigator.clipboard.writeText(state.id);
      setCodeCopied(true);
      toast('복구 코드를 복사했어요');
    } catch {
      toast('복사가 안 됐어요. 코드를 직접 적어두세요');
    }
  };

  // 시트는 화면 위에 덮개로 그려지므로, 닫지 않고 로그아웃하면 등록 화면 위에 그대로 떠 있는다.
  const handleLogout = () => {
    closeVow();
    logout();
  };

  // QR 미션에 남긴 답변은 기기가 바뀌어도 볼 수 있도록 DB에서 불러온다.
  useEffect(() => {
    if (!state.id) return;
    loadMissionAnswers(state.id)
      .then((data) => {
        if (data) setMissionAnswers(data);
      })
      .catch(() => {});
  }, [state.id]);

  // 어느 자물쇠가 새로 열렸는지만 적어둔다. 터뜨리는 건 아래 효과가 맡는다.
  // 게임·퀴즈·QR 어느 길로 열리든 결국 state.opened가 늘어나므로 여기 한 곳만 보면 된다.
  const day1OpenKey = DAY1_IDS.filter((id) => state.opened[id]).join(',');
  useEffect(() => {
    const openIds = day1OpenKey ? day1OpenKey.split(',') : [];
    const prev = prevDay1Open.current;
    prevDay1Open.current = openIds;
    // 첫 렌더에 이미 열려 있던 것들은 방금 깬 게 아니다(앱을 다시 켤 때마다 아홉 번 터지지 않도록).
    if (prev === null) return;
    const added = openIds.find((id) => !prev.includes(id));
    if (added) pendingLetter.current = DAY1_IDS.indexOf(added);
  }, [day1OpenKey]);

  // 시트가 닫혀 여정 화면이 실제로 보이는 순간에만 터뜨린다.
  // 아홉 글자가 다 모였으면 글자 하나짜리 연출이 지나간 뒤에 단어 완성이 이어진다.
  useEffect(() => {
    if (sheet !== null || state.day !== 1) return;
    const idx = pendingLetter.current;
    if (idx === null) return;
    pendingLetter.current = null;
    const complete = DAY1_IDS.every((id) => state.opened[id]);
    setLetterFx(idx);
    letterChime();
    const timers = [setTimeout(() => setLetterFx(null), LETTER_FX_MS)];
    if (complete) {
      timers.push(
        setTimeout(() => {
          setWordFx(true);
          wordChime();
          toast('BACKTOGOD · 아홉 글자를 모두 되찾았어요');
        }, WORD_FX_DELAY_MS),
      );
      timers.push(setTimeout(() => setWordFx(false), WORD_FX_DELAY_MS + WORD_FX_MS));
    }
    // 연출 도중에 다시 시트를 열거나 날짜를 바꾸면(=이 효과의 조건이 깨지면) 거기서 끊고 표시도 걷는다.
    return () => {
      timers.forEach(clearTimeout);
      setLetterFx(null);
      setWordFx(false);
    };
    // state.opened·toast는 이 효과를 다시 돌릴 이유가 없다. 다시 돌면 진행 중인 연출이 끊긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, state.day]);

  // 마지막 자물쇠는 대개 DAY 1이나 DAY 2에서 깨진다. 그 자리에서 흐림을 걷어봐야 아무도 못 보므로
  // 걷을 일이 남았다는 것만 적어둔다. 한 번 보고 나면 다시는 재생하지 않도록 기기에 표시해 둔다.
  useEffect(() => {
    if (!state.id || dialSealed || hasDialRevealed(state.id)) return;
    pendingDial.current = true;
  }, [state.id, dialSealed]);

  // DAY 3을 열어 다이얼이 실제로 눈앞에 놓인 순간에만 초점이 돌아온다.
  // 여정 화면이 떠 있는지까지 보는 건, 이 화면이 앱 내내 살아 있어서 다른 화면(순위판·검사)을
  // 보는 동안에도 조건이 맞아버리기 때문이다. 그러면 아무도 못 보는 사이에 한 번뿐인 장면이 지나간다.
  useEffect(() => {
    if (state.screen !== 'journey' || sheet !== null || state.day !== 3 || !state.id || !pendingDial.current) return;
    pendingDial.current = false;
    markDialRevealed(state.id);
    setDialFx(true);
    wordChime();
    const t = setTimeout(() => setDialFx(false), DIAL_FX_MS);
    return () => {
      clearTimeout(t);
      setDialFx(false);
    };
  }, [sheet, state.day, state.id, state.screen]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (mazeRevealTimer.current) clearTimeout(mazeRevealTimer.current);
      if (mazeSeqTimer.current) clearInterval(mazeSeqTimer.current);
      if (reflexSpawnTimer.current) clearTimeout(reflexSpawnTimer.current);
      if (reflexClearTimer.current) clearTimeout(reflexClearTimer.current);
    };
  }, []);

  // 관리자가 시트(locks)에 적어둔 unlock_at 시각·locked 여부를 주기적으로 확인해
  // 시간이 되면 자동으로 풀리도록 한다. 화면이 보일 때만 폴링한다.
  // 자물쇠 하나뿐 아니라 DAY 탭 전체·DAY 2 각 코너도 같은 시트에서 잠근다.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      fetchLockGates()
        .then((gates) => {
          if (!cancelled) setLockGates(gates);
        })
        // 1분마다 도는 폴링이라 참가자에게 토스트를 띄우면 화면을 계속 가린다.
        // 다만 조용히 삼키면 잠금이 통째로 안 걸린 걸 아무도 모르므로 콘솔에는 한 번 남긴다.
        .catch((err) => {
          if (!warnedLockFetch.current) {
            warnedLockFetch.current = true;
            console.warn('[locks] 자물쇠 설정을 불러오지 못했어요 — 모든 칸이 열린 상태로 동작합니다.', err);
          }
        });
    };
    load();
    const interval = setInterval(load, 60000);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  // 타임어택형 게임(9개 미니게임 전부)이 열려있는 동안만 시계를 째깍인다.
  // 1/100초까지 보여주는 순발력 타격은 눈에 보이게 굴러가도록 촘촘히 갱신한다.
  // (requestAnimationFrame은 화면이 가려지면 아예 멈춰서 저장까지 같이 끊기므로 쓰지 않는다.)
  // 로컬에 흘려쓰는 건 어느 쪽이든 0.5초에 한 번 — 앱을 그냥 꺼버려도 직전 지점까지는 남는다.
  useEffect(() => {
    if (!isTimedSheet(sheet) || sessionStart === null) return;
    const itemId = sheet.item.id;
    const base = accumulatedBase;
    const start = sessionStart;
    let lastFlush = 0;

    const id = setInterval(
      () => {
        const now = Date.now();
        setNowTick(now);
        if (now - lastFlush >= TIMER_FLUSH_MS) {
          lastFlush = now;
          setAccumulatedMs(itemId, base + (now - start));
        }
      },
      isPreciseGame(sheet.item.type) ? PRECISE_TICK_MS : TIMER_FLUSH_MS,
    );
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, sessionStart, accumulatedBase]);

  // 시트가 바뀌면(다른 게임, 완료, 닫기) 열려있던 재시작 메뉴는 닫는다.
  useEffect(() => {
    setRestartMenuOpen(false);
  }, [sheet]);

  // 시계는 "지금 손을 쓸 수 있는 동안"에만 흐른다.
  // 길을 보여주는 중, 단어가 스쳐가는 중, 준비 화면, 재시작 메뉴를 열어둔 동안은
  // 눈으로 보고만 있을 뿐 아무것도 할 수 없으니 그동안은 세워둔다.
  const canPlayNow = (() => {
    if (!isTimedSheet(sheet)) return false;
    if (restartMenuOpen) return false;
    if (sheet.kind === 'memory') return flashPhase === 'choose';
    if (sheet.kind === 'maze') return mazePhase === 'move';
    return true;
  })();

  // 시계를 돌리고 세우는 곳은 여기 한 군데뿐이다. 게임 로직 여기저기서 따로 부르지 않는다.
  useEffect(() => {
    if (!isTimedSheet(sheet)) return;
    if (canPlayNow && sessionStart === null) resumeTimer();
    else if (!canPlayNow && sessionStart !== null) pauseTimer(sheet.item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPlayNow, sheet, sessionStart]);

  // 십자 연산은 마지막 칸이 숫자패드로도, 힌트로도 채워질 수 있다.
  // 어느 쪽으로 채워졌든 여기 한 자리에서만 완성을 확인한다.
  useEffect(() => {
    if (sheet?.kind !== 'crossmath' || !cmRound) return;
    if (!checkCrossMath(cmValues, cmRound)) return;
    flashOk();
    const timer = setTimeout(() => finishTimedGame(sheet.item), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmValues, cmRound, sheet]);

  // 순발력 타격 시트를 벗어나면 다음 타깃 예약을 멈춘다.
  useEffect(() => {
    if (sheet?.kind === 'reflex') return;
    if (reflexSpawnTimer.current) clearTimeout(reflexSpawnTimer.current);
    if (reflexClearTimer.current) clearTimeout(reflexClearTimer.current);
    setReflexActiveCell(null);
  }, [sheet]);

  const dayData = LOCKS[state.day];

  // 시트에 적힌 잠금 상태를 읽는다. locked=TRUE면 시각과 무관하게 잠겨 있고,
  // unlock_at이 아직 안 지났으면 그 시각까지 잠겨 있다. 둘 다 없으면 열려 있다.
  const gateOf = (id: string): { locked: boolean; at?: string } => {
    const g = lockGates[id];
    if (!g) return { locked: false };
    if (g.locked) return { locked: true };
    if (g.unlockAt && new Date(g.unlockAt).getTime() > Date.now()) return { locked: true, at: g.unlockAt };
    return { locked: false };
  };

  // 하루가 통째로 잠겨 있으면 그 안의 것도 전부 잠긴 것으로 본다.
  const dayGate = (day: Day) => gateOf(DAY_GATES[day].id);
  const sectionGate = (gate: GateMeta) => {
    const d = dayGate(state.day);
    return d.locked ? d : gateOf(gate.id);
  };

  /** 잠긴 칸을 눌렀을 때: 열리는 시각을 알거나, 모르면 그냥 잠겼다고 알린다. */
  const toastGate = (g: { at?: string }) => toast(g.at ? `${formatKST(g.at)}에 열려요` : '아직 열리지 않았어요');

  // 자물쇠 하나에 걸린 잠금은 바깥부터 안쪽 순으로 본다: 그 날 전체 → 속한 코너 → 자물쇠 자신.
  // QR로 다른 날의 자물쇠를 바로 열 수도 있으므로, 지금 보고 있는 날이 아니라 그 자물쇠가 속한 날로 판단한다.
  const itemGate = (item: LockItem): { locked: boolean; at?: string } => {
    const day = ITEM_DAY[item.id] ?? state.day;
    const d = dayGate(day);
    if (d.locked) return d;
    // DAY 2의 QR 미션은 'QR 스캔' 코너에 속해 있어서, 그 코너를 잠그면 QR 링크로도 못 연다.
    if (day === 2 && item.type === 'mission') {
      const s = gateOf(SECTION_GATES.d2Qr.id);
      if (s.locked) return s;
    }
    return gateOf(item.id);
  };


  const handleLockClick = (item: LockItem) => {
    const isOpen = !!state.opened[item.id];
    // 시간 잠금은 자물쇠 종류를 가리지 않고 가장 먼저 본다(최후의 자물쇠도 시각을 정해둘 수 있게).
    const gate = itemGate(item);
    if (!isOpen && gate.locked) {
      toastGate(gate);
      return;
    }
    if (item.type === 'final') {
      // 앞선 이틀을 다 깨지 못했으면 화면을 하나 더 띄우지 않는다. 다이얼은 이미 흐릿하게
      // 잠겨 있는 게 보이고, 여기서 알려줄 건 "얼마나 남았는가" 한 줄뿐이라 토스트로 족하다.
      const done = FINAL_REQUIRED.filter((k) => state.opened[k]).length;
      if (done < FINAL_REQUIRED.length) {
        toast(`${done} / ${FINAL_REQUIRED.length}개를 깼어요. 아직 부족합니다.`);
      } else {
        goScreen('decide');
        setSheet(null);
      }
      return;
    }
    if (item.type === 'locked-until') {
      toast('저녁 집회 시간에 열려요');
      return;
    }
    if (isOpen) {
      setLastElapsed(null);
      setSheet({ kind: 'reveal', item });
      return;
    }
    if (activeItemId === item.id) {
      // 이미 진행 중인 판이 있으면 초기화하지 않고 그대로 이어서 보여준다.
      // 시계는 canPlayNow 효과가 알아서 다시 돌려주므로 "나가있던 동안"은 시간에서 빠진다.
      const kind = item.type === 'quiz' ? 'quiz' : item.type === 'mission' ? 'mission' : (item.type as SheetState['kind']);
      setSheet({ kind, item } as SheetState);
      return;
    }
    if (GAME_INTRO[item.type]) {
      setSheet({ kind: 'intro', item });
      return;
    }
    startGame(item);
  };

  // 지금까지 흐른 만큼을 누적값에 붙여넣고 시계를 세운다. 화면을 벗어날 때도,
  // 플래시 기억처럼 라운드 사이에 잠깐 멈춰야 할 때도 같은 길로 지나간다.
  const pauseTimer = (itemId: string) => {
    if (sessionStart === null) return;
    const total = accumulatedBase + (Date.now() - sessionStart);
    setAccumulatedBase(total);
    setAccumulatedMs(itemId, total);
    setSessionStart(null);
  };

  // 화면을 벗어날 때(X, 배경 탭) 시계를 세운다.
  const closeSheet = () => {
    if (isTimedSheet(sheet)) pauseTimer(sheet.item.id);
    setSheet(null);
  };

  // 누적 기준시간만 잡아두고 시계는 멈춰 둔다. 실제로 돌리고 세우는 건 아래 canPlayNow 효과가 맡는다.
  // 지난번에 멈춰둔 누적시간부터 이어서 흐른다(판을 깨고 나면 0으로 돌아간다).
  const prepareTimedGame = (item: LockItem) => {
    setAccumulatedBase(getAccumulatedMs(item.id));
    setSessionStart(null);
    setNowTick(Date.now());
  };

  // 멈춰 있던 시계를 다시 돌린다. 누적값은 건드리지 않는다.
  const resumeTimer = () => {
    const now = Date.now();
    setSessionStart(now);
    setNowTick(now);
  };

  // 경과시간에 벌시간을 얹는다. 시계가 도는 중이면 시작시각을 앞당기고, 멈춰 있으면 누적값에 바로 더한다.
  const addTimePenalty = (ms: number) => {
    if (sessionStart !== null) setSessionStart((s) => (s !== null ? s - ms : s));
    else setAccumulatedBase((b) => b + ms);
  };

  // 틀렸을 때 지나가는 한 자리. 판을 되돌리는 게임이든 그대로 두는 게임이든,
  // 벌시간과 알림 문구는 여기서만 붙는다 — 게임마다 따로 적어두면 값이 갈라진다.
  const penalizeWrong = (message: string, ms: number = WRONG_PENALTY_MS) => {
    addTimePenalty(ms);
    toast(`${message} + ${ms / 1000}초`);
  };

  // 맞았을 때 지나가는 한 자리. 벌시간처럼 게임마다 흩어놓지 않고 여기 하나로 모은다.
  //
  // 클래스를 한 번 떼었다가 다음 그림에서 붙이는 이유 — 이미 붙어 있는 클래스에는 애니메이션이
  // 다시 걸리지 않는다. 연달아 맞히는 게임(결합 찾기·플래시 기억)에서 두 번째부터 아무 표시도
  // 안 나는 걸 막으려면, 붙은 것을 떼는 그림이 사이에 한 번 들어가야 한다.
  const flashOk = () => {
    if (okFxTimer.current) clearTimeout(okFxTimer.current);
    setOkFx(false);
    requestAnimationFrame(() => {
      setOkFx(true);
      okFxTimer.current = setTimeout(() => setOkFx(false), OK_FX_MS);
    });
  };

  // 몇 번을 다시 깨든 전부 순위에 보낸다. 사람마다 문서가 하나라, 더 좋은 기록일 때만 덮어써져
  // 순위판에는 본인 최고 기록 하나만 남는다 — 한 사람이 1·2·3등을 다 차지할 수 없다.
  // 순위는 힌트 횟수가 먼저, 같은 횟수끼리 시간으로 가린다 — 힌트를 아예 안 쓰고 가장 빨랐던 사람이 1등.
  // extraMs는 마지막 한 수와 함께 얹히는 값이다(숫자야구의 시도 삯). 그 자리에서 addTimePenalty로
  // 얹으면 상태가 고쳐지는 건 다음 그림부터라, 같은 그림에서 계산하는 여기까지는 닿지 않는다.
  const finishTimedGame = (item: LockItem, extraMs = 0) => {
    const base = sessionStart !== null ? accumulatedBase + (Date.now() - sessionStart) : accumulatedBase;
    const elapsed = base + extraMs;
    openLock(item.id);
    if (state.id)
      saveGameTime(item.type, state.id, state.nickname || state.nick, elapsed, hintCount).catch((e) =>
        console.error('saveGameTime failed', e),
      );
    setAccumulatedMs(item.id, 0);
    setSessionStart(null);
    setLastElapsed(elapsed);
    setLastHints(hintCount);
    setSheet({ kind: 'reveal', item });
  };

  const clearMazeTimers = () => {
    if (mazeSeqTimer.current) clearInterval(mazeSeqTimer.current);
    if (mazeRevealTimer.current) clearTimeout(mazeRevealTimer.current);
    mazeSeqTimer.current = null;
    mazeRevealTimer.current = null;
  };

  // 시작 칸부터 한 칸씩 차례로 켜고 끈다. onDone은 마지막 칸이 꺼진 뒤에 부른다.
  const runMazeSequence = (path: [number, number][], stage: MazeStage, onDone: () => void) => {
    clearMazeTimers();
    setMazeSeqIdx(0);
    let i = 0;
    mazeSeqTimer.current = setInterval(() => {
      i += 1;
      if (i >= path.length) {
        clearMazeTimers();
        setMazeSeqIdx(null);
        mazeRevealTimer.current = setTimeout(onDone, stage.tailMs);
        return;
      }
      setMazeSeqIdx(i);
    }, stage.stepMs);
  };

  const beginMazeRound = (stageIdx: number) => {
    const stage = MAZE_STAGES[stageIdx] ?? MAZE_STAGES[MAZE_STAGES.length - 1];
    const path = generateMazePath(stageIdx);
    setMazeOrder(path);
    // 거꾸로 걷는 단계는 길을 본 순서와 반대로, 끝 칸에서 출발한다.
    setMazeStep(stage.reverse ? path.length - 1 : 0);
    // 거꾸로 걷는 단계는 곧바로 길을 켜지 않는다. 무엇이 달라지는지 읽고 스스로 시작하게 한다 —
    // 이때 시계는 멈춰 있다(canPlayNow는 걷는 동안에만 흐른다).
    if (stage.reverse) {
      clearMazeTimers();
      setMazePhase('notice');
      return;
    }
    setMazePhase('reveal');
    runMazeSequence(path, stage, () => setMazePhase('move'));
  };

  // 확인 화면에서 "준비됐어요"를 눌렀을 때. 이미 뽑아둔 길을 그대로 켠다(새 길을 뽑지 않는다).
  const startMazeReveal = () => {
    setMazePhase('reveal');
    runMazeSequence(mazeOrder, mazeStage, () => setMazePhase('move'));
  };

  // 길에서 벗어나도 판을 새로 깔지 않는다. 새 길을 다시 외우게 하면 한 번의 실수로 여태 외운 것이
  // 통째로 무의미해져서, 틀린 순간 게임을 놓아버리게 된다. 시간만 물리고 서 있던 칸에 그대로 세워둔다.
  const mazeFail = () => {
    penalizeWrong('길에서 벗어났어요');
    setMazeWrong(true);
    setTimeout(() => setMazeWrong(false), 500);
  };

  const scheduleReflexSpawn = () => {
    if (reflexSpawnTimer.current) clearTimeout(reflexSpawnTimer.current);
    reflexSpawnTimer.current = setTimeout(() => spawnReflexTarget(), REFLEX_GAP_MS);
  };

  const spawnReflexTarget = () => {
    setReflexActiveCell((prev) => {
      let next = Math.floor(Math.random() * REFLEX_GRID);
      let tries = 0;
      while (next === prev && tries < 5) {
        next = Math.floor(Math.random() * REFLEX_GRID);
        tries++;
      }
      return next;
    });
    if (reflexClearTimer.current) clearTimeout(reflexClearTimer.current);
    reflexClearTimer.current = setTimeout(() => {
      setReflexActiveCell(null);
      scheduleReflexSpawn();
    }, REFLEX_ON_MS);
  };

  // 게임마다 화면에 띄워둔 힌트 표시만 지운다. 이 판에서 힌트를 썼다는 사실(hintCount)은 남는다.
  const clearHintMarks = () => {
    setCmHinted([]);
    setCbHinted([]);
    setComboHintCards([]);
    setEqHintText(null);
    setLoHintCell(null);
    setBbRevealed([]);
  };

  const startGame = (item: LockItem) => {
    setActiveItemId(item.id);
    setAnswered(null);
    setLastElapsed(null);
    setHintCount(0);
    clearHintMarks();
    if (item.type === 'crossmath') {
      prepareTimedGame(item);
      setCmRound(generateCrossMathRound());
      setCmValues(new Array(9).fill(null));
      setCmSelected(null);
      setCmWrong(false);
      setSheet({ kind: 'crossmath', item });
      return;
    }
    if (item.type === 'codebreak') {
      prepareTimedGame(item);
      setCbStageIdx(0);
      setCbRound(generateCodeBreakRound(0));
      setCbInput('');
      setCbWrong(false);
      setSheet({ kind: 'codebreak', item });
      return;
    }
    if (item.type === 'baseball') {
      prepareTimedGame(item);
      setBbStageIdx(0);
      setBbSecret(generateBaseballSecret(0));
      setBbInput(new Array(BASEBALL_STAGES[0].digits).fill(null));
      setBbSel(0);
      setBbGuesses([]);
      setBbTries(0);
      setSheet({ kind: 'baseball', item });
      return;
    }
    if (item.type === 'reflex') {
      prepareTimedGame(item);
      setReflexHits(0);
      setReflexActiveCell(null);
      setReflexMiss(false);
      setSheet({ kind: 'reflex', item });
      scheduleReflexSpawn();
      return;
    }
    if (item.type === 'memory') {
      // 시계는 '시작'을 눌러 플래시가 뜨는 순간(beginFlashShow)부터 돈다. 여기서는 누적값만 잡아두고 멈춰 둔다.
      prepareTimedGame(item);
      setFlashRoundIdx(0);
      setFlashRound(generateFlashRound(FLASH_ROUNDS[0]));
      setFlashPhase('ready');
      setFlashProgress(0);
      setFlashWrong(false);
      setSheet({ kind: 'memory', item });
      return;
    }
    if (item.type === 'maze') {
      prepareTimedGame(item);
      setMazeStageIdx(0);
      beginMazeRound(0);
      setSheet({ kind: 'maze', item });
      return;
    }
    if (item.type === 'combo') {
      prepareTimedGame(item);
      setComboRounds(generateComboRounds(COMBO_ROUNDS));
      setComboRoundIdx(0);
      setComboSelected([]);
      setComboFound([]);
      setComboWrong(false);
      setSheet({ kind: 'combo', item });
      return;
    }
    if (item.type === 'equation') {
      prepareTimedGame(item);
      setEqStreak(0);
      const round = generateEquationRound(0);
      setEqRound(round);
      setEqTokens([]);
      setEqNumUsed(new Array(round.numbers.length).fill(false));
      setEqWrong(false);
      setSheet({ kind: 'equation', item });
      return;
    }
    if (item.type === 'lightsout') {
      prepareTimedGame(item);
      setLoStageIdx(0);
      const round = generateLightsOut(LO_STAGES[0]);
      setLoGrid(round.initial);
      setLoSolution(round.solution);
      setLoSize(round.size);
      setSheet({ kind: 'lightsout', item });
      return;
    }
    setAnswerDraft('');
    setSheet({ kind: item.type === 'quiz' ? 'quiz' : 'mission', item });
  };

  const clearGameTimers = () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    clearMazeTimers();
    if (reflexSpawnTimer.current) clearTimeout(reflexSpawnTimer.current);
    if (reflexClearTimer.current) clearTimeout(reflexClearTimer.current);
    if (reflexHitTimer.current) clearTimeout(reflexHitTimer.current);
    if (okFxTimer.current) clearTimeout(okFxTimer.current);
    setOkFx(false);
    setReflexHitCell(null);
  };

  // 지금 보고 있는 단계만 새 문제로 다시 깐다. 진행한 단계 수도, 경과시간도 그대로 둔다 —
  // 여기서 시간까지 0으로 돌려주면 마지막 단계에서 눌러 기록을 마음대로 만들 수 있게 된다.
  const restartRound = (item: LockItem) => {
    clearGameTimers();
    setLastElapsed(null);
    // 새 판에는 지난 판의 힌트 표시가 남으면 안 된다. 힌트를 썼다는 사실은 그대로 두고 표시만 지운다.
    clearHintMarks();

    switch (item.type) {
      case 'crossmath':
        setCmRound(generateCrossMathRound());
        setCmValues(new Array(9).fill(null));
        setCmSelected(null);
        setCmWrong(false);
        break;
      case 'codebreak':
        setCbRound(generateCodeBreakRound(cbStageIdx));
        setCbInput('');
        setCbWrong(false);
        break;
      case 'baseball':
        setBbSecret(generateBaseballSecret(bbStageIdx));
        setBbInput(new Array(bbDigits).fill(null));
        setBbSel(0);
        setBbGuesses([]);
        // 시도 수는 되돌리지 않는다. 이미 얹힌 시간을 그대로 두는 것과 같은 이유다 —
        // 여기서 0으로 돌려주면 판을 다시 깔아 시도 수를 지우고 기록만 챙길 수 있다.
        break;
      case 'reflex':
        setReflexHits(0);
        setReflexActiveCell(null);
        setReflexMiss(false);
        scheduleReflexSpawn();
        break;
      case 'memory':
        setFlashRound(generateFlashRound(FLASH_ROUNDS[flashRoundIdx]));
        setFlashPhase('ready');
        setFlashProgress(0);
        setFlashWrong(false);
        break;
      case 'maze':
        beginMazeRound(mazeStageIdx);
        break;
      case 'combo': {
        // 지금 세트의 보드만 새로 뽑고, 앞뒤 세트와 세트 번호는 그대로 둔다.
        const fresh = generateComboRounds(1)[0];
        setComboRounds((prev) => prev.map((board, i) => (i === comboRoundIdx ? fresh : board)));
        setComboSelected([]);
        setComboFound([]);
        setComboWrong(false);
        break;
      }
      case 'equation': {
        // 지금 문제만 새로 낸다. 여태 쌓은 연속 성공 수는 유지되므로 난이도도 그 자리 그대로다.
        const round = generateEquationRound(eqStreak);
        setEqRound(round);
        setEqTokens([]);
        setEqNumUsed(new Array(round.numbers.length).fill(false));
        setEqWrong(false);
        break;
      }
      case 'lightsout': {
        const round = generateLightsOut(LO_STAGES[loStageIdx]);
        setLoGrid(round.initial);
        setLoSolution(round.solution);
        setLoSize(round.size);
        break;
      }
    }
  };

  // 판을 통째로 버리고 게임 설명 화면으로 되돌아간다. "게임 시작"을 다시 눌러야 새 판이 깔리고,
  // 진행도를 전부 반납하는 대신 경과시간도 0으로 돌아간다.
  const restartAll = (item: LockItem) => {
    clearGameTimers();
    clearHintMarks();
    setAccumulatedMs(item.id, 0);
    setAccumulatedBase(0);
    setNowTick(Date.now());
    setSessionStart(null);
    setLastElapsed(null);
    setHintCount(0);
    // 하던 판은 버린다 — 설명 화면을 닫았다가 자물쇠를 다시 눌러도 옛 판이 되살아나지 않도록.
    setActiveItemId(null);
    if (GAME_INTRO[item.type]) {
      setSheet({ kind: 'intro', item });
      return;
    }
    startGame(item);
  };


  // id로 해당 자물쇠를 찾아 그 자리에서 바로 연다. URL의 ?qr= 파라미터와 인앱 카메라 스캐너가 함께 쓴다.
  const openMissionById = (qrId: string) => {
    let target: { day: Day; item: LockItem } | null = null;
    for (const d of [1, 2, 3] as Day[]) {
      const found = LOCKS[d].items.find((it) => it.id === qrId);
      if (found) {
        target = { day: d, item: found };
        break;
      }
    }
    if (!target) return;
    selectDay(target.day);
    setTab('journey');
    handleLockClick(target.item);
  };

  // 현장 곳곳에 붙여둔 QR(예: ?qr=d2a)을 스캔하면 로그인된 사용자를 해당 자물쇠로 바로 데려간다.
  useEffect(() => {
    if (qrHandled.current || !state.id) return;
    const qrId = new URLSearchParams(window.location.search).get('qr');
    if (!qrId) return;
    qrHandled.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    openMissionById(qrId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.id]);

  const handleScanDetect = (id: string) => {
    setScannerOpen(false);
    openMissionById(id);
  };

  const beginFlashShow = () => {
    // 시계는 단어를 다 보여준 뒤 고르기 시작할 때부터 흐른다(canPlayNow).
    // 준비 화면도, 단어가 스쳐가는 동안도 멈춰 있다.
    const total = flashRound?.sequence.length ?? 0;
    setFlashPhase('show');
    setFlashCursor(0);
    setFlashBlank(false);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    // i번째 단어 → 빈 화면 → i+1번째 … 마지막 단어까지 보여주면 선택 단계로.
    // 타이머를 매번 flashTimer.current에 다시 담아, 화면을 벗어날 때 한 번만 정리하면 사슬 전체가 끊긴다.
    const step = (i: number) => {
      flashTimer.current = setTimeout(() => {
        setFlashBlank(true);
        flashTimer.current = setTimeout(() => {
          if (i + 1 >= total) {
            setFlashPhase('choose');
            return;
          }
          setFlashCursor(i + 1);
          setFlashBlank(false);
          step(i + 1);
        }, FLASH_GAP_MS);
      }, FLASH_WORD_MS);
    };
    step(0);
  };

  const pickFlashWord = (item: LockItem, word: string) => {
    if (!flashRound) return;
    const expected = flashRound.sequence[flashProgress];
    if (word === expected) {
      const nextProgress = flashProgress + 1;
      setFlashProgress(nextProgress);
      if (nextProgress >= flashRound.sequence.length) {
        // 낱말 하나하나는 눌린 자리가 잠기는 것으로 이미 답이 되고, 세트를 다 맞힌 순간에만 판이 한 번 뛴다.
        // 단어마다 판을 뛰게 하면 빠르게 누르는 사람의 화면이 내내 들썩인다.
        flashOk();
        const isLastRound = flashRoundIdx + 1 >= FLASH_ROUNDS.length;
        setTimeout(() => {
          if (isLastRound) {
            finishTimedGame(item);
          } else {
            setFlashRoundIdx(flashRoundIdx + 1);
            setFlashRound(generateFlashRound(FLASH_ROUNDS[flashRoundIdx + 1]));
            setFlashProgress(0);
            setFlashPhase('ready');
          }
        }, 400);
      }
    } else {
      // 틀려도 판을 새로 뽑지 않는다. 새 단어로 갈아끼우면 여태 맞힌 것이 통째로 사라져서,
      // 한 번의 실수로 이 세트를 처음부터 다시 외워야 한다. 맞힌 데까지는 그대로 두고 벌시간만 얹는다.
      // 새 판은 재시작 메뉴에서 "이 세트만 다시"를 골랐을 때만 나온다.
      penalizeWrong('순서가 달라요');
      setFlashWrong(true);
      setTimeout(() => setFlashWrong(false), 500);
    }
  };

  // 갈 수 있는 칸은 "안전한 칸"이 아니라 "순서상 바로 다음 칸" 하나뿐이다.
  // 안전한 칸이기만 하면 통과시키면, 길이 자기 자신과 이웃하는 곳에서 중간 구간을 통째로
  // 건너뛰고 도착할 수 있다 — 순서를 외우게 하려는 게임인데 순서를 안 지켜도 이겨버린다.
  // 방금 지나온 칸으로 한 칸 물러나는 것만 허용한다(잘못 눌렀을 때의 무르기. 질러가기에는 못 쓴다).
  const moveMaze = (item: LockItem, dr: number, dc: number) => {
    if (mazePhase !== 'move') return;
    // 힌트로 길을 다시 틀어주는 동안은 못 움직인다. 켜지는 칸을 눈으로 좇으며 그대로 따라 걸으면
    // 순서를 기억하는 게임이 아니라 그냥 따라 그리기가 된다.
    if (mazeSeqIdx !== null) return;
    const [r, c] = mazePos;
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= mazeStage.rows || nc >= mazeStage.cols) return;

    const dir = mazeStage.reverse ? -1 : 1;
    const goalStep = mazeStage.reverse ? 0 : mazeOrder.length - 1;
    const isCell = (idx: number) => mazeOrder[idx]?.[0] === nr && mazeOrder[idx]?.[1] === nc;

    if (isCell(mazeStep - dir)) {
      setMazeStep(mazeStep - dir);
      return;
    }
    if (!isCell(mazeStep + dir)) {
      mazeFail();
      return;
    }

    const nextStep = mazeStep + dir;
    setMazeStep(nextStep);
    if (nextStep === goalStep) {
      flashOk();
      clearMazeTimers();
      setTimeout(() => {
        const nextStage = mazeStageIdx + 1;
        if (nextStage >= MAZE_STAGES.length) {
          finishTimedGame(item);
        } else {
          setMazeStageIdx(nextStage);
          beginMazeRound(nextStage);
        }
      }, 300);
    }
  };

  const tapCmCell = (idx: number) => {
    if (cmValues[idx] !== null) {
      const next = [...cmValues];
      next[idx] = null;
      setCmValues(next);
      setCmSelected(null);
      setCmHinted((prev) => prev.filter((i) => i !== idx));
      return;
    }
    setCmSelected(idx);
  };

  const tapCmDigit = (d: number) => {
    if (cmSelected === null || cmValues.includes(d)) return;
    const next = [...cmValues];
    next[cmSelected] = d;
    setCmValues(next);
    setCmSelected(null);
    // 아홉 칸이 다 찼는데 합이 안 맞으면 그 자체가 오답 제출이다. 판은 그대로 두고 벌시간만 얹는다.
    // 맞은 경우는 힌트로 마지막 칸이 채워질 수도 있어서 위쪽 완성 확인 효과가 한 자리에서 맡는다.
    if (cmRound && next.every((v) => v !== null) && !checkCrossMath(next, cmRound)) {
      penalizeWrong('합이 맞지 않아요');
      setCmWrong(true);
      setTimeout(() => setCmWrong(false), 400);
    }
  };

  const tapCbDigit = (d: number) => {
    setCbInput((v) => (v.length >= 2 ? v : v + String(d)));
  };

  const cbBackspace = () => setCbInput((v) => v.slice(0, -1));

  const cbSubmit = (item: LockItem) => {
    if (!cbRound || cbInput === '') return;
    if (Number(cbInput) === cbRound.answer) {
      flashOk();
      const nextStage = cbStageIdx + 1;
      if (nextStage >= CODEBREAK_STAGES.length) {
        finishTimedGame(item);
      } else {
        setCbStageIdx(nextStage);
        setCbRound(generateCodeBreakRound(nextStage));
        setCbInput('');
        setCbWrong(false);
        setCbHinted([]);
        toast(`${nextStage}/${CODEBREAK_STAGES.length}단계 통과! 다음 단계`);
      }
    } else {
      penalizeWrong('정답이 아니에요');
      setCbWrong(true);
      setTimeout(() => setCbWrong(false), 400);
      setCbInput('');
    }
  };

  const bbDigits = BASEBALL_STAGES[bbStageIdx]?.digits ?? BASEBALL_STAGES[BASEBALL_STAGES.length - 1].digits;

  // 채운 자리 다음으로 고를 자리. 오른쪽으로 훑다가 없으면 앞쪽까지 돌아 빈 자리를 찾는다 —
  // 가운데를 고쳐 넣은 뒤에도 손이 남은 빈 자리로 이어지게 하려는 것이다. 다 찼으면 아무 데도 고르지 않는다.
  const nextEmptyBbSlot = (values: (number | null)[], from: number): number | null => {
    for (let i = 1; i <= values.length; i++) {
      const idx = (from + i) % values.length;
      if (values[idx] === null) return idx;
    }
    return null;
  };

  const tapBbSlot = (idx: number) => setBbSel(idx);

  const putBbDigit = (d: number) => {
    // 같은 숫자는 한 판에 한 번뿐이다. 이미 딴 자리에 놓여 있으면 그 자리를 비우고 여기로 옮긴다 —
    // 버튼을 잠가두면 5를 2번째로 옮기려고 4번째를 먼저 지워야 해서, 고치는 데 두 손이 든다.
    if (bbSel === null) return;
    const next = bbInput.map((v, i) => (i === bbSel ? d : v === d ? null : v));
    setBbInput(next);
    setBbSel(nextEmptyBbSlot(next, bbSel));
  };

  // 고른 자리를 비운다. 아무 데도 안 골랐거나 고른 자리가 이미 비어 있으면 마지막으로 채운 자리를 지운다
  // — 되돌리기 버튼으로 쓰던 손에 그대로 맞는다.
  const bbErase = () => {
    let target = bbSel !== null && bbInput[bbSel] !== null ? bbSel : -1;
    if (target < 0) for (let i = bbInput.length - 1; i >= 0; i--) if (bbInput[i] !== null) { target = i; break; }
    if (target < 0) return;
    setBbInput(bbInput.map((v, i) => (i === target ? null : v)));
    setBbSel(target);
  };

  const bbSubmit = (item: LockItem) => {
    if (bbInput.length !== bbDigits) return;
    // 순서대로 채우는 판이 아니라 가운데 한 칸만 비워둔 채 확인을 누를 수 있다. 그때 아무 일도
    // 안 일어나면 버튼이 고장 난 것처럼 보이므로, 무엇이 모자란지 그 자리에서 말해준다.
    if (bbInput.some((v) => v === null)) {
      toast('빈 자리를 모두 채워주세요');
      return;
    }
    const guess = bbInput as number[];
    // 낸 수를 판에 남겨두니 확인을 한 번 더 눌러 같은 수를 또 낼 수 있다. 이미 답을 받은 수는
    // 새로 알려줄 게 없으므로 시도로 세지 않는다 — 손이 미끄러진 값으로 5초를 받을 이유는 없다.
    if (bbGuesses.some((g) => g.digits.every((d, i) => d === guess[i]))) {
      toast('이미 낸 수예요');
      return;
    }
    const { strikes, balls } = judgeBaseball(bbSecret, guess);
    // 최근 시도가 위로 오게 쌓는다. 아래로 흐르면 판이 길어질수록 방금 낸 결과가 화면 밖으로 밀린다.
    setBbGuesses([{ digits: guess, strikes, balls }, ...bbGuesses]);
    setBbTries((n) => n + 1);
    // 낸 수는 판에 그대로 둔다. 숫자야구는 앞 수에서 한두 자리만 바꿔가며 좁히는 게임이라,
    // 매번 비워버리면 방금 낸 수를 기록에서 눈으로 옮겨 적고 다시 채워야 한다.
    setBbSel(null);
    const cleared = strikes === bbDigits;
    const nextStage = bbStageIdx + 1;
    const finishing = cleared && nextStage >= BASEBALL_STAGES.length;
    // 맞힌 시도에도 똑같이 얹는다. 마지막 한 번을 공짜로 두면 한 번에 맞힌 사람과
    // 열 번 만에 맞힌 사람의 마지막 수만 값이 달라져 셈이 어긋난다.
    // 다만 판을 여는 그 한 수는 아래 finishTimedGame에 직접 넘긴다 — addTimePenalty는 상태를
    // 고쳐 다음 그림부터 반영되는데, 마무리 계산은 지금 이 그림의 값으로 이뤄지기 때문이다.
    if (!finishing) addTimePenalty(BASEBALL_TRY_MS);
    // 하나도 걸리지 않은 수(아웃)는 이 게임에서 유일한 "빗나감"이다. 결과 글씨가 흐려지는 것만으로는
    // 방금 낸 수가 어떻게 됐는지 눈에 잘 안 들어와서, 넣은 자리를 한 번 흔들어 알린다.
    if (!cleared && strikes === 0 && balls === 0) {
      setBbOut(true);
      setTimeout(() => setBbOut(false), 400);
    }
    if (cleared) {
      flashOk();
      if (finishing) {
        setTimeout(() => finishTimedGame(item, BASEBALL_TRY_MS), 400);
      } else {
        toast(`${bbStageIdx + 1}/${BASEBALL_STAGES.length}단계 통과! 다음 단계`);
        setTimeout(() => {
          setBbStageIdx(nextStage);
          setBbSecret(generateBaseballSecret(nextStage));
          setBbInput(new Array(BASEBALL_STAGES[nextStage].digits).fill(null));
          setBbSel(0);
          setBbGuesses([]);
          setBbRevealed([]);
        }, 400);
      }
    }
  };

  const tapReflexCell = (item: LockItem, idx: number) => {
    if (idx !== reflexActiveCell) {
      // 아무 칸도 안 켜져 있는 사이(맞힌 직후의 짧은 틈)는 그냥 흘려보낸다.
      // 여기까지 벌하면 한 번 맞히고 손가락이 두 번 튄 것만으로 10초가 붙는다.
      // 켜진 칸을 두고 엉뚱한 칸을 누른 것만 헛탭으로 센다 — 화면을 문질러 맞히는 길을 막는 게 목적이다.
      if (reflexActiveCell === null) return;
      penalizeWrong('빛나지 않는 칸이에요', REFLEX_PENALTY_MS);
      setReflexMiss(true);
      setTimeout(() => setReflexMiss(false), 400);
      return;
    }
    if (reflexClearTimer.current) clearTimeout(reflexClearTimer.current);
    setReflexActiveCell(null);
    // 맞힌 칸을 초록으로 한 번 물들인다. 같은 칸이 연달아 켜질 수 있어서, flashOk와 같은 이유로
    // 표시를 한 번 떼었다 붙인다 — 안 그러면 두 번째부터는 아무 일도 일어나지 않는다.
    if (reflexHitTimer.current) clearTimeout(reflexHitTimer.current);
    setReflexHitCell(null);
    requestAnimationFrame(() => {
      setReflexHitCell(idx);
      reflexHitTimer.current = setTimeout(() => setReflexHitCell(null), REFLEX_HIT_FX_MS);
    });
    const nextHits = reflexHits + 1;
    setReflexHits(nextHits);
    if (nextHits >= REFLEX_TARGET_HITS) {
      finishTimedGame(item);
    } else {
      scheduleReflexSpawn();
    }
  };

  // 오답 패널티: 게임을 리셋하지 않고 경과시간에 벌시간만 더한다.
  const comboPenalize = (message: string) => {
    penalizeWrong(message);
    setComboWrong(true);
    setTimeout(() => {
      setComboWrong(false);
      setComboSelected([]);
    }, 500);
  };

  const advanceComboRound = (item: LockItem) => {
    setComboSelected([]);
    setComboFound([]);
    setComboHintCards([]);
    const nextRound = comboRoundIdx + 1;
    if (nextRound >= comboRounds.length) {
      finishTimedGame(item);
    } else {
      setComboRoundIdx(nextRound);
    }
  };

  const tapCombo = (idx: number) => {
    // 힌트로 짚어준 카드를 건드리면 표시를 지운다 — 다 쓴 힌트가 계속 반짝이면 헷갈린다.
    if (comboHintCards.length) setComboHintCards([]);
    if (comboSelected.includes(idx)) {
      setComboSelected(comboSelected.filter((i) => i !== idx));
      return;
    }
    const board = comboRounds[comboRoundIdx];
    const next = [...comboSelected, idx];
    setComboSelected(next);
    if (next.length === 3) {
      const picked = next.map((i) => board[i]) as [ComboCard, ComboCard, ComboCard];
      if (checkCombo(picked)) {
        const sorted = [...next].sort((a, b) => a - b) as [number, number, number];
        const already = comboFound.some((t) => t[0] === sorted[0] && t[1] === sorted[1] && t[2] === sorted[2]);
        if (already) {
          toast('이미 찾은 합이에요');
          setComboSelected([]);
        } else {
          flashOk();
          setComboFound([...comboFound, sorted]);
          setComboSelected([]);
        }
      } else {
        comboPenalize('합이 아니에요');
      }
    }
  };

  // "결" 선언: 지금 보드에 아직 못 찾은 합이 없다고 주장한다. 실제로 다 찾았으면 다음 세트로, 남아있으면 페널티.
  const declareNoCombo = (item: LockItem) => {
    const board = comboRounds[comboRoundIdx];
    const total = findAllCombos(board).length;
    if (comboFound.length >= total) {
      flashOk();
      advanceComboRound(item);
    } else {
      comboPenalize('아직 못 찾은 합이 있어요');
    }
  };

  const tapEqNumber = (idx: number) => {
    if (!eqRound || eqNumUsed[idx]) return;
    setEqTokens([...eqTokens, { kind: 'num', value: eqRound.numbers[idx], cardIdx: idx }]);
    const nextUsed = [...eqNumUsed];
    nextUsed[idx] = true;
    setEqNumUsed(nextUsed);
  };

  const tapEqOp = (op: string) => {
    setEqTokens([...eqTokens, { kind: 'op', value: op }]);
  };

  const eqBackspace = () => {
    if (eqTokens.length === 0) return;
    const last = eqTokens[eqTokens.length - 1];
    if (last.kind === 'num') {
      const nextUsed = [...eqNumUsed];
      nextUsed[last.cardIdx] = false;
      setEqNumUsed(nextUsed);
    }
    setEqTokens(eqTokens.slice(0, -1));
  };

  const flashEqWrong = () => {
    setEqWrong(true);
    setTimeout(() => setEqWrong(false), 400);
  };

  const eqSubmit = (item: LockItem) => {
    if (!eqRound) return;
    if (!eqNumUsed.every(Boolean)) {
      toast('숫자를 전부 사용해야 해요');
      return;
    }
    const result = evaluateTokens(eqTokens);
    if (result === eqRound.target) {
      flashOk();
      const nextStreak = eqStreak + 1;
      setEqStreak(nextStreak);
      if (nextStreak >= EQ_TARGET_STREAK) {
        finishTimedGame(item);
      } else {
        // 다음 문제는 한 단계 더 어렵다 — 숫자는 그대로 4개지만 목표가 훌쩍 커진다.
        const round = generateEquationRound(nextStreak);
        setEqRound(round);
        setEqTokens([]);
        setEqNumUsed(new Array(round.numbers.length).fill(false));
        // 새 문제에 지난 문제의 힌트가 남아 있으면 그대로 따라 눌렀다가 틀린다.
        setEqHintText(null);
        toast(`${nextStreak}/${EQ_TARGET_STREAK} 성공! 다음 목표는 ${round.target}`);
      }
    } else if (result === null) {
      // 계산이 안 되는 식은 답을 낸 게 아니라 아직 식이 덜 된 것이다.
      // 알려주는 게 없으니 찍어보는 데도 못 쓴다 — 벌시간 없이 고쳐 쓰게 둔다.
      toast('수식이 올바르지 않아요');
      flashEqWrong();
    } else {
      penalizeWrong(`${result} — 목표(${eqRound.target})와 달라요`);
      flashEqWrong();
    }
  };

  const tapLight = (item: LockItem, r: number, c: number) => {
    if (!loGrid) return;
    const next = toggleLight(loGrid, r, c, loSize);
    setLoGrid(next);
    // 누른 칸을 정답 집합에서 뒤집어 둔다. 같은 칸을 두 번 누르면 서로 상쇄되므로 이걸로 항상 맞아떨어진다.
    setLoSolution((prev) => prev && prev.map((row, ri) => row.map((v, ci) => (ri === r && ci === c ? !v : v))));
    if (loHintCell && loHintCell[0] === r && loHintCell[1] === c) setLoHintCell(null);
    if (next.every((row) => row.every((v) => !v))) {
      flashOk();
      setTimeout(() => {
        const nextStage = loStageIdx + 1;
        if (nextStage >= LO_STAGES.length) {
          finishTimedGame(item);
        } else {
          setLoStageIdx(nextStage);
          const round = generateLightsOut(LO_STAGES[nextStage]);
          setLoGrid(round.initial);
          setLoSolution(round.solution);
          setLoSize(round.size);
          setLoHintCell(null);
        }
      }, 300);
    }
  };

  // 게임마다 한 걸음씩만 열어주는 힌트. 판을 대신 풀어주지는 않는다.
  // 정말 힌트를 준 경우에만 true를 돌려주고, 그때만 벌시간과 순위 제외가 붙는다.
  // 못 준 이유가 게임마다 다를 수 있는 곳(숫자야구 — 자리를 아직 안 골랐다)은 그 말을 돌려준다.
  const giveHint = (item: LockItem): boolean | string => {
    switch (item.type) {
      case 'crossmath': {
        if (!cmRound) return false;
        // 아직 정답과 다른 칸 중 하나를 만들 때 쓴 배치대로 채워준다.
        // 같은 숫자가 딴 데 놓여 있으면 그건 비워야 1~9를 한 번씩만 쓰는 규칙이 유지된다.
        const wrong = cmRound.solution.map((v, i) => (cmValues[i] === v ? -1 : i)).filter((i) => i >= 0);
        if (wrong.length === 0) return false;
        const idx = wrong[Math.floor(Math.random() * wrong.length)];
        const value = cmRound.solution[idx];
        const next = cmValues.map((v, i) => (i === idx ? value : v === value ? null : v));
        setCmValues(next);
        setCmSelected(null);
        setCmHinted((prev) => [...prev.filter((i) => next[i] !== null), idx]);
        toast(`${Math.floor(idx / 3) + 1}행 ${(idx % 3) + 1}열은 ${value}예요`);
        return true;
      }
      case 'codebreak': {
        if (!cbRound) return false;
        // 힌트 식을 만족하는 조합은 여럿일 수 있다. 그중 아무 조합의 값을 알려주면
        // 다르게(그러나 똑같이 옳게) 추리한 사람에게는 틀린 말이 된다.
        // 그래서 어떤 조합에서도 변하지 않는 것 — 확정된 도형, 없으면 확정된 관계식 — 만 내준다.
        const facts = codeBreakFacts(cbRound);
        const nextFixed = facts.fixed.find((f) => !cbHinted.some((h) => h.kind === 'fixed' && h.shape === f.shape));
        if (nextFixed) {
          setCbHinted([...cbHinted, { kind: 'fixed', ...nextFixed }]);
          toast('이 도형의 숫자는 어떤 경우에도 이 값이에요');
          return true;
        }
        const nextRel = facts.relations.find(
          (r) => !cbHinted.some((h) => h.kind === 'rel' && h.a === r.a && h.b === r.b && h.op === r.op),
        );
        if (nextRel) {
          setCbHinted([...cbHinted, { kind: 'rel', ...nextRel }]);
          toast('항상 성립하는 식을 하나 더 알려드렸어요');
          return true;
        }
        // 도형 수가 적은 판은 값도 관계도 하나로 안 잡히고 답만 정해진다. 그때는 답에 대해 말해준다.
        const notes: { id: string; text: string }[] = [
          { id: 'method', text: '한 도형을 x로 두고 나머지를 x로 나타내 보세요. 값을 몰라도 답은 정해져요.' },
          { id: 'parity', text: `답은 ${cbRound.answer % 2 === 0 ? '짝수' : '홀수'}예요.` },
          { id: 'range', text: `답은 ${Math.max(0, cbRound.answer - 3)}에서 ${cbRound.answer + 3} 사이예요.` },
        ];
        const nextNote = notes.find((n) => !cbHinted.some((h) => h.kind === 'note' && h.id === n.id));
        if (nextNote) {
          setCbHinted([...cbHinted, { kind: 'note', ...nextNote }]);
          return true;
        }
        return false;
      }
      case 'maze': {
        // 길을 순서대로 다시 한 번 틀어준다. 통째로 비춰주면 이 게임이 묻는 "순서"를 그냥 건너뛰게 된다.
        // 걷기 단계는 그대로라 시계도 계속 흐른다 — 힌트로 시간을 멈출 수는 없다.
        if (mazePhase !== 'move' || mazeSeqIdx !== null || mazeOrder.length === 0) return false;
        runMazeSequence(mazeOrder, mazeStage, () => setMazeSeqIdx(null));
        return true;
      }
      case 'baseball': {
        // 어느 자리를 알고 싶은지는 사람마다 다르다. 볼이 붙은 숫자가 어디로 가는지 보려고
        // 한 자리를 노려보고 있을 수도 있어서, 아무 자리나 골라주면 30초를 내고도 원하던 걸 못 얻는다.
        if (bbSel === null) return '알고 싶은 자리를 먼저 눌러주세요';
        if (bbRevealed[bbSel] != null) return '이미 알려드린 자리예요';
        const pos = bbSel;
        const value = bbSecret[pos];
        // 십자 연산 힌트처럼 값을 그 자리에 바로 넣어준다. 같은 숫자가 딴 자리에 놓여 있으면 비운다.
        const next = bbInput.map((v, i) => (i === pos ? value : v === value ? null : v));
        setBbInput(next);
        // 알려준 사실은 지우지 않는다. 그 자리를 나중에 손으로 덮어써도 "여기는 이 숫자"라는 건
        // 30초를 내고 산 참말이라, 판에서 값이 밀려나도 아래 목록에는 그대로 남아 있어야 한다.
        setBbRevealed((prev) => bbSecret.map((_, i) => (i === pos ? value : (prev[i] ?? null))));
        setBbSel(nextEmptyBbSlot(next, pos));
        toast(`${pos + 1}번째 자리는 ${value}예요`);
        return true;
      }
      case 'combo': {
        const board = comboRounds[comboRoundIdx];
        if (!board) return false;
        const remaining = findAllCombos(board).filter(
          (t) => !comboFound.some((f) => f[0] === t[0] && f[1] === t[1] && f[2] === t[2]),
        );
        if (remaining.length === 0) {
          // 남은 합이 없다는 것 자체가 정답이다 — "결"을 누르면 넘어간다.
          toast('남은 합이 없어요 · "결"을 누르세요');
          return true;
        }
        // 못 찾은 합 한 세트를 통째로 짚어주고 찾은 것으로 넣어준다.
        const triple = remaining[Math.floor(Math.random() * remaining.length)];
        setComboHintCards(triple);
        setComboFound([...comboFound, triple]);
        setComboSelected([]);
        toast('못 찾은 합 한 세트를 알려드렸어요');
        return true;
      }
      case 'equation': {
        if (!eqRound) return false;
        // 첫 번째 힌트는 어디부터 손대야 하는지, 두 번째부터는 식 전체를 보여준다.
        if (eqHintText === null) {
          setEqHintText(`먼저 ${eqRound.firstStep} 부터 만들어보세요`);
          return true;
        }
        if (!eqHintText.startsWith('정답')) {
          setEqHintText(`정답 하나: ${eqRound.solution}`);
          return true;
        }
        return false;
      }
      case 'lightsout': {
        if (!loSolution) return false;
        const cells: [number, number][] = [];
        loSolution.forEach((row, r) => row.forEach((v, c) => v && cells.push([r, c])));
        if (cells.length === 0) return false;
        setLoHintCell(cells[Math.floor(Math.random() * cells.length)]);
        return true;
      }
      default:
        return false;
    }
  };

  const requestHint = (item: LockItem) => {
    const given = giveHint(item);
    if (given !== true) {
      toast(typeof given === 'string' ? given : '지금은 더 알려줄 게 없어요');
      return;
    }
    setHintCount((n) => n + 1);
    addTimePenalty(HINT_PENALTY_MS);
  };

  const answerQuiz = (item: LockItem, idx: number) => {
    const correct = item.answer === -1 || idx === item.answer;
    setAnswered({ idx, correct });
    if (correct) {
      setTimeout(() => {
        openLock(item.id);
        setSheet({ kind: 'reveal', item });
        setAnswered(null);
      }, 550);
    } else {
      setTimeout(() => setAnswered(null), 500);
    }
  };

  // 이미 깨둔 크랙에 기록만 나중에 덧붙이려고 시트를 다시 여는 길(기록 목록의 "적기").
  const writeMissionRecord = (item: LockItem) => {
    setAnswerDraft(missionAnswers[item.id]?.answer ?? '');
    setSheet({ kind: 'mission', item });
  };

  const completeMission = (item: LockItem) => {
    // 크랙은 QR을 찾은 순간 이미 났을 수도 있다(글은 나중에 적을 수 있으므로).
    // 그 경우엔 축하 화면을 다시 띄우지 않고 기록만 더한다.
    const alreadyOpen = !!state.opened[item.id];
    openLock(item.id);
    if (DAY2_MISSION_IDS.includes(item.id)) {
      const trimmed = answerDraft.trim();
      if (trimmed) {
        setMissionAnswers((prev) => ({ ...prev, [item.id]: { name: item.name, answer: trimmed } }));
        if (state.id) {
          saveMissionAnswer(state.id, item.id, item.name, trimmed).catch(() => {
            toast('기록 저장에 실패했어요. 네트워크를 확인해주세요');
          });
        }
      }
      setAnswerDraft('');
      if (alreadyOpen) {
        setSheet(null);
        if (trimmed) toast('기록을 남겼어요');
        return;
      }
      const allDone = DAY2_MISSION_IDS.every((id) => id === item.id || state.opened[id]);
      if (allDone) {
        openFirstLove();
        return;
      }
    }
    setSheet({ kind: 'reveal', item });
  };

  const day2CrackCount = DAY2_MISSION_IDS.filter((id) => state.opened[id]).length;
  const eggDone = day2CrackCount >= DAY2_MISSION_IDS.length;
  // 찾았지만 아직 아무것도 안 적은 조각이 있는지. 알 아래 안내 문구가 이걸 보고 바뀐다.
  const unwrittenShard = DAY2_MISSIONS.some((i) => state.opened[i.id] && !missionAnswers[i.id]);
  const firstLove = missionAnswers[FIRST_LOVE_PROMPT.id];

  // 초심 화면은 알이 깨진 그 순간에 저절로 열리지만, 그때 못 적고 닫았거나 나중에 다시 읽고
  // 싶은 사람도 있다. 그래서 다 깨진 알 자체가 이 화면을 다시 여는 손잡이가 된다.
  function openFirstLove() {
    setFirstLoveDraft(missionAnswers[FIRST_LOVE_PROMPT.id]?.answer ?? '');
    setSheet({ kind: 'eggComplete' });
  }

  const saveFirstLove = () => {
    const trimmed = firstLoveDraft.trim();
    if (!trimmed) {
      toast('한 줄만이라도 남겨보세요');
      return;
    }
    setMissionAnswers((prev) => ({
      ...prev,
      [FIRST_LOVE_PROMPT.id]: { name: FIRST_LOVE_PROMPT.title, answer: trimmed },
    }));
    if (state.id) {
      saveMissionAnswer(state.id, FIRST_LOVE_PROMPT.id, FIRST_LOVE_PROMPT.title, trimmed).catch(() => {
        toast('기록 저장에 실패했어요. 네트워크를 확인해주세요');
      });
    }
    setSheet(null);
    toast('초심을 남겼어요');
  };

  const elapsedMs = accumulatedBase + (sessionStart !== null ? nowTick - sessionStart : 0);
  const elapsedText =
    sheet && isPreciseGame(sheet.kind) ? formatPreciseElapsed(elapsedMs) : formatElapsed(elapsedMs);

  // 9개 미니게임이 공통으로 쓰는 상단 줄 — 게임 이름 · 경과시간.
  // 이 줄은 게임 내용이 아니라 시트 머리말 자리(닫기·재시작 버튼과 같은 줄)에 놓인다.
  // 내용 쪽에 두면 기기에 따라 함께 커지거나 줄어서, 버튼과 겹치거나 두 줄로 밀려났다.
  // 시계가 멈춰 있는 동안은 아이콘을 일시정지 모양으로 바꿔, 안 흐르고 있다는 걸 숫자만 보고도 알게 한다.
  const timerPaused = sessionStart === null;
  const gameHeader = (label: React.ReactNode, showTimer = true) => (
    <div className={styles.timerRow}>
      <span className={`pill ${styles.gamePill}`}>{label}</span>
      {showTimer && (
        <span className={`${styles.timerBadge} ${timerPaused ? styles.timerBadgePaused : ''}`}>
          <TimerIcon paused={timerPaused} />
          {elapsedText}
        </span>
      )}
    </div>
  );

  // 지금 열려 있는 게임의 머리말. 시트가 버튼과 같은 줄에 그려준다.
  const sheetHeader = (() => {
    if (!sheet) return null;
    switch (sheet.kind) {
      case 'crossmath':
        return gameHeader('십자 연산');
      case 'codebreak':
        return gameHeader(`부호 해독 · ${cbStageIdx + 1}/${CODEBREAK_STAGES.length}단계`);
      case 'baseball':
        return gameHeader(`숫자야구 · ${bbStageIdx + 1}/${BASEBALL_STAGES.length}단계`);
      case 'reflex':
        return gameHeader(`순발력 타격 · ${reflexHits}/${REFLEX_TARGET_HITS}`);
      case 'memory':
        // 멈춰 있을 때는 시계 아이콘이 바뀌므로 숨기지 않는다 — 지금 시간이 가는지 안 가는지가 그대로 보인다.
        return gameHeader(`플래시 기억 · ${flashRoundIdx + 1}/${FLASH_ROUNDS.length}세트`);
      case 'maze':
        return gameHeader(`기억의 미로 · ${mazeStageIdx + 1}/${MAZE_STAGES.length}단계`);
      case 'combo':
        return gameHeader(`결합 찾기 · ${comboRoundIdx + 1}/${comboRounds.length}세트`);
      case 'equation':
        return gameHeader(`수식 만들기 · ${Math.min(eqStreak + 1, EQ_TARGET_STREAK)}/${EQ_TARGET_STREAK}문제`);
      case 'lightsout':
        return gameHeader(`라이트 아웃 · ${loStageIdx + 1}/${LO_STAGES.length}단계`);
      default:
        return null;
    }
  })();

  // 게임마다 같은 자리에 놓이는 힌트 줄. 버튼에는 대가만 적고, 무엇을 알려주는 힌트인지는
  // 옆에 작게 붙인다 — 게임마다 길이가 제각각이라 버튼에 넣으면 버튼 폭이 게임마다 달라진다.
  const hintBar = (item: LockItem) => {
    const label = HINT_LABELS[item.type];
    if (!label) return null;
    return (
      <div className={styles.hintRow}>
        <button className={styles.hintBtn} onClick={() => requestHint(item)}>
          <BulbIcon />
          힌트
          <span className={styles.hintCost}>+{HINT_PENALTY_MS / 1000}초</span>
        </button>
        <span className={styles.hintNote}>
          {label}
          {/* "적을수록"만 적어두면 무엇이 적어야 하는지가 흐려진다 — 쓴 횟수를 말하는 것임을 문장에 담는다. */}
          <span className={styles.hintSub}>
            {hintCount > 0
              ? `${hintCount}회 씀 · 힌트는 적게 쓸수록 순위에 유리해요`
              : '힌트는 적게 쓸수록 순위에 유리해요'}
          </span>
        </span>
      </div>
    );
  };

  // 타임어택 게임을 보고 있을 때만 시트 우상단(닫기 왼쪽)에 재시작 아이콘이 붙는다.
  // 여러 단계짜리 게임은 "이 단계만"과 "처음부터" 중에 고르게 하고, 한 판짜리는 곧바로 처음부터 다시 시작한다.
  const restartAction = isTimedSheet(sheet)
    ? (() => {
        const item = sheet.item;
        const stage = STAGED_GAMES[item.type];
        const icon = (
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        );
        if (!stage) {
          return (
            <button className={styles.restartBtn} onClick={() => restartAll(item)} aria-label="처음부터 다시 시작">
              {icon}
            </button>
          );
        }
        return (
          <div className={styles.restartWrap}>
            <button
              className={styles.restartBtn}
              onClick={() => setRestartMenuOpen((v) => !v)}
              aria-label="다시 시작"
              aria-expanded={restartMenuOpen}
            >
              {icon}
            </button>
            {restartMenuOpen && (
              <>
                <div className={styles.restartBackdrop} onClick={() => setRestartMenuOpen(false)} />
                <div className={styles.restartMenu}>
                  <button
                    className={styles.restartMenuItem}
                    onClick={() => {
                      setRestartMenuOpen(false);
                      restartRound(item);
                    }}
                  >
                    <b>이 {stage.unit}만</b>
                    <span>시간은 이어서 흐름</span>
                  </button>
                  <button
                    className={styles.restartMenuItem}
                    onClick={() => {
                      setRestartMenuOpen(false);
                      restartAll(item);
                    }}
                  >
                    <b>처음부터</b>
                    <span>{stage.allNote}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()
    : null;

  return (
    <section>
      {/* 제목이 버튼에 밀려 두 줄이 되지 않도록, 버튼은 제목이 아니라 그 윗줄(eyebrow)과 나란히 둔다. */}
      <div className={styles.header}>
        <div className="eyebrow">The Journey</div>
        <div className={styles.headerBtns}>
          {/* 내 정보 — 처음에 적은 다짐, 다시 들어올 때 쓰는 코드, 로그아웃이 여기 모여 있다. */}
          <button className={styles.iconBtn} onClick={() => setVowOpen(true)} aria-label="내 정보">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8.2" r="3.6" />
              <path d="M5 20a7 7 0 0 1 14 0" />
            </svg>
          </button>
          <button className={styles.rankBtn} onClick={() => goScreen('rank')} aria-label="조별 점수판">
            <svg viewBox="0 0 24 24">
              <path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z" />
            </svg>
          </button>
        </div>
      </div>
      {/* 제목에 이름을 넣어, 이 여정이 "3일짜리 일정"이 아니라 내 것임을 첫 줄에서 말한다.
          기록판에 뜨는 이름과 같은 것이라야 순위판에서 내 이름을 찾을 때 헷갈리지 않는다. */}
      {/* 닉네임은 길이를 정해줄 수 없는 값이라 제목과 같은 크기로 두면 긴 닉네임에서 두 줄이 된다.
          한 급 작게 써서 "Breaker,"가 제목을 이끌고 이름은 그 옆에 붙는 이름표처럼 보이게 한다. */}
      <h1 className={styles.headerTitle}>
        Breaker, <span className={styles.headerNick}>{state.nickname || state.nick}</span>
      </h1>

      {/* 전체 진행 바(n/16)는 뺐다. 날마다 이미 자기 진행이 눈에 보이고(자물쇠 그리드의 켜진 칸,
          알에 늘어나는 금), 무엇보다 그날 할 일을 다 해도 절반쯤에서 멈춰 있는 바라
          채워지는 맛 대신 덜 한 것 같은 느낌만 줬다. */}
      <div className={styles.daytabRow}>
        {([1, 2, 3] as Day[]).map((d) => {
          // 시트에서 그 날을 통째로 잠가두면 탭 자체가 열리지 않는다.
          const g = dayGate(d);
          return (
            <div
              key={d}
              className={`${styles.daytab} ${state.day === d ? styles.daytabOn : ''} ${g.locked ? styles.daytabLocked : ''}`}
              onClick={() => (g.locked ? toastGate(g) : selectDay(d))}
              aria-disabled={g.locked || undefined}
            >
              <div className={styles.d}>DAY {d}</div>
              <div className={styles.t}>{g.locked ? '잠김' : DAY_LABELS[d]}</div>
            </div>
          );
        })}
      </div>

      <div className={`muted ${styles.dayCaption}`}>{dayData.caption}</div>

      {/* 검사 → 나눔 → 잠언. 그날 하는 순서대로 세 걸음이 알 위에 한 줄로 선다.
          알 아래에 뒀을 때는 알과 그 아래 안내 한 줄을 지나야 나와서, 세로가 짧은 폰에서는
          스크롤을 내려야 보였다. 알보다 위에 두면 DAY 1의 자기소개 나눔 줄과 같은 높이라,
          날을 옮겨 다녀도 "오늘 할 일"이 늘 캡션 바로 아래에서 시작한다.
          여기 있어도 그날의 주인공은 알이다 — 세 걸음은 그림 하나와 표제 한 줄뿐이라
          한 줄 높이만 쓰고, 그 아래 알이 화면의 가운데를 그대로 가진다.
          나눔은 검사 직후가 아니라 진행자가 시간을 잡았을 때 열린다. */}
      {state.day === 2 && (
        <div className={styles.linkRow}>
          {(() => {
            const g = sectionGate(SECTION_GATES.d2Type);
            return (
              <DayLinkTile
                step={1}
                done={stepsDone.type}
                icon={
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="8" />
                    <circle cx="12" cy="12" r="2.6" />
                  </svg>
                }
                label="IDOL-X"
                name="나의 우상은?"
                locked={g.locked}
                next={!g.locked && !stepsDone.type}
                lockedSub={g.at ? `${formatKST(g.at)}에 열려요` : SECTION_GATES.d2Type.lockedSub}
                onClick={() => (g.locked ? toastGate(g) : goScreen('type'))}
              />
            );
          })()}
          {(() => {
            const g = sectionGate(SECTION_GATES.d2Share);
            return (
              <DayLinkTile
                step={2}
                done={stepsDone.share}
                icon={
                  <svg viewBox="0 0 24 24">
                    <path d="M4 5h16v10H8l-4 4z" />
                  </svg>
                }
                label="SHARE"
                name="유형 나눔"
                locked={g.locked}
                next={!g.locked && stepsDone.type && !stepsDone.share}
                lockedSub={g.at ? `${formatKST(g.at)}에 열려요` : SECTION_GATES.d2Share.lockedSub}
                onClick={() => (g.locked ? toastGate(g) : goScreen('share'))}
              />
            );
          })()}
          {/* 잠언은 나눔 화면 맨 끝에 붙어 있어서 거기까지 내려간 사람만 만났다.
              검사 → 나눔 다음의 세 번째 걸음으로 세운다. 여는 시각은 나눔과 같은 잠금을
              그대로 따른다 — 나눔을 마친 뒤에 적는 글이라 따로 열 시각이 없다. */}
          {(() => {
            const g = sectionGate(SECTION_GATES.d2Share);
            return (
              <DayLinkTile
                step={3}
                done={stepsDone.proverb}
                icon={
                  <svg viewBox="0 0 24 24">
                    <path d="M4 20h16M6 15.5 16.5 5a2.1 2.1 0 0 1 3 3L9 18.5l-4 1z" />
                  </svg>
                }
                label="WRITE"
                name="나만의 잠언"
                locked={g.locked}
                next={!g.locked && stepsDone.share && !stepsDone.proverb}
                lockedSub={g.at ? `${formatKST(g.at)}에 열려요` : SECTION_GATES.d2Share.lockedSub}
                onClick={() => (g.locked ? toastGate(g) : goScreen('proverb'))}
              />
            );
          })()}
        </div>
      )}

      {state.day === 2 &&
        (() => {
          const g = sectionGate(SECTION_GATES.d2Qr);
          return (
            <div className={styles.eggHero}>
              {/* 알 좌우에 껍질 조각 세 개씩. 찾은 조각이 곧 기록의 손잡이라 목록을 따로 펼칠 일이 없다. */}
              <EggStage
                items={DAY2_MISSIONS}
                answers={missionAnswers}
                opened={state.opened}
                onWrite={writeMissionRecord}
                onRead={(item) => setSheet({ kind: 'reveal', item })}
              >
                <EggCrack count={day2CrackCount} total={DAY2_MISSION_IDS.length} />
              </EggStage>
              {/* 다 깨고 나면 더 찾을 QR이 없다. 그 자리를 초심으로 바꿔, 알이 깨진 다음에
                  무엇을 하는 날인지가 같은 버튼에서 이어지게 한다. */}
              {eggDone ? (
                /* 화면 폭을 다 쓰는 큰 버튼은 알 그림을 아래로 밀어냈다. 무엇을 하는 자리인지는
                   펜 그림과 두 낱말이면 충분하다. */
                <button className={styles.firstLoveBtn} onClick={openFirstLove}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 20h16M6 16l9-9 3 3-9 9H6z" />
                  </svg>
                  {firstLove ? '초심 다시 보기' : '초심 기록'}
                </button>
              ) : (
                /* 무엇을 하는 버튼인지는 카메라 그림 하나로 충분하다. 아래 안내가 어디서
                   무엇을 찾는지 이어서 알려주므로, 글자까지 넣은 큰 버튼은 알 그림을 밀어낼 뿐이다. */
                <button
                  className={styles.scanBtn}
                  disabled={g.locked}
                  onClick={() => setScannerOpen(true)}
                  aria-label="QR 스캔하기"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4 8a2 2 0 0 1 2-2h1.6l1.2-1.6h6.4L16.4 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
                    <circle cx="12" cy="13" r="3.4" />
                  </svg>
                </button>
              )}
              {/* 무엇을 해야 하는지 짚어줄 게 있을 때만 한 줄 붙인다. QR을 찾으러 다니는 동안에는
                  아무 말도 두지 않는다 — 카메라 버튼이 이미 그 말이고, 없는 줄만큼 알이 커진다. */}
              {(() => {
                const hint = eggDone
                  ? firstLove
                    ? '알이 깨진 자리에 남긴 초심이에요. 눌러서 다시 읽고 고칠 수 있어요.'
                    : '알이 다 깨졌어요. 이제 초심을 적어볼 차례예요.'
                  : g.locked
                    ? g.at
                      ? `${formatKST(g.at)}에 열려요`
                      : SECTION_GATES.d2Qr.lockedSub
                    : /* 아직 안 적은 조각이 있으면, 다음에 할 일은 QR 찾기가 아니라 그 조각을 누르는 것이다. */
                      unwrittenShard
                      ? '떨어져 나온 조각을 눌러 그 자리에서 한 일을 남겨보세요'
                      : null;
                if (!hint) return null;
                return (
                  <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
                    {hint}
                  </p>
                );
              })()}
            </div>
          );
        })()}

      {/* 자기소개 나눔은 아홉 칸 위에 한 줄로 놓는다(위 IntroSheetRow 설명 참고).
          게임 진행에는 걸리지 않는 별도 코너라, 안 올린 사람도 자물쇠는 그대로 깰 수 있다.
          연결이 없을 때도 줄은 그대로 둔다 — 코너가 통째로 사라지면 그게 고장인지 원래 없는
          것인지 알 길이 없다. 들어간 화면이 왜 비어 있는지 말해주는 쪽이 낫다. */}
      {state.day === 1 &&
        (() => {
          const g = sectionGate(SECTION_GATES.d1Intro);
          return (
            <IntroSheetRow
              myId={state.id}
              myGroup={state.group}
              locked={g.locked}
              lockedSub={g.at ? `${formatKST(g.at)}에 열려요` : SECTION_GATES.d1Intro.lockedSub}
              onOpen={() => (g.locked ? toastGate(g) : goScreen('introsheet'))}
            />
          );
        })()}

      {/* 날마다 한 덩어리씩만 놓는다: DAY 1은 아홉 칸 자물쇠, DAY 2는 알, DAY 3은 다이얼. */}
      {state.day === 1 && (
        // 아홉 글자가 다 모이면 판 전체가 한 번 물결친다(--i로 글자마다 조금씩 늦게 켜진다).
        <div className={`${styles.lockGrid} ${wordFx ? styles.lockGridDone : ''}`}>
          {dayData.items.map((item, idx) => {
            const open = !!state.opened[item.id];
            // 시트에서 시각을 정해둔 자물쇠는 그 시각 전까지 눌러도 열리지 않으므로 흐리게 보여준다.
            const gated = !open && itemGate(item).locked;
            const letter = BACKTOGOD_WORD[idx];
            const fresh = letterFx === idx;
            return (
              <div
                key={item.id}
                className={[
                  styles.lockTile,
                  open ? styles.lockTileOpen : '',
                  gated ? styles.lockTileGated : '',
                  fresh ? styles.lockTileFx : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--i': idx } as React.CSSProperties}
                onClick={() => handleLockClick(item)}
                aria-label={open ? `${item.name} · 열림` : gated ? '아직 열리지 않은 자물쇠' : '잠긴 자물쇠'}
              >
                {open && letter ? (
                  <span className={`${styles.lockLetter} ${fresh ? styles.lockLetterFx : ''}`}>{letter}</span>
                ) : (
                  <LockIcon open={open} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DAY 3 · 다이얼이 아직 흐린 동안에만 그 위에 서는 되짚기 줄.
          다이얼은 앞선 이틀을 다 깨야 또렷해지는데, 지금까지 얼마나 남았는지는 흐린 다이얼을
          눌러야 토스트로 한 번 스쳐 지나갔다 — 흐린 이유를 알려면 눌러봐야 했다는 뜻이다.
          날마다 몇 개가 남았는지를 늘 보이는 자리에 적고, 누르면 아직 덜 깬 날로 곧장 건너뛴다.
          아래 안내("DAY 1 · 2의 여정을 마무리하면…")가 그제야 따라갈 수 있는 말이 된다.
          다 깨고 나면 이 줄은 사라진다 — 남은 게 없는 날에 0을 세는 줄만 남겨두면,
          그날의 주인공인 또렷해진 다이얼 위에 아무 할 일도 없는 상자가 하나 얹힌다.
          자리는 DAY 1의 자기소개 나눔 줄과 같다(캡션 바로 아래, 같은 껍데기). */}
      {state.day === 3 &&
        dialSealed &&
        (() => {
          const groups = FINAL_BY_DAY.map((g) => ({
            day: g.day,
            total: g.ids.length,
            done: g.ids.filter((id) => state.opened[id]).length,
          }));
          // 아직 덜 깬 첫 날로 보낸다. 순서대로 하는 여정이라, 둘 다 남았으면 앞선 날이 먼저다.
          const next = groups.find((g) => g.done < g.total) ?? groups[0];
          const gate = dayGate(next.day);
          const label = groups.map((g) => `DAY ${g.day} ${g.done} / ${g.total}`).join(' · ');
          return (
            <button
              className={styles.recapRow}
              onClick={() => (gate.locked ? toastGate(gate) : selectDay(next.day))}
              aria-label={`여정 되짚기 · ${label} · DAY ${next.day}로 가기`}
            >
              <span className={styles.recapIcon}>
                <svg viewBox="0 0 24 24" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 7l2 2 3-3.6M12.5 7.5H20.5" />
                  <path d="M3.5 16l2 2 3-3.6M12.5 16.5H20.5" />
                </svg>
              </span>
              <span className={styles.recapText}>
                <span className={styles.recapName}>여정 되짚기</span>
                <span className={styles.recapDays} aria-hidden="true">
                  {groups.map((g) => {
                    const full = g.done === g.total;
                    return (
                      <span key={g.day} className={`${styles.recapDay} ${full ? styles.recapDayFull : ''}`}>
                        DAY {g.day}
                        <b>
                          {g.done}/{g.total}
                        </b>
                        {full && (
                          <svg className={styles.recapCheck} viewBox="0 0 24 24">
                            <path d="M5 12.5l5 5 9-10.5" />
                          </svg>
                        )}
                      </span>
                    );
                  })}
                </span>
              </span>
              <svg className={styles.recapArrow} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          );
        })()}

      {/* DAY 3은 자물쇠 칸을 늘어놓지 않는다. 마지막 날에 남은 건 다이얼 하나뿐이다.
          여기서는 돌리지 않고, 눌러서 들어간 화면에서 푼다(DAY 2의 알과 QR 스캔이 나뉜 것과 같다).
          아래에 있던 "다이얼 돌리기" 버튼은 없앴다. 돌릴 물건이 눈앞에 있는데 손잡이가 그 아래
          따로 서 있으면 다이얼은 그림이 되고 버튼만 남는다. 대신 가운데 판에 빛을 돌려
          여기를 누르라고 말한다. 아직 못 여는 날이어도 눌리기는 한다 — 눌러야 이유를 알려줄 수 있다. */}
      {state.day === 3 &&
        (() => {
          const g = sectionGate(SECTION_GATES.d3Decide);
          const opened = !!state.opened['d3a'];
          // 앞선 이틀을 다 깨기 전에는 다이얼이 초점 밖에 있다. 무엇이 놓여 있는지는 보이되
          // 글자는 하나도 읽히지 않는 상태 — 눌러보면 얼마나 남았는지 토스트가 알려준다.
          const sealed = dialSealed;
          return (
            <div className={styles.dialHero}>
              <div className={sealed ? styles.dialSealed : dialFx ? styles.dialReveal : undefined}>
                <TimeDial
                  offsets={opened ? DIAL_SOLVED : DIAL_PREVIEW}
                  phase={opened ? 'broken' : 'turn'}
                  onTurn={() => {}}
                  readOnly
                  onOpen={() => (g.locked ? toastGate(g) : handleLockClick(dayData.items[0]))}
                  hubGlow={!g.locked && !sealed && !opened}
                />
              </div>
              <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
                {g.locked
                  ? g.at
                    ? `${formatKST(g.at)}에 열려요`
                    : SECTION_GATES.d3Decide.lockedSub
                  : sealed
                    ? 'DAY 1 · 2의 여정을 마무리하면 다이얼이 또렷해져요'
                    : opened
                      ? '가운데를 눌러 깨진 원과 내가 적은 결단을 다시 볼 수 있어요'
                      : '가운데를 눌러 세 개의 링을 돌려보세요'}
              </p>
            </div>
          );
        })()}

      {scannerOpen && <QrScanner parse={parseQrText} onDetect={handleScanDetect} onClose={() => setScannerOpen(false)} />}

      <Sheet open={vowOpen} onClose={closeVow}>
        <div className="eyebrow">My Info</div>
        {/* 이름은 둘 다 쓰인다 — 기도제목에는 본명이, 기록판과 복구 코드에는 닉네임이 나간다.
            하나만 보여주면 다른 하나는 어디에도 없어서, 기록판에 뜬 이름이 내 것인지 헷갈린다. */}
        <div className={styles.nameRow}>
          <h2 className={styles.nameReal}>{state.nick}</h2>
          {state.nickname && <span className={styles.nameNick}>{state.nickname}</span>}
        </div>
        <p className={`muted ${styles.nameNote}`}>
          기도제목에는 본명이, 게임 기록판에는 닉네임이 보여요.
        </p>

        <div className={styles.sectionLabel}>{VOW_PROMPT.recallTitle}</div>
        {state.vow ? (
          <p className={styles.vowText}>{state.vow}</p>
        ) : (
          <p className="muted">등록할 때 남겨둔 다짐이 없어요.</p>
        )}

        <hr className={styles.sectionDivider} />
        <div className={styles.sectionLabel}>내 코드 (다시 들어올 때 필요해요)</div>
        {/* 복사 버튼에는 글자 대신 그림만 둔다. 코드가 주인공인 줄이라, 옆에 "복사"라는 글자가
            같이 서 있으면 어느 쪽을 읽어야 하는지 한 박자 헷갈린다. */}
        <div className={styles.codeRow}>
          <div className={styles.codeValue}>{state.id}</div>
          <button
            className={`${styles.copyBtn} ${codeCopied ? styles.copyBtnDone : ''}`}
            onClick={copyCode}
            aria-label={codeCopied ? '복사됨' : '코드 복사'}
          >
            {codeCopied ? (
              <svg viewBox="0 0 24 24">
                <path d="M5 12.5 10 17.5 19 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24">
                <rect x="9" y="9" width="11" height="11" rx="2.4" />
                <path d="M15 5.6A1.6 1.6 0 0 0 13.4 4H6a2 2 0 0 0-2 2v7.4A1.6 1.6 0 0 0 5.6 15" />
              </svg>
            )}
          </button>
        </div>

        {logoutArmed ? (
          <>
            <p className="tiny" style={{ color: 'var(--danger)', textAlign: 'left', marginTop: 12 }}>
              복구 코드를 적어두었나요? 코드가 없으면 이 기록으로 다시 들어올 수 없어요.
            </p>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn ghost" onClick={() => setLogoutArmed(false)}>
                취소
              </button>
              <button className="btn" onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="tiny" style={{ textAlign: 'left', marginTop: 12 }}>
              로그아웃해도 기록은 그대로 남아요. 위 코드로 다시 들어올 수 있어요.
            </p>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setLogoutArmed(true)}>
              로그아웃
            </button>
          </>
        )}
      </Sheet>

      <Sheet open={sheet !== null} onClose={closeSheet} fullscreen action={restartAction} header={sheetHeader}>
        {sheet?.kind === 'intro' &&
          (() => {
            const intro = GAME_INTRO[sheet.item.type];
            if (!intro) return null;
            return (
              <>
                <span className="pill">{intro.pill}</span>
                <h2 style={{ margin: '6px 0 10px' }}>{intro.title}</h2>
                <p className="muted" style={{ marginBottom: intro.rules ? 8 : 12, lineHeight: 1.7 }}>
                  {intro.desc}
                </p>
                {intro.rules && (
                  <ul className={styles.introRules}>
                    {intro.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                )}
                {intro.note && (
                  <p className="muted" style={{ marginBottom: 12, lineHeight: 1.7 }}>
                    {intro.note}
                  </p>
                )}
                <GameDemo type={sheet.item.type} />
                <button className="btn" onClick={() => startGame(sheet.item)}>
                  게임 시작
                </button>
              </>
            );
          })()}

        {sheet?.kind === 'quiz' && (
          <>
            <span className="pill">{sheet.item.pill ?? '성경 자물쇠'}</span>
            <h2 style={{ margin: '6px 0 16px' }}>{sheet.item.q}</h2>
            {sheet.item.opts?.map((opt, i) => (
              <button
                key={i}
                className={`opt ${answered?.idx === i ? (answered.correct ? 'correct' : 'wrong') : ''}`}
                onClick={() => answerQuiz(sheet.item, i)}
              >
                {opt}
              </button>
            ))}
          </>
        )}

        {sheet?.kind === 'mission' && (
          <>
            <span className="pill">
              QR 크랙 {DAY2_MISSION_IDS.includes(sheet.item.id) ? `· ${day2CrackCount}/${DAY2_MISSION_IDS.length}` : ''}
            </span>
            <h2 style={{ margin: '6px 0 10px' }}>{sheet.item.name}</h2>
            <p style={{ fontSize: 'var(--fs-body)', color: '#d9cdbb', marginBottom: 8 }}>{sheet.item.q}</p>
            {/* hint는 "다 했으면 크랙을 냅니다" 같은 안내라, 이미 깨둔 크랙에 기록만 더하러
                들어온 경우엔 이미 지나간 이야기다. */}
            {!state.opened[sheet.item.id] && (
              <p className="muted" style={{ marginBottom: 12 }}>
                {sheet.item.hint}
              </p>
            )}
            {DAY2_MISSION_IDS.includes(sheet.item.id) && (
              <textarea
                className="field"
                style={{ minHeight: 96, resize: 'none', lineHeight: 1.6 }}
                placeholder="떠오른 생각이 있으면 적어보세요 (안 적어도 괜찮아요)"
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
              />
            )}
            {/* 글은 넘어가는 조건이 아니다. 계곡에서 손이 젖은 채로, 어두운 데서 타이핑을 강제하면
                "QR을 찾았다"는 것 자체가 막힌다. 못 적었으면 기록 목록에서 나중에 적을 수 있다. */}
            {/* 아직 안 깬 크랙을 내는 건 이 화면의 주인공이라 큰 버튼으로 두지만,
                이미 깬 자리에 글만 더하는 저장은 작은 버튼이면 된다. */}
            {state.opened[sheet.item.id] ? (
              <div className={styles.sheetActions}>
                <button className="btn xs" onClick={() => completeMission(sheet.item)}>
                  기록 저장
                </button>
              </div>
            ) : (
              <button className="btn" onClick={() => completeMission(sheet.item)}>
                완료했어요 · 크랙 내기
              </button>
            )}
          </>
        )}

        {sheet?.kind === 'crossmath' && cmRound && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>1~9를 겹치지 않게 채워 합을 맞추세요</h2>
            {/* 푸는 법은 시작 전 안내 화면에서 이미 읽었다. 여기서는 판을 보며 새로 알아야 할 것만 남긴다
                — 설명을 다시 늘어놓으면 작은 기기에서 그만큼 숫자패드가 화면 밖으로 밀려난다. */}
            <p className="muted" style={{ marginBottom: 14 }}>
              합이 맞은 줄은 초록으로 바뀌어요. 다 채웠는데 안 맞으면 +{WRONG_PENALTY_SEC}초.
            </p>
            <div className={`${styles.cmGrid} ${cmWrong ? styles.cmWrong : ''} ${okFx ? styles.okFx : ''}`}>
              {Array.from({ length: 4 }).map((_, r) =>
                Array.from({ length: 4 }).map((_, c) => {
                  if (r < 3 && c < 3) {
                    const idx = r * 3 + c;
                    const val = cmValues[idx];
                    const done = cmLines.rows[r] || cmLines.cols[c];
                    return (
                      <button
                        key={`${r}-${c}`}
                        className={`${styles.cmCell} ${cmSelected === idx ? styles.cmCellSelected : ''} ${
                          val !== null ? styles.cmCellFilled : ''
                        } ${done ? styles.cmCellDone : ''} ${cmHinted.includes(idx) ? styles.cmCellHinted : ''}`}
                        onClick={() => tapCmCell(idx)}
                      >
                        {val ?? ''}
                      </button>
                    );
                  }
                  if (r < 3 && c === 3) {
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`${styles.cmTarget} ${cmLines.rows[r] ? styles.cmTargetDone : ''}`}
                      >
                        {cmRound.rowTargets[r]}
                      </div>
                    );
                  }
                  if (r === 3 && c < 3) {
                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`${styles.cmTarget} ${cmLines.cols[c] ? styles.cmTargetDone : ''}`}
                      >
                        {cmRound.colTargets[c]}
                      </div>
                    );
                  }
                  return <div key={`${r}-${c}`} className={styles.cmCorner} />;
                }),
              )}
            </div>
            <p className="muted" style={{ margin: '0 0 14px', textAlign: 'center' }}>
              맞춘 줄 {cmLines.rows.filter(Boolean).length + cmLines.cols.filter(Boolean).length} / 6
            </p>
            <div className={styles.digitPad}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  className={styles.eqNumBtn}
                  disabled={cmValues.includes(d) || cmSelected === null}
                  onClick={() => tapCmDigit(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            {hintBar(sheet.item)}
          </>
        )}

        {sheet?.kind === 'codebreak' && cbRound && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>마지막 식의 답을 알아내세요</h2>
            {/* 도형값은 여러 조합이 나올 수 있고 유일하게 정해지는 건 마지막 식의 답뿐이다.
                "도형마다 숨은 숫자를 맞히라"고 하면 맞는 추리를 해놓고도 틀렸다고 여기게 된다. */}
            <p className="muted" style={{ marginBottom: 16 }}>
              힌트 {cbRound.hints.length}개를 모두 써야 답이 하나로 정해져요. 도형값을 다 알아낼 필요는 없어요.
            </p>
            {cbRound.hints.map((h, i) => (
              <div key={i} className={styles.cbHintRow}>
                <ShapeIcon shape={h.a} />
                <span className={styles.cbOp}>{h.op}</span>
                <ShapeIcon shape={h.b} />
                <span className={styles.cbOp}>=</span>
                <span className={styles.cbNum}>{h.result}</span>
              </div>
            ))}
            {cbHinted.length > 0 && (
              <div className={styles.cbRevealRow}>
                {cbHinted.map((h, i) => {
                  if (h.kind === 'fixed') {
                    return (
                      <span key={`f${h.shape}`} className={styles.cbRevealChip}>
                        <ShapeIcon shape={h.shape} size={20} />
                        <span className={styles.cbOp}>=</span>
                        <b>{h.value}</b>
                      </span>
                    );
                  }
                  if (h.kind === 'rel') {
                    return (
                      <span key={`r${i}`} className={styles.cbRevealChip}>
                        <ShapeIcon shape={h.a} size={20} />
                        <span className={styles.cbOp}>{h.op}</span>
                        <ShapeIcon shape={h.b} size={20} />
                        <span className={styles.cbOp}>=</span>
                        <b>{h.result}</b>
                      </span>
                    );
                  }
                  return (
                    <span key={`n${h.id}`} className={`${styles.cbRevealChip} ${styles.cbRevealNote}`}>
                      {h.text}
                    </span>
                  );
                })}
              </div>
            )}
            <div
              className={`${styles.cbHintRow} ${styles.cbFinalRow} ${cbWrong ? styles.cbWrong : ''} ${
                okFx ? styles.okFx : ''
              }`}
            >
              <ShapeIcon shape={cbRound.final.a} />
              <span className={styles.cbOp}>+</span>
              <ShapeIcon shape={cbRound.final.b} />
              <span className={styles.cbOp}>=</span>
              <span className={styles.cbInputDisplay}>{cbInput || '?'}</span>
            </div>
            <div className={styles.digitPad}>
              {[1, 2, 3, 4, 5].map((d) => (
                <button key={d} className={styles.eqNumBtn} onClick={() => tapCbDigit(d)}>
                  {d}
                </button>
              ))}
            </div>
            <div className={styles.digitPad}>
              {[6, 7, 8, 9, 0].map((d) => (
                <button key={d} className={styles.eqNumBtn} onClick={() => tapCbDigit(d)}>
                  {d}
                </button>
              ))}
            </div>
            <div className="row compact" style={{ marginTop: 4 }}>
              <button className="btn ghost" onClick={cbBackspace}>
                지우기
              </button>
              <button className="btn" onClick={() => cbSubmit(sheet.item)}>
                확인
              </button>
            </div>
            {hintBar(sheet.item)}
          </>
        )}

        {sheet?.kind === 'baseball' && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>{bbDigits}자리 숫자를 맞혀보세요</h2>
            <p className="muted" style={{ marginBottom: 14 }}>
              0~9 중 서로 다른 숫자 {bbDigits}개. 채울 자리를 누르고 숫자를 고르세요. 자리까지 맞으면 S, 숫자만
              맞으면 B. 시도 한 번마다 +{BASEBALL_TRY_SEC}초.
            </p>
            <div
              className={`${styles.bbInputRow} ${bbOut ? styles.bbOutFx : ''} ${okFx ? styles.okFx : ''}`}
              style={{ '--bb-slots': bbDigits } as React.CSSProperties}
            >
              {Array.from({ length: bbDigits }).map((_, i) => (
                <BaseballSlot
                  key={i}
                  pos={i}
                  digit={bbInput[i] ?? null}
                  active={i === bbSel}
                  // 알려준 값이 지금 그 자리에 놓여 있을 때만 힌트 표시를 한다 — 손으로 다른 숫자를
                  // 덮어쓴 자리까지 노란 테두리로 두면 그 값이 힌트인 줄 알고 읽게 된다.
                  hinted={bbRevealed[i] != null && bbInput[i] === bbRevealed[i]}
                  onClick={() => tapBbSlot(i)}
                />
              ))}
            </div>
            {bbRevealed.some((v) => v != null) && (
              <p className={styles.bbRevealNote}>
                힌트로 알아낸 자리 —{' '}
                {bbRevealed.map((v, i) => (v == null ? null : `${i + 1}번째 ${v}`)).filter(Boolean).join(' · ')}
              </p>
            )}
            <div className={styles.digitPad}>
              {BASEBALL_DIGITS.map((d) => (
                <button
                  key={d}
                  className={`${styles.eqNumBtn} ${bbInput.includes(d) ? styles.bbPadUsed : ''}`}
                  // 이미 쓴 숫자도 눌러서 옮길 수 있다. 잠기는 건 고른 자리가 없을 때뿐이다.
                  disabled={bbSel === null}
                  onClick={() => putBbDigit(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="row compact" style={{ marginTop: 4 }}>
              <button className="btn ghost" onClick={bbErase}>
                지우기
              </button>
              <button className="btn" onClick={() => bbSubmit(sheet.item)}>
                확인
              </button>
            </div>
            {bbGuesses.length > 0 && (
              <div className={styles.bbLog}>
                {/* 기록에 얹히는 건 두 단계를 통틀어 물어본 횟수라, 이 단계의 횟수만 적으면
                    2단계에 들어선 순간 숫자가 되감긴 것처럼 보인다. */}
                <div className={styles.bbLogLabel}>
                  <span>
                    {bbTries > bbGuesses.length ? `이 단계 ${bbGuesses.length}번 · 통틀어 ` : ''}
                    {bbTries}번 시도
                  </span>
                  <span className={styles.bbLogCost}>+{bbTries * BASEBALL_TRY_SEC}초</span>
                </div>
                {bbGuesses.map((g, i) => (
                  <div key={bbGuesses.length - i} className={styles.bbLogRow}>
                    <span className={styles.bbLogNo}>{bbGuesses.length - i}</span>
                    <span className={styles.bbLogDigits}>
                      {g.digits.map((d, j) => (
                        <span key={j} className={styles.bbLogDigit}>
                          {d}
                        </span>
                      ))}
                    </span>
                    <span
                      className={`${styles.bbLogResult} ${g.strikes === 0 && g.balls === 0 ? styles.bbLogOut : ''}`}
                    >
                      {baseballResultText(g.strikes, g.balls)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {hintBar(sheet.item)}
          </>
        )}

        {sheet?.kind === 'reflex' && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>빛나는 칸을 최대한 빠르게 탭하세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              {REFLEX_TARGET_HITS}번 맞히면 열려요. 빗나가면 +{REFLEX_PENALTY_SEC}초.
            </p>
            <div className={`${styles.reflexGrid} ${reflexMiss ? styles.reflexMissFx : ''}`}>
              {Array.from({ length: REFLEX_GRID }).map((_, i) => (
                <button
                  key={i}
                  className={`${styles.reflexCell} ${reflexActiveCell === i ? styles.reflexCellOn : ''} ${
                    reflexHitCell === i ? styles.reflexCellHit : ''
                  }`}
                  onClick={() => tapReflexCell(sheet.item, i)}
                />
              ))}
            </div>
          </>
        )}

        {sheet?.kind === 'memory' && (
          <>
            {flashPhase === 'ready' && (
              <>
                <h2 style={{ margin: '0 0 4px' }}>단어 {FLASH_ROUNDS[flashRoundIdx]}개가 한 개씩 스쳐 지나가요</h2>
                <p className="muted" style={{ marginBottom: 16 }}>
                  순서까지 기억해야 해요. 시계는 고르기 시작할 때부터 흘러가요.
                </p>
                <button className="btn" onClick={beginFlashShow}>
                  시작
                </button>
              </>
            )}
            {flashPhase === 'show' && flashRound && (
              <>
                <p className="muted" style={{ margin: '0 0 0', textAlign: 'center' }}>
                  {flashCursor + 1} / {flashRound.sequence.length}번째
                </p>
                <div className={styles.flashShowBox}>
                  {!flashBlank && (
                    <div key={flashCursor} className={styles.flashWord}>
                      {flashRound.sequence[flashCursor]}
                    </div>
                  )}
                </div>
                <div className={styles.flashDots}>
                  {flashRound.sequence.map((_, i) => (
                    <span
                      key={i}
                      className={`${styles.flashDot} ${i <= flashCursor ? styles.flashDotOn : ''}`}
                    />
                  ))}
                </div>
              </>
            )}
            {flashPhase === 'choose' && flashRound && (
              <>
                <h2 style={{ margin: '0 0 4px' }}>방금 본 순서대로 탭하세요</h2>
                <p className="muted" style={{ marginBottom: 12 }}>
                  {flashProgress}/{flashRound.sequence.length}개 선택함 · 틀리면 +{WRONG_PENALTY_SEC}초, 맞힌 데까지는
                  그대로예요
                </p>
                <div
                  className={`${styles.flashChoiceGrid} ${flashWrong ? styles.flashWrong : ''} ${
                    okFx ? styles.okFx : ''
                  }`}
                >
                  {flashRound.choices.map((w) => {
                    const used = flashRound.sequence.slice(0, flashProgress).includes(w);
                    return (
                      <button
                        key={w}
                        className={styles.flashChoice}
                        disabled={used}
                        onClick={() => pickFlashWord(sheet.item, w)}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {sheet?.kind === 'maze' && mazePhase === 'notice' && (
          // 거꾸로 걷는 단계에 들어가기 전 한 번 세우는 자리. 판 크기가 앞 단계와 같아서
          // 안내를 곁들여 흘려보내면 그대로 앞 단계처럼 걷다가 첫 칸에서 벌시간을 먹는다.
          // 여기서는 시계도 멈춰 있으니 천천히 읽고 스스로 시작하면 된다.
          <>
            <h2 style={{ margin: '0 0 4px' }}>이번 단계는 거꾸로 걸어요</h2>
            <p className="muted" style={{ marginBottom: 14 }}>
              길은 지금까지처럼 시작 칸부터 차례로 켜져요. 하지만 걷는 건 <b>반대</b>예요 — 길이 끝난 칸에
              서서, 켜진 순서를 거슬러 시작 칸으로 되짚어 가세요.
            </p>
            <div className={styles.mazeNoticeCard}>
              <div className={styles.mazeNoticeRow}>
                <span className={styles.mazeNoticeKey}>보여줄 때</span>
                <span>시작 칸 → 끝 칸</span>
              </div>
              <div className={styles.mazeNoticeRow}>
                <span className={styles.mazeNoticeKey}>걸을 때</span>
                <span className={styles.mazeNoticeFlip}>끝 칸 → 시작 칸</span>
              </div>
            </div>
            <p className="muted" style={{ margin: '0 0 16px' }}>
              준비될 때까지 시계는 멈춰 있어요. 누르면 바로 길이 켜져요.
            </p>
            <button className="btn" onClick={startMazeReveal}>
              준비됐어요 · 길 보기
            </button>
          </>
        )}

        {sheet?.kind === 'maze' && mazePhase !== 'notice' && (
          <>
            {mazePhase === 'reveal' ? (
              <>
                <h2 style={{ margin: '0 0 4px' }}>
                  {mazeStage.rows}x{mazeStage.cols} · 켜지는 순서를 기억하세요
                </h2>
                <p className="muted" style={{ marginBottom: 16 }}>
                  모양이 아니라 지나간 순서를 따라가세요. 보는 동안은 시계가 멈춰 있어요.
                  {mazeStage.reverse && (
                    <>
                      <br />이 단계는 <b>거꾸로</b> — 길이 끝난 곳에서 시작된 곳으로 되짚어 가세요.
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <h2 style={{ margin: '0 0 4px' }}>
                  {mazeStage.reverse ? '길이 시작된 칸으로 되짚어 가세요' : '출구까지 길을 찾아보세요'}
                </h2>
                <p className="muted" style={{ marginBottom: 16 }}>
                  {mazeSeqIdx !== null ? (
                    <>길을 다시 보여주는 중이에요. 다 지나가면 서 있던 칸에서 이어 걸어요.</>
                  ) : (
                    <>
                      <b>바로 다음 칸</b>으로만 갈 수 있어요. 질러가면 +{WRONG_PENALTY_SEC}초, 판은 그대로예요. 한 칸
                      무르는 건 괜찮아요.
                    </>
                  )}
                </p>
              </>
            )}
            <div
              className={`${styles.mazeGrid} ${mazeWrong ? styles.mazeWrongFx : ''} ${okFx ? styles.okFx : ''}`}
              style={
                {
                  gridTemplateColumns: `repeat(${mazeStage.cols}, 1fr)`,
                  '--board-ratio': mazeStage.cols / mazeStage.rows,
                } as React.CSSProperties
              }
            >
              {Array.from({ length: mazeStage.rows }).map((_, r) =>
                Array.from({ length: mazeStage.cols }).map((_, c) => {
                  const key = `${r},${c}`;
                  const isPlayer = mazePos[0] === r && mazePos[1] === c;
                  // 도착 칸은 판의 모서리가 아니라 "길이 끝나는 칸"이다. 거꾸로 걷는 단계에서는
                  // 길이 시작된 칸이 도착점이 되므로, 판 좌표가 아니라 순서에서 뽑아야 어긋나지 않는다.
                  const goalCell = mazeStage.reverse ? mazeOrder[0] : mazeOrder[mazeOrder.length - 1];
                  const isGoal = goalCell?.[0] === r && goalCell?.[1] === c;
                  // 지금 켜진 칸 하나와, 방금 지나온 칸 하나만 남긴다.
                  // 앞의 칸이 아예 안 남으면 어느 쪽으로 넘어갔는지 눈이 못 따라간다.
                  const lit = mazeSeqIdx !== null && mazeOrder[mazeSeqIdx]?.join(',') === key;
                  const fading = mazeSeqIdx !== null && mazeSeqIdx > 0 && mazeOrder[mazeSeqIdx - 1]?.join(',') === key;
                  return (
                    <div
                      key={key}
                      className={`${styles.mazeCell} ${lit ? styles.mazeSafe : ''} ${fading ? styles.mazeSafeFade : ''}`}
                    >
                      {isPlayer ? (
                        <span className={styles.mazePawn} />
                      ) : isGoal ? (
                        <span className={styles.mazeGoal} />
                      ) : mazePhase === 'move' && !lit && !fading ? (
                        <span className={styles.mazeUnknown} />
                      ) : null}
                    </div>
                  );
                }),
              )}
            </div>
            {mazePhase === 'move' && (
              // 힌트가 도는 동안은 버튼을 잠근다. 눌러도 안 먹는 것보다, 잠긴 게 눈에 보이는 편이 낫다.
              <div className={styles.mazeControls}>
                <div />
                <button className={styles.mazeBtn} disabled={mazeSeqIdx !== null} onClick={() => moveMaze(sheet.item, -1, 0)}>
                  ▲
                </button>
                <div />
                <button className={styles.mazeBtn} disabled={mazeSeqIdx !== null} onClick={() => moveMaze(sheet.item, 0, -1)}>
                  ◀
                </button>
                <div />
                <button className={styles.mazeBtn} disabled={mazeSeqIdx !== null} onClick={() => moveMaze(sheet.item, 0, 1)}>
                  ▶
                </button>
                <div />
                <button className={styles.mazeBtn} disabled={mazeSeqIdx !== null} onClick={() => moveMaze(sheet.item, 1, 0)}>
                  ▼
                </button>
                <div />
              </div>
            )}
            {mazePhase === 'move' && hintBar(sheet.item)}
          </>
        )}

        {sheet?.kind === 'combo' && comboRounds[comboRoundIdx] && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>보이는 합을 모두 찾아보세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              모양·색·배경이 각각 셋 다 같거나 셋 다 달라야 합이에요. 더 없으면 아래 "결"을 누르세요. 오답이면 +
              {WRONG_PENALTY_SEC}초.
            </p>
            <div className={`${styles.comboGrid} ${comboWrong ? styles.comboWrong : ''} ${okFx ? styles.okFx : ''}`}>
              {comboRounds[comboRoundIdx].map((card, i) => (
                <button
                  key={card.id}
                  className={`${styles.comboCard} ${styles[`comboCardBg${card.bg}`]} ${
                    comboSelected.includes(i) ? styles.comboCardSelected : ''
                  } ${comboHintCards.includes(i) ? styles.comboCardHinted : ''}`}
                  onClick={() => tapCombo(i)}
                >
                  <ComboShape card={card} />
                </button>
              ))}
            </div>
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => declareNoCombo(sheet.item)}>
              결 (더 이상 합 없음)
            </button>
            {hintBar(sheet.item)}
            {/* 찾은 합은 하나도 없을 때부터 자리를 잡고 있는다. 첫 합을 찾는 순간 이 줄이 생겨나면
                그만큼 판이 위로 밀려 올라가고, 합을 찾을 때마다 화면이 다시 잡힌다. */}
            <div className={styles.comboFoundWrap}>
              <div className={styles.comboFoundLabel}>찾은 합 {comboFound.length}개</div>
              <div className={styles.comboFoundRow}>
                {comboFound.length === 0 ? (
                  <span className={styles.comboFoundEmpty}>찾은 합이 여기 쌓여요</span>
                ) : (
                  comboFound.map((triple, ti) => (
                    <div key={ti} className={styles.comboFoundChip}>
                      {triple.map((idx) => {
                        const card = comboRounds[comboRoundIdx][idx];
                        return (
                          <div key={idx} className={`${styles.comboFoundSwatch} ${styles[`comboCardBg${card.bg}`]}`}>
                            <ComboShape card={card} size={14} />
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {sheet?.kind === 'equation' && eqRound && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>목표 숫자: {eqRound.target}</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              숫자 {eqRound.numbers.length}개를 전부 한 번씩만 쓰세요. 틀리면 +{WRONG_PENALTY_SEC}초.
            </p>
            {eqHintText && <p className={styles.eqHintText}>{eqHintText}</p>}
            <div className={`${styles.eqDisplay} ${eqWrong ? styles.eqWrong : ''} ${okFx ? styles.okFx : ''}`}>
              {eqTokens.length === 0 ? (
                <span className={styles.eqPlaceholder}>숫자와 연산자를 눌러 수식을 만드세요</span>
              ) : (
                eqTokens.map((t) => t.value).join(' ')
              )}
            </div>
            <div className={styles.eqNumRow}>
              {eqRound.numbers.map((n, i) => (
                <button key={i} className={styles.eqNumBtn} disabled={eqNumUsed[i]} onClick={() => tapEqNumber(i)}>
                  {n}
                </button>
              ))}
            </div>
            <div className={styles.eqOpRow}>
              {['+', '-', '×', '÷', '(', ')'].map((op) => (
                <button key={op} className={styles.eqOpBtn} onClick={() => tapEqOp(op)}>
                  {op}
                </button>
              ))}
            </div>
            <div className="row compact" style={{ marginTop: 14 }}>
              <button className="btn ghost" onClick={eqBackspace}>
                지우기
              </button>
              <button className="btn" onClick={() => eqSubmit(sheet.item)}>
                확인
              </button>
            </div>
            {hintBar(sheet.item)}
          </>
        )}

        {sheet?.kind === 'lightsout' && loGrid && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>
              {loSize}×{loSize} 불을 전부 꺼보세요
            </h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              칸을 누르면 자신과 상하좌우가 함께 반전돼요.
            </p>
            <div
              className={`${styles.loGrid} ${okFx ? styles.okFx : ''}`}
              style={{ gridTemplateColumns: `repeat(${loSize}, 1fr)` }}
            >
              {loGrid.map((row, r) =>
                row.map((on, c) => (
                  <button
                    key={`${r}-${c}`}
                    className={`${styles.loCell} ${on ? styles.loCellOn : ''} ${
                      loHintCell && loHintCell[0] === r && loHintCell[1] === c ? styles.loCellHinted : ''
                    }`}
                    onClick={() => tapLight(sheet.item, r, c)}
                  />
                ))
              )}
            </div>
            {hintBar(sheet.item)}
          </>
        )}

        {sheet?.kind === 'reveal' && (
          <>
            <RevealCard pill="자물쇠 열림" title={sheet.item.name}>
              {sheet.item.reveal}
            </RevealCard>
            {missionAnswers[sheet.item.id] && (
              <div className={styles.myAnswerBox}>
                <div className={styles.myAnswerLabel}>내가 남긴 기록</div>
                <p>{missionAnswers[sheet.item.id].answer}</p>
              </div>
            )}
            {/* 기록은 글이 아니라 숫자다. 문장으로 늘어놓으면 열림 문구와 뒤엉켜 어디까지가 이야기인지 흐려진다. */}
            {lastElapsed !== null && (
              <div className={styles.revealStats}>
                <span className={styles.revealStat}>
                  <b>{isPreciseGame(sheet.item.type) ? formatPreciseElapsed(lastElapsed) : formatElapsed(lastElapsed)}</b>
                  완료 시간
                </span>
                <span className={styles.revealStat}>
                  <b>{lastHints}회</b>
                  힌트
                </span>
                {/* 숫자야구만 시도 수가 기록에 얹힌다. 무엇이 시간을 불렸는지 여기서 마저 보여준다. */}
                {sheet.item.type === 'baseball' && (
                  <span className={styles.revealStat}>
                    <b>{bbTries}회</b>
                    시도
                  </span>
                )}
              </div>
            )}
            {/* 몇 번을 다시 해도 손해가 없다는 걸 분명히 적어둔다 — 도전 횟수 제한이 있던 시절의
                "괜히 다시 했다가 기록이 나빠지는 것 아닌가" 하는 망설임이 남지 않도록. */}
            {lastElapsed !== null && TIMED_KINDS.has(sheet.item.type) && (
              <p className={styles.revealNote}>
                {[
                  lastHints > 0 ? '힌트 없이 다시 깨면 순위에서 더 앞설 수 있어요' : '',
                  '몇 번이든 다시 도전할 수 있어요 · 순위에는 내 최고 기록만 남아요',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            <div style={{ height: 14 }} />
            {/* 이 화면의 주인공은 방금 깬 결과다. 버튼은 글자만큼만 차지하고, 되돌아가는 쪽(다시)은 왼쪽
                끝에 나가는 쪽(여정으로)은 오른쪽 끝에 붙는다 — 둘을 붙여 놓으면 어느 쪽이 "앞으로"인지
                매번 글자를 읽어야 안다. 그림만 남기지는 않는다. 되감기 화살표는 "다시"로도 "무르기"로도
                읽혀서, 잘못 누르면 기록이 날아가는 자리에 뜻이 흔들리는 아이콘만 둘 수는 없다. */}
            <div className={`${styles.sheetActions} ${styles.sheetActionsSplit}`}>
              {/* QR 미션은 다시 "플레이"할 것이 없다. 그 자리에서 한 일은 이미 했고, 남는 건 기록뿐이다. */}
              {sheet.item.type === 'mission' ? (
                <button className="btn xs ghost" onClick={() => writeMissionRecord(sheet.item)}>
                  {missionAnswers[sheet.item.id] ? '기록 고치기' : '기록 남기기'}
                </button>
              ) : (
                /* 다시 할 때도 판이 바로 깔리지 않고 설명 화면부터 지난다. 한 번 깬 게임이라도
                   며칠 뒤 다시 눌렀을 때 규칙이 그대로 기억나지는 않고, 무엇보다 시계는 설명을
                   읽는 동안 멈춰 있다 — 곧장 판이 깔리면 규칙을 떠올리는 시간까지 기록에 얹힌다. */
                <button className="btn xs ghost" onClick={() => restartAll(sheet.item)}>
                  <ReplayIcon />
                  다시 플레이
                </button>
              )}
              <button className="btn xs" onClick={() => setSheet(null)}>
                여정으로
                <ExitIcon />
              </button>
            </div>
            {TIMED_KINDS.has(sheet.item.type) && <GameRanking gameId={sheet.item.type} meId={state.id} />}
          </>
        )}

        {/* 알이 다 깨진 자리는 축하로 끝내지 않는다. 껍질을 깨고 나온 다음에 무엇을 붙잡고
            살 것인지 — 초심을 적는 자리로 이어진다. */}
        {sheet?.kind === 'eggComplete' && (
          <>
            {/* 바로 아래 알약이 이미 "알이 완전히 깨졌습니다"라고 말한다. 같은 말을 두 번 두지 않는다.
                깨지는 연출(빛살·충격파)은 알 그림 밖으로 1.5배까지 번져 나가므로, 알을 줄이고
                아래에 그만큼 빈자리를 둔다 — 그러지 않으면 빛살이 알약과 제목 위에 겹쳐 지나간다. */}
            <div className={styles.eggBurst}>
              <EggCrack count={DAY2_MISSION_IDS.length} total={DAY2_MISSION_IDS.length} label={false} />
            </div>
            <span className="pill">{FIRST_LOVE_PROMPT.pill}</span>
            <h2 style={{ margin: '8px 0 8px' }}>{FIRST_LOVE_PROMPT.title}</h2>
            <p style={{ fontSize: 'var(--fs-body)', color: '#d9cdbb', marginBottom: 4, lineHeight: 1.7 }}>
              {FIRST_LOVE_PROMPT.question}
            </p>
            <p className="muted" style={{ marginBottom: 12 }}>
              {FIRST_LOVE_PROMPT.body}
            </p>
            <textarea
              className="field"
              style={{ minHeight: 140, resize: 'none', lineHeight: 1.7 }}
              placeholder={FIRST_LOVE_PROMPT.placeholder}
              value={firstLoveDraft}
              onChange={(e) => setFirstLoveDraft(e.target.value)}
            />
            {/* 적는 칸이 이 화면의 주인공이다. 버튼 둘은 글자 길이만큼만 차지하고 한 줄에 선다. */}
            <div className={styles.sheetActions}>
              <button className="btn xs" onClick={saveFirstLove}>
                {firstLove ? '기록 저장' : '초심 기록'}
              </button>
              <button className="btn xs ghost" onClick={() => setSheet(null)}>
                여정으로
              </button>
            </div>
            {/* 지금 못 적어도 알은 이미 깨져 있으므로, 여정의 알을 다시 눌러 이 자리로 돌아올 수 있다. */}
            <p className="tiny">이 기록은 언제든 여정 화면의 깨진 알을 눌러 다시 열 수 있어요.</p>
          </>
        )}

      </Sheet>
    </section>
  );
}
