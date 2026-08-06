import { useEffect, useRef, useState } from 'react';
import { hasIntroSheet } from '../../lib/storage';
import { firebaseEnabled, loadIntroSheetThumb, subscribeIntroSheets, type IntroSheetEntry } from '../../lib/sync';
import styles from './JourneyScreen.module.css';

// DAY 1 캡션 아래에 놓이는 자기소개 나눔 한 줄.
//
// 아홉 칸이 화면 폭을 다 쓰며 아래까지 내려앉는 날이라, 그리드 아래에 두면 첫날 첫 순서인 코너가
// 스크롤 밖으로 나간다. 그래서 캡션 바로 아래, 세로 한 줄만 쓰는 자리에 놓는다 —
// 실제 순서(자기소개 먼저 → 게임)와도 이 자리가 맞다.
//
// 오른쪽에 겹쳐 놓은 작은 동그라미는 방금 올라온 자기소개지 셋이다. 종이를 크게 깔면
// 이 어두운 화면에서 하얀 종이가 제일 밝은 덩어리가 되어 그날의 주인공(아홉 칸)을 덮는다.
// 22px짜리 동그라미로만 비치면 밝기를 흔들지 않으면서 "누가 올렸는지"는 그대로 읽힌다.
const INTRO_FACES = 3;

export default function IntroSheetRow({
  myId,
  myGroup,
  locked,
  lockedSub,
  onOpen,
}: {
  myId: string | null;
  myGroup: string;
  locked: boolean;
  /** 잠겨 있을 때 대신 보여줄 한 줄(열리는 시각 등). */
  lockedSub: string;
  onOpen: () => void;
}) {
  const [entries, setEntries] = useState<IntroSheetEntry[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  // 이미 받아오기 시작한 그림. 여정 화면은 자주 다시 그려지므로, 이게 없으면 같은 그림을
  // 그릴 때마다 새로 요청한다.
  const requested = useRef<Set<string>>(new Set());
  const uploaded = myId ? hasIntroSheet(myId) : false;

  // 목록 뼈대만 받는 구독이라 사람마다 수백 바이트다. 그림은 아래에서 세 장만 따로 받아온다.
  useEffect(() => subscribeIntroSheets(setEntries, () => {}), []);

  const visible = entries.filter((e) => e.scope === 'all' || e.group === myGroup);
  const faces = visible.slice(0, INTRO_FACES);
  const faceKey = faces.map((e) => e.id).join(',');

  useEffect(() => {
    let cancelled = false;
    faceKey
      .split(',')
      .filter((id) => id && !requested.current.has(id))
      .forEach((id) => {
        requested.current.add(id);
        loadIntroSheetThumb(id)
          .then((url) => {
            if (cancelled || !url) return;
            setThumbs((prev) => ({ ...prev, [id]: url }));
          })
          .catch(() => requested.current.delete(id));
      });
    return () => {
      cancelled = true;
    };
  }, [faceKey]);

  const sub = !firebaseEnabled
    ? '지금은 연결이 없어 볼 수 없어요'
    : locked
      ? lockedSub
      : visible.length === 0
        ? '첫 번째로 올려보세요'
        : uploaded
          ? `${visible.length}명이 올렸어요`
          : `${visible.length}명이 올렸어요 · 나도 올리기`;

  return (
    <button
      className={`${styles.introRow} ${locked ? styles.introRowLocked : ''}`}
      onClick={onOpen}
      aria-disabled={locked || undefined}
      aria-label={`자기소개 나눔 · ${sub}`}
    >
      <span className={styles.introIcon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="M4 8a2 2 0 0 1 2-2h1.6l1.2-1.6h6.4L16.4 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
          <circle cx="12" cy="13" r="3.4" />
        </svg>
        {uploaded && !locked && (
          <span className={styles.introDone} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 12.5l5 5 9-10.5" />
            </svg>
          </span>
        )}
      </span>
      <span className={styles.introText}>
        <span className={styles.introName}>자기소개 나눔</span>
        <span className={styles.introSub}>{sub}</span>
      </span>
      {faces.length > 0 ? (
        <span className={styles.introFaces} aria-hidden="true">
          {faces.map((e) => (
            <span key={e.id} className={styles.introFace}>
              {thumbs[e.id] && <img src={thumbs[e.id]} alt="" />}
            </span>
          ))}
        </span>
      ) : (
        <svg className={styles.introArrow} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </button>
  );
}
