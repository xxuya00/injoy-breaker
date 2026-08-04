import { useEffect, useRef, useState } from 'react';
import { QT_CONTENT, type QtVerse } from '../data/qt';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { loadQtAnswers, saveQtAnswers } from '../lib/storage';
import { useScrollFit } from '../components/FitBox';
import styles from './QtScreen.module.css';

// 글자를 칠 때마다 localStorage에 쓰지 않고 손이 멈추면 한 번에 쓴다.
const SAVE_DEBOUNCE_MS = 400;

// 가로 스와이프로 페이지를 넘긴다.
// 이만큼은 움직여야 "가로인지 세로인지" 방향을 판정한다. 너무 작으면 세로로 훑는 손짓의
// 미세한 흔들림까지 가로로 잡히고, 너무 크면 넘기려는 손짓이 한 박자 늦게 붙는다.
const SWIPE_DECIDE_PX = 12;
// 이만큼 끌어야 실제로 넘어간다. 여기 못 미치면 제자리로 돌아간다.
const SWIPE_GO_PX = 56;
// 손가락을 따라가는 정도. 그대로 따라가면 화면이 통째로 빠져나가 보여서 절반쯤만 따라간다.
const SWIPE_PULL = 0.45;
// 넘어갈 곳이 없는 쪽(첫 장에서 오른쪽, 끝 장에서 왼쪽)은 끝이라는 게 느껴질 만큼만 밀린다.
const SWIPE_PULL_EDGE = 0.1;

// 하루치 큐티는 "본문을 읽고 → 답을 적는" 순서라, 한 화면에 다 쌓지 않고 두 장으로 나눠 넘긴다.
// 날짜(DAY 2·DAY 3)는 위쪽 탭이 맡고, 이 두 장은 탭이 아니라 넘기는 페이지로 두어
// 탭 위에 탭이 겹쳐 보이지 않게 한다.
type Step = 'read' | 'write';
const STEPS: { id: Step; label: string }[] = [
  { id: 'read', label: '본문 읽기' },
  { id: 'write', label: '나눔 쓰기' },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Verses({ verses }: { verses: QtVerse[] }) {
  return (
    <div className={styles.passage}>
      {verses.map((v) => (
        <p key={v.no} className={styles.verseLine}>
          <span className={styles.verseNo}>{v.no}</span>
          {v.text}
        </p>
      ))}
    </div>
  );
}

export default function QtScreen() {
  const { state } = useApp();
  const toast = useToast();
  const [day, setDay] = useState<2 | 3>(2);
  const [step, setStep] = useState<Step>('read');
  // 방금 뒤로 넘어왔는지. 넘어온 방향대로 페이지가 미끄러져 들어온다.
  const [back, setBack] = useState(false);
  // 나눔 쓰는 중에 본문을 다시 볼 수 있도록 접어둔 본문. 기본은 접힘.
  const [refOpen, setRefOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // 어느 참가자의 기록을 불러왔는지. 불러오기 전에는 저장하지 않는다 —
  // 빈 답변이 먼저 덮어써서 지난번에 적어둔 글이 사라지는 걸 막는다.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // 본문도 나눔도 한 화면에 담기지 않는다. 억지로 줄이면 글씨가 읽기 힘들어지므로
  // 원래 크기로 두고 읽어 내려가게 하고, 페이지를 넘길 때마다 위에서 다시 시작한다.
  useScrollFit(`${day}_${step}`);

  // 이 화면은 로그인 전부터 떠 있어서(App이 모든 화면을 한꺼번에 그린다) 처음엔 id가 없다.
  // 등록이 끝나 id가 생기는 순간 그 참가자가 적어둔 기록을 가져온다.
  useEffect(() => {
    if (!state.id || loadedId === state.id) return;
    setAnswers(loadQtAnswers(state.id));
    setLoadedId(state.id);
  }, [state.id, loadedId]);

  useEffect(() => {
    if (!loadedId || loadedId !== state.id) return;
    const t = setTimeout(() => saveQtAnswers(loadedId, answers), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [answers, loadedId, state.id]);

  const content = QT_CONTENT.find((c) => c.day === day)!;

  const go = (next: Step) => {
    if (next === step) return;
    setBack(next === 'read');
    setStep(next);
  };

  // 날이 바뀌면 본문이 통째로 바뀐다. 남의 날 본문을 펴 둔 채로 다른 날 질문에 답하지 않도록
  // 언제나 본문 읽기부터 다시 시작한다.
  const pickDay = (d: 2 | 3) => {
    if (d === day) return;
    setDay(d);
    setBack(true);
    setStep('read');
    setRefOpen(false);
  };

  const save = () => {
    if (!loadedId) return;
    saveQtAnswers(loadedId, answers);
    toast('큐티 기록이 이 기기에 저장됐어요');
  };

  const paneRef = useRef<HTMLDivElement>(null);
  // 한 손가락 가로 스와이프. 세로로 읽어 내려가는 손짓과 헷갈리지 않도록 처음 몇 px에서
  // 방향을 딱 한 번 정하고, 세로로 정해지면 그 손짓은 끝까지 넘김으로 치지 않는다.
  const swipe = useRef({ x: 0, y: 0, dx: 0, axis: '' as '' | 'x' | 'y', on: false });

  // px가 null이면 제자리로 되돌린다.
  const shiftPane = (px: number | null) => {
    const pane = paneRef.current;
    if (!pane) return;
    pane.style.transition = px === null ? 'transform 0.18s ease' : 'none';
    pane.style.transform = px === null ? '' : `translateX(${px}px)`;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    // 답을 적는 칸 안에서 시작한 손짓은 커서를 옮기거나 글자를 고르려는 것이다. 페이지를 넘기지 않는다.
    if (e.touches.length !== 1 || (e.target as HTMLElement).closest('textarea')) {
      swipe.current.on = false;
      return;
    }
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, dx: 0, axis: '', on: true };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = swipe.current;
    if (!s.on) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < SWIPE_DECIDE_PX && Math.abs(dy) < SWIPE_DECIDE_PX) return;
      // 세로가 조금이라도 우세하면 읽어 내려가는 중으로 본다 — 넘김은 확실히 가로일 때만.
      s.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (s.axis === 'y') {
        s.on = false;
        return;
      }
    }
    s.dx = dx;
    const canGo = dx < 0 ? step === 'read' : step === 'write';
    shiftPane(dx * (canGo ? SWIPE_PULL : SWIPE_PULL_EDGE));
  };

  const onTouchEnd = () => {
    const s = swipe.current;
    if (!s.on) return;
    s.on = false;
    shiftPane(null);
    if (s.axis !== 'x' || Math.abs(s.dx) < SWIPE_GO_PX) return;
    // 넘어갈 곳이 없는 방향이면 go()가 알아서 아무것도 하지 않는다.
    go(s.dx < 0 ? 'write' : 'read');
  };

  return (
    <section>
      <div className="eyebrow">Quiet Time</div>
      <h1>아침 큐티</h1>
      <p className="muted" style={{ marginBottom: 4 }}>
        하루를 시작하며 말씀 앞에 잠시 머물러요.
      </p>

      <div className={styles.dayTabRow}>
        {QT_CONTENT.map((c) => (
          <div
            key={c.day}
            className={`${styles.dayTab} ${day === c.day ? styles.dayTabOn : ''}`}
            onClick={() => pickDay(c.day)}
          >
            <div className={styles.dayTabNum}>DAY {c.day}</div>
            <div className={styles.dayTabDate}>
              {c.date} {c.weekday}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.stepper}>
        {STEPS.map((s, i) => (
          <div key={s.id} className={styles.stepCell}>
            {i > 0 && <span className={styles.stepLine} />}
            <button
              className={`${styles.stepBtn} ${step === s.id ? styles.stepBtnOn : ''}`}
              aria-current={step === s.id}
              onClick={() => go(s.id)}
            >
              <span className={styles.stepDot} />
              {s.label}
            </button>
          </div>
        ))}
      </div>

      <div
        key={`${day}_${step}`}
        ref={paneRef}
        className={`${styles.pane} ${back ? styles.paneBack : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {step === 'read' ? (
          <>
            <div className={styles.passageRef}>{content.passageRef}</div>
            <Verses verses={content.verses} />
            <p className={styles.swipeHint}>천천히 두 번 읽어도 좋아요. 옆으로 넘기면 나눔 쓰기로 가요.</p>
          </>
        ) : (
          <>
            <button className={styles.refToggle} aria-expanded={refOpen} onClick={() => setRefOpen((o) => !o)}>
              <span className={styles.refToggleRef}>{content.passageRef}</span>
              <span className={styles.refToggleHint}>
                {refOpen ? '접기' : '본문 보기'}
                <Chevron open={refOpen} />
              </span>
            </button>
            {refOpen && <Verses verses={content.verses} />}

            {content.sections.map((section, si) => {
              // 질문이 하나뿐인 [적용하기]에는 번호를 붙이지 않는다. 셀 것이 없는데 붙은 번호는 군더더기다.
              const numbered = section.questions.length > 1;
              return (
                <div key={section.title} className={styles.section}>
                  <div className={styles.sectionTitle}>{section.title}</div>
                  {section.questions.map((q, qi) => (
                    <div key={qi} className={styles.question}>
                      <p className={`${styles.questionText} ${numbered ? styles.questionNumbered : ''}`}>
                        {numbered && <span className={styles.questionNo}>{qi + 1}</span>}
                        {q}
                      </p>
                      <textarea
                        className="field"
                        style={{ minHeight: 84, resize: 'none', marginBottom: 0 }}
                        placeholder="묵상한 내용을 적어보세요"
                        value={answers[`${day}_${si}_${qi}`] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [`${day}_${si}_${qi}`]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              );
            })}

            <button className="btn" onClick={save}>
              기록 저장
            </button>
            <p className="tiny">적는 동안에도 자동으로 저장돼요. 이 기기에만 남고 아무에게도 보이지 않아요.</p>
          </>
        )}
      </div>
    </section>
  );
}
