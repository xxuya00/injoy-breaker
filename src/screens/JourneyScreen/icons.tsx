// 여정 화면 곳곳에 쓰는 그림들. 기기마다 모양이 달라지는 이모지 대신 SVG로 두어
// 어디서든 같은 그림이 나오고 글자 색을 그대로 따라오게 한다.
import type { ShapeId } from '../../data/codeBreak';
import type { ComboCard } from '../../data/comboGame';
import styles from './JourneyScreen.module.css';

// 경과시간 배지 앞의 작은 표시. 시계가 멈춰 있는 동안은 일시정지 모양으로 바뀌어,
// 숫자가 안 움직이는 게 고장이 아니라 멈춰둔 것임을 알린다.
export function TimerIcon({ paused }: { paused: boolean }) {
  return (
    <svg className={styles.timerIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {paused ? (
        <>
          <rect x="7" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
          <rect x="13" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="12" cy="13.5" r="8" />
          <path d="M12 9.5v4.5l3 1.5M9 2h6" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

// 힌트 버튼 앞의 전구. 이모지 대신 SVG로 둬야 기기마다 그림이 달라지지 않고 글자 색을 그대로 따라온다.
export function BulbIcon() {
  return (
    <svg
      className={styles.hintIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a6 6 0 0 0-3.4 10.9c.6.4.9 1 .9 1.7h5c0-.7.3-1.3.9-1.7A6 6 0 0 0 12 3z" />
      <path d="M9.5 18.5h5M10.5 21h3" />
    </svg>
  );
}

// 결과 화면의 "다시 플레이"에 붙는 되감기 화살표. 시트 머리말의 재시작 아이콘과 같은 그림이라
// 둘이 같은 일을 한다는 게 그림만으로 읽힌다.
export function ReplayIcon() {
  return (
    <svg
      className={styles.btnIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function ExitIcon() {
  return (
    <svg
      className={styles.btnIcon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h13M13 6l6 6-6 6" />
    </svg>
  );
}

export function LockIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24">
      <path d="M7 11V8a5 5 0 0 1 9.9-1" />
      <rect x="4" y="11" width="16" height="10" rx="2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

const COMBO_COLORS = ['var(--danger)', 'var(--accent-blue)', 'var(--accent-yellow)'];

export function ComboShape({ card, size = 36 }: { card: ComboCard; size?: number }) {
  const color = COMBO_COLORS[card.color];
  // 카드 배경이 흰색/회색/검정으로 바뀌어도 도형이 또렷이 보이도록 옅은 외곽선을 둔다.
  const stroke = { stroke: 'rgba(0, 0, 0, 0.3)', strokeWidth: 1.5 };
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      {card.shape === 0 && <circle cx="20" cy="20" r="14" fill={color} {...stroke} />}
      {card.shape === 1 && <polygon points="20,6 34,32 6,32" fill={color} {...stroke} />}
      {card.shape === 2 && <rect x="7" y="7" width="26" height="26" rx="3" fill={color} {...stroke} />}
    </svg>
  );
}

const SHAPE_COLORS = ['var(--accent)', 'var(--ok)', 'var(--accent-blue)', 'var(--accent-yellow)', 'var(--accent-purple)'];

export function ShapeIcon({ shape, size = 30 }: { shape: ShapeId; size?: number }) {
  const color = SHAPE_COLORS[shape];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size}>
      {shape === 0 && <rect x="7" y="7" width="26" height="26" rx="3" fill={color} />}
      {shape === 1 && <polygon points="20,6 34,32 6,32" fill={color} />}
      {shape === 2 && <circle cx="20" cy="20" r="15" fill={color} />}
      {shape === 3 && (
        <polygon
          points="20,4 24.7,15.3 37,16.5 27.7,24.7 30.5,37 20,30.5 9.5,37 12.3,24.7 3,16.5 15.3,15.3"
          fill={color}
        />
      )}
      {shape === 4 && <rect x="10" y="10" width="20" height="20" rx="2" fill={color} transform="rotate(45 20 20)" />}
    </svg>
  );
}
