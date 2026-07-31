import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { addPrayer, fetchPrayers, gasEnabled, type PrayerEntry } from '../lib/gas';
import { saveRemoteProgress as syncGroupToLeaderboard } from '../lib/sync';
import { PRAYER_GROUPS } from '../data/prayerGroups';
import { loadGroup, saveGroup } from '../lib/storage';
import styles from './PrayerScreen.module.css';

export default function PrayerScreen() {
  const { state } = useApp();
  const toast = useToast();
  const [group, setGroup] = useState<string | null>(loadGroup());
  const [prayers, setPrayers] = useState<PrayerEntry[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

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

  const joinGroup = (g: string) => {
    saveGroup(g);
    setGroup(g);
    // 조별 순위판에 바로 반영되도록, 조 선택 즉시 한 번 동기화해둔다.
    if (state.id) syncGroupToLeaderboard(state.id, state.nick, state.day, state.opened).catch(() => {});
  };

  const leaveGroup = () => {
    setGroup(null);
    setPrayers([]);
  };

  const submit = async () => {
    const v = text.trim();
    if (!v || !group) return;
    setPosting(true);
    try {
      await addPrayer(group, state.nick, v);
      setText('');
      const data = await fetchPrayers(group);
      setPrayers(data);
    } catch {
      toast('저장에 실패했어요. 다시 시도해주세요');
    } finally {
      setPosting(false);
    }
  };

  if (!group) {
    return (
      <section>
        <div className="eyebrow">Prayer Together</div>
        <h1>조별 기도제목</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          내 조를 선택하면 같은 조원들과 기도제목을 함께 볼 수 있어요.
        </p>
        <div className={styles.groupGrid}>
          {PRAYER_GROUPS.map((g) => (
            <button key={g} className={styles.groupBtn} onClick={() => joinGroup(g)}>
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
        <span className={styles.groupLabel}>{group}</span>
        <button className={styles.switchLink} onClick={leaveGroup}>
          조 변경
        </button>
      </div>

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

      <div style={{ height: 20 }} />
      {prayers.length === 0 ? (
        <p className={styles.empty}>아직 남겨진 기도제목이 없어요.</p>
      ) : (
        prayers.map((p) => (
          <div className={styles.item} key={p.id}>
            <div className={styles.itemNick}>{p.nick}</div>
            <div className={styles.itemText}>{p.text}</div>
          </div>
        ))
      )}
    </section>
  );
}
