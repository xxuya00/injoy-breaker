import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LOCKS, TOTAL, FINAL_REQUIRED } from '../data/locks';
import { generateFlashRound, type FlashRound } from '../data/memoryGame';
import { TILE_PUZZLE } from '../data/tilePuzzle';
import { MAZE_STAGES, generateMazePath } from '../data/maze';
import { generateComboRounds, checkCombo, findAllCombos, type ComboCard } from '../data/comboGame';
import { generateEquationRound, evaluateTokens, type EquationRound, type EqToken } from '../data/equationGame';
import { generateLightsOut, toggleLight } from '../data/lightsOut';
import { generateCrossMathRound, checkCrossMath, type CrossMathRound } from '../data/crossMath';
import { generateCodeBreakRound, type CodeBreakRound, type ShapeId } from '../data/codeBreak';
import { generateBalanceRound, BALANCE_STAGES, ITEM_LABELS, type BalanceRound } from '../data/balance';
import { fetchLockUnlockTimes } from '../lib/gas';
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
const FLASH_SHOW_MS = 1200;
const FLASH_ROUNDS = [4, 6, 8];
const REFLEX_TARGET_HITS = 10;
const REFLEX_GRID = 9;
const REFLEX_ON_MS = 650;
const REFLEX_GAP_MS = 250;

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
    desc: '5개 도형에 0~9 중 겹치지 않는 숫자가 배정되어 있어요. 힌트 두 식을 보고 최종식을 풀어보세요.',
  },
  memory: {
    pill: '플래시 기억',
    title: '단어들이 순식간에 나타났다 사라져요',
    desc: `순서까지 기억해서, 사라진 뒤 방금 본 순서대로 탭해야 해요. ${FLASH_ROUNDS.join('개 → ')}개로 라운드가 갈수록 단어 수가 늘어나요.`,
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

function NavCard({ icon, name, sub, onClick }: { icon: React.ReactNode; name: string; sub: string; onClick: () => void }) {
  return (
    <div className={`${styles.lock} ${styles.lockOpen} ${styles.tapable}`} onClick={onClick}>
      <div className={styles.ic}>{icon}</div>
      <div className={styles.body}>
        <div className={styles.name}>{name}</div>
        <div className={styles.sub}>{sub}</div>
      </div>
      <svg className={styles.chev} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </div>
  );
}

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
const MAZE_DEMO_SAFE = new Set([0, 3, 4, 5, 8]);
const RX_DEMO_HIT: Record<number, string> = { 4: styles.demoRxHit1, 1: styles.demoRxHit2, 7: styles.demoRxHit3 };
// 가운데를 누르면 십자 다섯 칸이 "반전"된다는 게 핵심이라, 켜진 칸과 꺼진 칸을 섞어 둔다.
const LO_DEMO_ON = new Set([0, 3, 4, 6, 7]);
const LO_DEMO_CROSS = new Set([1, 3, 4, 5, 7]);
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
            {Array.from({ length: 9 }).map((_, i) => {
              const on = LO_DEMO_ON.has(i);
              const flip = LO_DEMO_CROSS.has(i) ? (on ? styles.demoLoFlipOff : styles.demoLoFlipOn) : '';
              return (
                <div
                  key={i}
                  className={`${styles.demoLoCell} ${on ? styles.demoLoOn : ''} ${i === 4 ? styles.demoLoTap : flip}`}
                />
              );
            })}
          </div>
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
          <div className={styles.demoComboRow}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.demoComboCard}>
                ▲
              </div>
            ))}
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
          <div className={styles.podiumTime}>{formatElapsed(entry!.elapsedMs)}</div>
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

function MissionRecordAccordion({ items, answers }: { items: LockItem[]; answers: MissionAnswers }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className={styles.recordList}>
      {items.map((item) => {
        const answer = answers[item.id];
        const answered = Boolean(answer);
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className={styles.recordItem}>
            <button
              className={styles.recordHead}
              disabled={!answered}
              onClick={() => setOpenId(isOpen ? null : item.id)}
            >
              <span className={`${styles.recordDot} ${answered ? styles.recordDotOn : ''}`} />
              <span className={styles.recordName}>{item.name}</span>
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
                <span className={styles.recordPending}>미발견</span>
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
  const { state, selectDay, openLock, goScreen, setTab } = useApp();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // 진행 중(아직 완료 전)인 자물쇠 id. X로 닫았다가 같은 자물쇠를 다시 열면
  // 처음부터 다시 만들지 않고 하던 판을 그대로 이어서 보여준다.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
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
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 성경 십자 연산
  const [cmRound, setCmRound] = useState<CrossMathRound | null>(null);
  const [cmValues, setCmValues] = useState<(number | null)[]>(new Array(9).fill(null));
  const [cmSelected, setCmSelected] = useState<number | null>(null);

  // 시각 부호 해독
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
  const [lockTimes, setLockTimes] = useState<Record<string, string>>({});
  const [missionAnswers, setMissionAnswers] = useState<MissionAnswers>({});
  const [answerDraft, setAnswerDraft] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const qrHandled = useRef(false);

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

  // 관리자가 시트(locks)에 적어둔 unlock_at 시각을 주기적으로 확인해
  // 시간이 되면 자동으로 자물쇠가 풀리도록 한다. 화면이 보일 때만 폴링한다.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      fetchLockUnlockTimes()
        .then((times) => {
          if (!cancelled) setLockTimes(times);
        })
        .catch(() => {});
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

  // 타임어택형 게임(9개 미니게임 전부)이 열려있는 동안만 시계를 째깍이고,
  // 0.5초마다 누적시간을 로컬에 흘려써서 앱을 그냥 꺼버려도 직전 지점까지는 저장돼 있게 한다.
  useEffect(() => {
    if (!isTimedSheet(sheet) || sessionStart === null) return;
    const itemId = sheet.item.id;
    const base = accumulatedBase;
    const start = sessionStart;
    const id = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (getGameAttempts(itemId) < MAX_RANKED_ATTEMPTS) {
        setAccumulatedMs(itemId, base + (now - start));
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, sessionStart, accumulatedBase]);

  // 순발력 타격 시트를 벗어나면 다음 타깃 예약을 멈춘다.
  useEffect(() => {
    if (sheet?.kind === 'reflex') return;
    if (reflexSpawnTimer.current) clearTimeout(reflexSpawnTimer.current);
    if (reflexClearTimer.current) clearTimeout(reflexClearTimer.current);
    setReflexActiveCell(null);
  }, [sheet]);

  const dayData = LOCKS[state.day];
  const openedCount = Object.keys(state.opened).length;

  const isTimeLocked = (item: LockItem) => {
    const t = lockTimes[item.id];
    if (!t) return false;
    return new Date(t).getTime() > Date.now();
  };

  const handleLockClick = (item: LockItem) => {
    const isOpen = !!state.opened[item.id];
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
    if (!isOpen && isTimeLocked(item)) {
      toast(`${formatKST(lockTimes[item.id])}에 열려요`);
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
      setCbRound(generateCodeBreakRound());
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
    // 라운드가 바뀔 때마다 다시 시작을 누르지만, 타이머는 첫 라운드에서만 시작해 계속 이어서 흐르게 한다.
    if (flashRoundIdx === 0) beginTimedGame(item);
    setFlashPhase('show');
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashPhase('choose'), FLASH_SHOW_MS);
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
      finishTimedGame(item);
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

  const completeMission = (item: LockItem) => {
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
      const allDone = DAY2_MISSION_IDS.every((id) => id === item.id || state.opened[id]);
      if (allDone) {
        setSheet({ kind: 'eggComplete', item });
        return;
      }
    }
    setSheet({ kind: 'reveal', item });
  };

  const day2CrackCount = DAY2_MISSION_IDS.filter((id) => state.opened[id]).length;

  return (
    <section>
      <div className={styles.header}>
        <div>
          <div className="eyebrow">The Journey</div>
          <h1>3일 간 여정</h1>
        </div>
        <button className={styles.rankBtn} onClick={() => goScreen('rank')} aria-label="순위 보기">
          <svg viewBox="0 0 24 24">
            <path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z" />
          </svg>
        </button>
      </div>

      <div className={styles.progressWrap}>
        <span className={styles.progressNum}>
          {openedCount} / {TOTAL} UNLOCKED
        </span>
        <div className={styles.bar}>
          <span className={styles.barFill} style={{ width: `${Math.min(100, (openedCount / TOTAL) * 100)}%` }} />
        </div>
      </div>

      <div className={styles.daytabRow}>
        {([1, 2, 3] as Day[]).map((d) => (
          <div
            key={d}
            className={`${styles.daytab} ${state.day === d ? styles.daytabOn : ''}`}
            onClick={() => selectDay(d)}
          >
            <div className={styles.d}>DAY {d}</div>
            <div className={styles.t}>{DAY_LABELS[d]}</div>
          </div>
        ))}
      </div>

      <div className={`muted ${styles.dayCaption}`}>{dayData.caption}</div>

      {state.day === 2 && (
        <NavCard
          icon={
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
          }
          name="유형 검사"
          sub="아침 큐티 직후, 가장 먼저 해보세요"
          onClick={() => goScreen('type')}
        />
      )}

      {state.day === 2 && (
        <div className={styles.eggHero}>
          <EggCrack count={day2CrackCount} total={DAY2_MISSION_IDS.length} />
          <button className="btn" onClick={() => setScannerOpen(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 8a2 2 0 0 1 2-2h1.6l1.2-1.6h6.4L16.4 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
              <circle cx="12" cy="13" r="3.4" />
            </svg>
            QR 스캔하기
          </button>
          <p className="muted" style={{ textAlign: 'center', marginTop: 8 }}>
            물놀이 전후로 숲과 계곡 곳곳의 QR을 찾아보세요
          </p>
        </div>
      )}

      {state.day !== 2 && (
        <div className={styles.lockGrid}>
          {dayData.items.map((item, idx) => {
            const open = !!state.opened[item.id];
            const letter = state.day === 1 ? BACKTOGOD_WORD[idx] : null;
            return (
              <div
                key={item.id}
                className={`${styles.lockTile} ${open ? styles.lockTileOpen : ''}`}
                onClick={() => handleLockClick(item)}
                aria-label={open ? `${item.name} · 열림` : '잠긴 자물쇠'}
              >
                {open && letter ? <span className={styles.lockLetter}>{letter}</span> : <LockIcon open={open} />}
              </div>
            );
          })}
        </div>
      )}

      {state.day === 2 && (
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
            onClick={() => goScreen('write')}
          />
        </>
      )}
      {state.day === 3 && (
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
            onClick={() => goScreen('decide')}
          />
        </>
      )}

      {state.day === 2 && (
        <>
          <hr className={styles.sectionDivider} />
          <div className={styles.sectionLabel}>
            나의 기록 · {day2CrackCount}/{DAY2_MISSION_IDS.length}
          </div>
          <MissionRecordAccordion items={DAY2_MISSIONS} answers={missionAnswers} />
        </>
      )}

      {scannerOpen && <QrScanner parse={parseQrText} onDetect={handleScanDetect} onClose={() => setScannerOpen(false)} />}

      <Sheet open={sheet !== null} onClose={closeSheet} fullscreen>
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
            <p className="muted" style={{ marginBottom: 12 }}>
              {sheet.item.hint}
            </p>
            {DAY2_MISSION_IDS.includes(sheet.item.id) && (
              <textarea
                className="field"
                style={{ minHeight: 96, resize: 'none', lineHeight: 1.6 }}
                placeholder="떠오른 생각이나 답을 적어보세요…"
                value={answerDraft}
                onChange={(e) => setAnswerDraft(e.target.value)}
              />
            )}
            <button
              className="btn"
              disabled={DAY2_MISSION_IDS.includes(sheet.item.id) && answerDraft.trim().length === 0}
              onClick={() => completeMission(sheet.item)}
            >
              완료했어요 · 크랙 내기
            </button>
          </>
        )}

        {sheet?.kind === 'crossmath' && cmRound && (
          <>
            <div className={styles.timerRow}>
              <span className="pill">✝️ 성경 십자 연산</span>
              <span className={styles.timerBadge}>
                ⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}
              </span>
            </div>
            <h2 style={{ margin: '6px 0 4px' }}>1~9를 겹치지 않게 채워 합을 맞추세요</h2>
            <p className="muted" style={{ marginBottom: 6 }}>
              {cmRound.hint}
            </p>
            <p className="muted" style={{ marginBottom: 14 }}>
              빈칸을 탭해 선택하고, 아래 숫자패드로 채워보세요. 오른쪽·아래 숫자가 목표 합이에요.
            </p>
            <div className={styles.cmGrid}>
              {Array.from({ length: 4 }).map((_, r) =>
                Array.from({ length: 4 }).map((_, c) => {
                  if (r < 3 && c < 3) {
                    const idx = r * 3 + c;
                    const val = cmValues[idx];
                    return (
                      <button
                        key={`${r}-${c}`}
                        className={`${styles.cmCell} ${cmSelected === idx ? styles.cmCellSelected : ''} ${
                          val !== null ? styles.cmCellFilled : ''
                        }`}
                        onClick={() => tapCmCell(idx)}
                      >
                        {val ?? ''}
                      </button>
                    );
                  }
                  if (r < 3 && c === 3) {
                    return (
                      <div key={`${r}-${c}`} className={styles.cmTarget}>
                        {cmRound.rowTargets[r]}
                      </div>
                    );
                  }
                  if (r === 3 && c < 3) {
                    return (
                      <div key={`${r}-${c}`} className={styles.cmTarget}>
                        {cmRound.colTargets[c]}
                      </div>
                    );
                  }
                  return <div key={`${r}-${c}`} className={styles.cmCorner} />;
                }),
              )}
            </div>
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
            <div className={styles.timerRow}>
              <span className="pill">🔺 부호 해독</span>
              <span className={styles.timerBadge}>
                ⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}
              </span>
            </div>
            <h2 style={{ margin: '6px 0 4px' }}>도형마다 숨은 숫자를 추리하세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              5개 도형에 0~9 중 겹치지 않는 숫자가 배정되어 있어요. 힌트 두 식을 보고 최종식을 풀어보세요.
            </p>
            <div className={styles.cbHintRow}>
              <ShapeIcon shape={cbRound.hint1.a} />
              <span className={styles.cbOp}>{cbRound.hint1.op}</span>
              <ShapeIcon shape={cbRound.hint1.b} />
              <span className={styles.cbOp}>=</span>
              <span className={styles.cbNum}>{cbRound.hint1.result}</span>
            </div>
            <div className={styles.cbHintRow}>
              <ShapeIcon shape={cbRound.hint2.a} />
              <span className={styles.cbOp}>{cbRound.hint2.op}</span>
              <ShapeIcon shape={cbRound.hint2.b} />
              <span className={styles.cbOp}>=</span>
              <span className={styles.cbNum}>{cbRound.hint2.result}</span>
            </div>
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
            <div className={styles.timerRow}>
              <span className="pill">
                ⚖️ 가짜 찾기 · {balStageIdx + 1}/{BALANCE_STAGES.length}단계 ({balRound.itemCount}개)
              </span>
              <span className={styles.timerBadge}>
                ⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}
              </span>
            </div>
            <h2 style={{ margin: '6px 0 4px' }}>딱 하나, 무게가 다른 가짜를 찾으세요</h2>
            <p className="muted" style={{ marginBottom: 14 }}>
              아래는 이미 진행된 저울질 결과예요. 결과를 보고 어떤 것이 가짜(더 무거운 것)인지 아래에서 골라보세요.
            </p>
            <div className={styles.balWeighList}>
              {balRound.weighings.map((w, i) => (
                <div key={i} className={styles.balWeighRow}>
                  <span className={styles.balWeighNum}>{i + 1}차</span>
                  <div className={styles.balPan}>
                    {w.left.map((idx) => (
                      <ItemChip key={idx} idx={idx} size={24} />
                    ))}
                  </div>
                  <span className={styles.balTilt}>{w.result === 'left' ? '◀' : w.result === 'right' ? '▶' : '='}</span>
                  <div className={styles.balPan}>
                    {w.right.map((idx) => (
                      <ItemChip key={idx} idx={idx} size={24} />
                    ))}
                  </div>
                </div>
              ))}
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
            <div className={styles.timerRow}>
              <span className="pill">
                ⚡ 순발력 타격 · {reflexHits}/{REFLEX_TARGET_HITS}
              </span>
              <span className={styles.timerBadge}>
                ⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}
              </span>
            </div>
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
            <div className={styles.timerRow}>
              <span className="pill">
                🧠 플래시 기억 · {flashRoundIdx + 1}/{FLASH_ROUNDS.length}세트
              </span>
              {flashPhase !== 'ready' && (
                <span className={styles.timerBadge}>
                  ⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}
                </span>
              )}
            </div>
            {flashPhase === 'ready' && (
              <>
                <h2 style={{ margin: '6px 0 4px' }}>단어 {FLASH_ROUNDS[flashRoundIdx]}개가 순식간에 나타났다 사라져요</h2>
                <p className="muted" style={{ marginBottom: 16 }}>
                  준비되면 시작을 눌러보세요. 순서까지 기억해야 해요.
                </p>
                <button className="btn" onClick={() => beginFlashShow(sheet.item)}>
                  시작
                </button>
              </>
            )}
            {flashPhase === 'show' && flashRound && (
              <div className={styles.flashShowBox}>
                {flashRound.sequence.map((w, i) => (
                  <div key={i} className={styles.flashWord}>
                    {w}
                  </div>
                ))}
              </div>
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
            <div className={styles.timerRow}>
              <span className="pill">
                🧭 기억의 미로 · {mazeStageIdx + 1}/{MAZE_STAGES.length}단계 ({mazeStage.rows}x{mazeStage.cols})
              </span>
              <span className={styles.timerBadge}>
                ⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}
              </span>
            </div>
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
            <div className={styles.timerRow}>
              <span className="pill">
                🎴 결합 찾기 · {comboRoundIdx + 1}/{comboRounds.length}세트
              </span>
              <span className={styles.timerBadge}>⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}</span>
            </div>
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
            <div className={styles.timerRow}>
              <span className="pill">
                🔢 수식 만들기 · {eqStreak}/{EQ_TARGET_STREAK}
              </span>
              <span className={styles.timerBadge}>⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}</span>
            </div>
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
            <div className={styles.timerRow}>
              <span className="pill">
                💡 라이트 아웃 · {loStageIdx + 1}/{LO_STAGES.length}단계
              </span>
              <span className={styles.timerBadge}>⏱ {formatElapsed(accumulatedBase + (sessionStart ? nowTick - sessionStart : 0))}</span>
            </div>
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
                완료 시간 {formatElapsed(lastElapsed)}
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
