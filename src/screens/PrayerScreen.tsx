import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useFillFit } from '../components/FitBox';
import Modal from '../components/Modal';
import { addPrayer, editPrayer, fetchPrayers, gasEnabled, prayFor, type PrayerEntry } from '../lib/gas';
import { saveRemoteProgress as syncGroupToLeaderboard } from '../lib/sync';
import { loadPrayedIds, savePrayedIds } from '../lib/storage';
import { useSwipePager } from '../lib/useSwipePager';
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
  // 적는 창. null이면 닫혀 있고, { id: null }이면 새로 남기는 중, { id }면 그 글을 고치는 중이다.
  const [draft, setDraft] = useState<{ id: string | null } | null>(null);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [prayed, setPrayed] = useState<string[]>(() => loadPrayedIds());

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

  // 목록을 옆으로 밀면 앞뒤 조로 넘어간다. 칩을 하나씩 겨냥해 누르지 않아도 옆 조를 훑어볼 수 있다.
  // (조가 없어 아래에서 일찍 돌아가는 경우가 있으므로 훅은 그보다 먼저 부른다.)
  const groupIdx = group ? PRAYER_GROUPS.indexOf(group) : -1;
  const { ref: listRef, handlers: swipeHandlers } = useSwipePager({
    onGo: (dir) => showGroup(PRAYER_GROUPS[groupIdx + dir]),
    canGo: (dir) => groupIdx >= 0 && groupIdx + dir >= 0 && groupIdx + dir < PRAYER_GROUPS.length,
  });

  // 등록할 때 조를 고르지 않았던 참가자만 여기서 내 조를 정한다.
  const chooseMyGroup = (g: string) => {
    setGroup(g);
    setPrayers([]);
    setViewing(null);
    // 조별 순위판에 바로 반영되도록, 조 선택 즉시 한 번 동기화해둔다.
    if (state.id) syncGroupToLeaderboard(state.id, state.nick, state.day, state.opened).catch(() => {});
  };

  // 남긴 사람인지 가리는 기준. author_id 칸이 생긴 뒤의 글은 참가자 id로,
  // 그 전에 쌓인 글은 실명으로 가린다(동명이인이면 함께 내 글로 보인다).
  const isAuthor = (p: PrayerEntry) => (p.authorId ? p.authorId === state.id : p.nick === state.nick);

  const openNew = () => {
    setText('');
    setDraft({ id: null });
  };
  const openEdit = (p: PrayerEntry) => {
    setText(p.text);
    setDraft({ id: p.id });
  };

  const submit = async () => {
    const v = text.trim();
    if (!v || !draft || !isMine || !myGroup) return;
    setPosting(true);
    try {
      if (draft.id) await editPrayer(draft.id, v, state.id ?? undefined, state.nick);
      else await addPrayer(myGroup, state.nick, v, state.id ?? undefined);
      setText('');
      setDraft(null);
      const data = await fetchPrayers(myGroup);
      setPrayers(data);
      setNow(Date.now());
    } catch {
      toast(draft.id ? '수정에 실패했어요. 다시 시도해주세요' : '저장에 실패했어요. 다시 시도해주세요');
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
        <h1 className={styles.title}>기도제목</h1>
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
        <h1 className={styles.title}>기도제목</h1>
      </header>

      {/* 조는 한 줄에 다 보인다. 가로로 밀어 넘기던 때는 내 조가 맨 앞으로 끌려 나와
          번호 순서가 흐트러지고, 옆으로 넘겨야 나머지가 나와서 몇 조까지 있는지도 알 수 없었다.
          여덟 칸을 그대로 펼쳐 두면 넘길 것도, 넘기며 흔들릴 것도 없다. */}
      <div className={styles.chips}>
        {PRAYER_GROUPS.map((g) => (
          <button
            key={g}
            className={`${styles.chip} ${g === group ? styles.chipOn : ''} ${g === myGroup ? styles.chipMine : ''}`}
            aria-pressed={g === group}
            onClick={() => showGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <div className={styles.list} key={group} ref={listRef} {...swipeHandlers}>
        {prayers.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              {isMine ? '아직 남겨진 기도제목이 없어요.\n첫 번째로 나눠볼까요?' : `${group}에는 아직 남겨진 기도제목이 없어요.`}
            </p>
          </div>
        ) : (
          prayers.map((p) => {
            const mine = isMine && isAuthor(p);
            const done = prayed.includes(p.id);
            return (
              <article key={p.id} className={`${styles.card} ${mine ? styles.cardMine : ''}`}>
                <div className={styles.cardHead}>
                  <span className={styles.nick}>{p.nick}</span>
                  {mine && <span className={styles.meTag}>나</span>}
                  <span className={styles.time}>
                    {relativeTime(p.createdAt, now)}
                    {p.editedAt ? ' · 고침' : ''}
                  </span>
                </div>
                <p className={styles.cardText}>{p.text}</p>
                {/* 카드마다 붙는 손잡이는 오른쪽 아래 한 자리에 모은다. 왼쪽에 있으면 글 첫 줄
                    아래에 딱 붙어 문장의 일부처럼 읽혔다. */}
                <div className={styles.cardFoot}>
                  {mine ? (
                    <>
                      {p.prayCount > 0 && (
                        <span className={styles.prayedFor}>{p.prayCount}명이 함께 기도했어요</span>
                      )}
                      {/* 내 글에는 하트 대신 고치는 손잡이. 잘못 적었거나 기도제목이 바뀌었을 때
                          지웠다 다시 올리지 않아도 된다(올린 시각과 함께 기도한 수는 그대로 남는다). */}
                      <button className={styles.edit} onClick={() => openEdit(p)} aria-label="내 기도제목 고치기">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
                        </svg>
                        고치기
                      </button>
                    </>
                  ) : (
                    /* 글자로 된 큰 버튼은 카드마다 하나씩 붙어 목록을 반쯤 차지했다.
                       하트 하나로 줄이고, 함께한 사람 수만 그 옆에 붙인다 — 누르면 하트가 채워지며
                       분홍으로 물들고 숫자가 하나 올라간다. */
                    <button
                      className={`${styles.pray} ${done ? styles.prayOn : ''}`}
                      onClick={() => pray(p.id)}
                      disabled={done}
                      aria-label={
                        done
                          ? `함께 기도했어요${p.prayCount > 0 ? ` · ${p.prayCount}명` : ''}`
                          : '함께 기도하기'
                      }
                    >
                      {p.prayCount > 0 && <span className={styles.prayCount}>{p.prayCount}</span>}
                      <svg
                        className={styles.prayHeart}
                        viewBox="0 0 24 24"
                        fill={done ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.9 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
                      </svg>
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* 화면 폭을 다 쓰던 분홍 막대는 목록만큼 무거워서, 기도제목보다 버튼이 먼저 읽혔다.
          오른쪽 아래 동그라미 하나로 줄인다 — 목록 위에 떠 있어 어디까지 내려가도 손이 닿는다. */}
      {isMine ? (
        <button className={styles.compose} onClick={openNew} aria-label="기도제목 남기기">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
          </svg>
        </button>
      ) : (
        <p className={styles.viewingNote}>
          {group} 기도제목을 보고 있어요. 함께 기도해주세요.
        </p>
      )}

      {/* 적다 만 글이 있는 자리라 아래에서 올라오는 시트가 아니라 한가운데 뜨는 창으로 둔다.
          닫는 길은 X 하나뿐이라 바깥을 스치듯 눌러 쓰던 글이 날아가지 않는다. */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        head={
          <>
            {/* eyebrow는 자간이 넓어 한글(조 이름)을 넣으면 "3 조"처럼 벌어진다. 조 이름은 아래 안내에 적는다. */}
            <div className="eyebrow">{draft?.id ? 'Edit Prayer' : 'New Prayer'}</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 'var(--fs-title)' }}>
              {draft?.id ? '기도제목 고치기' : '기도제목 남기기'}
            </h2>
          </>
        }
        foot={
          // 안내와 버튼을 한 줄에 둔다. 위아래로 쌓으면 자판이 올라온 화면에서 그만큼 적는 칸이 밀린다.
          <div className={styles.composeFoot}>
            {/* 버튼과 한 줄에 서는 안내라, 버튼 폭을 뺀 나머지에 한 줄로 들어갈 만큼만 적는다. */}
            <p className={styles.composeNote}>
              {draft?.id ? '고친 글이 바로 보여요.' : '함께 기도하겠습니다.'}
            </p>
            <button className="btn xs" onClick={submit} disabled={posting || !text.trim()}>
              {posting ? (draft?.id ? '고치는 중…' : '올리는 중…') : draft?.id ? '고치기' : '남기기'}
            </button>
          </div>
        }
      >
        {/* 적는 칸을 크게. 칸의 크기가 곧 "이만큼 적어도 됩니다"라는 말이라,
            두 줄짜리 칸만 내주면 한마디만 적고 마는 자리로 읽힌다. */}
        <textarea
          className="field"
          style={{ minHeight: 150, resize: 'none' }}
          placeholder="나누고 싶은 기도제목을 적어주세요"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      </Modal>
    </section>
  );
}
