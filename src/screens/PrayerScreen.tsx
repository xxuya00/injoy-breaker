import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useFillFit } from '../components/FitBox';
import Sheet from '../components/Sheet';
import { addPrayer, fetchPrayers, gasEnabled, prayFor, type PrayerEntry } from '../lib/gas';
import { saveRemoteProgress as syncGroupToLeaderboard } from '../lib/sync';
import { loadPrayedIds, savePrayedIds } from '../lib/storage';
import { PRAYER_GROUPS } from '../data/prayerGroups';
import styles from './PrayerScreen.module.css';

// 시트의 created_at은 'yyyy-MM-dd HH:mm:ss'(한국시각) 문자열로 적히지만, 스프레드시트가
// 값을 날짜로 알아서 바꿔버린 칸은 ISO(UTC) 문자열로 넘어온다. 두 가지를 모두 받는다.
function parseCreatedAt(raw: string): number | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (m) {
    // 시간대가 안 붙은 값은 한국시각으로 적힌 것이다. 기기 시간대에 휘둘리지 않도록
    // UTC+9를 직접 빼서 읽는다.
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5], +(m[6] ?? 0));
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

function relativeTime(raw: string, now: number): string {
  const t = parseCreatedAt(raw);
  if (t === null) return '';
  const min = Math.floor(Math.max(0, now - t) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  return `${Math.floor(hour / 24)}일 전`;
}

export default function PrayerScreen() {
  const { state, setGroup } = useApp();
  const toast = useToast();
  // 남는 높이를 통째로 넘겨받아, 목록이 화면 대부분을 차지하고 그 안에서만 스크롤하게 한다.
  useFillFit();

  // 등록할 때 고른 내 조가 기본. 다른 조를 눌러 구경하는 동안만 이 값이 채워지고,
  // 내 조는 그대로 둔다(구경은 보기 전용이라 기도제목도 남길 수 없다).
  const [viewing, setViewing] = useState<string | null>(null);
  const [prayers, setPrayers] = useState<PrayerEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [prayed, setPrayed] = useState<string[]>(() => loadPrayedIds());

  const myGroup = state.group;
  const group = viewing ?? myGroup;
  const isMine = group === myGroup;

  // 내 조가 언제나 맨 앞. 나머지는 원래 순서 그대로 뒤에 붙는다.
  const groups = useMemo(
    () => (myGroup ? [myGroup, ...PRAYER_GROUPS.filter((g) => g !== myGroup)] : PRAYER_GROUPS),
    [myGroup],
  );

  const warnedRef = useRef(false);
  useEffect(() => {
    if (!group || !gasEnabled || state.screen !== 'prayer') return;
    let cancelled = false;
    const poll = () => {
      fetchPrayers(group)
        .then((data) => {
          if (cancelled) return;
          setPrayers(data);
          // 목록을 새로 받을 때마다 "방금 · 12분 전"도 함께 다시 센다.
          setNow(Date.now());
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
    if (g === group) return;
    setPrayers([]);
    setViewing(g === myGroup ? null : g);
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
      setComposing(false);
      const data = await fetchPrayers(myGroup);
      setPrayers(data);
      setNow(Date.now());
    } catch {
      toast('저장에 실패했어요. 다시 시도해주세요');
    } finally {
      setPosting(false);
    }
  };

  // 누른 티가 바로 나야 마음이 이어지므로 화면부터 올리고, 실패하면 되돌린다.
  const pray = async (id: string) => {
    if (prayed.includes(id)) return;
    const nextPrayed = [...prayed, id];
    setPrayed(nextPrayed);
    savePrayedIds(nextPrayed);
    setPrayers((list) => list.map((p) => (p.id === id ? { ...p, prayCount: p.prayCount + 1 } : p)));
    try {
      const count = await prayFor(id);
      if (count !== null) {
        setPrayers((list) => list.map((p) => (p.id === id ? { ...p, prayCount: count } : p)));
      }
    } catch {
      const reverted = prayed.filter((v) => v !== id);
      setPrayed(reverted);
      savePrayedIds(reverted);
      setPrayers((list) =>
        list.map((p) => (p.id === id ? { ...p, prayCount: Math.max(0, p.prayCount - 1) } : p)),
      );
      toast('잠시 뒤 다시 눌러주세요');
    }
  };

  // 예전에 조 없이 등록된 참가자를 위한 대비책. 보통은 등록할 때 고른 조가 있어서 이 화면을 지나친다.
  if (!myGroup) {
    return (
      <section className={`${styles.wrap} ${styles.wrapCenter}`}>
        <div className="eyebrow">Prayer Together</div>
        <h1 className={styles.title}>조별 기도제목</h1>
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
    <section className={styles.wrap}>
      <header className={styles.head}>
        <div className="eyebrow">Prayer Together</div>
        <h1 className={styles.title}>조별 기도제목</h1>
      </header>

      {/* 조 전환은 가로로 넘겨 고른다. 펼쳤다 접는 그리드와 달리 아래 목록이 밀리지 않는다. */}
      <div className={styles.chips}>
        {groups.map((g) => (
          <button
            key={g}
            className={`${styles.chip} ${g === group ? styles.chipOn : ''}`}
            onClick={() => showGroup(g)}
          >
            {g}
            {g === myGroup && <span className={styles.chipTag}>내 조</span>}
          </button>
        ))}
      </div>

      <div className={styles.list} key={group}>
        {prayers.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyMark}>🙏</div>
            <p className={styles.emptyText}>
              {isMine ? '아직 남겨진 기도제목이 없어요.\n첫 번째로 나눠볼까요?' : `${group}에는 아직 남겨진 기도제목이 없어요.`}
            </p>
          </div>
        ) : (
          prayers.map((p) => {
            // 기도제목에는 실명만 남으므로 실명으로 내 글을 가린다(동명이인이면 함께 표시된다).
            const mine = p.nick === state.nick;
            const done = prayed.includes(p.id);
            return (
              <article key={p.id} className={`${styles.card} ${mine ? styles.cardMine : ''}`}>
                <div className={styles.cardHead}>
                  <span className={styles.nick}>{p.nick}</span>
                  {mine && <span className={styles.meTag}>나</span>}
                  <span className={styles.time}>{relativeTime(p.createdAt, now)}</span>
                </div>
                <p className={styles.cardText}>{p.text}</p>
                {mine ? (
                  p.prayCount > 0 && (
                    <div className={styles.prayedFor}>🙏 {p.prayCount}명이 함께 기도했어요</div>
                  )
                ) : (
                  <button
                    className={`${styles.pray} ${done ? styles.prayOn : ''}`}
                    onClick={() => pray(p.id)}
                    disabled={done}
                  >
                    🙏 {done ? '기도했어요' : '함께 기도하기'}
                    {p.prayCount > 0 && <span className={styles.prayCount}>{p.prayCount}</span>}
                  </button>
                )}
              </article>
            );
          })
        )}
      </div>

      {isMine ? (
        <button className={styles.compose} onClick={() => setComposing(true)}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
          </svg>
          기도제목 남기기
        </button>
      ) : (
        <p className={styles.viewingNote}>
          함께 기도해주시라고 보여드리는 거예요. 기도제목은 내 조에만 남길 수 있어요.
        </p>
      )}

      <Sheet open={composing} onClose={() => setComposing(false)}>
        {/* eyebrow는 자간이 넓어 한글(조 이름)을 넣으면 "3 조"처럼 벌어진다. 조 이름은 아래 안내에 적는다. */}
        <div className="eyebrow">New Prayer</div>
        <h2 style={{ margin: '6px 0 12px' }}>기도제목 남기기</h2>
        <textarea
          className="field"
          style={{ minHeight: 110, resize: 'none' }}
          placeholder="나누고 싶은 기도제목을 적어주세요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button className="btn" onClick={submit} disabled={posting || !text.trim()}>
          {posting ? '올리는 중…' : '남기기'}
        </button>
        <p className="tiny">{myGroup} 조원들에게 이름과 함께 보여요.</p>
      </Sheet>
    </section>
  );
}
