import { useEffect, useRef, useState } from 'react';
import { IDOL_META, type IdolKey } from '../../data/typeTest';
import { PROVERB_PROMPT } from '../../data/typeShare';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { loadTypeSummary, markProverbWritten } from '../../lib/storage';
import { firebaseEnabled, saveProverb, subscribeProverbs, type ProverbEntry } from '../../lib/sync';
import BackLink from '../../components/BackLink';
import { useFillFit } from '../../components/FitBox';
import styles from './ProverbScreen.module.css';

type ProverbScope = 'all' | 'type' | 'group';

const SCOPE_LABELS: Record<ProverbScope, string> = { all: '전체', type: '내 유형', group: '우리 조' };

// 검사와 나눔을 지나온 사람이 한 문장을 남기고, 남이 남긴 문장을 읽는 자리.
// 예전에는 나눔 화면 맨 끝에 붙어 있었는데, 나눔이 한창인 화면을 끝까지 내려야 나오는 바람에
// "쓰러 간다"는 걸음 자체가 없었다. 검사 → 나눔 다음의 세 번째 칸으로 따로 세운다.
//
// 기본은 전체 공개다 — 나눔은 유형·조 단위로 하지만, 남이 어떤 문장에 도달했는지는
// 그 울타리 밖에서 읽을 때 더 크게 남기 때문이다. 좁혀 보고 싶을 때만 필터를 쓴다.
export default function ProverbScreen() {
  const { state, goScreen } = useApp();
  const toast = useToast();
  // 남이 남긴 문장이 몇 개나 쌓일지는 정해져 있지 않다. 남는 높이를 그 목록 쪽에 몰아주면,
  // 아직 몇 개 없는 이른 시간에도 아래가 텅 비지 않는다.
  useFillFit();

  const [mine, setMine] = useState<IdolKey | null>(null);
  const [entries, setEntries] = useState<ProverbEntry[]>([]);
  const [scope, setScope] = useState<ProverbScope>('all');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  // 내가 예전에 쓴 문장을 입력칸에 한 번만 채워 넣는다. 매번 덮어쓰면 고쳐 쓰는 중에
  // 실시간 구독이 한 번 더 오는 것만으로 방금 지운 글자가 되살아난다.
  const hydrated = useRef(false);

  // 이 화면도 앱이 켜질 때 함께 마운트되므로, 로그인해서 id가 생긴 뒤에 결과를 읽는다.
  useEffect(() => {
    if (!state.id) return;
    const summary = loadTypeSummary(state.id);
    setMine((summary?.primary as IdolKey) ?? null);
  }, [state.id]);

  useEffect(
    () =>
      subscribeProverbs(setEntries, () => {
        toast('잠언을 불러오지 못했어요. 네트워크를 확인해주세요');
      }),
    // toast는 화면이 살아있는 동안 바뀌지 않는다. 의존성에 넣으면 구독만 다시 걸린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const myProverb = state.id ? entries.find((e) => e.id === state.id) : undefined;
  useEffect(() => {
    if (!myProverb || !state.id) return;
    // 다른 기기에서 남긴 잠언을 여기서 처음 만났을 수도 있다. 여정 화면의 걸음 표시가
    // 그 사실을 모르고 있으므로 이때 표시를 남긴다.
    markProverbWritten(state.id);
    if (hydrated.current) return;
    hydrated.current = true;
    setDraft(myProverb.text);
  }, [myProverb, state.id]);

  const submit = async () => {
    const text = draft.trim();
    if (!text) {
      toast('한 문장만 남겨보세요');
      return;
    }
    if (!state.id) return;
    setSaving(true);
    try {
      await saveProverb(state.id, state.nickname || state.nick, state.group || null, mine, text);
      toast(myProverb ? '잠언을 고쳤어요' : '잠언을 남겼어요');
    } catch {
      toast('저장에 실패했어요. 네트워크를 확인해주세요');
    } finally {
      setSaving(false);
    }
  };

  const shown = entries.filter((e) => {
    if (scope === 'type') return e.idol !== null && e.idol === mine;
    if (scope === 'group') return e.group !== null && e.group === state.group;
    return true;
  });

  return (
    <section className={styles.wrap}>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">My Own Proverb</div>
      <h1 className={styles.title}>나만의 잠언</h1>

      <p className={styles.lead}>{PROVERB_PROMPT.lead}</p>
      <p className={styles.hint}>{PROVERB_PROMPT.hint}</p>

      <textarea
        className="field"
        style={{ minHeight: 96, resize: 'none', lineHeight: 1.7 }}
        placeholder={PROVERB_PROMPT.placeholder}
        maxLength={PROVERB_PROMPT.maxLength}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {/* 글자 수와 보내기를 한 줄에 둔다. 화면 폭을 다 쓰는 큰 버튼은 한 문장 적는 칸보다
          커 보였다 — 주인공은 적는 칸이므로, 버튼은 다 적고 손이 닿는 오른쪽 아래에만 둔다. */}
      <div className={styles.writeRow}>
        <span className={styles.count}>
          {draft.length} / {PROVERB_PROMPT.maxLength}
        </span>
        <button className="btn xs" disabled={saving} onClick={submit}>
          {saving ? '남기는 중…' : myProverb ? '잠언 고쳐 쓰기' : '잠언 남기기'}
        </button>
      </div>

      {!firebaseEnabled ? (
        <p className="tiny">지금은 오프라인이라 다른 사람의 잠언을 불러올 수 없어요.</p>
      ) : (
        <>
          <div className={styles.scopeRow}>
            {(Object.keys(SCOPE_LABELS) as ProverbScope[]).map((s) => (
              <button
                key={s}
                className={`${styles.scopeBtn} ${s === scope ? styles.scopeBtnOn : ''}`}
                aria-pressed={s === scope}
                onClick={() => setScope(s)}
              >
                {SCOPE_LABELS[s]}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className={styles.empty}>{entries.length === 0 ? PROVERB_PROMPT.empty : PROVERB_PROMPT.emptyFiltered}</p>
          ) : (
            <div className={styles.list}>
              {shown.map((e) => {
                const meta = e.idol && e.idol in IDOL_META ? IDOL_META[e.idol as IdolKey] : null;
                return (
                  <div key={e.id} className={`${styles.item} ${e.id === state.id ? styles.itemMine : ''}`}>
                    <p className={styles.text}>{e.text}</p>
                    <div className={styles.by}>
                      {e.nick || '이름 없음'}
                      {meta && <span className={styles.byType}>{meta.label}</span>}
                      {e.id === state.id && <span className={styles.byMine}>내 잠언</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
