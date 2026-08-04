import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  IDOL_ORDER,
  IDOL_META,
  IDOL_COMBOS,
  IDOL_QUESTIONS,
  IDOL_Q_PER_CAT,
  LIKERT_LABELS,
  AB_SCALE,
  MED_AXIS_ROUTINE,
  MED_AXIS_METHOD,
  MED_AXIS_SOCIAL,
  MED_TIME_OPTIONS,
  PRAY_AXIS_ROUTINE,
  PRAY_AXIS_EXPR,
  PRAY_AXIS_FOCUS,
  PRAY_TIME_OPTIONS,
  type IdolKey,
} from '../../data/typeTest';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { loadTypeResult, saveTypeResult } from '../../lib/gas';
import { clearTypeProgress, loadTypeProgress, saveTypeProgress, saveTypeSummary } from '../../lib/storage';
import { computeResponseQuality, computeWalk, QUALITY_NOTE, type QualityBand, type WalkMeta } from '../../lib/typeScore';
import BackLink from '../../components/BackLink';
import { useFitMode } from '../../components/FitBox';
import styles from './TypeTest.module.css';

// 문항 자리의 높이를 붙박이로 만들기 위해 뒤에 깔아둘 "가장 긴 문장". 글자 수가 많을수록
// 줄 수도 많으므로 가장 긴 문장의 높이가 곧 모든 문항이 필요로 하는 최대 높이가 된다.
const longest = (list: string[]) => list.reduce((a, b) => (b.length > a.length ? b : a), '');
const LONGEST_IDOL_TEXT = longest(IDOL_QUESTIONS.map((q) => q.text));
const LONGEST_AB_TEXT = longest(
  [
    ...MED_AXIS_ROUTINE,
    ...MED_AXIS_METHOD,
    ...MED_AXIS_SOCIAL,
    ...PRAY_AXIS_ROUTINE,
    ...PRAY_AXIS_EXPR,
    ...PRAY_AXIS_FOCUS,
  ].flatMap((q) => [q.a, q.b]),
);

function shuffledIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type TTScreen =
  | { type: 'intro' }
  | { type: 'section'; step: string; title: string; body: string }
  | { type: 'likert'; key: string; cat: IdolKey; text: string; section: string }
  | { type: 'ab'; key: string; a: string; b: string; section: string }
  | { type: 'choice'; key: string; text: string; options: string[]; section: string }
  | { type: 'result' };

// order는 우상 문항을 보여줄 순서다. 답변 키(idol_i)는 섞기 전 원래 번호로 매기므로
// 순서가 달라져도 채점 결과는 같지만, 이어풀기 때 같은 자리에서 이어지도록 순서째로 저장해둔다.
function buildScreens(order: number[]): TTScreen[] {
  const screens: TTScreen[] = [];
  screens.push({ type: 'intro' });
  screens.push({
    type: 'section',
    step: 'PART 1',
    title: '나의 우상 유형',
    body: '하나님보다 앞에 두기 쉬운 것이 무엇인지, 함께 찾아봐요.',
  });
  order.forEach((i) => {
    const q = IDOL_QUESTIONS[i];
    screens.push({ type: 'likert', key: 'idol_' + i, cat: q.cat, text: q.text, section: '우상 유형' });
  });

  // 묵상과 기도는 따로 나누지 않고 한 부로 이어서 묻는다.
  screens.push({
    type: 'section',
    step: 'PART 2',
    title: '나의 묵상과 기도',
    body: '말씀과 기도를 대하는 시간과 방식으로 나의 결을 알아봐요.',
  });
  MED_AXIS_ROUTINE.forEach((q, i) => screens.push({ type: 'ab', key: 'med_r_' + i, a: q.a, b: q.b, section: '묵상과 기도' }));
  MED_AXIS_METHOD.forEach((q, i) => screens.push({ type: 'ab', key: 'med_m_' + i, a: q.a, b: q.b, section: '묵상과 기도' }));
  MED_AXIS_SOCIAL.forEach((q, i) => screens.push({ type: 'ab', key: 'med_s_' + i, a: q.a, b: q.b, section: '묵상과 기도' }));
  screens.push({ type: 'choice', key: 'med_time', text: '하루 평균 말씀 묵상(QT) 시간은 얼마나 되나요?', options: MED_TIME_OPTIONS, section: '묵상과 기도' });
  PRAY_AXIS_ROUTINE.forEach((q, i) => screens.push({ type: 'ab', key: 'pray_r_' + i, a: q.a, b: q.b, section: '묵상과 기도' }));
  PRAY_AXIS_EXPR.forEach((q, i) => screens.push({ type: 'ab', key: 'pray_e_' + i, a: q.a, b: q.b, section: '묵상과 기도' }));
  PRAY_AXIS_FOCUS.forEach((q, i) => screens.push({ type: 'ab', key: 'pray_f_' + i, a: q.a, b: q.b, section: '묵상과 기도' }));
  screens.push({ type: 'choice', key: 'pray_time', text: '하루 평균(합산) 기도 시간은 얼마나 되나요?', options: PRAY_TIME_OPTIONS, section: '묵상과 기도' });

  screens.push({ type: 'result' });
  return screens;
}

function axisPole(answers: Record<string, number>, keys: string[], a: string, b: string) {
  const sum = keys.reduce((s, k) => s + (answers[k] ?? 0), 0);
  return sum <= 0 ? a : b;
}

// 카테고리마다 문항 수가 15개로 같으므로 문항 수 보정 없이 총점을 그대로 비교한다.
const IDOL_CAT_MAX = IDOL_Q_PER_CAT * LIKERT_LABELS.length;

function computeIdol(answers: Record<string, number>) {
  const scores: Record<IdolKey, number> = { people: 0, love: 0, money: 0, power: 0, approval: 0, dopamine: 0 };
  IDOL_QUESTIONS.forEach((q, i) => {
    const v = answers['idol_' + i] ?? 0;
    scores[q.cat] += v;
  });
  const ranked = [...IDOL_ORDER].sort((a, b) => scores[b] - scores[a]);
  return { scores, primary: ranked[0], secondary: ranked[1] };
}

function computeMed(answers: Record<string, number>) {
  const routine = axisPole(answers, ['med_r_0', 'med_r_1'], 'R', 'S');
  const method = axisPole(answers, ['med_m_0', 'med_m_1'], 'W', 'M');
  const social = axisPole(answers, ['med_s_0'], 'G', 'A');
  const t = answers['med_time'];
  return { type: `${routine}_${method}`, social, time: t !== undefined ? MED_TIME_OPTIONS[t] : '미응답' };
}

function computePray(answers: Record<string, number>) {
  const routine = axisPole(answers, ['pray_r_0', 'pray_r_1'], 'R', 'S');
  const expr = axisPole(answers, ['pray_e_0', 'pray_e_1'], 'V', 'Si');
  const focus = axisPole(answers, ['pray_f_0'], 'O', 'B');
  const t = answers['pray_time'];
  return { type: `${routine}_${expr}`, focus, time: t !== undefined ? PRAY_TIME_OPTIONS[t] : '미응답' };
}

function SectionTag({ label }: { label: string }) {
  return (
    <div className="muted" style={{ fontSize: 12, letterSpacing: '0.08em', marginBottom: 8, color: 'var(--accent-soft)' }}>
      {label}
    </div>
  );
}

// 문항 글은 보이는 것과 가장 긴 문항을 같은 자리에 겹쳐 둔다(뒤엣것은 자리만 차지한다).
function QuestionText({ text }: { text: string }) {
  return (
    <div className={styles.qStack}>
      <h2 className={styles.qHeading}>{text}</h2>
      <h2 className={`${styles.qHeading} ${styles.ghost}`} aria-hidden="true">
        {LONGEST_IDOL_TEXT}
      </h2>
    </div>
  );
}

function PrevButton({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.qNav}>
      <button className={styles.prevBtn} onClick={onClick}>
        <svg viewBox="0 0 24 24">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        이전
      </button>
    </div>
  );
}

export default function TypeTest() {
  const { state, goScreen } = useApp();
  const [order, setOrder] = useState(() => shuffledIndices(IDOL_QUESTIONS.length));
  const screens = useMemo(() => buildScreens(order), [order]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredFor = useRef<string | null>(null);

  const current = screens[idx];
  // 화면 수는 문항 수에 따라 정해지므로, 저장해둔 답변이 지금 문항 구성과 맞는지 가리는 기준으로 쓴다.
  const version = screens.length;
  const isResult = current.type === 'result';

  // 결과지는 한 화면에 우겨넣을 내용이 아니다(카드 두 장에 상세 설명 토글까지 열린다).
  // 억지로 줄이면 글씨만 작아지므로 원래 크기로 두고 읽어 내려가게 한다.
  // 반대로 문항 화면은 글이 한 줄뿐이라 남는 높이만큼 키우면 글씨만 커진 확대경이 된다.
  useFitMode(isResult ? 'scroll' : 'shrink', idx);

  // 이 화면은 앱이 켜질 때(로그인 전) 이미 마운트되므로, 로그인해서 id가 생긴 뒤에 저장된 답변을 불러온다.
  // 이 기기에 남은 게 없으면 시트에 백업해둔 답변으로 결과를 되살린다
  // (캐시가 지워졌거나 다른 기기로 들어온 경우).
  useEffect(() => {
    const id = state.id;
    if (!id || restoredFor.current === id) return;
    restoredFor.current = id;
    const local = loadTypeProgress(id, version);
    if (local) {
      setOrder(local.order);
      setAnswers(local.answers);
      setIdx(Math.min(Math.max(local.idx, 0), version - 1));
      return;
    }
    loadTypeResult(id)
      .then((remote) => {
        if (!remote || remote.version !== version) return;
        // 되찾아오는 동안 이미 풀기 시작했다면 그 답변을 덮어쓰지 않는다.
        setIdx((cur) => (cur === 0 ? version - 1 : cur));
        setAnswers((cur) => (Object.keys(cur).length === 0 ? remote.answers : cur));
      })
      .catch(() => {});
  }, [state.id, version]);

  // 풀던 자리를 이 기기에 남긴다(새로고침·앱 전환에도 이어서 풀 수 있도록).
  useEffect(() => {
    const id = state.id;
    if (!id || restoredFor.current !== id) return;
    if (idx === 0 && Object.keys(answers).length === 0) return;
    saveTypeProgress(id, { version, order, idx, answers });
  }, [state.id, version, order, idx, answers]);

  const isQ = current.type === 'likert' || current.type === 'ab' || current.type === 'choice';
  const qScreens = screens.filter((s) => s.type === 'likert' || s.type === 'ab' || s.type === 'choice') as Extract<
    TTScreen,
    { key: string }
  >[];
  const answeredCount = qScreens.filter((s) => answers[s.key] !== undefined).length;
  // 몇 번째 문항인지(102 같은 숫자) 대신 진행률만 %로 보여준다. 문항이 102개라 한 문항이 약 1%다.
  const pct = qScreens.length === 0 ? 0 : Math.round((answeredCount / qScreens.length) * 100);

  const goNext = () => setIdx((i) => Math.min(i + 1, screens.length - 1));
  const goPrev = () => setIdx((i) => Math.max(i - 1, 0));
  const answerAndNext = (key: string, val: number) => {
    setAnswers((a) => ({ ...a, [key]: val }));
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(goNext, 180);
  };
  const restart = () => {
    if (state.id) clearTypeProgress(state.id);
    setAnswers({});
    setOrder(shuffledIndices(IDOL_QUESTIONS.length));
    setIdx(0);
  };

  // 결과 화면에서만 제목이 'IDOL-X' 대신 확정된 글자와 조합 이름으로 바뀐다.
  const resultTitle = useMemo(() => {
    if (!isResult) return null;
    const { primary, secondary } = computeIdol(answers);
    return `IDOL-${computeWalk(answers).code}: “${IDOL_COMBOS[primary][secondary]!.name}”`;
  }, [isResult, answers]);

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className={`eyebrow ${styles.ttEyebrow}`}>Inner Desire &amp; Orientation Assessment</div>
      {/* 검사를 마치면 제목의 X가 내 글자로 확정되고, 조합 이름까지 제목이 품는다 —
          결과지의 헤드라인 역할을 제목이 겸한다.
          반대로 문항을 푸는 동안에는 제목이 매 화면 주인공 자리를 차지하지 않도록 줄여 둔다.
          그 자리의 주인공은 지금 읽어야 할 문항이다. */}
      <h1 className={resultTitle ? styles.resultTitle : current.type === 'intro' ? undefined : styles.testTitle}>
        {resultTitle ?? 'IDOL-X'}
      </h1>
      {current.type === 'intro' && (
        <p className="muted" style={{ marginBottom: 16 }}>
          Break · 하나님보다 앞세우는 것 찾기
        </p>
      )}

      {isQ && (
        <div className={styles.progressWrap}>
          <span className={styles.progressLabel}>{pct}%</span>
          <div className={styles.bar}>
            <span className={styles.barFill} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div>
        {current.type === 'intro' && (
          <>
            <p className="lead" style={{ marginBottom: 10 }}>
              내가 하나님보다 앞세우는 것은 무엇인지, 말씀과 기도를 대하는 나의 방식은 어떤 결인지 — 질문으로 알아봐요.
            </p>
            <p className="muted" style={{ marginBottom: 20 }}>
              솔직하게, 지금 나의 모습 그대로 답해주세요. 정답은 없어요. 각 문항은 7점 척도로, 1은 “전혀 아니다” 7은 “매우 그렇다”예요.
            </p>
            <button className="btn" onClick={goNext}>
              시작하기
            </button>
          </>
        )}

        {/* 예전에는 안내 문장 자체가 h2로 화면을 가득 채웠다. 지금은 "몇 부에 들어서는가"가
            주인공이고, 안내 문장은 그 아래 붙는 본문이다. */}
        {current.type === 'section' && (
          <>
            <div className={styles.sectionStep}>{current.step}</div>
            <h2 className={styles.sectionTitle}>{current.title}</h2>
            <p className={styles.sectionBody}>{current.body}</p>
            <div className="row">
              <button className="btn ghost" style={{ flex: '0 0 92px' }} onClick={goPrev}>
                이전
              </button>
              <button className="btn" onClick={goNext}>
                계속하기
              </button>
            </div>
          </>
        )}

        {current.type === 'likert' && (
          <>
            <SectionTag label={current.section} />
            <QuestionText text={current.text} />
            <div className={`${styles.scaleTrack} ${styles.scaleTrackLikert}`}>
              <div className={styles.scaleLine} />
              {LIKERT_LABELS.map((label, i) => {
                const v = i + 1;
                const selected = answers[current.key] === v;
                return (
                  <button
                    key={v}
                    className={`${styles.scaleDot} ${selected ? styles.scaleDotOn : ''}`}
                    aria-label={label}
                    onClick={() => answerAndNext(current.key, v)}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
            <div className={styles.scaleEndLabels}>
              <span>{LIKERT_LABELS[0]}</span>
              <span>{LIKERT_LABELS[LIKERT_LABELS.length - 1]}</span>
            </div>
            <PrevButton onClick={goPrev} />
          </>
        )}

        {current.type === 'ab' && (
          <>
            <SectionTag label={current.section} />
            <div className={styles.abCard}>
              <div className={styles.abSide}>
                <span className={styles.abBadge}>A</span>
                <div className={styles.abStack}>
                  <p>{current.a}</p>
                  <p className={styles.ghost} aria-hidden="true">
                    {LONGEST_AB_TEXT}
                  </p>
                </div>
              </div>
              <div className={styles.abDivider}>vs</div>
              <div className={styles.abSide}>
                <span className={`${styles.abBadge} ${styles.abBadgeB}`}>B</span>
                <div className={styles.abStack}>
                  <p>{current.b}</p>
                  <p className={styles.ghost} aria-hidden="true">
                    {LONGEST_AB_TEXT}
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.scaleTrack}>
              <div className={styles.scaleLine} />
              {AB_SCALE.map((o, i) => {
                const selected = answers[current.key] === o.v;
                return (
                  <button
                    key={o.v}
                    className={`${styles.scaleDot} ${i === 2 ? styles.scaleDotMid : ''} ${selected ? styles.scaleDotOn : ''}`}
                    aria-label={o.label}
                    onClick={() => answerAndNext(current.key, o.v)}
                  />
                );
              })}
            </div>
            <div className={styles.scaleEndLabels}>
              <span>A</span>
              <span>중립</span>
              <span>B</span>
            </div>
            <PrevButton onClick={goPrev} />
          </>
        )}

        {current.type === 'choice' && (
          <>
            <SectionTag label={current.section} />
            <h2 className={styles.qHeading} style={{ marginBottom: 16 }}>{current.text}</h2>
            {current.options.map((o, i) => (
              <button
                key={i}
                className={`opt ${answers[current.key] === i ? 'selected' : ''}`}
                onClick={() => answerAndNext(current.key, i)}
              >
                {o}
              </button>
            ))}
            <PrevButton onClick={goPrev} />
          </>
        )}

        {current.type === 'result' && <ResultView answers={answers} version={version} onRestart={restart} />}
      </div>
    </section>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.chev} ${open ? styles.chevOpen : ''}`}
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// 우상 유형 카드. 내 결과를 보여주는 것이 기본이지만, 1·2위 자리를 눌러 다른 유형 조합의
// 결과도 그대로 열어볼 수 있다(내 점수와 저장되는 결과는 바뀌지 않는다).
function IdolResultCard({ idol, band }: { idol: ReturnType<typeof computeIdol>; band: QualityBand }) {
  const [pick, setPick] = useState<{ p: IdolKey; s: IdolKey } | null>(null);
  const [openSlot, setOpenSlot] = useState<'p' | 's' | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const p = pick?.p ?? idol.primary;
  const s = pick?.s ?? idol.secondary;
  const isMine = p === idol.primary && s === idol.secondary;
  const combo = IDOL_COMBOS[p][s]!;

  // 이미 다른 자리에 있는 유형을 고르면 두 자리를 맞바꾼다(1위와 2위가 같아지지 않도록).
  const choose = (key: IdolKey) => {
    if (openSlot === 'p') setPick(key === s ? { p: key, s: p } : { p: key, s });
    else setPick(key === p ? { p: s, s: key } : { p, s: key });
    setOpenSlot(null);
  };

  const slots = [
    { slot: 'p' as const, rank: '1위', key: p },
    { slot: 's' as const, rank: '2위', key: s },
  ];

  return (
    <div className="decision-card">
      {/* 내 조합은 이름표처럼 이 줄에 작게 붙인다. 응답이 얼마나 또렷했는지는 그 이름표의
          색으로만 전한다 — '신뢰성 낮음' 같은 등급을 글자로 박아두면 채점처럼 읽히기 때문이다. */}
      <div className={styles.cardTagRow}>
        <span className={styles.ttResultTag}>{isMine ? '내가 앞세우는 것' : '다른 유형 살펴보는 중'}</span>
        {isMine && (
          <span className={`${styles.comboPill} ${QUALITY_BAND_CLASS[band]}`} title={QUALITY_NOTE[band]}>
            {IDOL_META[idol.primary].label} × {IDOL_META[idol.secondary].label}
          </span>
        )}
      </div>
      {/* 내 조합 이름은 화면 제목이 이미 품고 있다. 여기서는 다른 유형을 열어봤을 때만
          지금 보고 있는 조합이 무엇인지 밝혀준다. */}
      {!isMine && <h2 style={{ marginBottom: 10 }}>{combo.name}</h2>}
      <p className={styles.comboDesc}>{combo.desc}</p>

      <div className={styles.rankBadges}>
        {slots.map(({ slot, rank, key }) => {
          const meta = IDOL_META[key];
          return (
            <button
              key={slot}
              className={`${styles.rankBadge} ${slot === 'p' ? styles.rankBadgePrimary : ''} ${
                openSlot === slot ? styles.rankBadgeOpen : ''
              }`}
              aria-expanded={openSlot === slot}
              onClick={() => setOpenSlot(openSlot === slot ? null : slot)}
            >
              <span className={styles.rankBadgeRank}>{rank}</span>
              <span className={styles.rankBadgeLabel}>
                {meta.label}
                <Chevron open={openSlot === slot} />
              </span>
              <span className={styles.rankBadgeTitle}>{meta.title}</span>
            </button>
          );
        })}
      </div>

      {openSlot ? (
        <div className={styles.typePicker}>
          <div className={styles.typePickerHint}>{openSlot === 'p' ? '1위' : '2위'} 자리에 놓고 볼 유형을 골라보세요</div>
          <div className={styles.typeChips}>
            {IDOL_ORDER.map((k) => {
              const meta = IDOL_META[k];
              const on = (openSlot === 'p' ? p : s) === k;
              return (
                <button
                  key={k}
                  className={`${styles.typeChip} ${on ? styles.typeChipOn : ''}`}
                  onClick={() => choose(k)}
                >
                  <b>{meta.label}</b>
                  <em>{meta.title}</em>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className={styles.exploreHint}>
          {isMine ? '1위 · 2위 자리를 눌러 다른 유형 조합도 살펴볼 수 있어요.' : `내 결과는 ${IDOL_META[idol.primary].label} × ${IDOL_META[idol.secondary].label}이에요.`}
        </p>
      )}

      {!isMine && (
        <button className={styles.backToMine} onClick={() => setPick(null)}>
          내 결과로 돌아가기
        </button>
      )}

      <button className={styles.detailToggle} aria-expanded={detailOpen} onClick={() => setDetailOpen((o) => !o)}>
        <span>{combo.name} 자세히 보기</span>
        <Chevron open={detailOpen} />
      </button>
      <div className={`${styles.detailBody} ${detailOpen ? styles.detailBodyOpen : ''}`}>
        <div className={styles.detailInner}>
          <p className={styles.detailText}>{combo.detail}</p>
          <div className={styles.detailVerse}>
            <span className={styles.detailVerseRef}>추천 말씀</span>
            {combo.verse}
          </div>
        </div>
      </div>

      <div className={styles.ttSubLabel} style={{ marginTop: 18 }}>
        내 응답 분포
      </div>
      <div className={styles.ttBars}>
        {IDOL_ORDER.map((c) => {
          const meta = IDOL_META[c];
          const pct = Math.max(4, Math.round((idol.scores[c] / IDOL_CAT_MAX) * 100));
          return (
            <div className={styles.ttBarRow} key={c}>
              <div className={styles.ttBarLabel}>
                {meta.label}
                <em>{meta.title}</em>
              </div>
              <div className={styles.ttBarTrack}>
                <div className={styles.ttBarFill} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const QUALITY_BAND_CLASS: Record<QualityBand, string> = {
  high: styles.qualityHigh,
  mid: styles.qualityMid,
  low: styles.qualityLow,
};

// 우상 진단(내 마음의 그늘)에서 처방(하나님께 돌아가는 길)으로 넘어가는 자리.
// 덱은 손가락으로 넘길 수 있지만 그것만으로는 "넘길 게 있다"는 걸 모른다.
// 진단을 다 읽은 자리에 질문을 놓고, 그 질문이 곧 넘기는 버튼이 된다.
function BridgeNudge({ onNext }: { onNext: () => void }) {
  return (
    <button className={styles.bridge} onClick={onNext}>
      <span className={styles.bridgeLine} aria-hidden="true" />
      {/* 줄바꿈을 손으로 넣으면 기기 폭에 따라 "위해," 같은 한 낱말만 남는 줄이 생긴다.
          어절 단위로만 끊기게 두고(keep-all) 줄바꿈은 브라우저에 맡긴다. */}
      <span className={styles.bridgeText}>
        그렇다면 이 마음의 우상을 내려놓고 하나님께 돌아가기 위해, 당신에게 가장 자연스러운 <b>영적 호흡 방식</b>은
        무엇일까요?
      </span>
      <span className={styles.bridgeGo}>
        나의 영적 처방 보기
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </button>
  );
}

// 묵상·기도의 결을 "또 하나의 유형"이 아니라 앞선 우상 진단에 대한 처방으로 내놓는다.
// 그래서 이름을 크게 앞세우지 않고, 무엇을 어떻게 해보면 되는지가 카드의 본문이 된다.
function PrescriptionCard({ walk }: { walk: WalkMeta }) {
  return (
    <div className="decision-card">
      <div className={styles.walkHead}>
        <h2 className={styles.walkName}>
          {walk.name}
          <em>{walk.en}</em>
        </h2>
        <span className={styles.walkAxis}>
          {walk.expression} × {walk.rhythm}
        </span>
      </div>
      <p className={styles.walkTagline}>{walk.tagline}</p>
      <p className={styles.walkFusion}>{walk.fusion}</p>

      <div className={styles.guideLabel}>실천 가이드</div>
      <ul className={styles.guideList}>
        {walk.guides.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
    </div>
  );
}

interface DeckSlide {
  key: string;
  /** 넘기기 전에도 저쪽에 무엇이 있는지 보여주는 이름표 */
  tab: string;
  /** goTo를 받아 슬라이드 안에서도 다른 장으로 넘길 수 있게 한다(브릿지 버튼 등). */
  render: (goTo: (i: number) => void) => ReactNode;
}

// 진단과 처방을 좌우로 넘겨보는 덱. 스크롤 스냅만 쓰기 때문에 터치 스와이프는 브라우저 기본
// 동작이고, 여기서는 지금 몇 번째를 보고 있는지만 따라간다.
// 점 대신 이름표를 쓴다 — 넘기기 전에도 "저쪽에 무엇이 있는지"가 보여야 넘길 마음이 생긴다.
function ResultDeck({ slides }: { slides: DeckSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // 넘기는 중에는 들어오는 장이 잘리지 않게 가장 큰 높이를 쓴다. 멈춘 뒤에는 지금 보는 장에 맞춘다.
  const [moving, setMoving] = useState(false);
  const [trackH, setTrackH] = useState<number>();
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 스크롤이 멎었는지 알려주는 이벤트가 없어서, 잠시 조용하면 멈춘 것으로 본다.
  const markMoving = () => {
    setMoving(true);
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => setMoving(false), 160);
  };

  // 슬라이드 사이 간격 때문에 scrollLeft를 폭으로 나누면 어긋난다.
  // 화면 한가운데에 가장 가까운 슬라이드를 현재 슬라이드로 본다.
  const syncActive = () => {
    const el = trackRef.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setActive(nearest);
    markMoving();
  };

  // 두 장의 높이가 다르면 짧은 쪽 아래에 그 차이만큼 빈 자리가 남는다(상세 설명을 펴면 더 벌어진다).
  // 그래서 덱 자체의 높이를 지금 보는 장에 맞춰 따라가게 한다. 슬라이드 안에서 토글이 열려
  // 높이가 달라지는 것도 관찰해서 함께 따라간다.
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    if (!kids.length) return;
    const sync = () => {
      const heights = kids.map((k) => k.getBoundingClientRect().height);
      setTrackH(Math.ceil(moving ? Math.max(...heights) : heights[active] ?? 0));
    };
    sync();
    const ro = new ResizeObserver(sync);
    kids.forEach((k) => ro.observe(k));
    return () => ro.disconnect();
  }, [active, moving, slides.length]);

  useEffect(() => () => {
    if (settleRef.current) clearTimeout(settleRef.current);
  }, []);

  // 이름표를 눌러 넘길 때는 스크롤 이벤트를 기다리지 않고 곧바로 활성 장을 바꾼다.
  // 부드러운 스크롤은 몇 프레임 뒤에야 첫 이벤트를 주기 때문에, 기다리면 누른 이름표가
  // 한 박자 늦게 켜진다(움직임을 줄이는 설정에서는 아예 안 켜질 수도 있다).
  const goTo = (i: number) => {
    const el = trackRef.current;
    const target = el?.children[i] as HTMLElement | undefined;
    if (!el || !target) return;
    setActive(i);
    // 짧은 장으로 넘어갈 때, 아직 보이는 긴 장이 잘리지 않도록 스크롤이 끝날 때까지 높이를 열어둔다.
    markMoving();
    el.scrollTo({ left: target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2, behavior: 'smooth' });
  };

  return (
    <>
      <div className={styles.deckTabs} role="tablist">
        {slides.map((s, i) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={i === active}
            className={`${styles.deckTab} ${i === active ? styles.deckTabOn : ''}`}
            onClick={() => goTo(i)}
          >
            {s.tab}
          </button>
        ))}
      </div>
      <div className={styles.deck} ref={trackRef} onScroll={syncActive} style={{ height: trackH }}>
        {slides.map((s) => (
          <div className={styles.deckSlide} key={s.key}>
            {s.render(goTo)}
          </div>
        ))}
      </div>
    </>
  );
}

function ResultView({
  answers,
  version,
  onRestart,
}: {
  answers: Record<string, number>;
  version: number;
  onRestart: () => void;
}) {
  const { state } = useApp();
  const idol = computeIdol(answers);
  // 묵상·기도 유형 코드와 시간은 화면에 따로 펼치지 않고 인도자용으로 시트에만 남긴다.
  const med = computeMed(answers);
  const pray = computePray(answers);
  const walk = computeWalk(answers);
  const quality = computeResponseQuality(answers);
  const combo = IDOL_COMBOS[idol.primary][idol.secondary]!;
  const toast = useToast();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const savingRef = useRef(false);

  // 결과를 시트에 기록한다. 예전에는 한 번 시도하고 실패하면 조용히 포기해서 기록이 아예 안 남았다.
  // 이제는 (1) 로그인 정보가 아직 없으면 생길 때까지 기다렸다가 저장하고,
  // (2) 실패하면 알려주고 아래 버튼으로 다시 시도할 수 있게 한다.
  const persist = () => {
    if (!state.id || savingRef.current) return;
    savingRef.current = true;
    setSaveStatus('saving');
    saveTypeResult({
      playerId: state.id,
      nick: state.nick,
      idolPrimary: idol.primary,
      idolSecondary: idol.secondary,
      comboName: combo.name,
      medType: med.type,
      prayType: pray.type,
      medTime: med.time,
      prayTime: pray.time,
      walkCode: walk.code,
      medSocial: med.social,
      prayFocus: pray.focus,
      idolScores: idol.scores,
      consistency: quality.consistency,
      clarity: quality.clarity,
      flat: quality.flat,
      answers,
      version,
    })
      .then(() => setSaveStatus('saved'))
      .catch(() => {
        setSaveStatus('error');
        toast('검사 결과 저장에 실패했어요. 아래에서 다시 시도해주세요');
      })
      .finally(() => {
        savingRef.current = false;
      });
  };

  useEffect(() => {
    if (saveStatus === 'idle') persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.id, saveStatus]);

  // 나눔 화면이 내 유형을 알아야 하는데, 답변을 다시 채점하려면 문항 구성까지 알아야 한다.
  // 결론만 따로 남겨두면 나눔 화면은 검사 화면을 몰라도 된다.
  useEffect(() => {
    if (state.id) saveTypeSummary(state.id, { primary: idol.primary, secondary: idol.secondary, comboName: combo.name });
  }, [state.id, idol.primary, idol.secondary, combo.name]);

  return (
    <>
      {/* 진단과 처방을 위아래로 이어 붙이면 처방이 한참 내려야 나오는 덤이 된다.
          좌우로 두 장을 두고, 진단 끝의 질문이 곧 처방으로 넘어가는 손잡이가 된다. */}
      <ResultDeck
        slides={[
          {
            key: 'idol',
            tab: '우상 진단',
            render: (goTo) => (
              <>
                <IdolResultCard idol={idol} band={quality.band} />
                <BridgeNudge onNext={() => goTo(1)} />
              </>
            ),
          },
          {
            key: 'walk',
            tab: '영적 처방',
            render: () => <PrescriptionCard walk={walk} />,
          },
        ]}
      />

      {saveStatus === 'error' && (
        <button className="btn" style={{ marginBottom: 10 }} onClick={persist}>
          결과 다시 저장하기
        </button>
      )}
      <button className="btn ghost" onClick={onRestart}>
        다시 검사하기
      </button>
      {/* 나눔은 검사 직후가 아니라 진행자가 시간을 잡았을 때 여정에서 열린다.
          여기서는 그런 자리가 있다는 것만 알려둔다. */}
      <p className="tiny">
        이 결과는 진단이 아니라, 나를 돌아보고 하나님 앞에 더 솔직해지기 위한 도구예요. 같은 유형끼리 나누는 시간은
        여정 화면에서 열려요.
      </p>
    </>
  );
}
