import { useEffect, useState } from 'react';
import { IDOL_META, IDOL_ORDER, type IdolKey } from '../../data/typeTest';
import { SHARE_QUESTIONS, SHARE_SESSIONS } from '../../data/typeShare';
import { WALK_TYPES, type WalkCode } from '../../lib/typeScore';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import {
  loadShareMemo,
  loadTypeSummary,
  markShareDone,
  saveShareMemo,
  type StoredTypeSummary,
} from '../../lib/storage';
import BackLink from '../../components/BackLink';
import Modal from '../../components/Modal';
import { useScrollFit } from '../../components/FitBox';
import styles from './TypeShare.module.css';

// 적는 도중에 저장이 계속 일어나지 않도록 손을 멈춘 뒤에 저장한다.
const SAVE_DEBOUNCE_MS = 600;

// 검사 결과를 다시 보여주는 화면이 아니라, 입 밖으로 꺼낼 질문만 놓는 화면이다.
//
// 나눔은 두 번 있고 목적이 다르다(같은 유형끼리 / 조별). 두 자리를 화면 두 개로 갈라놓으면
// 앞의 나눔에서 정리한 것을 뒤에서 다시 펴 보기가 번거로워서, 한 화면 안에 탭으로 세웠다.
export default function TypeShare() {
  const { state, goScreen } = useApp();
  const toast = useToast();

  const [tab, setTab] = useState(0);
  // 탭을 옮기면 다른 나눔의 첫 단계부터 읽어야 하므로 스크롤을 위에서 다시 시작한다.
  useScrollFit(SHARE_SESSIONS[tab].key);

  // 유형별 질문은 내 1위 유형으로 열리되, 칩을 눌러 다른 유형의 질문도 볼 수 있다.
  // 조 나눔에서는 조원의 유형을 물어보며 그 질문을 함께 읽게 되기 때문이다.
  const [pick, setPick] = useState<IdolKey | null>(null);
  const [summary, setSummary] = useState<StoredTypeSummary | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);

  const [memos, setMemos] = useState<Record<string, string>>({});
  // 어느 참가자의 메모를 불러왔는지. 불러오기 전에는 저장하지 않는다 —
  // 빈 메모가 먼저 덮어써서 적어둔 글이 사라지는 걸 막는다.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // 이 화면도 앱이 켜질 때 함께 마운트되므로, 로그인해서 id가 생긴 뒤에 결과를 읽는다.
  useEffect(() => {
    if (!state.id) return;
    setSummary(loadTypeSummary(state.id));
  }, [state.id]);

  useEffect(() => {
    if (!state.id || loadedId === state.id) return;
    setMemos(loadShareMemo(state.id));
    setLoadedId(state.id);
  }, [state.id, loadedId]);

  useEffect(() => {
    if (!loadedId || loadedId !== state.id) return;
    const t = setTimeout(() => saveShareMemo(loadedId, memos), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [memos, loadedId, state.id]);

  const mine = (summary?.primary as IdolKey | undefined) ?? null;
  const secondary = (summary?.secondary as IdolKey | undefined) ?? null;
  const active = pick ?? mine;
  const walk = summary?.walkCode ? WALK_TYPES[summary.walkCode as WalkCode] : null;

  const session = SHARE_SESSIONS[tab];
  const carried = memos.same?.trim() ?? '';

  const finish = () => {
    if (state.id) {
      saveShareMemo(state.id, memos);
      markShareDone(state.id);
    }
    goScreen('journey');
  };

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Share Together</div>
      {/* 나눔 자리에 앉으면 "내가 무슨 유형이었더라"부터 다시 더듬게 된다. 검사에서 받은
          조합 이름을 제목 옆에 이름표처럼 붙여 두고, 어느 둘의 조합인지는 그 이름 옆에
          한 급 더 작게 잇는다 — 주인공은 어디까지나 아래의 질문이다. */}
      <div className={styles.titleRow}>
        <div className={styles.titleMain}>
          <h1 className={styles.title}>유형 나눔</h1>
          {mine && summary && (
            <span className={styles.mineTag}>
              {summary.comboName}
              {secondary && (
                <em>
                  {IDOL_META[mine].label} × {IDOL_META[secondary].label}
                </em>
              )}
            </span>
          )}
        </div>
        {/* 유형별 질문을 화면에 늘 펼쳐두면 나눔의 뼈대(아래 다섯 단계)와 자리를 다툰다.
            제목 줄에 손잡이로 걸어두면 말문이 막혔을 때, 옆 사람 유형이 궁금할 때 바로 편다. */}
        {mine && (
          <button className={styles.rulesBtn} onClick={() => setRefOpen(true)} aria-label="유형별 질문 보기">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7.6l1.7 1.7 3.1-3.4" />
              <path d="M4 15.6l1.7 1.7 3.1-3.4" />
              <path d="M12.4 7.2h7.2M12.4 15.2h7.2" />
            </svg>
          </button>
        )}
      </div>

      {mine === null ? (
        // 검사를 아직 안 했으면 질문을 아무거나 띄우는 대신 검사로 보낸다.
        <>
          <p className="lead" style={{ marginBottom: 18 }}>
            먼저 IDOL-X 검사를 마쳐야 내 유형에 맞는 나눔이 열려요.
          </p>
          <button className="btn" onClick={() => goScreen('type')}>
            IDOL-X 검사하러 가기
          </button>
        </>
      ) : (
        <>
          {/* 나눔이 두 번이라는 것과, 지금 어느 자리에 앉아 있는지를 질문보다 먼저 보여준다. */}
          <div className={styles.tabs} role="tablist">
            {SHARE_SESSIONS.map((s, i) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={i === tab}
                className={`${styles.tab} ${i === tab ? styles.tabOn : ''}`}
                onClick={() => setTab(i)}
              >
                <em>나눔 {i + 1}</em>
                <b>{s.tab}</b>
              </button>
            ))}
          </div>

          {/* 목적이 분명해야 질문도 흐르지 않는다. 그래서 목적을 질문 위에 한 문장으로 세웠다. */}
          <div className={styles.purpose}>
            <span className={styles.purposeLabel}>이 나눔의 목적</span>
            <strong>{session.purpose}</strong>
            <p>{session.lead}</p>
          </div>

          {/* 조 나눔의 첫 단계는 "앞 나눔에서 정리한 것을 소개하기"다. 그 정리가 이 화면에
              남아 있으니 다시 펴 볼 수 있게 둔다 — 없으면 이 칸 자체가 나오지 않는다. */}
          {session.key === 'group' && carried && (
            <div className={styles.foldCard}>
              <button className={styles.foldHead} onClick={() => setPrevOpen((v) => !v)} aria-expanded={prevOpen}>
                <span>앞 나눔에서 정리한 우리 유형</span>
                <svg className={prevOpen ? styles.foldIconOn : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {prevOpen && <p className={styles.foldBody}>{carried}</p>}
            </div>
          )}

          <div className="decision-card">
            <div className={styles.cardTag}>진행</div>
            <ol className={styles.steps}>
              {session.steps.map((s) => (
                <li key={s.title}>
                  <b>{s.title}</b>
                  <p>{s.question}</p>
                  {s.note && <span>{s.note}</span>}
                </li>
              ))}
            </ol>
          </div>

          {/* 검사에서 받은 실천 가이드. 나눔1의 "말씀으로 비춰보기"에서도, 나눔2의 "실천 앞에서"
              에서도 이걸 손에 들고 이야기하게 되므로 두 자리 모두에 둔다. 늘 펴 두면 질문을
              밀어내니 접어놓는다. */}
          {walk && (
            <div className={styles.foldCard}>
              <button className={styles.foldHead} onClick={() => setGuideOpen((v) => !v)} aria-expanded={guideOpen}>
                <span>
                  내 실천 가이드 · {walk.name}
                  <em>{walk.en}</em>
                </span>
                <svg className={guideOpen ? styles.foldIconOn : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {guideOpen && (
                <div className={styles.foldBody}>
                  <p className={styles.walkTagline}>{walk.tagline}</p>
                  <ul className={styles.walkGuides}>
                    {walk.guides.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 나눔에서 나온 말은 그 자리에서 흩어진다. 적어두면 조 나눔에서 소개할 거리가 되고,
              잠언을 쓸 때 다시 꺼낼 문장이 된다. 남에게 보이지 않는 글이라 이 기기에만 둔다. */}
          <div className={styles.memo}>
            <label className={styles.memoLabel} htmlFor={`memo-${session.key}`}>
              {session.memo.label}
            </label>
            <textarea
              id={`memo-${session.key}`}
              className={`field ${styles.memoField}`}
              placeholder={session.memo.placeholder}
              value={memos[session.key] ?? ''}
              onChange={(e) => setMemos((m) => ({ ...m, [session.key]: e.target.value }))}
            />
            <div className={styles.memoFoot}>
              <span className="tiny">이 기기에만 저장돼요</span>
              <button
                className="btn xs"
                onClick={() => {
                  if (!loadedId) return;
                  saveShareMemo(loadedId, memos);
                  toast('메모가 이 기기에 저장됐어요');
                }}
              >
                메모 저장
              </button>
            </div>
          </div>

          <p className="tiny">여기서 들은 이야기는 이 자리에 두고 갑니다. 서로의 솔직함을 지켜주세요.</p>

          {/* 나눔1을 마치면 곧바로 끝내는 게 아니라 나눔2로 건너간다. 앱은 나눔이 끝났는지 알 수
              없으므로, 나눔2 끝의 "나눔 마치기"를 누른 것을 끝으로 삼아 여정 화면의 다음
              걸음(잠언)에 불이 들어오게 한다. */}
          {session.key === 'same' ? (
            <button className={styles.doneBtn} onClick={() => setTab(1)}>
              조별 나눔으로
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </button>
          ) : (
            <button className={styles.doneBtn} onClick={finish}>
              나눔 마치기
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </>
      )}

      <Modal
        open={refOpen}
        onClose={() => setRefOpen(false)}
        head={
          <>
            <div className="eyebrow">Reference</div>
            <h2 className={styles.rulesTitle}>유형별 질문</h2>
          </>
        }
      >
        <p className={styles.refLead}>말문이 막혔을 때 펴 보세요. 다른 유형을 눌러 그 유형의 질문도 읽을 수 있어요.</p>
        <div className={styles.chips}>
          {IDOL_ORDER.map((k) => (
            <button
              key={k}
              className={`${styles.chip} ${k === active ? styles.chipOn : ''}`}
              aria-pressed={k === active}
              onClick={() => setPick(k)}
            >
              <b>{IDOL_META[k].label}</b>
              {k === mine && <em>내 유형</em>}
            </button>
          ))}
        </div>
        {active && (
          <>
            <div className={styles.cardTag}>
              {IDOL_META[active].label} · {IDOL_META[active].title}
              {active !== mine && <span className={styles.otherNote}>다른 유형 질문 보는 중</span>}
            </div>
            <ol className={styles.questions}>
              {SHARE_QUESTIONS[active].map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ol>
          </>
        )}
      </Modal>
    </section>
  );
}
