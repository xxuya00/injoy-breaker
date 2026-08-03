import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { addPrayer, fetchPrayers, gasEnabled, type PrayerEntry } from '../lib/gas';
import { saveRemoteProgress as syncGroupToLeaderboard } from '../lib/sync';
import { PRAYER_GROUPS } from '../data/prayerGroups';
import styles from './PrayerScreen.module.css';

export default function PrayerScreen() {
  const { state, setGroup } = useApp();
  const toast = useToast();
  // 등록할 때 고른 내 조가 기본. 다른 조를 눌러 구경하는 동안만 이 값이 채워지고,
  // 내 조는 그대로 둔다(구경은 보기 전용이라 기도제목도 남길 수 없다).
  const [viewing, setViewing] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [prayers, setPrayers] = useState<PrayerEntry[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const myGroup = state.group;
  const group = viewing ?? myGroup;
  const isMine = group === myGroup;

  const warnedRef = useRef(false);
  useEffect(() => {
    if (!group || !gasEnabled || state.screen !== 'prayer') return;
    let cancelled = false;
    const poll = () => {
      fetchPrayers(group)
        .then((data) => {
          if (!cancelled) setPrayers(data);
        })
        .catch(() => {
          if (!cancelled && !warnedRef.current) {
            warnedRef.current = true;
            toast('기도제목을 불러오지 못했어요. 네트워크를 확인해주세요');
          }
        });
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, state.screen]);

  // 보는 조가 바뀌면 이전 조의 기도제목이 잠깐 남아 보이지 않도록 비운다.
  const showGroup = (g: string) => {
    setPrayers([]);
    setViewing(g === myGroup ? null : g);
    setPicking(false);
  };

  // 등록할 때 조를 고르지 않았던 참가자만 여기서 내 조를 정한다.
  const chooseMyGroup = (g: string) => {
    setGroup(g);
    setPrayers([]);
    setViewing(null);
    // 조별 순위판에 바로 반영되도록, 조 선택 즉시 한 번 동기화해둔다.
    if (state.id) syncGroupToLeaderboard(state.id, state.nick, state.day, state.opened).catch(() => {});
  };

  const submit = async () => {
    const v = text.trim();
    if (!v || !isMine || !myGroup) return;
    setPosting(true);
    try {
      await addPrayer(myGroup, state.nick, v);
      setText('');
      const data = await fetchPrayers(myGroup);
      setPrayers(data);
    } catch {
      toast('저장에 실패했어요. 다시 시도해주세요');
    } finally {
      setPosting(false);
    }
  };

  // 예전에 조 없이 등록된 참가자를 위한 대비책. 보통은 등록할 때 고른 조가 있어서 이 화면을 지나친다.
  if (!myGroup) {
    return (
      <section>
        <div className="eyebrow">Prayer Together</div>
        <h1>조별 기도제목</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          내 조를 선택하면 같은 조원들과 기도제목을 함께 볼 수 있어요.
        </p>
        <div className={styles.groupGrid}>
          {PRAYER_GROUPS.map((g) => (
            <button key={g} className={styles.groupBtn} onClick={() => chooseMyGroup(g)}>
              {g}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="eyebrow">Prayer Together</div>
      <h1>조별 기도제목</h1>
      <div className={styles.groupBadge}>
        <span className={styles.groupLabel}>
          {group}
          {isMine ? ' · 내 조' : ' 둘러보는 중'}
        </span>
        {isMine ? (
          <button className={styles.switchLink} onClick={() => setPicking((v) => !v)}>
            {picking ? '닫기' : '다른 조 보기'}
          </button>
        ) : (
          <button className={styles.switchLink} onClick={() => showGroup(myGroup)}>
            내 조로 돌아가기
          </button>
        )}
      </div>

      {picking && (
        <div className={styles.groupGrid} style={{ marginBottom: 16 }}>
          {PRAYER_GROUPS.map((g) => (
            <button key={g} className={styles.groupBtn} onClick={() => showGroup(g)}>
              {g}
            </button>
          ))}
        </div>
      )}

      {isMine ? (
        <>
          <textarea
            className="field"
            style={{ minHeight: 90, resize: 'none' }}
            placeholder="나누고 싶은 기도제목을 적어주세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn" onClick={submit} disabled={posting}>
            {posting ? '올리는 중…' : '기도제목 남기기'}
          </button>
        </>
      ) : (
        <p className="tiny" style={{ marginTop: 0 }}>
          다른 조의 기도제목은 함께 기도해주시라고 보여드리는 거예요. 기도제목은 내 조에만 남길 수 있어요.
        </p>
      )}

      <div style={{ height: 20 }} />
      {prayers.length === 0 ? (
        <p className={styles.empty}>아직 남겨진 기도제목이 없어요.</p>
      ) : (
        <div className={styles.list}>
          {prayers.map((p) => (
            <div className={styles.item} key={p.id}>
              <div className={styles.itemNick}>{p.nick}</div>
              <div className={styles.itemText}>{p.text}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
