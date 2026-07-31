import type { ReactNode } from 'react';
import styles from './Sheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  fullscreen?: boolean;
}

export default function Sheet({ open, onClose, children, fullscreen }: Props) {
  return (
    <div
      className={`${styles.sheetBg} ${open ? styles.sheetBgShow : ''} ${fullscreen ? styles.sheetBgFull : ''}`}
      onClick={(e) => {
        if (!fullscreen && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet}>
        {fullscreen ? (
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
          <div className={styles.grab} />
        )}
        {children}
      </div>
    </div>
  );
}
