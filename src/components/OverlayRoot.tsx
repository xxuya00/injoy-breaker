import { createContext, useContext, useState, type ReactNode } from 'react';

// 화면 내용은 기기 높이에 맞춰 통째로 축소(transform)되는데, 그 안에 있으면
// 시트·QR 스캐너 같은 덮개까지 같이 줄어들고 좌표계도 어긋난다.
// 그래서 덮개는 축소 밖(앱 껍데기 바로 아래)으로 옮겨서 그린다.
const OverlayContext = createContext<HTMLElement | null>(null);

export function useOverlayRoot() {
  return useContext(OverlayContext);
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <OverlayContext.Provider value={el}>
      {children}
      <div ref={setEl} />
    </OverlayContext.Provider>
  );
}
