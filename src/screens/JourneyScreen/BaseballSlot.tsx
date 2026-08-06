import styles from './JourneyScreen.module.css';

// 숫자야구 한 자리. 십자 연산의 칸과 같은 물건이다 — 눌러서 고르고, 숫자패드로 채우고, 다시 눌러 고친다.
// 힌트로 알아낸 자리는 따로 표시해, 내가 짚은 숫자와 알려준 숫자를 판 위에서 구분할 수 있게 한다.
export default function BaseballSlot({
  pos,
  digit,
  hinted,
  active,
  onClick,
}: {
  pos: number;
  digit?: number | null;
  hinted?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.bbSlot} ${hinted ? styles.bbSlotHint : ''} ${active ? styles.bbSlotActive : ''}`}
      onClick={onClick}
      aria-label={`${pos + 1}번째 자리 ${digit == null ? '비어 있음' : digit}`}
      aria-pressed={active}
    >
      {digit ?? ''}
    </button>
  );
}
