import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import styles from './FitBox.module.css';

// 화면을 담는 상자.
//
// 글씨 크기는 어느 화면에서나 코드에 적힌 그대로 둔다. 화면을 통째로 줄이거나 키우지 않고,
// 넘치는 만큼만 스크롤한다. 그래서
//  · 같은 역할의 글씨는 어느 화면에서나 같은 크기다(15px는 어디서나 15px).
//  · 문구를 고쳐도 그 문구가 놓인 자리만 길어질 뿐, 제목·버튼의 크기는 그대로다.
//  · 기기의 글꼴 크기 설정을 앱이 덮어쓰지 않는다.
//
// 담는 방식은 세 가지다.
//  · fit    - 담기면 가운데, 넘치면 위에서부터 스크롤 (기본)
//  · scroll - 짧아도 언제나 위에서 시작한다. 날마다 길이가 제각각인 여정 목록처럼,
//             내용 길이에 따라 가운데로 갔다 위로 갔다 하면 같은 화면이 위아래로 널뛴다.
//  · fill   - 남는 높이를 화면이 통째로 넘겨받아 스스로 나눠 쓴다.
//             (기도제목처럼 목록이 화면 대부분을 차지하고 그 안에서만 스크롤하는 화면)
type FitMode = 'fit' | 'scroll' | 'fill';

interface FitApi {
  setMode: (mode: FitMode) => void;
  scrollToTop: () => void;
}

const FitContext = createContext<FitApi>({ setMode: () => {}, scrollToTop: () => {} });

// 이 화면은 이렇게 담아 달라고 바깥 FitBox에 알린다. 화면을 벗어나면 다시 기본(fit)으로 돌아간다.
// resetKey는 "보여줄 내용이 통째로 바뀌는 기준"(여정의 날짜 탭, 검사의 문항 번호 등)이다.
// 값이 바뀌면 읽던 위치가 아니라 맨 위에서 다시 시작한다.
export function useFitMode(mode: FitMode, resetKey?: unknown) {
  const { setMode, scrollToTop } = useContext(FitContext);
  useLayoutEffect(() => {
    setMode(mode);
    return () => setMode('fit');
  }, [setMode, mode]);
  useLayoutEffect(() => {
    scrollToTop();
  }, [scrollToTop, resetKey]);
}

// 읽어 내려가는 화면(여정 목록, 큐티 본문).
export function useScrollFit(resetKey?: unknown) {
  useFitMode('scroll', resetKey);
}

// 남는 높이를 통째로 넘겨받아 스스로 나눠 쓰는 화면(개요, 기도제목).
export function useFillFit() {
  useFitMode('fill');
}

interface Props {
  children: ReactNode;
  // 담기는 화면이 스스로 고르는 대신 바깥에서 통째로 정해주는 모드(시트처럼 무엇이 들어올지
  // 미리 아는 자리). 값이 있으면 안쪽 화면의 useFitMode()보다 이쪽이 이긴다.
  mode?: FitMode;
}

export default function FitBox({ children, mode: fixedMode }: Props) {
  const [ownMode, setMode] = useState<FitMode>('fit');
  const mode = fixedMode ?? ownMode;
  const outerRef = useRef<HTMLDivElement>(null);
  // setMode는 useState가 주는 고정된 함수라 이 값도 한 번 만들면 바뀌지 않는다.
  const api = useMemo<FitApi>(
    () => ({
      setMode,
      scrollToTop: () => {
        if (outerRef.current) outerRef.current.scrollTop = 0;
      },
    }),
    [],
  );

  return (
    <FitContext.Provider value={api}>
      <div ref={outerRef} className={`${styles.outer} ${styles[mode]}`}>
        <div className={styles.inner}>{children}</div>
      </div>
    </FitContext.Provider>
  );
}
