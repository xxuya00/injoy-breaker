import type { ReactNode } from 'react';
import styles from './Sheet.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Sheet({ open, onClose, children }: Props) {
  return (
    <div
      className={`${styles.sheetBg} ${open ? styles.sheetBgShow : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet}>
        <div className={styles.grab} />
        {children}
      </div>
    </div>
  );
}
