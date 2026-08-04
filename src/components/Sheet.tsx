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
  // 닫기 버튼과 같은 줄, 왼쪽에 놓이는 머리말(예: 게임 이름·경과시간).
  // 안쪽 내용은 기기에 맞춰 줄었다 커졌다 하지만 이 줄은 버튼과 같은 크기로 고정이라,
  // 어떤 기기에서도 버튼과 겹치거나 서로 밀어내지 않는다.
  header?: ReactNode;
}

export default function Sheet({ open, onClose, children, fullscreen, action, header }: Props) {
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
            <div className={styles.topBar}>
              <div className={styles.topBarMain}>{header}</div>
              {action}
              <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {/* 게임이 도는 전체화면 시트도 기기 높이에 맞춰 한 화면에 담는다.
                다만 작은 기기에서 줄이기만 하고 키우지는 않는다(shrink). 내용이 적다고
                통째로 확대하면 제목·버튼만 커진 확대경처럼 보이고, 판마다 글씨 크기가 달라진다. */}
            <FitBox mode="shrink">{children}</FitBox>
          </>
        ) : (
          <>
            {/* 아래에서 올라오는 작은 시트는 내용 높이만큼만 차지하므로 그대로 둔다. */}
            <div className={styles.grab} />
            {children}
          </>
        )}
      </div>
    </div>
  );

  // 화면 축소(transform) 안쪽에 있으면 시트까지 같이 줄어들므로 덮개 전용 자리로 옮겨 그린다.
  if (!overlayRoot) return null;
  return createPortal(sheet, overlayRoot);
}
