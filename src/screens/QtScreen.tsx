import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QT_CONTENT, type QtVerse } from '../data/qt';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { loadQtAnswers, saveQtAnswers } from '../lib/storage';
import { useSwipePager } from '../lib/useSwipePager';
import { useFillFit } from '../components/FitBox';
import styles from './QtScreen.module.css';

// 글자를 칠 때마다 localStorage에 쓰지 않고 손이 멈추면 한 번에 쓴다.
const SAVE_DEBOUNCE_MS = 400;

// 하루치 큐티는 본문 읽기 → 관찰하기 → 묵상하기 → 적용하기 순으로 한 장씩 넘긴다.
// 예전에는 관찰·묵상·적용 세 묶음을 "나눔 쓰기" 한 장에 다 쌓아 두었는데, 열어보자마자
// 질문 여섯 개와 입력칸 여섯 개가 한꺼번에 쏟아져 어디부터 손대야 할지 알 수 없었다.
// 0번은 본문, 1번부터는 content.sections를 순서대로 한 장씩 맡는다.
const READ_STEP = 0;

// 단계 줄에 적히는 이름. 점 네 개가 나란히 놓이는 좁은 줄이라 "관찰하기"의 -하기는 덜어낸다
// (무엇을 하는 곳인지는 두 글자로도 충분하고, 네 칸이 다 들어와야 한눈에 순서가 보인다).
const shortLabel = (title: string) => title.replace(/하기$/, '');

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
  const [step, setStep] = useState(READ_STEP);
  // 방금 뒤로 넘어왔는지. 넘어온 방향대로 페이지가 미끄러져 들어온다.
  const [back, setBack] = useState(false);
  // 답을 적는 중에 본문을 다시 볼 수 있도록 접어둔 본문. 기본은 접힘.
  const [refOpen, setRefOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // 어느 참가자의 기록을 불러왔는지. 불러오기 전에는 저장하지 않는다 —
  // 빈 답변이 먼저 덮어써서 지난번에 적어둔 글이 사라지는 걸 막는다.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // 본문도 질문도 한 화면에 담기지 않는다. 억지로 줄이면 글씨가 읽기 힘들어지므로
  // 원래 크기로 두고 읽어 내려가게 한다. 다만 짧은 장에서 아래가 텅 비지 않도록,
  // 남는 높이는 본문 상자가 받아 화면 아래까지 채운다(적는 칸이 그만큼 넓어진다).
  useFillFit();
  // fill 모드에서는 바깥 FitBox가 아니라 이 화면이 스크롤한다. 장을 넘기면 읽던 자리가
  // 아니라 맨 위에서 다시 시작해야 하므로, FitBox 대신 여기서 직접 되돌린다.
  const wrapRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollTop = 0;
  }, [day, step]);

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
  const stepLabels = ['본문', ...content.sections.map((s) => shortLabel(s.title))];
  const section = step === READ_STEP ? null : content.sections[step - 1];

  const go = (next: number) => {
    if (next === step || next < 0 || next >= stepLabels.length) return;
    setBack(next < step);
    setStep(next);
  };

  // 날이 바뀌면 본문이 통째로 바뀐다. 남의 날 본문을 펴 둔 채로 다른 날 질문에 답하지 않도록
  // 언제나 본문 읽기부터 다시 시작한다.
  const pickDay = (d: 2 | 3) => {
    if (d === day) return;
    setDay(d);
    setBack(true);
    setStep(READ_STEP);
    setRefOpen(false);
  };

  const save = () => {
    if (!loadedId) return;
    saveQtAnswers(loadedId, answers);
    toast('큐티 기록이 이 기기에 저장됐어요');
  };

  const { ref: paneRef, handlers: swipeHandlers } = useSwipePager({
    onGo: (dir) => go(step + dir),
    canGo: (dir) => step + dir >= 0 && step + dir < stepLabels.length,
    // 답을 적는 칸 안에서 시작한 손짓은 커서를 옮기거나 글자를 고르려는 것이다.
    ignore: 'textarea',
  });

  return (
    <section className={styles.wrap} ref={wrapRef}>
      <div className={styles.head}>
      {/* 제목 아래 각주 줄 하나에 날짜 고르기 · 날짜 · 인사말이 이어 선다.
          인사말을 제목 옆에 따로 세워두면 제목과 크기를 겨루는데, 날짜 뒤에 이어 붙이면
          "며칠 것을 · 어느 날에 · 무엇 하러 보는가"가 한 줄로 읽힌다. */}
      <div className="eyebrow">Quiet Time</div>
      <h1 className={styles.title}>아침 큐티</h1>
      <div className={styles.dateLine}>
        <div className={styles.dayPick}>
          {QT_CONTENT.map((c) => (
            <button
              key={c.day}
              className={`${styles.dayBtn} ${day === c.day ? styles.dayBtnOn : ''}`}
              aria-pressed={day === c.day}
              onClick={() => pickDay(c.day)}
            >
              DAY {c.day}
            </button>
          ))}
        </div>
        <span className={`muted ${styles.dateNote}`}>
          {content.date} {content.weekday} · 말씀 앞에 잠시 머물러요
        </span>
      </div>

      {/* 선 하나에 점 네 개. 칸으로 나눈 탭보다 "지금 몇 번째 장인지"가 부드럽게 읽힌다. */}
      <div className={styles.stepper}>
        {stepLabels.map((label, i) => (
          <div key={label} className={styles.stepCell}>
            {i > 0 && <span className={styles.stepLine} />}
            <button
              className={`${styles.stepBtn} ${step === i ? styles.stepBtnOn : ''}`}
              aria-current={step === i}
              onClick={() => go(i)}
            >
              <span className={styles.stepDot} />
              {label}
            </button>
          </div>
        ))}
      </div>
      </div>

      <div
        key={`${day}_${step}`}
        ref={paneRef}
        className={`${styles.pane} ${back ? styles.paneBack : ''}`}
        {...swipeHandlers}
      >
        {!section ? (
          <>
            <div className={styles.passageRef}>{content.passageRef}</div>
            <Verses verses={content.verses} />
            {/* 다음 장이 무엇인지는 바로 위 점 네 개가 이미 말해준다. 여기서는 어떻게
                넘기는지만 알려주면 되고, 이름까지 넣으면 두 줄로 접힌다. */}
            <p className={styles.swipeHint}>옆으로 넘겨 나눔을 이어가요</p>
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

            {section.questions.map((q, qi) => {
              // 질문이 하나뿐인 [적용하기]에는 번호를 붙이지 않는다. 셀 것이 없는데 붙은 번호는 군더더기다.
              const numbered = section.questions.length > 1;
              return (
                <div key={qi} className={styles.question}>
                  <p className={`${styles.questionText} ${numbered ? styles.questionNumbered : ''}`}>
                    {numbered && <span className={styles.questionNo}>{qi + 1}</span>}
                    {q}
                  </p>
                  <textarea
                    className={`field ${styles.answer}`}
                    placeholder="묵상한 내용을 적어보세요"
                    value={answers[`${day}_${step - 1}_${qi}`] ?? ''}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [`${day}_${step - 1}_${qi}`]: e.target.value }))
                    }
                  />
                </div>
              );
            })}

            {/* 적는 동안 이미 저장되므로 이 버튼은 확인용이다. 화면을 대표하는 버튼이 아니니
                글자 길이만큼만 차지하는 작은 버튼으로 둔다. */}
            <div className={styles.saveRow}>
              <button className="btn xs" onClick={save}>
                기록 저장
              </button>
            </div>
            <p className="tiny">자동으로 이 기기에만 저장됩니다</p>
          </>
        )}
      </div>
    </section>
  );
}
