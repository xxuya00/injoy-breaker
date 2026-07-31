import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IDOL_ORDER,
  IDOL_META,
  IDOL_COMBOS,
  IDOL_QUESTIONS,
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
import { saveTypeResult } from '../../lib/gas';
import BackLink from '../../components/BackLink';
import styles from './TypeTest.module.css';

const COMBO_ICONS = import.meta.glob('../../assets/idol-icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function comboIconUrl(primary: IdolKey, secondary: IdolKey): string | null {
  const key = `${primary}-${secondary}`;
  const path = Object.keys(COMBO_ICONS).find((p) => p.endsWith(`/${key}.svg`));
  return path ? COMBO_ICONS[path] : null;
}

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

function buildScreens(): TTScreen[] {
  const screens: TTScreen[] = [];
  screens.push({ type: 'intro' });
  screens.push({ type: 'section', title: '1부 · 나의 우상 유형', body: '하나님보다 앞에 두기 쉬운 것이 무엇인지, 함께 찾아봐요.' });
  shuffledIndices(IDOL_QUESTIONS.length).forEach((i) => {
    const q = IDOL_QUESTIONS[i];
    screens.push({ type: 'likert', key: 'idol_' + i, cat: q.cat, text: q.text, section: '우상 유형' });
  });

  screens.push({ type: 'section', title: '2부 · 나의 묵상 유형', body: '말씀을 대하는 시간과 방식으로 나의 묵상 스타일을 알아봐요.' });
  MED_AXIS_ROUTINE.forEach((q, i) => screens.push({ type: 'ab', key: 'med_r_' + i, a: q.a, b: q.b, section: '묵상 유형' }));
  MED_AXIS_METHOD.forEach((q, i) => screens.push({ type: 'ab', key: 'med_m_' + i, a: q.a, b: q.b, section: '묵상 유형' }));
  MED_AXIS_SOCIAL.forEach((q, i) => screens.push({ type: 'ab', key: 'med_s_' + i, a: q.a, b: q.b, section: '묵상 유형' }));
  screens.push({ type: 'choice', key: 'med_time', text: '하루 평균 말씀 묵상(QT) 시간은 얼마나 되나요?', options: MED_TIME_OPTIONS, section: '묵상 시간' });

  screens.push({ type: 'section', title: '3부 · 나의 기도 유형', body: '기도의 형식과 표현 방식으로 나의 기도 스타일을 알아봐요.' });
  PRAY_AXIS_ROUTINE.forEach((q, i) => screens.push({ type: 'ab', key: 'pray_r_' + i, a: q.a, b: q.b, section: '기도 유형' }));
  PRAY_AXIS_EXPR.forEach((q, i) => screens.push({ type: 'ab', key: 'pray_e_' + i, a: q.a, b: q.b, section: '기도 유형' }));
  PRAY_AXIS_FOCUS.forEach((q, i) => screens.push({ type: 'ab', key: 'pray_f_' + i, a: q.a, b: q.b, section: '기도 유형' }));
  screens.push({ type: 'choice', key: 'pray_time', text: '하루 평균(합산) 기도 시간은 얼마나 되나요?', options: PRAY_TIME_OPTIONS, section: '기도 시간' });

  screens.push({ type: 'result' });
  return screens;
}

function axisPole(answers: Record<string, number>, keys: string[], a: string, b: string) {
  const sum = keys.reduce((s, k) => s + (answers[k] ?? 0), 0);
  return sum <= 0 ? a : b;
}

const IDOL_CAT_MAX: Record<IdolKey, number> = IDOL_QUESTIONS.reduce(
  (acc, q) => {
    acc[q.cat] = (acc[q.cat] ?? 0) + 5;
    return acc;
  },
  {} as Record<IdolKey, number>,
);

function computeIdol(answers: Record<string, number>) {
  const scores: Record<IdolKey, number> = { people: 0, love: 0, money: 0, power: 0, approval: 0, dopamine: 0 };
  const weighted: Record<IdolKey, number> = { people: 0, love: 0, money: 0, power: 0, approval: 0, dopamine: 0 };
  IDOL_QUESTIONS.forEach((q, i) => {
    const v = answers['idol_' + i] ?? 0;
    scores[q.cat] += v;
    if (q.weight) weighted[q.cat] += v;
  });
  // 카테고리마다 문항 수가 달라서 총점으로 비교하면 문항 많은 카테고리가 유리해진다.
  // 문항 수와 무관하게 공정하도록 카테고리별 평균(문항당 만점 대비 비율)으로 순위를 매긴다.
  const ranked = [...IDOL_ORDER].sort((a, b) => {
    const avgA = scores[a] / IDOL_CAT_MAX[a];
    const avgB = scores[b] / IDOL_CAT_MAX[b];
    if (avgB !== avgA) return avgB - avgA;
    return weighted[b] - weighted[a];
  });
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
  const { goScreen } = useApp();
  const screens = useMemo(buildScreens, []);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = screens[idx];
  const isQ = current.type === 'likert' || current.type === 'ab' || current.type === 'choice';
  const qScreens = screens.filter((s) => s.type === 'likert' || s.type === 'ab' || s.type === 'choice') as Extract<
    TTScreen,
    { key: string }
  >[];
  const answeredCount = qScreens.filter((s) => answers[s.key] !== undefined).length;
  const pos = isQ ? qScreens.findIndex((s) => s === current) + 1 : 0;

  const goNext = () => setIdx((i) => Math.min(i + 1, screens.length - 1));
  const goPrev = () => setIdx((i) => Math.max(i - 1, 0));
  const answerAndNext = (key: string, val: number) => {
    setAnswers((a) => ({ ...a, [key]: val }));
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(goNext, 180);
  };
  const restart = () => {
    setAnswers({});
    setIdx(0);
  };

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Self Diagnosis</div>
      <h1>우상 · 묵상 · 기도</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        내가 하나님보다 앞세우는 것, 말씀과 기도를 대하는 나의 결을 알아봐요.
      </p>

      {isQ && (
        <div className={styles.progressWrap}>
          <span className={styles.progressLabel}>
            {pos} / {qScreens.length}
          </span>
          <div className={styles.bar}>
            <span className={styles.barFill} style={{ width: `${Math.round((answeredCount / qScreens.length) * 100)}%` }} />
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
              솔직하게, 지금 나의 모습 그대로 답해주세요. 정답은 없어요.
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
            <h2 style={{ marginBottom: 8 }}>{current.text}</h2>
            <div className={styles.scaleTrack}>
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
              <span>{LIKERT_LABELS[4]}</span>
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
            <h2 style={{ marginBottom: 16 }}>{current.text}</h2>
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

        {current.type === 'result' && <ResultView answers={answers} onRestart={restart} />}
      </div>
    </section>
  );
}

function ResultView({ answers, onRestart }: { answers: Record<string, number>; onRestart: () => void }) {
  const { state } = useApp();
  const idol = computeIdol(answers);
  const med = computeMed(answers);
  const pray = computePray(answers);
  const pMeta = IDOL_META[idol.primary];
  const combo = IDOL_COMBOS[idol.primary][idol.secondary]!;
  const iconUrl = comboIconUrl(idol.primary, idol.secondary);
  const medT = MED_TYPES[med.type];
  const prayT = PRAY_TYPES[pray.type];
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current || !state.id) return;
    savedRef.current = true;
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
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const medSocialNote =
    med.social === 'G' ? '함께 말씀을 나누며 묵상할 때 더 은혜를 받는 편이에요.' : '혼자 조용히 묵상할 때 더 은혜를 받는 편이에요.';
  const prayFocusNote =
    pray.focus === 'O'
      ? '기도 시간의 대부분을 나 자신의 삶과 고민을 위해 쓰는 편이에요.'
      : '나를 위한 기도와 다른 사람을 위한 기도를 비슷한 비중으로 하는 편이에요.';

  return (
    <>
      <div className="decision-card" style={{ marginBottom: 16 }}>
        <div className={styles.ttResultTag} style={{ position: 'relative' }}>
          01 · 나의 우상 유형
        </div>
        <div className={styles.comboIconWrap} style={{ position: 'relative' }}>
          {iconUrl ? (
            <img src={iconUrl} alt="" className={styles.comboIcon} />
          ) : (
            <svg className={styles.comboIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="2.6" />
            </svg>
          )}
        </div>
        <h2 style={{ position: 'relative', marginBottom: 10 }}>{combo.name}</h2>
        <p style={{ position: 'relative', color: '#d9cdbb', fontSize: 14.5, marginBottom: 8 }}>{combo.desc}</p>
        <div className={styles.ttBars} style={{ position: 'relative' }}>
          {IDOL_ORDER.map((c) => {
            const meta = IDOL_META[c];
            const pct = Math.max(4, Math.round((idol.scores[c] / IDOL_CAT_MAX[c]) * 100));
            return (
              <div className={styles.ttBarRow} key={c}>
                <div className={styles.ttBarLabel}>{meta.label}</div>
                <div className={styles.ttBarTrack}>
                  <div className={styles.ttBarFill} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="verse" style={{ margin: '16px 0 0', position: 'relative' }}>
          함께 묵상해보면 좋은 말씀 · {pMeta.verse}
        </div>
      </div>

      <div className="decision-card" style={{ marginBottom: 16 }}>
        <div className={styles.ttResultTag} style={{ position: 'relative' }}>
          02 · 나의 묵상 유형
        </div>
        <h2 style={{ position: 'relative', marginBottom: 10 }}>{medT.name}</h2>
        <p style={{ position: 'relative', color: '#d9cdbb', fontSize: 14.5, marginBottom: 2 }}>{medT.desc}</p>
        <p style={{ position: 'relative', color: '#d9cdbb', fontSize: 14.5, marginTop: 8 }}>+ {medSocialNote}</p>
        <div className={styles.ttStatPill} style={{ position: 'relative' }}>
          하루 평균 묵상 시간 · {med.time}
        </div>
      </div>

      <div className="decision-card" style={{ marginBottom: 16 }}>
        <div className={styles.ttResultTag} style={{ position: 'relative' }}>
          03 · 나의 기도 유형
        </div>
        <h2 style={{ position: 'relative', marginBottom: 10 }}>{prayT.name}</h2>
        <p style={{ position: 'relative', color: '#d9cdbb', fontSize: 14.5, marginBottom: 2 }}>{prayT.desc}</p>
        <p style={{ position: 'relative', color: '#d9cdbb', fontSize: 14.5, marginTop: 8 }}>+ {prayFocusNote}</p>
        <div className={styles.ttStatPill} style={{ position: 'relative' }}>
          하루 평균 기도 시간 · {pray.time}
        </div>
      </div>

      <button className="btn ghost" onClick={onRestart}>
        다시 검사하기
      </button>
      <p className="tiny">이 결과는 진단이 아니라, 나를 돌아보고 하나님 앞에 더 솔직해지기 위한 도구예요.</p>
    </>
  );
}
