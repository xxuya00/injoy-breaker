import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LOCKS, TOTAL, FINAL_REQUIRED } from '../data/locks';
import { MATH_PUZZLES } from '../data/mathQuiz';
import { SPOT_DIFF } from '../data/spotDiff';
import { MEMORY_CHALLENGE } from '../data/memoryGame';
import { WORD_PUZZLE } from '../data/wordPuzzle';
import type { Day, LockItem } from '../types';
import Sheet from '../components/Sheet';
import RevealCard from '../components/RevealCard';
import { useToast } from '../context/ToastContext';
import styles from './JourneyScreen.module.css';

type SheetState =
  | { kind: 'quiz'; item: LockItem }
  | { kind: 'mission'; item: LockItem }
  | { kind: 'math'; item: LockItem }
  | { kind: 'spotdiff'; item: LockItem }
  | { kind: 'memory'; item: LockItem }
  | { kind: 'puzzle'; item: LockItem }
  | { kind: 'reveal'; item: LockItem }
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

const DAY_LABELS: Record<Day, string> = { 1: 'BREAK AWAY', 2: 'BREAK DOWN', 3: 'BREAK THROUGH' };

export default function JourneyScreen() {
  const { state, selectDay, openLock, goScreen } = useApp();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetState | null>(null);
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

  useEffect(() => {
    return () => {
      if (memTimer.current) clearTimeout(memTimer.current);
    };
  }, []);

  const dayData = LOCKS[state.day];
  const openedCount = Object.keys(state.opened).length;

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
    if (item.type === 'locked-until') {
      toast('저녁 집회 시간에 열려요');
      return;
    }
    if (isOpen) {
      setSheet({ kind: 'reveal', item });
      return;
    }
    setAnswered(null);
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
    setSheet({ kind: item.type === 'quiz' ? 'quiz' : 'mission', item });
  };

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
    setSheet({ kind: 'reveal', item });
  };

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

      <Sheet open={sheet !== null} onClose={() => setSheet(null)}>
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
            <span className="pill">QR 미션</span>
            <h2 style={{ margin: '6px 0 10px' }}>{sheet.item.name}</h2>
            <p style={{ fontSize: 15.5, color: '#c9d2f2', marginBottom: 8 }}>{sheet.item.q}</p>
            <p className="muted" style={{ marginBottom: 18 }}>
              {sheet.item.hint}
            </p>
            <button className="btn" onClick={() => completeMission(sheet.item)}>
              완료했어요 · 자물쇠 열기
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

        {sheet?.kind === 'reveal' && (
          <>
            <RevealCard pill="자물쇠 열림" title={sheet.item.name} footnote="…그러나 이것도 헛되더라.">
              {sheet.item.reveal}
            </RevealCard>
            <div style={{ height: 18 }} />
            <button className="btn" onClick={() => setSheet(null)}>
              여정으로 돌아가기
            </button>
          </>
        )}

        {sheet?.kind === 'finalLocked' && (
          <>
            <span className="pill">최후의 자물쇠</span>
            <h2 style={{ margin: '6px 0 10px' }}>아직 잠겨 있습니다</h2>
            <p style={{ color: '#c9d2f2', fontSize: 15, marginBottom: 6 }}>
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
