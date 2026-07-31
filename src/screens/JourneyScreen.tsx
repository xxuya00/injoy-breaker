import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LOCKS, TOTAL, FINAL_REQUIRED } from '../data/locks';
import { MATH_PUZZLES } from '../data/mathQuiz';
import { SPOT_DIFF } from '../data/spotDiff';
import { MEMORY_CHALLENGE } from '../data/memoryGame';
import { WORD_PUZZLE } from '../data/wordPuzzle';
import { TILE_PUZZLE } from '../data/tilePuzzle';
import { MAZE } from '../data/maze';
import { generateComboBoard, checkCombo, hasAnyCombo, type ComboCard } from '../data/comboGame';
import { generateEquationRound, evaluateTokens, type EquationRound, type EqToken } from '../data/equationGame';
import { generateLightsOut, toggleLight } from '../data/lightsOut';
import { fetchLockUnlockTimes } from '../lib/gas';
import { setGameStartIfAbsent, isGameTimeRecorded, markGameTimeRecorded } from '../lib/storage';
import {
  saveGameTime,
  subscribeGameLeaderboard,
  saveMissionAnswer,
  loadMissionAnswers,
  type GameTimeEntry,
  type MissionAnswers,
} from '../lib/sync';
import type { Day, LockItem } from '../types';
import Sheet from '../components/Sheet';
import RevealCard from '../components/RevealCard';
import EggCrack from '../components/EggCrack';
import { useToast } from '../context/ToastContext';
import styles from './JourneyScreen.module.css';

const EQ_TARGET_STREAK = 3;
const LO_STAGES = [3, 4, 5];
const COMBO_SIZE = 12;
const TIMED_KINDS = new Set(['equation', 'combo', 'lightsout']);

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
  | { kind: 'math'; item: LockItem }
  | { kind: 'spotdiff'; item: LockItem }
  | { kind: 'memory'; item: LockItem }
  | { kind: 'puzzle'; item: LockItem }
  | { kind: 'tilepuzzle'; item: LockItem }
  | { kind: 'maze'; item: LockItem }
  | { kind: 'combo'; item: LockItem }
  | { kind: 'equation'; item: LockItem }
  | { kind: 'lightsout'; item: LockItem }
  | { kind: 'reveal'; item: LockItem }
  | { kind: 'eggComplete'; item: LockItem }
  | { kind: 'finalLocked'; done: number; need: number };

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

const COMBO_COLORS = ['var(--accent)', 'var(--ok)', 'var(--accent-blue)'];

function ComboShape({ card }: { card: ComboCard }) {
  const color = COMBO_COLORS[card.color];
  const patternId = `combo-stripe-${card.color}`;
  const fillProps =
    card.fill === 0
      ? { fill: color, stroke: color, strokeWidth: 2 }
      : card.fill === 1
      ? { fill: 'none', stroke: color, strokeWidth: 3 }
      : { fill: `url(#${patternId})`, stroke: color, strokeWidth: 2 };
  return (
    <svg viewBox="0 0 40 40" width="36" height="36">
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" stroke={color} strokeWidth="2" />
        </pattern>
      </defs>
      {card.shape === 0 && <circle cx="20" cy="20" r="14" {...fillProps} />}
      {card.shape === 1 && <rect x="7" y="7" width="26" height="26" rx="3" {...fillProps} />}
      {card.shape === 2 && <polygon points="20,6 34,32 6,32" {...fillProps} />}
    </svg>
  );
}

function GameLeaderboard({ gameId }: { gameId: string }) {
  const [entries, setEntries] = useState<GameTimeEntry[]>([]);
  useEffect(() => {
    const unsub = subscribeGameLeaderboard(gameId, setEntries, () => {});
    return unsub;
  }, [gameId]);
  if (entries.length === 0) return null;
  return (
    <div className={styles.gameBoard}>
      <div className={styles.gameBoardTitle}>⏱ 최고 기록</div>
      {entries.map((e, i) => (
        <div key={e.id} className={styles.gameBoardRow}>
          <span>
            {i + 1}. {e.nick}
          </span>
          <span>{formatElapsed(e.elapsedMs)}</span>
        </div>
      ))}
    </div>
  );
}

const DAY_LABELS: Record<Day, string> = { 1: 'BREAK AWAY', 2: 'BREAK DOWN', 3: 'BREAK THROUGH' };
const DAY2_MISSION_IDS = LOCKS[2].items.filter((i) => i.type === 'mission').map((i) => i.id);

export default function JourneyScreen() {
  const { state, selectDay, openLock, goScreen, setTab } = useApp();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // 진행 중(아직 완료 전)인 자물쇠 id. X로 닫았다가 같은 자물쇠를 다시 열면
  // 처음부터 다시 만들지 않고 하던 판을 그대로 이어서 보여준다.
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [answered, setAnswered] = useState<{ idx: number; correct: boolean } | null>(null);
  const [mathIdx, setMathIdx] = useState(0);
  const [mathAnswered, setMathAnswered] = useState<{ value: number; correct: boolean } | null>(null);
  const [spotWrong, setSpotWrong] = useState(false);
  const [memPhase, setMemPhase] = useState<'show' | 'ask'>('show');
  const [memAnswered, setMemAnswered] = useState<{ idx: number; correct: boolean } | null>(null);
  const memTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [puzzleWords, setPuzzleWords] = useState<{ word: string; idx: number }[]>([]);
  const [puzzlePicked, setPuzzlePicked] = useState<number[]>([]);
  const [puzzleWrong, setPuzzleWrong] = useState(false);
  const [tileOrder, setTileOrder] = useState<number[]>([]);
  const [tileSelected, setTileSelected] = useState<number | null>(null);
  const [mazePos, setMazePos] = useState<[number, number]>(MAZE.start);
  const [comboBoard, setComboBoard] = useState<ComboCard[]>([]);
  const [comboCleared, setComboCleared] = useState<boolean[]>([]);
  const [comboSelected, setComboSelected] = useState<number[]>([]);
  const [comboWrong, setComboWrong] = useState(false);
  const [eqRound, setEqRound] = useState<EquationRound | null>(null);
  const [eqTokens, setEqTokens] = useState<EqToken[]>([]);
  const [eqNumUsed, setEqNumUsed] = useState<boolean[]>([]);
  const [eqStreak, setEqStreak] = useState(0);
  const [loGrid, setLoGrid] = useState<boolean[][] | null>(null);
  const [loSize, setLoSize] = useState(5);
  const [loStageIdx, setLoStageIdx] = useState(0);
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [lastElapsed, setLastElapsed] = useState<number | null>(null);
  const [lockTimes, setLockTimes] = useState<Record<string, string>>({});
  const [missionAnswers, setMissionAnswers] = useState<MissionAnswers>({});
  const [answerDraft, setAnswerDraft] = useState('');
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
      if (memTimer.current) clearTimeout(memTimer.current);
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

  // 타임어택형 게임(수식 만들기/결합/라이트아웃)이 열려있는 동안만 시계를 째깍인다.
  useEffect(() => {
    if (!sheet || !TIMED_KINDS.has(sheet.kind)) return;
    const id = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(id);
  }, [sheet?.kind]);

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
      // 이미 진행 중인 판이 있으면 초기화하지 않고 그대로 이어서 보여준다.
      const kind = item.type === 'quiz' ? 'quiz' : item.type === 'mission' ? 'mission' : (item.type as SheetState['kind']);
      setSheet({ kind, item } as SheetState);
      return;
    }
    setActiveItemId(item.id);
    startGame(item);
  };

  // 이미 기록이 확정된 뒤(다시 플레이)라면 매번 새 타이머로, 아직이라면 저장된 최초 시작 시각을 이어서 쓴다 —
  // 그래야 앱을 나갔다 들어와도 처음 도전한 시점 기준으로 경과시간이 흐른다.
  const beginTimedGame = (item: LockItem) => {
    const start = isGameTimeRecorded(item.id) ? Date.now() : setGameStartIfAbsent(item.id);
    setGameStartedAt(start);
    setNowTick(Date.now());
  };

  const finishTimedGame = (item: LockItem) => {
    const elapsed = gameStartedAt ? Date.now() - gameStartedAt : 0;
    openLock(item.id);
    if (!isGameTimeRecorded(item.id)) {
      markGameTimeRecorded(item.id);
      if (state.id)
        saveGameTime(item.type, state.id, state.nickname || state.nick, elapsed).catch((e) =>
          console.error('saveGameTime failed', e),
        );
    }
    setLastElapsed(elapsed);
    setSheet({ kind: 'reveal', item });
  };

  const startGame = (item: LockItem) => {
    setAnswered(null);
    setLastElapsed(null);
    if (item.type === 'math') {
      setMathIdx(0);
      setMathAnswered(null);
      setSheet({ kind: 'math', item });
      return;
    }
    if (item.type === 'spotdiff') {
      setSpotWrong(false);
      setSheet({ kind: 'spotdiff', item });
      return;
    }
    if (item.type === 'memory') {
      setMemPhase('show');
      setMemAnswered(null);
      setSheet({ kind: 'memory', item });
      if (memTimer.current) clearTimeout(memTimer.current);
      memTimer.current = setTimeout(() => setMemPhase('ask'), 3000);
      return;
    }
    if (item.type === 'puzzle') {
      setPuzzleWords(shuffleArr(WORD_PUZZLE.words.map((word, idx) => ({ word, idx }))));
      setPuzzlePicked([]);
      setPuzzleWrong(false);
      setSheet({ kind: 'puzzle', item });
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
      setMazePos(MAZE.start);
      setSheet({ kind: 'maze', item });
      return;
    }
    if (item.type === 'combo') {
      beginTimedGame(item);
      setComboBoard(generateComboBoard(COMBO_SIZE));
      setComboCleared(new Array(COMBO_SIZE).fill(false));
      setComboSelected([]);
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

  // 현장 곳곳에 붙여둔 QR(예: ?qr=d2a)을 스캔하면 로그인된 사용자를 해당 자물쇠로 바로 데려간다.
  useEffect(() => {
    if (qrHandled.current || !state.id) return;
    const qrId = new URLSearchParams(window.location.search).get('qr');
    if (!qrId) return;
    qrHandled.current = true;
    window.history.replaceState({}, '', window.location.pathname);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.id]);

  const answerSpotDiff = (item: LockItem, index: number) => {
    if (index === SPOT_DIFF.diffIndex) {
      openLock(item.id);
      setSheet({ kind: 'reveal', item });
    } else {
      setSpotWrong(true);
      setTimeout(() => setSpotWrong(false), 400);
    }
  };

  const answerMemory = (item: LockItem, idx: number) => {
    const correct = idx === MEMORY_CHALLENGE.correctIndex;
    setMemAnswered({ idx, correct });
    if (correct) {
      setTimeout(() => {
        openLock(item.id);
        setSheet({ kind: 'reveal', item });
      }, 550);
    } else {
      setTimeout(() => setMemAnswered(null), 500);
    }
  };

  const pickPuzzleWord = (item: LockItem, wordIdx: number) => {
    const nextPicked = [...puzzlePicked, wordIdx];
    setPuzzlePicked(nextPicked);
    if (nextPicked.length === WORD_PUZZLE.words.length) {
      const correct = nextPicked.every((v, i) => v === i);
      if (correct) {
        setTimeout(() => {
          openLock(item.id);
          setSheet({ kind: 'reveal', item });
        }, 400);
      } else {
        setPuzzleWrong(true);
        setTimeout(() => {
          setPuzzleWrong(false);
          setPuzzlePicked([]);
        }, 800);
      }
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
    const [r, c] = mazePos;
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= MAZE.grid.length || nc >= MAZE.grid[0].length) return;
    if (MAZE.grid[nr][nc] === 1) return;
    setMazePos([nr, nc]);
    if (nr === MAZE.end[0] && nc === MAZE.end[1]) {
      setTimeout(() => {
        openLock(item.id);
        setSheet({ kind: 'reveal', item });
      }, 400);
    }
  };

  const tapCombo = (item: LockItem, idx: number) => {
    if (comboCleared[idx] || comboSelected.includes(idx)) {
      setComboSelected(comboSelected.filter((i) => i !== idx));
      return;
    }
    const next = [...comboSelected, idx];
    setComboSelected(next);
    if (next.length === 3) {
      const picked = next.map((i) => comboBoard[i]);
      if (checkCombo(picked)) {
        setTimeout(() => {
          const nextCleared = [...comboCleared];
          next.forEach((i) => {
            nextCleared[i] = true;
          });
          setComboCleared(nextCleared);
          setComboSelected([]);
          const remaining = comboBoard.filter((_, i) => !nextCleared[i]);
          if (!hasAnyCombo(remaining)) {
            finishTimedGame(item);
          }
        }, 400);
      } else {
        setComboWrong(true);
        setTimeout(() => {
          setComboWrong(false);
          setComboSelected([]);
        }, 500);
      }
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

  const answerMath = (item: LockItem, value: number) => {
    const puzzle = MATH_PUZZLES[mathIdx];
    const correct = value === puzzle.answer;
    setMathAnswered({ value, correct });
    if (correct) {
      setTimeout(() => {
        if (mathIdx < MATH_PUZZLES.length - 1) {
          setMathIdx((i) => i + 1);
          setMathAnswered(null);
        } else {
          openLock(item.id);
          setSheet({ kind: 'reveal', item });
        }
      }, 550);
    } else {
      setTimeout(() => setMathAnswered(null), 500);
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
          <h1>3일의 자물쇠</h1>
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
        <div className={styles.eggHero}>
          <EggCrack count={day2CrackCount} total={DAY2_MISSION_IDS.length} />
          {DAY2_MISSION_IDS.some((id) => missionAnswers[id]) && (
            <div className={styles.myRecords}>
              <div className={styles.myRecordsTitle}>나의 기록</div>
              {DAY2_MISSION_IDS.filter((id) => missionAnswers[id]).map((id) => (
                <div key={id} className={styles.myRecordRow}>
                  <span className={styles.myRecordName}>{missionAnswers[id].name}</span>
                  <span className={styles.myRecordText}>{missionAnswers[id].answer}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.day !== 2 && (
        <div className={styles.lockGrid}>
          {dayData.items.map((item) => {
            const open = !!state.opened[item.id];
            return (
              <div
                key={item.id}
                className={`${styles.lockTile} ${open ? styles.lockTileOpen : ''}`}
                onClick={() => handleLockClick(item)}
                aria-label={open ? `${item.name} · 열림` : '잠긴 자물쇠'}
              >
                <LockIcon open={open} />
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
          <NavCard
            icon={
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            }
            name="유형 검사"
            sub="우상 · 묵상 · 기도 유형 알아보기"
            onClick={() => goScreen('type')}
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

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} fullscreen>
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

        {sheet?.kind === 'math' && (
          <>
            <span className="pill">🧮 숫자 퍼즐 · {mathIdx + 1}/{MATH_PUZZLES.length}</span>
            <h2 style={{ margin: '6px 0 16px' }}>{MATH_PUZZLES[mathIdx].question}</h2>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {MATH_PUZZLES[mathIdx].options.map((opt) => (
                <button
                  key={opt}
                  className={`opt ${mathAnswered?.value === opt ? (mathAnswered.correct ? 'correct' : 'wrong') : ''}`}
                  style={{ flex: '0 0 47%' }}
                  onClick={() => answerMath(sheet.item, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}

        {sheet?.kind === 'spotdiff' && (
          <>
            <span className="pill">🔍 틀린그림찾기</span>
            <h2 style={{ margin: '6px 0 4px' }}>아래 줄에서 다른 하나를 찾아 탭하세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              두 줄은 똑같아요. 딱 하나만 다릅니다.
            </p>
            <div className={styles.emojiRow}>
              {SPOT_DIFF.items.map((e, i) => (
                <div key={i} className={styles.emojiCell}>
                  {e}
                </div>
              ))}
            </div>
            <div className={`${styles.emojiRow} ${spotWrong ? styles.emojiRowWrong : ''}`} style={{ marginTop: 10 }}>
              {SPOT_DIFF.items.map((e, i) => (
                <button
                  key={i}
                  className={styles.emojiCellBtn}
                  onClick={() => answerSpotDiff(sheet.item, i)}
                >
                  {i === SPOT_DIFF.diffIndex ? SPOT_DIFF.diffItem : e}
                </button>
              ))}
            </div>
          </>
        )}

        {sheet?.kind === 'memory' && (
          <>
            <span className="pill">🧠 암기 자물쇠</span>
            {memPhase === 'show' ? (
              <>
                <h2 style={{ margin: '6px 0 16px' }}>이 순서를 기억하세요</h2>
                <div className={styles.emojiRow}>
                  {MEMORY_CHALLENGE.sequence.map((e, i) => (
                    <div key={i} className={styles.emojiCellBig}>
                      {e}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: '6px 0 16px' }}>방금 본 순서와 같은 것은?</h2>
                {MEMORY_CHALLENGE.options.map((opt, i) => (
                  <button
                    key={i}
                    className={`opt ${memAnswered?.idx === i ? (memAnswered.correct ? 'correct' : 'wrong') : ''}`}
                    onClick={() => answerMemory(sheet.item, i)}
                  >
                    {opt.join(' ')}
                  </button>
                ))}
              </>
            )}
          </>
        )}

        {sheet?.kind === 'puzzle' && (
          <>
            <span className="pill">🧩 퍼즐 자물쇠</span>
            <h2 style={{ margin: '6px 0 4px' }}>말씀 순서를 맞춰보세요</h2>
            <p className="muted" style={{ marginBottom: 12 }}>
              {WORD_PUZZLE.reference}
            </p>
            <div className={`${styles.puzzleAnswerRow} ${puzzleWrong ? styles.puzzleWrong : ''}`}>
              {puzzlePicked.length === 0
                ? '탭한 단어가 여기에 순서대로 쌓여요'
                : puzzlePicked.map((wi) => WORD_PUZZLE.words[wi]).join(' ')}
            </div>
            <div className={styles.puzzleChipRow}>
              {puzzleWords.map(({ word, idx }) => (
                <button
                  key={idx}
                  className={styles.puzzleChip}
                  disabled={puzzlePicked.includes(idx)}
                  onClick={() => pickPuzzleWord(sheet.item, idx)}
                >
                  {word}
                </button>
              ))}
            </div>
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
            <span className="pill">🧭 미로 찾기</span>
            <h2 style={{ margin: '6px 0 4px' }}>출구까지 길을 찾아보세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              화살표로 이동해서 깃발까지 도착하면 열려요.
            </p>
            <div
              className={styles.mazeGrid}
              style={{ gridTemplateColumns: `repeat(${MAZE.grid[0].length}, 1fr)` }}
            >
              {MAZE.grid.map((row, r) =>
                row.map((cell, c) => {
                  const isPlayer = mazePos[0] === r && mazePos[1] === c;
                  const isEnd = MAZE.end[0] === r && MAZE.end[1] === c;
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`${styles.mazeCell} ${cell === 1 ? styles.mazeWall : ''}`}
                    >
                      {isPlayer ? '🧍' : isEnd ? '🚩' : ''}
                    </div>
                  );
                })
              )}
            </div>
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
          </>
        )}

        {sheet?.kind === 'combo' && (
          <>
            <div className={styles.timerRow}>
              <span className="pill">🎴 결합 찾기</span>
              <span className={styles.timerBadge}>⏱ {formatElapsed(nowTick - (gameStartedAt ?? nowTick))}</span>
            </div>
            <h2 style={{ margin: '6px 0 4px' }}>보이는 합을 전부 찾아보세요</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              모양·색·채우기가 각각 셋 다 같거나 셋 다 달라야 해요. 더 이상 합이 없으면 클리어!
              ({comboCleared.filter(Boolean).length}/{COMBO_SIZE}장 정리됨)
            </p>
            <div className={`${styles.comboGrid} ${comboWrong ? styles.comboWrong : ''}`}>
              {comboBoard.map((card, i) =>
                comboCleared[i] ? (
                  <div key={i} className={styles.comboCardCleared} />
                ) : (
                  <button
                    key={i}
                    className={`${styles.comboCard} ${comboSelected.includes(i) ? styles.comboCardSelected : ''}`}
                    onClick={() => tapCombo(sheet.item, i)}
                  >
                    <ComboShape card={card} />
                  </button>
                )
              )}
            </div>
            <GameLeaderboard gameId="combo" />
          </>
        )}

        {sheet?.kind === 'equation' && eqRound && (
          <>
            <div className={styles.timerRow}>
              <span className="pill">
                🔢 수식 만들기 · {eqStreak}/{EQ_TARGET_STREAK}
              </span>
              <span className={styles.timerBadge}>⏱ {formatElapsed(nowTick - (gameStartedAt ?? nowTick))}</span>
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
            <GameLeaderboard gameId="equation" />
          </>
        )}

        {sheet?.kind === 'lightsout' && loGrid && (
          <>
            <div className={styles.timerRow}>
              <span className="pill">
                💡 라이트 아웃 · {loStageIdx + 1}/{LO_STAGES.length}단계
              </span>
              <span className={styles.timerBadge}>⏱ {formatElapsed(nowTick - (gameStartedAt ?? nowTick))}</span>
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
            <GameLeaderboard gameId="lightsout" />
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
              </p>
            )}
            <div style={{ height: 18 }} />
            <button className="btn" onClick={() => setSheet(null)}>
              여정으로 돌아가기
            </button>
            <button
              className="btn ghost"
              style={{ marginTop: 10 }}
              onClick={() => {
                setActiveItemId(sheet.item.id);
                startGame(sheet.item);
              }}
            >
              다시 플레이
            </button>
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
