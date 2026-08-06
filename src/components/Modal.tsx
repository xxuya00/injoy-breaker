import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayRoot } from './OverlayRoot';
import styles from './Modal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 창 머리에 놓이는 제목 줄(영문 표제 + 제목). X 버튼 왼쪽에 선다. */
  head?: ReactNode;
  children: ReactNode;
  /** 바닥에 고정으로 서는 줄(저장·남기기 버튼 등). 내용이 길어도 늘 보인다. */
  foot?: ReactNode;
}

// 화면 한가운데 뜨는 창. 글을 적는 자리(기도제목 등)와 잠깐 펼쳐 읽는 자리에 쓴다.
export default function Modal({ open, onClose, head, children, foot }: Props) {
  const overlayRoot = useOverlayRoot();
  // 자판이 올라오면 화면 아래 절반이 가려진다. 창은 "지금 보이는 높이"의 한가운데 떠야
  // 적는 칸과 저장 버튼이 자판 뒤로 숨지 않는다.
  const [viewH, setViewH] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const sync = () => setViewH(vv.height);
    sync();
    vv.addEventListener('resize', sync);
    return () => vv.removeEventListener('resize', sync);
  }, [open]);

  // 적다 만 글을 두고 바깥을 눌러 닫는 사고를 막는다. 닫는 길은 X 하나뿐이다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const modal = (
    <div
      className={`${styles.backdrop} ${open ? styles.backdropShow : ''}`}
      style={viewH ? { height: viewH, bottom: 'auto' } : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.box}>
        <div className={styles.head}>
          <div className={styles.headMain}>{head}</div>
          <button className={styles.close} onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {foot && <div className={styles.foot}>{foot}</div>}
      </div>
    </div>
  );

  // 화면 내용은 기기 높이에 맞춰 통째로 축소되므로, 덮개는 그 밖에서 그린다.
  if (!overlayRoot) return null;
  return createPortal(modal, overlayRoot);
}
