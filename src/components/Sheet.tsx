import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import FitBox from './FitBox';
import { useOverlayRoot } from './OverlayRoot';
import styles from './Sheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  fullscreen?: boolean;
  // 닫기 버튼 왼쪽에 나란히 놓이는 보조 동작(예: 게임 재시작).
  action?: ReactNode;
}

export default function Sheet({ open, onClose, children, fullscreen, action }: Props) {
  const overlayRoot = useOverlayRoot();

  const sheet = (
    <div
      className={`${styles.sheetBg} ${open ? styles.sheetBgShow : ''} ${fullscreen ? styles.sheetBgFull : ''}`}
      onClick={(e) => {
        if (!fullscreen && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet}>
        {fullscreen ? (
          <>
            {action && <div className={styles.actionSlot}>{action}</div>}
            <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </>
        ) : (
          <div className={styles.grab} />
        )}
        {/* 게임이 도는 전체화면 시트도 기기 높이에 맞춰 한 화면에 담는다.
            아래에서 올라오는 작은 시트는 내용 높이만큼만 차지하므로 그대로 둔다. */}
        {fullscreen ? <FitBox>{children}</FitBox> : children}
      </div>
    </div>
  );

  // 화면 축소(transform) 안쪽에 있으면 시트까지 같이 줄어들므로 덮개 전용 자리로 옮겨 그린다.
  if (!overlayRoot) return null;
  return createPortal(sheet, overlayRoot);
}
