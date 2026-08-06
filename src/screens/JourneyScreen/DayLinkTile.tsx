import styles from './JourneyScreen.module.css';

// 알 아래에 나란히 놓이는 세 걸음(나의 우상은? · 유형 나눔 · 나만의 잠언).
//
// 상자를 걷어냈다. 알은 그림인데 그 아래에 테두리와 배경을 두른 카드 셋이 서면, 한 화면에서
// 서로 다른 두 가지 그림 언어가 부딪힌다 — 폭 104px짜리 상자에 번호·표제·이름·화살표·잠금까지
// 다섯 가지를 밀어 넣던 것이 원인이었다. 이제 동그란 그림 하나와 이름 한 줄만 남긴다.
//
// 순서는 원과 원을 잇는 실선이 말한다. 번호를 떼도 왼쪽에서 오른쪽으로 이어진 한 줄기로 읽힌다.
// 상태는 원에 붙는 작은 표시 하나로 갈린다 — 마친 걸음에는 체크, 잠긴 걸음에는 자물쇠.
// next("지금 할 차례")는 한 걸음에만 켜서 원 둘레가 은은하게 숨 쉬게 한다(잠긴 걸음에는 켜지 않는다).
//
// done은 "마쳤다"를 아는 걸음에만 켠다 — 나눔은 앱 밖에서 일어나는 일이라, 나눔 화면 끝의
// "나눔 마치기"를 누른 것을 끝으로 삼는다.
export default function DayLinkTile({
  step,
  icon,
  label,
  name,
  onClick,
  locked = false,
  lockedSub,
  done = false,
  next = false,
}: {
  step: number;
  icon: React.ReactNode;
  /** 그림 아래 보이는 표제(IDOL-X·SHARE·WRITE). */
  label: string;
  /** 화면을 읽어주는 기기에 넘기는 이름. 표제만으로는 무슨 코너인지 알 수 없어 한글로 둔다. */
  name: string;
  onClick: () => void;
  locked?: boolean;
  lockedSub?: string;
  done?: boolean;
  next?: boolean;
}) {
  return (
    <div className={styles.linkStep}>
      {/* 앞 걸음과 이어주는 실선. 원 바깥(칸 사이 간격)에 놓이므로 바깥 상자가 들고 있는다. */}
      {step > 1 && <span className={styles.linkConnect} aria-hidden="true" />}
      <button
        className={[styles.linkTile, locked ? styles.linkTileLocked : '', next ? styles.linkTileNext : '']
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
        aria-disabled={locked || undefined}
        aria-label={`${step}번째 걸음 · ${name}${done ? ' · 마침' : ''}${locked ? ' · 잠김' : next ? ' · 지금 할 차례' : ''}`}
      >
        <span className={styles.linkIcon}>
          {icon}
          {/* 마침·잠김은 원 오른쪽 아래에 작은 표시로 얹는다. 그림을 덮지 않으므로
              "무엇을 하는 걸음인지"와 "지금 어떤 상태인지"를 한눈에 같이 읽는다. */}
          {done && !locked && (
            <span className={`${styles.linkBadge} ${styles.linkBadgeDone}`} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 12.5l5 5 9-10.5" />
              </svg>
            </span>
          )}
          {locked && (
            <span className={`${styles.linkBadge} ${styles.linkBadgeLock}`} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="9" rx="2.2" />
                <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
              </svg>
            </span>
          )}
        </span>
        {/* 그림 아래에는 표제만 둔다. 짧은 영문 대문자라 폭을 거의 쓰지 않아 세 걸음이
            가볍게 서고, 무슨 코너인지는 위 그림과 짝을 이뤄 읽힌다.
            (화면을 읽어주는 기기에는 위 aria-label로 한글 이름이 그대로 나간다.) */}
        <span className={styles.linkName}>{label}</span>
        {locked && <span className={styles.linkSub}>{lockedSub ?? '아직 열리지 않았어요'}</span>}
      </button>
    </div>
  );
}
