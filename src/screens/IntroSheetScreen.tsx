import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import BackLink from '../components/BackLink';
import DocScanner, { type ScanResult } from '../components/DocScanner';
import { useOverlayRoot } from '../components/OverlayRoot';
import { useScrollFit } from '../components/FitBox';
import { markIntroSheetUploaded } from '../lib/storage';
import {
  deleteIntroSheet,
  firebaseEnabled,
  loadIntroSheetImage,
  loadIntroSheetThumb,
  loadMyIntroSheet,
  saveIntroSheet,
  setIntroSheetScope,
  subscribeIntroSheets,
  type IntroSheetEntry,
  type MyIntroSheet,
  type SheetScope,
} from '../lib/sync';
import styles from './IntroSheetScreen.module.css';

const SCOPE_BADGE: Record<SheetScope, string> = { all: '전체 공개', group: '우리 조만', me: '나만 보기' };
const SCOPE_ORDER: SheetScope[] = ['all', 'group', 'me'];

type Filter = 'all' | 'group';

// 한 번 받아온 작은 그림은 앱이 켜져 있는 동안 들고 있는다. 여정과 이 화면을 오가는 동안
// 같은 그림을 다시 받아오면, 정작 아직 못 본 사람의 그림이 그만큼 늦게 도착한다.
const thumbCache = new Map<string, string>();

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 6v12M6 12h12" />
    </svg>
  );
}

// 목록 칸 하나. 화면에 들어올 때가 되어서야 제 그림을 받아온다 —
// 수십 명이 올린 자리에서 한꺼번에 받아오면 맨 위 칸이 뜨는 데까지 한참 걸린다.
function SheetCard({ entry, onOpen }: { entry: IntroSheetEntry; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState(() => thumbCache.get(entry.id) ?? '');

  useEffect(() => {
    if (thumb) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const fetchThumb = () => {
      loadIntroSheetThumb(entry.id)
        .then((url) => {
          if (cancelled || !url) return;
          thumbCache.set(entry.id, url);
          setThumb(url);
        })
        .catch(() => {});
    };
    // 이 브라우저가 관찰자를 모르면(아주 오래된 기기) 그냥 바로 받아온다.
    if (typeof IntersectionObserver === 'undefined') {
      fetchThumb();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        fetchThumb();
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [entry.id, thumb]);

  return (
    <button ref={ref} className={styles.card} onClick={onOpen} aria-label={`${entry.nick || '이름 없음'}의 자기소개지`}>
      <span className={styles.cardShot} style={{ aspectRatio: String(entry.ratio || 0.72) }}>
        {thumb && <img className={styles.cardImg} src={thumb} alt="" />}
      </span>
      <span className={styles.cardName}>
        {entry.nick || '이름 없음'}
        {entry.group && <span className={styles.cardGroup}>{entry.group}</span>}
      </span>
    </button>
  );
}

// 첫날 자기소개 나눔에 쓰는 자리. 종이를 찍어 올리고, 서로의 것을 본다.
//
// 올린 사람이 매번 공개 범위를 고른다 — 자기소개지에는 이름·나이·연락처처럼 본인이 어디까지
// 내놓을지 스스로 정해야 하는 것들이 적혀 있어서, 앱이 일괄로 정해줄 일이 아니다.
export default function IntroSheetScreen() {
  const { state, goScreen } = useApp();
  const toast = useToast();
  const overlayRoot = useOverlayRoot();
  useScrollFit();

  const [entries, setEntries] = useState<IntroSheetEntry[]>([]);
  const [mine, setMine] = useState<MyIntroSheet | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [scanning, setScanning] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  // 크게 보는 중인 사람. image가 null이면 아직 받아오는 중이다.
  const [viewing, setViewing] = useState<{ entry: IntroSheetEntry; image: string | null } | null>(null);

  useEffect(
    () =>
      subscribeIntroSheets(setEntries, () => {
        toast('자기소개지를 불러오지 못했어요. 네트워크를 확인해주세요');
      }),
    // toast는 화면이 살아있는 동안 바뀌지 않는다. 의존성에 넣으면 구독만 다시 걸린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 다른 기기에서 올린 것을 여기서 처음 만날 수도 있다. 여정 화면의 표시가 그 사실을
  // 모르고 있으므로, 있으면 켜고 없으면 끈다(관리자가 지웠거나 내가 다른 기기에서 지운 경우).
  useEffect(() => {
    if (!state.id) return;
    const id = state.id;
    loadMyIntroSheet(id)
      .then((sheet) => {
        setMine(sheet);
        markIntroSheetUploaded(id, !!sheet);
      })
      .catch(() => {});
  }, [state.id]);

  const handleSave = async (result: ScanResult) => {
    if (!state.id) return;
    try {
      await saveIntroSheet(
        state.id,
        state.nick,
        state.group || null,
        result.scope,
        result.thumb,
        result.image,
        result.ratio,
      );
      thumbCache.set(state.id, result.thumb);
      markIntroSheetUploaded(state.id, true);
      setMine({
        id: state.id,
        nick: state.nick,
        group: state.group || null,
        scope: result.scope,
        ratio: result.ratio,
        thumb: result.thumb,
        image: result.image,
      });
      setScanning(false);
      toast('자기소개지를 올렸어요');
    } catch {
      toast('올리지 못했어요. 네트워크를 확인해주세요');
    }
  };

  const changeScope = async (scope: SheetScope) => {
    if (!state.id || !mine) return;
    setScopeOpen(false);
    if (scope === mine.scope) return;
    try {
      await setIntroSheetScope(state.id, scope);
      setMine({ ...mine, scope });
      toast(`이제 ${SCOPE_BADGE[scope]}예요`);
    } catch {
      toast('공개 범위를 바꾸지 못했어요');
    }
  };

  const remove = async () => {
    if (!state.id) return;
    try {
      await deleteIntroSheet(state.id);
      thumbCache.delete(state.id);
      markIntroSheetUploaded(state.id, false);
      setMine(null);
      setRemoving(false);
      toast('올린 자기소개지를 지웠어요');
    } catch {
      toast('지우지 못했어요. 네트워크를 확인해주세요');
    }
  };

  const open = (entry: IntroSheetEntry) => {
    const cached = entry.id === state.id ? mine?.image : undefined;
    setViewing({ entry, image: cached ?? null });
    if (cached) return;
    loadIntroSheetImage(entry.id)
      .then((image) => setViewing((cur) => (cur && cur.entry.id === entry.id ? { ...cur, image } : cur)))
      .catch(() => toast('사진을 불러오지 못했어요'));
  };

  // 목록에 오르는 건 전체 공개와, 나와 같은 조에게 열어둔 것뿐이다.
  // 내 것은 위에 따로 서 있으므로 여기서 뺀다.
  const visible = entries.filter((e) => {
    if (e.id === state.id) return false;
    if (e.scope === 'group' && e.group !== state.group) return false;
    if (filter === 'group') return e.group === state.group;
    return true;
  });

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Intro Sheets</div>
      <h1 className={styles.title}>자기소개 나눔</h1>
      <p className={styles.lead}>자기소개지를 찍어 올리면 서로 언제든 다시 꺼내볼 수 있어요.</p>

      {!firebaseEnabled ? (
        <p className="tiny">지금은 오프라인이라 자기소개지를 올리거나 볼 수 없어요.</p>
      ) : (
        <>
          {mine ? (
            <div className={styles.mine}>
              <button className={styles.mineShot} onClick={() => open(mine)} aria-label="내 자기소개지 크게 보기">
                <img src={mine.thumb} alt="" />
              </button>
              <div className={styles.mineInfo}>
                <div className={styles.mineName}>내 자기소개지</div>
                <button
                  className={styles.scopeChip}
                  onClick={() => setScopeOpen((v) => !v)}
                  aria-expanded={scopeOpen}
                >
                  {SCOPE_BADGE[mine.scope]}
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {scopeOpen && (
                  <div className={styles.scopeMenu}>
                    {SCOPE_ORDER.map((s) => (
                      <button
                        key={s}
                        className={`${styles.scopeItem} ${s === mine.scope ? styles.scopeItemOn : ''}`}
                        onClick={() => changeScope(s)}
                      >
                        {SCOPE_BADGE[s]}
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.mineActions}>
                  <button className={styles.textBtn} onClick={() => setScanning(true)}>
                    다시 찍기
                  </button>
                  <button className={`${styles.textBtn} ${styles.textBtnDanger}`} onClick={() => setRemoving(true)}>
                    지우기
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button className={styles.empty} onClick={() => setScanning(true)}>
              <span className={styles.emptyIcon}>
                <PlusIcon />
              </span>
              <span className={styles.emptyText}>
                내 자기소개지 올리기
                <span className={styles.emptySub}>종이를 찍으면 네 모서리를 잡아 반듯하게 펴드려요</span>
              </span>
            </button>
          )}

          {removing && (
            <div className={styles.confirm}>
              <p className={styles.confirmText}>올린 자기소개지를 지울까요? 다른 사람 화면에서도 사라져요.</p>
              <div className={styles.confirmRow}>
                <button className="btn ghost xs" onClick={() => setRemoving(false)}>
                  취소
                </button>
                <button className="btn xs" onClick={remove}>
                  지우기
                </button>
              </div>
            </div>
          )}

          <div className={styles.listHead}>
            <span className={styles.listLabel}>모두의 자기소개지 {visible.length > 0 && `· ${visible.length}`}</span>
            <div className={styles.filterRow}>
              <button
                className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnOn : ''}`}
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                전체
              </button>
              <button
                className={`${styles.filterBtn} ${filter === 'group' ? styles.filterBtnOn : ''}`}
                aria-pressed={filter === 'group'}
                onClick={() => setFilter('group')}
              >
                우리 조
              </button>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className={styles.none}>
              {entries.length === 0
                ? '아직 아무도 올리지 않았어요. 첫 번째로 올려보세요.'
                : '이 조에는 아직 올린 사람이 없어요.'}
            </p>
          ) : (
            <div className={styles.grid}>
              {visible.map((e) => (
                <SheetCard key={e.id} entry={e} onOpen={() => open(e)} />
              ))}
            </div>
          )}
        </>
      )}

      {scanning && (
        <DocScanner onClose={() => setScanning(false)} onSave={handleSave} initialScope={mine?.scope ?? 'all'} />
      )}

      {/* 크게 보는 덮개는 화면 축소·잘림 밖(OverlayRoot)에 그린다 — QR 스캐너와 같은 자리다. */}
      {viewing &&
        (() => {
          const viewer = (
            <div className={styles.viewer}>
              <div className={styles.viewerBar}>
                <span className={styles.viewerName}>
                  {viewing.entry.id === state.id ? '내 자기소개지' : viewing.entry.nick || '이름 없음'}
                  {viewing.entry.group && <span className={styles.viewerGroup}>{viewing.entry.group}</span>}
                </span>
                <button className={styles.viewerClose} onClick={() => setViewing(null)} aria-label="닫기">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
              {/* 종이는 세로로 길다. 화면 폭에 맞춰 놓고 아래로 내려 읽는 게 폰에서 문서를 보는 방식이다. */}
              <div className={styles.viewerBody}>
                {viewing.image ? (
                  <img className={styles.viewerImg} src={viewing.image} alt={`${viewing.entry.nick}의 자기소개지`} />
                ) : (
                  <p className={styles.viewerWait}>사진을 불러오는 중…</p>
                )}
              </div>
            </div>
          );
          return overlayRoot ? createPortal(viewer, overlayRoot) : viewer;
        })()}
    </section>
  );
}
