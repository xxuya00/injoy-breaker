import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { addPrayer, fetchPrayers, gasEnabled, type PrayerEntry } from '../lib/gas';
import { loadGroup, saveGroup } from '../lib/storage';
import styles from './PrayerScreen.module.css';

export default function PrayerScreen() {
  const { state } = useApp();
  const toast = useToast();
  const [group, setGroup] = useState<string | null>(loadGroup());
  const [groupInput, setGroupInput] = useState('');
  const [prayers, setPrayers] = useState<PrayerEntry[]>([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!group || !gasEnabled || state.screen !== 'prayer') return;
    let cancelled = false;
    const poll = () => {
      fetchPrayers(group).then((data) => {
        if (!cancelled) setPrayers(data);
      });
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [group, state.screen]);

  const joinGroup = () => {
    const v = groupInput.trim();
    if (!v) {
      toast('조 번호를 입력해주세요');
      return;
    }
    saveGroup(v);
    setGroup(v);
  };

  const leaveGroup = () => {
    setGroup(null);
    setGroupInput('');
    setPrayers([]);
  };

  const submit = async () => {
    const v = text.trim();
    if (!v || !group) return;
    setPosting(true);
    await addPrayer(group, state.nick || '나', v);
    setText('');
    const data = await fetchPrayers(group);
    setPrayers(data);
    setPosting(false);
  };

  if (!group) {
    return (
      <section>
        <div className="eyebrow">Prayer Together</div>
        <h1>조별 기도제목</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          같은 조원들과 기도제목을 나눠보세요. 조 번호를 입력하면 그 조의 기도제목을 함께 볼 수 있어요.
        </p>
        <input
          className="field"
          placeholder="예: 1조"
          value={groupInput}
          onChange={(e) => setGroupInput(e.target.value)}
          maxLength={10}
        />
        <button className="btn" onClick={joinGroup}>
          입장하기
        </button>
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
