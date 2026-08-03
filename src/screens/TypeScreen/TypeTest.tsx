import { useEffect, useMemo, useRef, useState } from 'react';
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
  MED_TYPES,
  PRAY_TYPES,
  type IdolKey,
} from '../../data/typeTest';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { loadTypeResult, saveTypeResult } from '../../lib/gas';
import { clearTypeProgress, loadTypeProgress, saveTypeProgress } from '../../lib/storage';
import BackLink from '../../components/BackLink';
import styles from './TypeTest.module.css';

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
  | { type: 'section'; title: string; body: string }
  | { type: 'likert'; key: string; cat: IdolKey; text: string; section: string }
  | { type: 'ab'; key: string; a: string; b: string; section: string }
  | { type: 'choice'; key: string; text: string; options: string[]; section: string }
  | { type: 'result' };

// order는 우상 문항을 보여줄 순서다. 답변 키(idol_i)는 섞기 전 원래 번호로 매기므로
// 순서가 달라져도 채점 결과는 같지만, 이어풀기 때 같은 자리에서 이어지도록 순서째로 저장해둔다.
function buildScreens(order: number[]): TTScreen[] {
  const screens: TTScreen[] = [];
  screens.push({ type: 'intro' });
  screens.push({ type: 'section', title: '1부 · 나의 우상 유형', body: '하나님보다 앞에 두기 쉬운 것이 무엇인지, 함께 찾아봐요.' });
  order.forEach((i) => {
    const q = IDOL_QUESTIONS[i];
    screens.push({ type: 'likert', key: 'idol_' + i, cat: q.cat, text: q.text, section: '우상 유형' });
  });

  // 묵상과 기도는 따로 나누지 않고 한 부로 이어서 묻는다.
  screens.push({ type: 'section', title: '2부 · 나의 묵상과 기도', body: '말씀과 기도를 대하는 시간과 방식으로 나의 결을 알아봐요.' });
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

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Inner Desire &amp; Orientation Assessment</div>
      <h1>IDOL-X</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        내가 하나님보다 앞세우는 것, 말씀과 기도를 대하는 나의 결을 알아봐요.
      </p>

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

        {current.type === 'section' && (
          <>
            <span className="pill">{current.title}</span>
            <h2 style={{ margin: '8px 0 18px' }}>{current.body}</h2>
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
            <div className="muted" style={{ fontSize: 12, letterSpacing: '0.08em', marginBottom: 8, color: 'var(--accent-soft)' }}>
              {current.section}
            </div>
            <h2 className={styles.qHeading}>{current.text}</h2>
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
            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn ghost" onClick={goPrev}>
                이전
              </button>
            </div>
          </>
        )}

        {current.type === 'ab' && (
          <>
            <div className="muted" style={{ fontSize: 12, letterSpacing: '0.08em', marginBottom: 8, color: 'var(--accent-soft)' }}>
              {current.section}
            </div>
            <div className={styles.abCard}>
              <div className={styles.abSide}>
                <span className={styles.abBadge}>A</span>
                <p>{current.a}</p>
              </div>
              <div className={styles.abDivider}>vs</div>
              <div className={styles.abSide}>
                <span className={`${styles.abBadge} ${styles.abBadgeB}`}>B</span>
                <p>{current.b}</p>
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
            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn ghost" onClick={goPrev}>
                이전
              </button>
            </div>
          </>
        )}

        {current.type === 'choice' && (
          <>
            <div className="muted" style={{ fontSize: 12, letterSpacing: '0.08em', marginBottom: 8, color: 'var(--accent-soft)' }}>
              {current.section}
            </div>
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
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn ghost" onClick={goPrev}>
                이전
              </button>
            </div>
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
function IdolResultCard({ idol }: { idol: ReturnType<typeof computeIdol> }) {
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
    <div className="decision-card" style={{ marginBottom: 16 }}>
      <div className={styles.ttResultTag} style={{ position: 'relative' }}>
        {isMine ? '01 · 나의 우상 유형' : '01 · 다른 유형 살펴보는 중'}
      </div>
      <h2 style={{ position: 'relative', marginBottom: 10 }}>{combo.name}</h2>
      <p style={{ position: 'relative', color: '#d9cdbb', fontSize: 14.5, marginBottom: 8 }}>{combo.desc}</p>

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
        <span>
          {IDOL_META[p].label} × {IDOL_META[s].label} 자세히 보기
        </span>
        <Chevron open={detailOpen} />
      </button>
      <div className={`${styles.detailBody} ${detailOpen ? styles.detailBodyOpen : ''}`}>
        <div className={styles.detailInner}>
          <p className={styles.detailText}>{combo.detail}</p>
          <div className={styles.detailVerse}>
            <span className={styles.detailVerseRef}>추천 말씀 · {combo.verse.ref}</span>“{combo.verse.text}”
          </div>
        </div>
      </div>

      <div className={styles.ttSubLabel} style={{ position: 'relative', marginTop: 18 }}>
        내 응답 분포
      </div>
      <div className={styles.ttBars} style={{ position: 'relative' }}>
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
  const med = computeMed(answers);
  const pray = computePray(answers);
  const combo = IDOL_COMBOS[idol.primary][idol.secondary]!;
  const medT = MED_TYPES[med.type];
  const prayT = PRAY_TYPES[pray.type];
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
      medTypeName: medT.name,
      prayType: pray.type,
      prayTypeName: prayT.name,
      medTime: med.time,
      prayTime: pray.time,
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

  const medSocialNote =
    med.social === 'G' ? '함께 말씀을 나누며 묵상할 때 더 은혜를 받는 편이에요.' : '혼자 조용히 묵상할 때 더 은혜를 받는 편이에요.';
  const prayFocusNote =
    pray.focus === 'O'
      ? '기도 시간의 대부분을 나 자신의 삶과 고민을 위해 쓰는 편이에요.'
      : '나를 위한 기도와 다른 사람을 위한 기도를 비슷한 비중으로 하는 편이에요.';

  return (
    <>
      <IdolResultCard idol={idol} />

      <div className="decision-card" style={{ marginBottom: 16 }}>
        <div className={styles.ttResultTag} style={{ position: 'relative' }}>
          02 · 나의 묵상과 기도
        </div>
        <div className={styles.ttSubLabel} style={{ position: 'relative' }}>
          묵상
        </div>
        <p style={{ position: 'relative', color: '#f5ede0', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{medT.desc}</p>
        <p style={{ position: 'relative', color: '#d9cdbb', fontSize: 14.5, marginTop: 8 }}>+ {medSocialNote}</p>
        <div className={styles.ttStatPill} style={{ position: 'relative' }}>
          하루 평균 묵상 시간 · {med.time}
        </div>

        <div className={styles.ttSubLabel} style={{ position: 'relative', marginTop: 20 }}>
          기도
        </div>
        <p style={{ position: 'relative', color: '#f5ede0', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{prayT.desc}</p>
        <p style={{ position: 'relative', color: '#d9cdbb', fontSize: 14.5, marginTop: 8 }}>+ {prayFocusNote}</p>
        <div className={styles.ttStatPill} style={{ position: 'relative' }}>
          하루 평균 기도 시간 · {pray.time}
        </div>
      </div>

      {saveStatus === 'error' && (
        <button className="btn" style={{ marginBottom: 10 }} onClick={persist}>
          결과 다시 저장하기
        </button>
      )}
      <button className="btn ghost" onClick={onRestart}>
        다시 검사하기
      </button>
      <p className="tiny">이 결과는 진단이 아니라, 나를 돌아보고 하나님 앞에 더 솔직해지기 위한 도구예요.</p>
    </>
  );
}
