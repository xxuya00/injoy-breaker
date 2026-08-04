import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LOCKS, FINAL_REQUIRED, DAY_GATES, SECTION_GATES, type GateMeta } from '../data/locks';
import { generateFlashRound, type FlashRound } from '../data/memoryGame';
import { TILE_PUZZLE } from '../data/tilePuzzle';
import { MAZE_STAGES, generateMazePath } from '../data/maze';
import { generateComboRounds, checkCombo, findAllCombos, type ComboCard } from '../data/comboGame';
import { generateEquationRound, evaluateTokens, type EquationRound, type EqToken } from '../data/equationGame';
import { generateLightsOut, toggleLight } from '../data/lightsOut';
import { generateCrossMathRound, checkCrossMath, crossMathLines, type CrossMathRound } from '../data/crossMath';
import { generateCodeBreakRound, CODEBREAK_STAGES, type CodeBreakRound, type ShapeId } from '../data/codeBreak';
import { generateBalanceRound, BALANCE_STAGES, ITEM_LABELS, type BalanceRound } from '../data/balance';
import { VOW_PROMPT } from '../data/intro';
import { fetchLockGates, type LockGate } from '../lib/gas';
import { getAccumulatedMs, setAccumulatedMs, getGameAttempts, incrementGameAttempts } from '../lib/storage';
import {
  saveGameTime,
  subscribeGameLeaderboard,
  saveMissionAnswer,
  loadMissionAnswers,
  type GameTimeEntry,
  type MissionAnswers,
} from '../lib/sync';
import type { Day, LockItem, LockType } from '../types';
import Sheet from '../components/Sheet';
import { useScrollFit } from '../components/FitBox';
import RevealCard from '../components/RevealCard';
import EggCrack from '../components/EggCrack';
import QrScanner from '../components/QrScanner';
import { useToast } from '../context/ToastContext';
import styles from './JourneyScreen.module.css';

const EQ_TARGET_STREAK = 3;
const LO_STAGES = [3, 4, 5];
const COMBO_ROUNDS = 3;
const COMBO_PENALTY_MS = 10000;
const TIMED_KINDS = new Set([
  'equation',
  'combo',
  'lightsout',
  'reflex',
  'crossmath',
  'codebreak',
  'balance',
  'maze',
  'memory',
]);
const MAX_RANKED_ATTEMPTS = 3;
const MAZE_REVEAL_MS = 2000;
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
// 경과시간을 로컬에 흘려쓰는 주기이자, 분:초로 보여주는 게임의 화면 갱신 주기.
const TIMER_FLUSH_MS = 500;
// 1/100초까지 보여주는 게임의 화면 갱신 주기.
const PRECISE_TICK_MS = 40;

type TimedKind = 'equation' | 'combo' | 'lightsout' | 'reflex' | 'crossmath' | 'codebreak' | 'balance' | 'maze' | 'memory';
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
  | { kind: 'tilepuzzle'; item: LockItem }
  | { kind: 'maze'; item: LockItem }
  | { kind: 'combo'; item: LockItem }
  | { kind: 'equation'; item: LockItem }
  | { kind: 'lightsout'; item: LockItem }
  | { kind: 'crossmath'; item: LockItem }
  | { kind: 'codebreak'; item: LockItem }
  | { kind: 'balance'; item: LockItem }
  | { kind: 'reflex'; item: LockItem }
  | { kind: 'intro'; item: LockItem }
  | { kind: 'reveal'; item: LockItem }
  | { kind: 'eggComplete'; item: LockItem }
  | { kind: 'finalLocked'; done: number; need: number };

// 9개 미니게임은 탭하면 바로 시작하지 않고, 먼저 이 설명을 보여주고 "게임 시작"을 눌러야 시작한다.
const GAME_INTRO: Partial<Record<LockType, { pill: string; title: string; desc: string }>> = {
  crossmath: {
    pill: '십자 연산',
    title: '1~9를 겹치지 않게 채워 합을 맞추세요',
    desc: '빈칸을 탭해 선택하고, 아래 숫자패드로 채워보세요. 오른쪽·아래 숫자가 목표 합이에요.',
  },
  maze: {
    pill: '기억의 미로',
    title: '안전한 길을 기억해서 출구까지 가보세요',
    desc: `초록색 칸이 2초간 보였다가 사라져요. 화살표로 이동해서 깃발까지 도착하면 열려요. 함정을 밟으면 그 단계부터 다시예요. ${MAZE_STAGES.map((s) => `${s.rows}x${s.cols}`).join(' → ')}로 단계가 오를수록 판이 커져요.`,
  },
  codebreak: {
    pill: '부호 해독',
    title: '도형마다 숨은 숫자를 추리하세요',
    desc: `도형마다 0~9 중 겹치지 않는 숫자가 숨어 있어요. 힌트 식들을 보고 최종식을 풀어보세요. ${CODEBREAK_STAGES.map(
      (s) => `${s.shapes}개`,
    ).join(' → ')}로 단계가 오를수록 도형과 힌트가 늘고, 마지막엔 곱셈까지 섞여요.`,
  },
  memory: {
    pill: '플래시 기억',
    title: '단어가 한 개씩 스쳐 지나가요',
    desc: `단어를 한 개씩 순서대로 보여줘요. 다 지나간 뒤 방금 본 순서 그대로 탭해야 해요. ${FLASH_ROUNDS.join('개 → ')}개로 라운드가 갈수록 단어 수가 늘어나요.`,
  },
  reflex: {
    pill: '순발력',
    title: '빛나는 칸을 최대한 빠르게 탭하세요',
    desc: `${REFLEX_TARGET_HITS}번 맞히면 열려요. 속도가 곧 실력!`,
  },
  balance: {
    pill: '가짜 찾기',
    title: '무게가 다른 가짜 하나를 찾아내세요',
    desc: `이미 진행된 저울질 결과를 보고 어떤 것이 가짜(더 무거운 것)인지 추리하세요. ${BALANCE_STAGES.map((s) => `${s.items}개`).join(' → ')}로 단계가 오를수록 어려워져요.`,
  },
  combo: {
    pill: '결합 찾기',
    title: '보이는 결합을 모두 찾으세요',
    desc: `모양·색·배경이 각각 셋 다 같거나 셋 다 달라야 결합이에요. 더 찾을 결합이 없으면 "결" 버튼을 눌러 다음 세트로 넘어가세요. 오답이면 리셋 없이 경과시간에 10초가 더해져요. ${COMBO_ROUNDS}세트를 모두 넘기면 열려요.`,
  },
  equation: {
    pill: '수식 만들기',
    title: '숫자 4개로 목표 숫자를 만드세요',
    desc: `숫자 4개를 전부 한 번씩만 써서 목표를 만드세요. ${EQ_TARGET_STREAK}문제 연속 성공하면 열려요.`,
  },
  lightsout: {
    pill: '라이트 아웃',
    title: '불을 전부 꺼보세요',
    desc: '칸을 누르면 자신과 상하좌우가 함께 반전돼요. 3→4→5단계를 전부 깨야 열려요.',
  },
};

// 여러 단계·세트로 나뉜 게임들. 재시작할 때 "이 단계만"과 "처음부터"를 구분해서 물어본다.
// 여기 없는 게임(십자 연산·순발력)은 한 판짜리라 곧바로 처음부터 다시 시작한다.
const STAGED_GAMES: Partial<Record<LockType, { unit: string; allNote: string }>> = {
  maze: { unit: '단계', allNote: '1단계로 · 시간도 0부터' },
  balance: { unit: '단계', allNote: '1단계로 · 시간도 0부터' },
  lightsout: { unit: '단계', allNote: '1단계로 · 시간도 0부터' },
  codebreak: { unit: '단계', allNote: '1단계로 · 시간도 0부터' },
  memory: { unit: '세트', allNote: '1세트로 · 시간도 0부터' },
  combo: { unit: '세트', allNote: '1세트로 · 시간도 0부터' },
  equation: { unit: '문제', allNote: '연속 성공 0부터 · 시간도 0부터' },
};

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

// locked가 켜지면(시트에서 잠가둔 구역) 눌러도 넘어가지 않고, 언제 열리는지만 알려준다.
function NavCard({
  icon,
  name,
  sub,
  onClick,
  locked = false,
  lockedSub,
}: {
  icon: React.ReactNode;
  name: string;
  sub: string;
  onClick: () => void;
  locked?: boolean;
  lockedSub?: string;
}) {
  return (
    <div
      className={`${styles.lock} ${locked ? styles.lockGated : styles.lockOpen} ${styles.tapable}`}
      onClick={onClick}
      aria-disabled={locked || undefined}
    >
      <div className={styles.ic}>{locked ? <LockIcon open={false} /> : icon}</div>
      <div className={styles.body}>
        <div className={styles.name}>{name}</div>
        <div className={styles.sub}>{locked ? (lockedSub ?? '아직 열리지 않았어요') : sub}</div>
      </div>
      {!locked && (
        <svg className={styles.chev} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </div>
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

// Day1의 자물쇠 9개를 하나씩 깰 때마다, 그 칸 안에서 바로 BACKTOGOD의 글자가 순서대로 드러난다.
const BACKTOGOD_WORD = 'BACKTOGOD'.split('');

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

const ITEM_COLORS = ['var(--accent)', 'var(--ok)', 'var(--accent-blue)', 'var(--accent-yellow)', 'var(--accent-purple)'];

function ItemChip({ idx, size = 32 }: { idx: number; size?: number }) {
  return (
    <span
      className={styles.balItemChip}
      style={{ width: size, height: size, fontSize: size * 0.4, background: ITEM_COLORS[idx % ITEM_COLORS.length] }}
    >
      {ITEM_LABELS[idx]}
    </span>
  );
}

// 인트로 화면에서 텍스트 설명만으로는 감이 안 오니, 고정된 예시 상황을 CSS 루프로 반복 재생해
// "이런 식으로 진행된다"를 짧게 보여준다. 실제 랜덤 로직과는 무관한 순수 연출용.
// "셋 다 달라도" / "색만 같아도" / "모양만 같아도" 전부 결합이라는 걸 예시 셋으로 차례차례 보여준다.
// 한 가지 경우만 보여주면 나머지도 결합인 줄 모르고 지나치기 쉬워서, 세 유형을 모두 돌린다.
const COMBO_DEMO_SETS: { cards: ComboCard[]; label: string }[] = [
  {
    cards: [
      { id: 'demo-a0', shape: 0, color: 0, bg: 0 },
      { id: 'demo-a1', shape: 1, color: 1, bg: 1 },
      { id: 'demo-a2', shape: 2, color: 2, bg: 2 },
    ],
    label: '모양·색·배경이 셋 다 달라요',
  },
  {
    cards: [
      { id: 'demo-b0', shape: 0, color: 0, bg: 0 },
      { id: 'demo-b1', shape: 1, color: 0, bg: 1 },
      { id: 'demo-b2', shape: 2, color: 0, bg: 2 },
    ],
    label: '색이 셋 다 같아요',
  },
  {
    cards: [
      { id: 'demo-c0', shape: 0, color: 0, bg: 0 },
      { id: 'demo-c1', shape: 0, color: 1, bg: 1 },
      { id: 'demo-c2', shape: 0, color: 2, bg: 2 },
    ],
    label: '모양이 셋 다 같아요',
  },
];
const MAZE_DEMO_SAFE = new Set([0, 3, 4, 5, 8]);
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
const CM_DEMO_CELLS = [1, 5, 9, 8, 2, 4, 3, 7, 6];
const CM_DEMO_BLANK = 1;
const CM_DEMO_ROW_SUMS = [15, 14, 16];
const CM_DEMO_COL_SUMS = [12, 14, 19];

function GameDemo({ type }: { type: LockType }) {
  switch (type) {
    case 'maze':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoMzGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`${styles.demoMzCell} ${MAZE_DEMO_SAFE.has(i) ? styles.demoMzSafe : ''}`} />
            ))}
            <span className={styles.demoMzFlag}>🚩</span>
            <span className={styles.demoMzDot}>🧍</span>
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
    case 'crossmath':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoCmGrid}>
            {Array.from({ length: 4 }).map((_, r) =>
              Array.from({ length: 4 }).map((_, c) => {
                const key = `${r}-${c}`;
                if (r < 3 && c < 3) {
                  const idx = r * 3 + c;
                  if (idx === CM_DEMO_BLANK) {
                    return (
                      <div key={key} className={`${styles.demoCmCell} ${styles.demoCmBlank}`}>
                        <span className={styles.demoCmQ}>?</span>
                        <span className={styles.demoCmFill}>{CM_DEMO_CELLS[idx]}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className={styles.demoCmCell}>
                      {CM_DEMO_CELLS[idx]}
                    </div>
                  );
                }
                if (r < 3 && c === 3) {
                  return (
                    <div key={key} className={`${styles.demoCmTarget} ${r === 0 ? styles.demoCmTargetHit : ''}`}>
                      {CM_DEMO_ROW_SUMS[r]}
                    </div>
                  );
                }
                if (r === 3 && c < 3) {
                  return (
                    <div key={key} className={`${styles.demoCmTarget} ${c === 1 ? styles.demoCmTargetHit : ''}`}>
                      {CM_DEMO_COL_SUMS[c]}
                    </div>
                  );
                }
                return <div key={key} />;
              }),
            )}
          </div>
          <div className={styles.demoCmPad}>
            {[3, 4, 5, 6, 7].map((n) => (
              <div key={n} className={`${styles.demoCmKey} ${n === CM_DEMO_CELLS[CM_DEMO_BLANK] ? styles.demoCmKeyTap : ''}`}>
                {n}
              </div>
            ))}
          </div>
        </div>
      );
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
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoMemRow}>
            {['해', '달', '별'].map((w, i) => (
              <div key={w} className={`${styles.demoMemChip} ${i === 1 ? styles.demoMemChip1 : i === 2 ? styles.demoMemChip2 : ''}`}>
                {w}
              </div>
            ))}
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
    case 'balance':
      // A를 올린 왼쪽 접시가 내려가므로 A가 더 무거운 가짜 — 아래 A가 정답으로 표시된다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoScale}>
            <div className={styles.demoScalePivot} />
            <div className={styles.demoScaleBeam}>
              <div className={`${styles.demoScalePan} ${styles.demoScalePanL}`}>
                <ItemChip idx={0} size={20} />
              </div>
              <div className={`${styles.demoScalePan} ${styles.demoScalePanR}`}>
                <ItemChip idx={1} size={20} />
              </div>
            </div>
          </div>
          <div className={styles.demoBalItems}>
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className={`${styles.demoBalItem} ${idx === 0 ? styles.demoBalFound : ''}`}>
                <ItemChip idx={idx} size={22} />
              </div>
            ))}
          </div>
        </div>
      );
    case 'combo':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoComboStage}>
            {COMBO_DEMO_SETS.map((set, p) => (
              <div key={set.label} className={`${styles.demoComboPhase} ${styles[`demoComboPhase${p + 1}`]}`}>
                <div className={styles.demoComboRow}>
                  {set.cards.map((card, i) => (
                    <div
                      key={card.id}
                      className={`${styles.demoComboCard} ${styles[`comboCardBg${card.bg}`]} ${
                        styles[`demoComboPick${i + 1}`]
                      } ${styles[`demoComboOk${p + 1}`]}`}
                    >
                      <ComboShape card={card} size={26} />
                    </div>
                  ))}
                </div>
                <span className={`${styles.demoComboCaption} ${styles[`demoComboCaptionOk${p + 1}`]}`}>{set.label}</span>
              </div>
            ))}
            <div className={`${styles.demoComboPhase} ${styles.demoComboPhase4}`}>
              <span className={styles.demoComboPassBtn}>결</span>
              <span className={styles.demoComboCaption}>더 찾을 결합이 없으면 → 다음 세트</span>
            </div>
          </div>
        </div>
      );
    case 'equation':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoEqRow}>
            {['3', '×', '5', '-', '2', '-', '4'].map((t, i) => (
              <span key={i} className={styles.demoEqTok} style={{ animationDelay: `${i * 0.35}s` }}>
                {t}
              </span>
            ))}
            <span className={styles.demoEqEq}>= 9</span>
          </div>
        </div>
      );
    default:
      return null;
  }
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function GamePodium({ gameId }: { gameId: string }) {
  const [entries, setEntries] = useState<GameTimeEntry[]>([]);
  useEffect(() => {
    const unsub = subscribeGameLeaderboard(gameId, setEntries, () => {});
    return unsub;
  }, [gameId]);
  if (entries.length === 0) return null;
  const [first, second, third] = entries;
  const columns = [
    { place: 2, entry: second },
    { place: 1, entry: first },
    { place: 3, entry: third },
  ].filter((c) => c.entry);
  return (
    <div className={styles.podium}>
      {columns.map(({ place, entry }) => (
        <div className={styles.podiumCol} key={entry!.id}>
          <div className={styles.podiumNick}>{entry!.nick}</div>
          <div className={styles.podiumTime}>
            {isPreciseGame(gameId) ? formatPreciseElapsed(entry!.elapsedMs) : formatElapsed(entry!.elapsedMs)}
          </div>
          <div className={`${styles.podiumBlock} ${styles[`podiumBlock${place}`]}`}>
            <span className={styles.podiumMedal}>{MEDALS[place]}</span>
          </div>
        </div>
      ))}
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

// 크랙을 낸 것(=QR을 찾은 것)과 글을 남긴 것은 이제 별개다. 글은 안 써도 크랙이 나기 때문에,
// 찾았지만 아직 안 적은 칸은 여기서 "적기"로 다시 열어 그때 적을 수 있게 한다.
// 아직 못 찾은 칸은 눌리지 않는다 — 여기로 미션을 열어버리면 QR을 찾지 않고도 깰 수 있게 된다.
function MissionRecordAccordion({
  items,
  answers,
  opened,
  onWrite,
}: {
  items: LockItem[];
  answers: MissionAnswers;
  opened: Record<string, boolean>;
  onWrite: (item: LockItem) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className={styles.recordList}>
      {items.map((item) => {
        const answer = answers[item.id];
        const found = Boolean(opened[item.id]);
        const answered = Boolean(answer);
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className={styles.recordItem}>
            <button
              className={styles.recordHead}
              disabled={!found}
              onClick={() => (answered ? setOpenId(isOpen ? null : item.id) : onWrite(item))}
            >
              <span className={`${styles.recordDot} ${found ? styles.recordDotOn : ''}`} />
              <span className={styles.recordName}>{item.name}</span>
              {found && !answered && <span className={styles.recordWrite}>적기</span>}
              {answered ? (
                <svg
                  className={`${styles.recordChev} ${isOpen ? styles.recordChevOpen : ''}`}
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              ) : (
                !found && <span className={styles.recordPending}>미발견</span>
              )}
            </button>
            <div className={`${styles.recordBody} ${isOpen ? styles.recordBodyOpen : ''}`}>
              <div className={styles.recordBodyInner}>
                <p>{answer?.answer}</p>
              </div>
            </div>
          </div>
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
  useScrollFit(state.day);
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // 진행 중(아직 완료 전)인 자물쇠 id. X로 닫았다가 같은 자물쇠를 다시 열면
  // 처음부터 다시 만들지 않고 하던 판을 그대로 이어서 보여준다.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [restartMenuOpen, setRestartMenuOpen] = useState(false);
  const [answered, setAnswered] = useState<{ idx: number; correct: boolean } | null>(null);
  const [tileOrder, setTileOrder] = useState<number[]>([]);
  const [tileSelected, setTileSelected] = useState<number | null>(null);

  // 기억의 미로
  const [mazeStageIdx, setMazeStageIdx] = useState(0);
  const mazeStage = MAZE_STAGES[mazeStageIdx] ?? MAZE_STAGES[MAZE_STAGES.length - 1];
  const [mazePath, setMazePath] = useState<Set<string>>(new Set());
  const [mazePos, setMazePos] = useState<[number, number]>([0, 0]);
  const [mazePhase, setMazePhase] = useState<'reveal' | 'move'>('reveal');
  const [mazeWrong, setMazeWrong] = useState(false);
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

  // 성경 십자 연산
  const [cmRound, setCmRound] = useState<CrossMathRound | null>(null);
  const [cmValues, setCmValues] = useState<(number | null)[]>(new Array(9).fill(null));
  const [cmSelected, setCmSelected] = useState<number | null>(null);
  const cmLines = cmRound
    ? crossMathLines(cmValues, cmRound)
    : { rows: [false, false, false] as [boolean, boolean, boolean], cols: [false, false, false] as [boolean, boolean, boolean] };

  // 시각 부호 해독
  const [cbStageIdx, setCbStageIdx] = useState(0);
  const [cbRound, setCbRound] = useState<CodeBreakRound | null>(null);
  const [cbInput, setCbInput] = useState('');
  const [cbWrong, setCbWrong] = useState(false);

  // 가짜 찾기(저울)
  const [balStageIdx, setBalStageIdx] = useState(0);
  const [balRound, setBalRound] = useState<BalanceRound | null>(null);
  const [balWrong, setBalWrong] = useState(false);

  // 순발력 타격
  const [reflexHits, setReflexHits] = useState(0);
  const [reflexActiveCell, setReflexActiveCell] = useState<number | null>(null);
  const reflexSpawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reflexClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [comboRounds, setComboRounds] = useState<ComboCard[][]>([]);
  const [comboRoundIdx, setComboRoundIdx] = useState(0);
  const [comboSelected, setComboSelected] = useState<number[]>([]);
  const [comboFound, setComboFound] = useState<[number, number, number][]>([]);
  const [comboWrong, setComboWrong] = useState(false);
  const [eqRound, setEqRound] = useState<EquationRound | null>(null);
  const [eqTokens, setEqTokens] = useState<EqToken[]>([]);
  const [eqNumUsed, setEqNumUsed] = useState<boolean[]>([]);
  const [eqStreak, setEqStreak] = useState(0);
  const [loGrid, setLoGrid] = useState<boolean[][] | null>(null);
  const [loSize, setLoSize] = useState(5);
  const [loStageIdx, setLoStageIdx] = useState(0);
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
  const [scannerOpen, setScannerOpen] = useState(false);
  // 등록할 때 적은 "나의 다짐"과 내 정보(복구 코드·로그아웃)를 꺼내 보는 시트.
  // 게임용 시트와 성격이 달라서 따로 연다.
  const [vowOpen, setVowOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [logoutArmed, setLogoutArmed] = useState(false);
  const qrHandled = useRef(false);

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

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (mazeRevealTimer.current) clearTimeout(mazeRevealTimer.current);
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
          if (getGameAttempts(itemId) < MAX_RANKED_ATTEMPTS) {
            setAccumulatedMs(itemId, base + (now - start));
          }
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
      const done = FINAL_REQUIRED.filter((k) => state.opened[k]).length;
      if (done < FINAL_REQUIRED.length) {
        setSheet({ kind: 'finalLocked', done, need: FINAL_REQUIRED.length });
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
      // 이미 진행 중인 판이 있으면 초기화하지 않고 그대로 이어서 보여준다. 타임어택형이면
      // 여기서 세션을 다시 시작해 "나가있던 동안"은 시간에서 빠지도록 한다.
      if (TIMED_KINDS.has(item.type)) {
        setSessionStart(Date.now());
        setNowTick(Date.now());
      }
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

  // 화면을 벗어날 때(X, 배경 탭) 지금까지 경과한 시간을 누적값에 더해 "정지"시킨다.
  const closeSheet = () => {
    if (isTimedSheet(sheet) && sessionStart !== null) {
      const total = accumulatedBase + (Date.now() - sessionStart);
      setAccumulatedBase(total);
      if (getGameAttempts(sheet.item.id) < MAX_RANKED_ATTEMPTS) setAccumulatedMs(sheet.item.id, total);
      setSessionStart(null);
    }
    setSheet(null);
  };

  // 순위에 반영되는 시도(처음 3번)가 남아있다면 지난번에 멈춰둔 누적시간부터, 다 썼다면 0부터 이어서 흐른다.
  const beginTimedGame = (item: LockItem) => {
    const base = getGameAttempts(item.id) >= MAX_RANKED_ATTEMPTS ? 0 : getAccumulatedMs(item.id);
    setAccumulatedBase(base);
    setSessionStart(Date.now());
    setNowTick(Date.now());
  };

  // 처음 3번의 시도까지만 순위에 반영되고, 그중 가장 빠른 기록이 순위판에 남는다.
  const finishTimedGame = (item: LockItem) => {
    const elapsed = sessionStart !== null ? accumulatedBase + (Date.now() - sessionStart) : accumulatedBase;
    openLock(item.id);
    if (getGameAttempts(item.id) < MAX_RANKED_ATTEMPTS) {
      incrementGameAttempts(item.id);
      if (state.id)
        saveGameTime(item.type, state.id, state.nickname || state.nick, elapsed).catch((e) =>
          console.error('saveGameTime failed', e),
        );
    }
    setAccumulatedMs(item.id, 0);
    setSessionStart(null);
    setLastElapsed(elapsed);
    setSheet({ kind: 'reveal', item });
  };

  const beginMazeRound = (stageIdx: number) => {
    const path = generateMazePath(stageIdx);
    setMazePath(new Set(path.map(([r, c]) => `${r},${c}`)));
    setMazePos([0, 0]);
    setMazePhase('reveal');
    if (mazeRevealTimer.current) clearTimeout(mazeRevealTimer.current);
    mazeRevealTimer.current = setTimeout(() => setMazePhase('move'), MAZE_REVEAL_MS);
  };

  const mazeFail = () => {
    setMazeWrong(true);
    setTimeout(() => {
      setMazeWrong(false);
      beginMazeRound(mazeStageIdx);
    }, 500);
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

  const startGame = (item: LockItem) => {
    setActiveItemId(item.id);
    setAnswered(null);
    setLastElapsed(null);
    if (item.type === 'crossmath') {
      beginTimedGame(item);
      setCmRound(generateCrossMathRound());
      setCmValues(new Array(9).fill(null));
      setCmSelected(null);
      setSheet({ kind: 'crossmath', item });
      return;
    }
    if (item.type === 'codebreak') {
      beginTimedGame(item);
      setCbStageIdx(0);
      setCbRound(generateCodeBreakRound(0));
      setCbInput('');
      setCbWrong(false);
      setSheet({ kind: 'codebreak', item });
      return;
    }
    if (item.type === 'balance') {
      beginTimedGame(item);
      setBalStageIdx(0);
      setBalRound(generateBalanceRound(0));
      setBalWrong(false);
      setSheet({ kind: 'balance', item });
      return;
    }
    if (item.type === 'reflex') {
      beginTimedGame(item);
      setReflexHits(0);
      setReflexActiveCell(null);
      setSheet({ kind: 'reflex', item });
      scheduleReflexSpawn();
      return;
    }
    if (item.type === 'memory') {
      // 실제 타이머는 '시작' 버튼을 눌러 플래시가 뜨는 순간(beginFlashShow)부터 시작한다.
      setFlashRoundIdx(0);
      setFlashRound(generateFlashRound(FLASH_ROUNDS[0]));
      setFlashPhase('ready');
      setFlashProgress(0);
      setFlashWrong(false);
      setSheet({ kind: 'memory', item });
      return;
    }
    if (item.type === 'tilepuzzle') {
      let order = shuffleArr(TILE_PUZZLE.tiles.map((_, idx) => idx));
      while (order.every((v, i) => v === i)) {
        order = shuffleArr(TILE_PUZZLE.tiles.map((_, idx) => idx));
      }
      setTileOrder(order);
      setTileSelected(null);
      setSheet({ kind: 'tilepuzzle', item });
      return;
    }
    if (item.type === 'maze') {
      beginTimedGame(item);
      setMazeStageIdx(0);
      beginMazeRound(0);
      setSheet({ kind: 'maze', item });
      return;
    }
    if (item.type === 'combo') {
      beginTimedGame(item);
      setComboRounds(generateComboRounds(COMBO_ROUNDS));
      setComboRoundIdx(0);
      setComboSelected([]);
      setComboFound([]);
      setComboWrong(false);
      setSheet({ kind: 'combo', item });
      return;
    }
    if (item.type === 'equation') {
      beginTimedGame(item);
      setEqStreak(0);
      const round = generateEquationRound();
      setEqRound(round);
      setEqTokens([]);
      setEqNumUsed(new Array(round.numbers.length).fill(false));
      setSheet({ kind: 'equation', item });
      return;
    }
    if (item.type === 'lightsout') {
      beginTimedGame(item);
      setLoStageIdx(0);
      const round = generateLightsOut(LO_STAGES[0]);
      setLoGrid(round.initial);
      setLoSize(round.size);
      setSheet({ kind: 'lightsout', item });
      return;
    }
    setAnswerDraft('');
    setSheet({ kind: item.type === 'quiz' ? 'quiz' : 'mission', item });
  };

  const clearGameTimers = () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (mazeRevealTimer.current) clearTimeout(mazeRevealTimer.current);
    if (reflexSpawnTimer.current) clearTimeout(reflexSpawnTimer.current);
    if (reflexClearTimer.current) clearTimeout(reflexClearTimer.current);
  };

  // 지금 보고 있는 단계만 새 문제로 다시 깐다. 진행한 단계 수도, 경과시간도 그대로 둔다 —
  // 여기서 시간까지 0으로 돌려주면 마지막 단계에서 눌러 기록을 마음대로 만들 수 있게 된다.
  const restartRound = (item: LockItem) => {
    clearGameTimers();
    setLastElapsed(null);

    switch (item.type) {
      case 'crossmath':
        setCmRound(generateCrossMathRound());
        setCmValues(new Array(9).fill(null));
        setCmSelected(null);
        break;
      case 'codebreak':
        setCbRound(generateCodeBreakRound(cbStageIdx));
        setCbInput('');
        setCbWrong(false);
        break;
      case 'balance':
        setBalRound(generateBalanceRound(balStageIdx));
        setBalWrong(false);
        break;
      case 'reflex':
        setReflexHits(0);
        setReflexActiveCell(null);
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
        // 지금 문제만 새로 낸다. 여태 쌓은 연속 성공 수는 유지된다.
        const round = generateEquationRound();
        setEqRound(round);
        setEqTokens([]);
        setEqNumUsed(new Array(round.numbers.length).fill(false));
        break;
      }
      case 'lightsout': {
        const round = generateLightsOut(LO_STAGES[loStageIdx]);
        setLoGrid(round.initial);
        setLoSize(round.size);
        break;
      }
    }
  };

  // 판을 통째로 버리고 1단계부터 새로. 진행도를 전부 반납하는 대신 경과시간도 0으로 되돌린다.
  const restartAll = (item: LockItem) => {
    clearGameTimers();
    setAccumulatedMs(item.id, 0);
    setAccumulatedBase(0);
    setNowTick(Date.now());
    // 플래시 기억은 '시작'을 눌러야 시계가 도는 게임이라 멈춘 채로 두고, 나머지는 startGame이 곧바로 다시 돌린다.
    setSessionStart(null);
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

  const beginFlashShow = (item: LockItem) => {
    // 라운드가 바뀔 때마다 다시 시작을 누르지만, 타이머는 한 번 돌기 시작하면 라운드 사이에도 계속 흐른다.
    // 시계가 멈춰 있을 때(첫 라운드, 또는 재시작 직후)만 다시 돌린다.
    if (sessionStart === null) beginTimedGame(item);
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
        setTimeout(() => {
          const nextRoundIdx = flashRoundIdx + 1;
          if (nextRoundIdx >= FLASH_ROUNDS.length) {
            finishTimedGame(item);
          } else {
            setFlashRoundIdx(nextRoundIdx);
            setFlashRound(generateFlashRound(FLASH_ROUNDS[nextRoundIdx]));
            setFlashProgress(0);
            setFlashPhase('ready');
          }
        }, 400);
      }
    } else {
      setFlashWrong(true);
      setTimeout(() => {
        setFlashWrong(false);
        setFlashRound(generateFlashRound(FLASH_ROUNDS[flashRoundIdx]));
        setFlashProgress(0);
        setFlashPhase('ready');
      }, 500);
    }
  };

  const tapTile = (item: LockItem, pos: number) => {
    if (tileSelected === null) {
      setTileSelected(pos);
      return;
    }
    if (tileSelected === pos) {
      setTileSelected(null);
      return;
    }
    const next = [...tileOrder];
    [next[tileSelected], next[pos]] = [next[pos], next[tileSelected]];
    setTileOrder(next);
    setTileSelected(null);
    if (next.every((v, i) => v === i)) {
      setTimeout(() => {
        openLock(item.id);
        setSheet({ kind: 'reveal', item });
      }, 400);
    }
  };

  const moveMaze = (item: LockItem, dr: number, dc: number) => {
    if (mazePhase !== 'move') return;
    const [r, c] = mazePos;
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= mazeStage.rows || nc >= mazeStage.cols) return;
    if (!mazePath.has(`${nr},${nc}`)) {
      mazeFail();
      return;
    }
    setMazePos([nr, nc]);
    if (nr === mazeStage.rows - 1 && nc === mazeStage.cols - 1) {
      if (mazeRevealTimer.current) clearTimeout(mazeRevealTimer.current);
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
      return;
    }
    setCmSelected(idx);
  };

  const tapCmDigit = (item: LockItem, d: number) => {
    if (cmSelected === null || cmValues.includes(d)) return;
    const next = [...cmValues];
    next[cmSelected] = d;
    setCmValues(next);
    setCmSelected(null);
    if (cmRound && checkCrossMath(next, cmRound)) {
      setTimeout(() => {
        finishTimedGame(item);
      }, 300);
    }
  };

  const tapCbDigit = (d: number) => {
    setCbInput((v) => (v.length >= 2 ? v : v + String(d)));
  };

  const cbBackspace = () => setCbInput((v) => v.slice(0, -1));

  const cbSubmit = (item: LockItem) => {
    if (!cbRound || cbInput === '') return;
    if (Number(cbInput) === cbRound.answer) {
      const nextStage = cbStageIdx + 1;
      if (nextStage >= CODEBREAK_STAGES.length) {
        finishTimedGame(item);
      } else {
        setCbStageIdx(nextStage);
        setCbRound(generateCodeBreakRound(nextStage));
        setCbInput('');
        setCbWrong(false);
        toast(`${nextStage}/${CODEBREAK_STAGES.length}단계 통과! 다음 단계`);
      }
    } else {
      toast('정답이 아니에요');
      setCbWrong(true);
      setTimeout(() => setCbWrong(false), 400);
      setCbInput('');
    }
  };

  const tapBalanceItem = (item: LockItem, idx: number) => {
    if (!balRound) return;
    if (idx === balRound.fakeIndex) {
      setTimeout(() => {
        const nextStage = balStageIdx + 1;
        if (nextStage >= BALANCE_STAGES.length) {
          finishTimedGame(item);
        } else {
          setBalStageIdx(nextStage);
          setBalRound(generateBalanceRound(nextStage));
        }
      }, 400);
    } else {
      setBalWrong(true);
      setTimeout(() => {
        setBalWrong(false);
        setBalRound(generateBalanceRound(balStageIdx));
      }, 500);
    }
  };

  const tapReflexCell = (item: LockItem, idx: number) => {
    if (idx !== reflexActiveCell) return;
    if (reflexClearTimer.current) clearTimeout(reflexClearTimer.current);
    setReflexActiveCell(null);
    const nextHits = reflexHits + 1;
    setReflexHits(nextHits);
    if (nextHits >= REFLEX_TARGET_HITS) {
      finishTimedGame(item);
    } else {
      scheduleReflexSpawn();
    }
  };

  // 오답 패널티: 게임을 리셋하지 않고 경과시간에 10초를 더한다(세션 시작시각을 앞당기는 방식).
  const applyComboPenalty = () => {
    setSessionStart((s) => (s !== null ? s - COMBO_PENALTY_MS : s));
  };

  const comboPenalize = (message: string) => {
    applyComboPenalty();
    setComboWrong(true);
    toast(message);
    setTimeout(() => {
      setComboWrong(false);
      setComboSelected([]);
    }, 500);
  };

  const advanceComboRound = (item: LockItem) => {
    setComboSelected([]);
    setComboFound([]);
    const nextRound = comboRoundIdx + 1;
    if (nextRound >= comboRounds.length) {
      finishTimedGame(item);
    } else {
      setComboRoundIdx(nextRound);
    }
  };

  const tapCombo = (idx: number) => {
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
          toast('이미 찾은 결합이에요');
          setComboSelected([]);
        } else {
          setComboFound([...comboFound, sorted]);
          setComboSelected([]);
        }
      } else {
        comboPenalize('결합이 아니에요 · 10초 페널티');
      }
    }
  };

  // "결" 선언: 지금 보드에 아직 못 찾은 결합이 없다고 주장한다. 실제로 다 찾았으면 다음 세트로, 남아있으면 페널티.
  const declareNoCombo = (item: LockItem) => {
    const board = comboRounds[comboRoundIdx];
    const total = findAllCombos(board).length;
    if (comboFound.length >= total) {
      advanceComboRound(item);
    } else {
      comboPenalize('아직 못 찾은 결합이 있어요 · 10초 페널티');
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

  const eqSubmit = (item: LockItem) => {
    if (!eqRound) return;
    if (!eqNumUsed.every(Boolean)) {
      toast('숫자를 전부 사용해야 해요');
      return;
    }
    const result = evaluateTokens(eqTokens);
    if (result === eqRound.target) {
      const nextStreak = eqStreak + 1;
      setEqStreak(nextStreak);
      if (nextStreak >= EQ_TARGET_STREAK) {
        finishTimedGame(item);
      } else {
        const round = generateEquationRound();
        setEqRound(round);
        setEqTokens([]);
        setEqNumUsed(new Array(round.numbers.length).fill(false));
        toast(`${nextStreak}/${EQ_TARGET_STREAK} 성공! 다음 문제`);
      }
    } else {
      toast(result === null ? '수식이 올바르지 않아요' : `${result} — 목표(${eqRound.target})와 달라요`);
    }
  };

  const tapLight = (item: LockItem, r: number, c: number) => {
    if (!loGrid) return;
    const next = toggleLight(loGrid, r, c, loSize);
    setLoGrid(next);
    if (next.every((row) => row.every((v) => !v))) {
      setTimeout(() => {
        const nextStage = loStageIdx + 1;
        if (nextStage >= LO_STAGES.length) {
          finishTimedGame(item);
        } else {
          setLoStageIdx(nextStage);
          const round = generateLightsOut(LO_STAGES[nextStage]);
          setLoGrid(round.initial);
          setLoSize(round.size);
        }
      }, 300);
    }
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
        setSheet({ kind: 'eggComplete', item });
        return;
      }
    }
    setSheet({ kind: 'reveal', item });
  };

  const day2CrackCount = DAY2_MISSION_IDS.filter((id) => state.opened[id]).length;

  const elapsedMs = accumulatedBase + (sessionStart !== null ? nowTick - sessionStart : 0);
  const elapsedText =
    sheet && isPreciseGame(sheet.kind) ? formatPreciseElapsed(elapsedMs) : formatElapsed(elapsedMs);

  // 9개 미니게임이 공통으로 쓰는 상단 줄 — 게임 이름 · 경과시간. (재시작은 시트 우상단에 따로 있다)
  const gameHeader = (label: React.ReactNode, showTimer = true) => (
    <div className={styles.timerRow}>
      <span className="pill">{label}</span>
      {showTimer && <span className={styles.timerBadge}>⏱ {elapsedText}</span>}
    </div>
  );

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
                    <b>이 {stage.unit}만 다시</b>
                    <span>시간은 이어서 흘러요</span>
                  </button>
                  <button
                    className={styles.restartMenuItem}
                    onClick={() => {
                      setRestartMenuOpen(false);
                      restartAll(item);
                    }}
                  >
                    <b>처음부터 다시</b>
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
          <button className={styles.iconBtn} onClick={() => goScreen('intro')} aria-label="수련회 개요 다시 보기">
            <svg viewBox="0 0 24 24">
              <path d="M5 5h14M5 10h14M5 15h9" />
            </svg>
          </button>
          <button className={styles.iconBtn} onClick={() => setVowOpen(true)} aria-label="나의 다짐 보기">
            <svg viewBox="0 0 24 24">
              <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.6L6 20V5a1 1 0 0 1 1-1z" />
            </svg>
          </button>
          <button className={styles.rankBtn} onClick={() => goScreen('rank')} aria-label="순위 보기">
            <svg viewBox="0 0 24 24">
              <path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z" />
            </svg>
          </button>
        </div>
      </div>
      <h1>3일 간 여정</h1>

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

      {state.day === 2 &&
        (() => {
          const g = sectionGate(SECTION_GATES.d2Type);
          return (
            <NavCard
              icon={
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" />
                  <circle cx="12" cy="12" r="2.6" />
                </svg>
              }
              name="IDOL-X · 우상 유형 검사"
              sub="아침 큐티 직후, 가장 먼저 해보세요"
              locked={g.locked}
              lockedSub={g.at ? `${formatKST(g.at)}에 열려요` : SECTION_GATES.d2Type.lockedSub}
              onClick={() => (g.locked ? toastGate(g) : goScreen('type'))}
            />
          );
        })()}

      {/* 검사 결과를 혼자 읽고 끝내지 않고 입 밖으로 꺼내는 자리.
          검사 직후가 아니라 진행자가 나눔 시간을 잡았을 때 열어준다. */}
      {state.day === 2 &&
        (() => {
          const g = sectionGate(SECTION_GATES.d2Share);
          return (
            <NavCard
              icon={
                <svg viewBox="0 0 24 24">
                  <path d="M4 5h16v10H8l-4 4z" />
                </svg>
              }
              name="유형 나눔"
              sub="같은 유형끼리, 그리고 우리 조에서"
              locked={g.locked}
              lockedSub={g.at ? `${formatKST(g.at)}에 열려요` : SECTION_GATES.d2Share.lockedSub}
              onClick={() => (g.locked ? toastGate(g) : goScreen('share'))}
            />
          );
        })()}

      {state.day === 2 &&
        (() => {
          const g = sectionGate(SECTION_GATES.d2Qr);
          return (
            <div className={styles.eggHero}>
              <EggCrack count={day2CrackCount} total={DAY2_MISSION_IDS.length} />
              <button className="btn" disabled={g.locked} onClick={() => setScannerOpen(true)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 8a2 2 0 0 1 2-2h1.6l1.2-1.6h6.4L16.4 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
                  <circle cx="12" cy="13" r="3.4" />
                </svg>
                QR 스캔하기
              </button>
              <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
                {g.locked
                  ? g.at
                    ? `${formatKST(g.at)}에 열려요`
                    : SECTION_GATES.d2Qr.lockedSub
                  : '물놀이 전후로 숲과 계곡 곳곳의 QR을 찾아보세요'}
              </p>
            </div>
          );
        })()}

      {state.day !== 2 && (
        <div className={styles.lockGrid}>
          {dayData.items.map((item, idx) => {
            const open = !!state.opened[item.id];
            // 시트에서 시각을 정해둔 자물쇠는 그 시각 전까지 눌러도 열리지 않으므로 흐리게 보여준다.
            const gated = !open && itemGate(item).locked;
            const letter = state.day === 1 ? BACKTOGOD_WORD[idx] : null;
            return (
              <div
                key={item.id}
                className={`${styles.lockTile} ${open ? styles.lockTileOpen : ''} ${gated ? styles.lockTileGated : ''}`}
                onClick={() => handleLockClick(item)}
                aria-label={open ? `${item.name} · 열림` : gated ? '아직 열리지 않은 자물쇠' : '잠긴 자물쇠'}
              >
                {open && letter ? <span className={styles.lockLetter}>{letter}</span> : <LockIcon open={open} />}
              </div>
            );
          })}
        </div>
      )}

      {state.day === 2 &&
        (() => {
          const g = sectionGate(SECTION_GATES.d2Write);
          return (
            <>
              <hr className={styles.sectionDivider} />
              <div className={styles.sectionLabel}>이 날 더 해보기</div>
              <NavCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path d="M4 20h16M6 16l9-9 3 3-9 9H6z" />
                  </svg>
                }
                name="숲의 기록"
                sub="오늘 마주한 것을 남겨보세요"
                locked={g.locked}
                lockedSub={g.at ? `${formatKST(g.at)}에 열려요` : SECTION_GATES.d2Write.lockedSub}
                onClick={() => (g.locked ? toastGate(g) : goScreen('write'))}
              />
            </>
          );
        })()}
      {state.day === 3 &&
        (() => {
          const g = sectionGate(SECTION_GATES.d3Decide);
          return (
            <>
              <hr className={styles.sectionDivider} />
              <div className={styles.sectionLabel}>이 날 더 해보기</div>
              <NavCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3l2 5 5 .5-4 3.5 1 5-4-2.5L8 20l1-5-4-3.5 5-.5z" />
                  </svg>
                }
                name="마지막 열쇠 · 결단"
                sub="깨어난 집중으로 세상에 나아가요"
                locked={g.locked}
                lockedSub={g.at ? `${formatKST(g.at)}에 열려요` : SECTION_GATES.d3Decide.lockedSub}
                onClick={() => (g.locked ? toastGate(g) : goScreen('decide'))}
              />
            </>
          );
        })()}

      {state.day === 2 && (
        <>
          <hr className={styles.sectionDivider} />
          <div className={styles.sectionLabel}>
            나의 기록 · {day2CrackCount}/{DAY2_MISSION_IDS.length}
          </div>
          <MissionRecordAccordion
            items={DAY2_MISSIONS}
            answers={missionAnswers}
            opened={state.opened}
            onWrite={writeMissionRecord}
          />
        </>
      )}

      {scannerOpen && <QrScanner parse={parseQrText} onDetect={handleScanDetect} onClose={() => setScannerOpen(false)} />}

      <Sheet open={vowOpen} onClose={closeVow}>
        <span className="pill">{VOW_PROMPT.recallTitle}</span>
        <h2 style={{ margin: '8px 0 12px' }}>{VOW_PROMPT.question}</h2>
        {state.vow ? (
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 15.5, lineHeight: 1.85, color: '#d9cdbb' }}>{state.vow}</p>
        ) : (
          <p className="muted">등록할 때 남겨둔 다짐이 없어요.</p>
        )}

        <hr className={styles.sectionDivider} />
        <div className={styles.sectionLabel}>내 정보 · {state.nickname || state.nick}</div>
        <div className={styles.codeRow}>
          <div className={styles.codeValue}>{state.id}</div>
          <button className={styles.copyBtn} onClick={copyCode}>
            {codeCopied ? '복사됨' : '복사'}
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

      <Sheet open={sheet !== null} onClose={closeSheet} fullscreen action={restartAction}>
        {sheet?.kind === 'intro' &&
          (() => {
            const intro = GAME_INTRO[sheet.item.type];
            if (!intro) return null;
            return (
              <>
                <span className="pill">{intro.pill}</span>
                <h2 style={{ margin: '6px 0 10px' }}>{intro.title}</h2>
                <p className="muted" style={{ marginBottom: 12, lineHeight: 1.7 }}>
                  {intro.desc}
                </p>
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
              🥚 QR 크랙 {DAY2_MISSION_IDS.includes(sheet.item.id) ? `· ${day2CrackCount}/${DAY2_MISSION_IDS.length}` : ''}
            </span>
            <h2 style={{ margin: '6px 0 10px' }}>{sheet.item.name}</h2>
            <p style={{ fontSize: 15.5, color: '#d9cdbb', marginBottom: 8 }}>{sheet.item.q}</p>
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
            <button className="btn" onClick={() => completeMission(sheet.item)}>
              {state.opened[sheet.item.id] ? '기록 저장' : '완료했어요 · 크랙 내기'}
            </button>
          </>
        )}

        {sheet?.kind === 'crossmath' && cmRound && (
          <>
            {gameHeader('✝️ 성경 십자 연산')}
            <h2 style={{ margin: '6px 0 4px' }}>1~9를 겹치지 않게 채워 합을 맞추세요</h2>
            <p className="muted" style={{ marginBottom: 6 }}>
              {cmRound.hint}
            </p>
            <p className="muted" style={{ marginBottom: 14 }}>
              빈칸을 탭해 선택하고, 아래 숫자패드로 채워보세요. 오른쪽·아래 숫자가 목표 합이에요.
              합이 맞은 줄은 초록색으로 표시돼요.
            </p>
            <div className={styles.cmGrid}>
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
                        } ${done ? styles.cmCellDone : ''}`}
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
            <div className={styles.eqNumRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <button
                  key={d}
                  className={styles.eqNumBtn}
                  disabled={cmValues.includes(d) || cmSelected === null}
                  onClick={() => tapCmDigit(sheet.item, d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}

        {sheet?.kind === 'codebreak' && cbRound && (
          <>
            {gameHeader(`🔺 부호 해독 · ${cbStageIdx + 1}/${CODEBREAK_STAGES.length}단계`)}
            <h2 style={{ margin: '6px 0 4px' }}>도형마다 숨은 숫자를 추리하세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              {cbRound.shapeCount}개 도형에 0~9 중 겹치지 않는 숫자가 배정되어 있어요. 힌트 {cbRound.hints.length}개를 보고
              최종식을 풀어보세요.
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
            <div className={`${styles.cbHintRow} ${styles.cbFinalRow} ${cbWrong ? styles.cbWrong : ''}`}>
              <ShapeIcon shape={cbRound.final.a} />
              <span className={styles.cbOp}>+</span>
              <ShapeIcon shape={cbRound.final.b} />
              <span className={styles.cbOp}>=</span>
              <span className={styles.cbInputDisplay}>{cbInput || '?'}</span>
            </div>
            <div className={styles.eqNumRow}>
              {[1, 2, 3, 4, 5].map((d) => (
                <button key={d} className={styles.eqNumBtn} onClick={() => tapCbDigit(d)}>
                  {d}
                </button>
              ))}
            </div>
            <div className={styles.eqNumRow}>
              {[6, 7, 8, 9, 0].map((d) => (
                <button key={d} className={styles.eqNumBtn} onClick={() => tapCbDigit(d)}>
                  {d}
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn ghost" onClick={cbBackspace}>
                지우기
              </button>
              <button className="btn" onClick={() => cbSubmit(sheet.item)}>
                확인
              </button>
            </div>
          </>
        )}

        {sheet?.kind === 'balance' && balRound && (
          <>
            {gameHeader(
              `⚖️ 가짜 찾기 · ${balStageIdx + 1}/${BALANCE_STAGES.length}단계 (${balRound.itemCount}개)`,
            )}
            <h2 style={{ margin: '6px 0 4px' }}>딱 하나, 무게가 다른 가짜를 찾으세요</h2>
            <p className="muted" style={{ marginBottom: 14 }}>
              아래는 이미 진행된 저울질 결과예요. 결과를 보고 어떤 것이 가짜(더 무거운 것)인지 아래에서 골라보세요.
            </p>
            <div className={styles.balWeighList}>
              {balRound.weighings.map((w, i) => {
                // 기운 쪽이 더 무겁다. 저울대는 기울이고 접시는 반대로 돌려 수평을 유지한다.
                const beamTilt =
                  w.result === 'left' ? styles.balBeamLeft : w.result === 'right' ? styles.balBeamRight : '';
                const panTilt =
                  w.result === 'left' ? styles.balPanLeft : w.result === 'right' ? styles.balPanRight : '';
                return (
                  <div key={i} className={styles.balWeighRow}>
                    <span className={styles.balWeighNum}>{i + 1}차</span>
                    <div className={styles.balScale}>
                      <div className={styles.balScalePivot} />
                      <div className={`${styles.balScaleBeam} ${beamTilt}`}>
                        <div className={`${styles.balScalePan} ${styles.balScalePanL} ${panTilt}`}>
                          {w.left.map((idx) => (
                            <ItemChip key={idx} idx={idx} size={20} />
                          ))}
                        </div>
                        <div className={`${styles.balScalePan} ${styles.balScalePanR} ${panTilt}`}>
                          {w.right.map((idx) => (
                            <ItemChip key={idx} idx={idx} size={20} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={`${styles.balItemGrid} ${balWrong ? styles.balWrong : ''}`}>
              {Array.from({ length: balRound.itemCount }).map((_, idx) => (
                <button key={idx} className={styles.balItemBtn} onClick={() => tapBalanceItem(sheet.item, idx)}>
                  <ItemChip idx={idx} size={36} />
                </button>
              ))}
            </div>
          </>
        )}

        {sheet?.kind === 'reflex' && (
          <>
            {gameHeader(`⚡ 순발력 타격 · ${reflexHits}/${REFLEX_TARGET_HITS}`)}
            <h2 style={{ margin: '6px 0 4px' }}>빛나는 칸을 최대한 빠르게 탭하세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              {REFLEX_TARGET_HITS}번 맞히면 열려요. 속도가 곧 실력!
            </p>
            <div className={styles.reflexGrid}>
              {Array.from({ length: REFLEX_GRID }).map((_, i) => (
                <button
                  key={i}
                  className={`${styles.reflexCell} ${reflexActiveCell === i ? styles.reflexCellOn : ''}`}
                  onClick={() => tapReflexCell(sheet.item, i)}
                />
              ))}
            </div>
          </>
        )}

        {sheet?.kind === 'memory' && (
          <>
            {/* 시계는 '시작'을 눌러야 돌기 시작한다. 한 번 돌기 시작하면 준비 화면에서도 계속 보여준다. */}
            {gameHeader(
              `🧠 플래시 기억 · ${flashRoundIdx + 1}/${FLASH_ROUNDS.length}세트`,
              flashPhase !== 'ready' || sessionStart !== null,
            )}
            {flashPhase === 'ready' && (
              <>
                <h2 style={{ margin: '6px 0 4px' }}>단어 {FLASH_ROUNDS[flashRoundIdx]}개가 한 개씩 스쳐 지나가요</h2>
                <p className="muted" style={{ marginBottom: 16 }}>
                  준비되면 시작을 눌러보세요. 순서까지 기억해야 해요.
                </p>
                <button className="btn" onClick={() => beginFlashShow(sheet.item)}>
                  시작
                </button>
              </>
            )}
            {flashPhase === 'show' && flashRound && (
              <>
                <p className="muted" style={{ margin: '6px 0 0', textAlign: 'center' }}>
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
                <h2 style={{ margin: '6px 0 4px' }}>방금 본 순서대로 탭하세요</h2>
                <p className="muted" style={{ marginBottom: 12 }}>
                  {flashProgress}/{flashRound.sequence.length}개 선택함
                </p>
                <div className={`${styles.flashChoiceGrid} ${flashWrong ? styles.flashWrong : ''}`}>
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

        {sheet?.kind === 'tilepuzzle' && (
          <>
            <span className="pill">🧩 퍼즐 맞추기</span>
            <h2 style={{ margin: '6px 0 4px' }}>{TILE_PUZZLE.caption}</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              타일 두 개를 순서대로 탭하면 자리가 바뀌어요.
            </p>
            <div className={styles.tileGrid}>
              {tileOrder.map((tileIdx, pos) => (
                <button
                  key={pos}
                  className={`${styles.tile} ${tileSelected === pos ? styles.tileSelected : ''}`}
                  onClick={() => tapTile(sheet.item, pos)}
                >
                  {TILE_PUZZLE.tiles[tileIdx]}
                </button>
              ))}
            </div>
          </>
        )}

        {sheet?.kind === 'maze' && (
          <>
            {gameHeader(
              `🧭 기억의 미로 · ${mazeStageIdx + 1}/${MAZE_STAGES.length}단계 (${mazeStage.rows}x${mazeStage.cols})`,
            )}
            {mazePhase === 'reveal' ? (
              <>
                <h2 style={{ margin: '6px 0 4px' }}>안전한 길을 잘 기억하세요</h2>
                <p className="muted" style={{ marginBottom: 16 }}>
                  초록색 칸이 곧 사라집니다. 잠시 후 기억으로만 이동해야 해요.
                </p>
              </>
            ) : (
              <>
                <h2 style={{ margin: '6px 0 4px' }}>출구까지 길을 찾아보세요</h2>
                <p className="muted" style={{ marginBottom: 16 }}>
                  화살표로 이동해서 깃발까지 도착하면 열려요. 함정을 밟으면 이 단계부터 다시예요.
                </p>
              </>
            )}
            <div
              className={`${styles.mazeGrid} ${mazeWrong ? styles.mazeWrongFx : ''}`}
              style={{ gridTemplateColumns: `repeat(${mazeStage.cols}, 1fr)` }}
            >
              {Array.from({ length: mazeStage.rows }).map((_, r) =>
                Array.from({ length: mazeStage.cols }).map((_, c) => {
                  const key = `${r},${c}`;
                  const isPlayer = mazePos[0] === r && mazePos[1] === c;
                  const isEnd = mazeStage.rows - 1 === r && mazeStage.cols - 1 === c;
                  const showSafe = mazePhase === 'reveal' && mazePath.has(key);
                  return (
                    <div key={key} className={`${styles.mazeCell} ${showSafe ? styles.mazeSafe : ''}`}>
                      {isPlayer ? '🧍' : isEnd ? '🚩' : mazePhase === 'move' ? '❓' : ''}
                    </div>
                  );
                }),
              )}
            </div>
            {mazePhase === 'move' && (
              <div className={styles.mazeControls}>
                <div />
                <button className={styles.mazeBtn} onClick={() => moveMaze(sheet.item, -1, 0)}>
                  ▲
                </button>
                <div />
                <button className={styles.mazeBtn} onClick={() => moveMaze(sheet.item, 0, -1)}>
                  ◀
                </button>
                <div />
                <button className={styles.mazeBtn} onClick={() => moveMaze(sheet.item, 0, 1)}>
                  ▶
                </button>
                <div />
                <button className={styles.mazeBtn} onClick={() => moveMaze(sheet.item, 1, 0)}>
                  ▼
                </button>
                <div />
              </div>
            )}
          </>
        )}

        {sheet?.kind === 'combo' && comboRounds[comboRoundIdx] && (
          <>
            {gameHeader(`🎴 결합 찾기 · ${comboRoundIdx + 1}/${comboRounds.length}세트`)}
            <h2 style={{ margin: '6px 0 4px' }}>보이는 결합을 모두 찾아보세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              모양·색·배경이 각각 셋 다 같거나 셋 다 달라야 결합이에요. 더 찾을 결합이 없으면 아래 "결" 버튼을 눌러
              다음 세트로 넘어가세요. 오답이면 리셋 없이 경과시간에 10초가 더해져요.
            </p>
            <div className={`${styles.comboGrid} ${comboWrong ? styles.comboWrong : ''}`}>
              {comboRounds[comboRoundIdx].map((card, i) => (
                <button
                  key={card.id}
                  className={`${styles.comboCard} ${styles[`comboCardBg${card.bg}`]} ${
                    comboSelected.includes(i) ? styles.comboCardSelected : ''
                  }`}
                  onClick={() => tapCombo(i)}
                >
                  <ComboShape card={card} />
                </button>
              ))}
            </div>
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => declareNoCombo(sheet.item)}>
              결 (더 이상 결합 없음)
            </button>
            {comboFound.length > 0 && (
              <div className={styles.comboFoundWrap}>
                <div className={styles.comboFoundLabel}>찾은 결합 {comboFound.length}개</div>
                <div className={styles.comboFoundRow}>
                  {comboFound.map((triple, ti) => (
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
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {sheet?.kind === 'equation' && eqRound && (
          <>
            {gameHeader(`🔢 수식 만들기 · ${eqStreak}/${EQ_TARGET_STREAK}`)}
            <h2 style={{ margin: '6px 0 4px' }}>목표 숫자: {eqRound.target}</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              숫자 4개를 전부 한 번씩만 써서 목표를 만드세요. {EQ_TARGET_STREAK}문제 연속 성공하면 열려요.
            </p>
            <div className={styles.eqDisplay}>
              {eqTokens.length === 0
                ? '숫자와 연산자를 눌러 수식을 만들어보세요'
                : eqTokens.map((t) => (t.kind === 'num' ? t.value : t.value)).join(' ')}
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
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn ghost" onClick={eqBackspace}>
                지우기
              </button>
              <button className="btn" onClick={() => eqSubmit(sheet.item)}>
                확인
              </button>
            </div>
          </>
        )}

        {sheet?.kind === 'lightsout' && loGrid && (
          <>
            {gameHeader(`💡 라이트 아웃 · ${loStageIdx + 1}/${LO_STAGES.length}단계`)}
            <h2 style={{ margin: '6px 0 4px' }}>
              {loSize}×{loSize} 불을 전부 꺼보세요
            </h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              칸을 누르면 자신과 상하좌우가 함께 반전돼요. 3→4→5단계를 전부 깨야 열려요.
            </p>
            <div className={styles.loGrid} style={{ gridTemplateColumns: `repeat(${loSize}, 1fr)` }}>
              {loGrid.map((row, r) =>
                row.map((on, c) => (
                  <button
                    key={`${r}-${c}`}
                    className={`${styles.loCell} ${on ? styles.loCellOn : ''}`}
                    onClick={() => tapLight(sheet.item, r, c)}
                  />
                ))
              )}
            </div>
          </>
        )}

        {sheet?.kind === 'reveal' && (
          <>
            <RevealCard pill="자물쇠 열림" title={sheet.item.name} footnote="…그러나 이것도 헛되더라.">
              {sheet.item.reveal}
            </RevealCard>
            {missionAnswers[sheet.item.id] && (
              <div className={styles.myAnswerBox}>
                <div className={styles.myAnswerLabel}>내가 남긴 기록</div>
                <p>{missionAnswers[sheet.item.id].answer}</p>
              </div>
            )}
            {lastElapsed !== null && (
              <p className="muted" style={{ marginTop: -4, marginBottom: 4 }}>
                완료 시간{' '}
                {isPreciseGame(sheet.item.type) ? formatPreciseElapsed(lastElapsed) : formatElapsed(lastElapsed)}
                {TIMED_KINDS.has(sheet.item.type) && getGameAttempts(sheet.item.id) >= MAX_RANKED_ATTEMPTS
                  ? ' · 순위 기록은 처음 3번의 도전까지만 반영돼요'
                  : ''}
              </p>
            )}
            <div style={{ height: 18 }} />
            <button className="btn" onClick={() => setSheet(null)}>
              여정으로 돌아가기
            </button>
            <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => startGame(sheet.item)}>
              다시 플레이
            </button>
            {TIMED_KINDS.has(sheet.item.type) && (
              <div style={{ marginTop: 22 }}>
                <div className={styles.sectionLabel} style={{ textAlign: 'center' }}>
                  🏆 이 게임 랭킹 TOP 3
                </div>
                <GamePodium gameId={sheet.item.type} />
              </div>
            )}
          </>
        )}

        {sheet?.kind === 'eggComplete' && (
          <>
            <EggCrack count={DAY2_MISSION_IDS.length} total={DAY2_MISSION_IDS.length} />
            <h2 style={{ textAlign: 'center', margin: '10px 0 10px' }}>알이 완전히 깨졌습니다</h2>
            {/* TODO: 팀 논의 후 마무리 메시지·말씀 확정 예정 */}
            <div style={{ height: 12 }} />
            <button className="btn" onClick={() => setSheet(null)}>
              여정으로 돌아가기
            </button>
            <button
              className="btn ghost"
              style={{ marginTop: 10 }}
              onClick={() => {
                setSheet(null);
                goScreen('type');
              }}
            >
              내 우상 유형 자세히 보기
            </button>
          </>
        )}

        {sheet?.kind === 'finalLocked' && (
          <>
            <span className="pill">최후의 자물쇠</span>
            <h2 style={{ margin: '6px 0 10px' }}>아직 잠겨 있습니다</h2>
            <p style={{ color: '#d9cdbb', fontSize: 15, marginBottom: 6 }}>
              앞선 자물쇠 {sheet.done} / {sheet.need}개를 깼어요. 솔로몬의 헛된 것들을 모두 마주해야, 진짜 열쇠가 드러납니다.
            </p>
            <div style={{ height: 16 }} />
            <button className="btn ghost" onClick={() => setSheet(null)}>
              알겠어요
            </button>
          </>
        )}
      </Sheet>
    </section>
  );
}
