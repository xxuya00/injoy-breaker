import { useEffect, useState } from 'react';
import { IDOL_META, IDOL_ORDER, type IdolKey } from '../../data/typeTest';
import { SHARE_QUESTIONS, SHARE_RULES } from '../../data/typeShare';
import { useApp } from '../../context/AppContext';
import { loadTypeSummary } from '../../lib/storage';
import BackLink from '../../components/BackLink';
import { useScrollFit } from '../../components/FitBox';
import styles from './TypeShare.module.css';

// 검사 결과를 다시 보여주는 화면이 아니라, 입 밖으로 꺼낼 질문만 놓는 화면이다.
// 그래서 점수도 설명도 없고, 유형 하나와 질문 세 개뿐이다.
export default function TypeShare() {
  const { state, goScreen } = useApp();
  useScrollFit();

  // 내 1위 유형으로 시작하되, 유형 칩을 눌러 다른 유형의 질문도 열어볼 수 있다.
  // 조 나눔에서는 조원의 유형을 물어보며 그 질문을 함께 읽게 되기 때문이다.
  const [pick, setPick] = useState<IdolKey | null>(null);
  const [mine, setMine] = useState<IdolKey | null>(null);

  // 이 화면도 앱이 켜질 때 함께 마운트되므로, 로그인해서 id가 생긴 뒤에 결과를 읽는다.
  useEffect(() => {
    if (!state.id) return;
    const summary = loadTypeSummary(state.id);
    setMine((summary?.primary as IdolKey) ?? null);
  }, [state.id]);

  const active = pick ?? mine;

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Share Together</div>
      <h1 className={styles.title}>유형 나눔</h1>

      {active === null ? (
        // 검사를 아직 안 했으면 질문을 아무거나 띄우는 대신 검사로 보낸다.
        <>
          <p className="lead" style={{ marginBottom: 18 }}>
            먼저 IDOL-X 검사를 마쳐야 내 유형에 맞는 나눔 질문이 열려요.
          </p>
          <button className="btn" onClick={() => goScreen('type')}>
            IDOL-X 검사하러 가기
          </button>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>
            같은 유형끼리 모여서, 그리고 우리 조에서 한 번 더 나눠보세요.
          </p>

          <div className={styles.chips}>
            {IDOL_ORDER.map((k) => {
              const meta = IDOL_META[k];
              return (
                <button
                  key={k}
                  className={`${styles.chip} ${k === active ? styles.chipOn : ''}`}
                  aria-pressed={k === active}
                  onClick={() => setPick(k)}
                >
                  <b>{meta.label}</b>
                  {k === mine && <em>내 유형</em>}
                </button>
              );
            })}
          </div>

          <div className="decision-card">
            <div className={styles.cardTag}>
              {IDOL_META[active].label} · {IDOL_META[active].title}
              {active !== mine && mine && <span className={styles.otherNote}>다른 유형 질문 보는 중</span>}
            </div>
            <ol className={styles.questions}>
              {SHARE_QUESTIONS[active].map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </div>

          {/* 규칙이 길면 아무도 읽지 않는다. 세 줄로 줄이고 질문 아래에 조용히 둔다. */}
          <div className={styles.rules}>
            <div className={styles.rulesLabel}>나눔 약속</div>
            {SHARE_RULES.map((r) => (
              <p key={r}>{r}</p>
            ))}
          </div>

          <p className="tiny">여기서 들은 이야기는 이 자리에 두고 갑니다. 서로의 솔직함을 지켜주세요.</p>
        </>
      )}
    </section>
  );
}
