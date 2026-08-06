import { useRef } from 'react';

// 손가락으로 옆으로 밀어 장을 넘기는 손짓. 큐티(본문→관찰→묵상→적용)와 기도제목(조 넘기기)이
// 같은 손짓을 쓰므로 여기 한 곳에 둔다.
//
// 이만큼은 움직여야 "가로인지 세로인지" 방향을 판정한다. 너무 작으면 세로로 훑는 손짓의
// 미세한 흔들림까지 가로로 잡히고, 너무 크면 넘기려는 손짓이 한 박자 늦게 붙는다.
const DECIDE_PX = 12;
// 이만큼 끌어야 실제로 넘어간다. 여기 못 미치면 제자리로 돌아간다.
const GO_PX = 56;
// 손가락을 따라가는 정도. 그대로 따라가면 화면이 통째로 빠져나가 보여서 절반쯤만 따라간다.
const PULL = 0.45;
// 넘어갈 곳이 없는 쪽(첫 장에서 오른쪽, 끝 장에서 왼쪽)은 끝이라는 게 느껴질 만큼만 밀린다.
const PULL_EDGE = 0.1;

/** 왼쪽으로 밀면 +1(다음), 오른쪽으로 밀면 -1(이전). */
export type SwipeDir = -1 | 1;

interface Options {
  /** 그 방향으로 실제로 넘어갔을 때 부를 함수. */
  onGo: (dir: SwipeDir) => void;
  /** 그 방향에 넘어갈 곳이 있는지. 없으면 조금만 밀렸다가 제자리로 돌아온다. */
  canGo: (dir: SwipeDir) => boolean;
  /**
   * 이 안에서 시작한 손짓은 넘김으로 치지 않는다(CSS 선택자).
   * 답을 적는 칸 안에서 옆으로 끄는 건 커서를 옮기거나 글자를 고르려는 것이다.
   */
  ignore?: string;
}

export function useSwipePager({ onGo, canGo, ignore }: Options) {
  const ref = useRef<HTMLDivElement>(null);
  // 세로로 읽어 내려가는 손짓과 헷갈리지 않도록 처음 몇 px에서 방향을 딱 한 번 정하고,
  // 세로로 정해지면 그 손짓은 끝까지 넘김으로 치지 않는다.
  const swipe = useRef({ x: 0, y: 0, dx: 0, axis: '' as '' | 'x' | 'y', on: false });

  // px가 null이면 제자리로 되돌린다.
  const shift = (px: number | null) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = px === null ? 'transform 0.18s ease' : 'none';
    el.style.transform = px === null ? '' : `translateX(${px}px)`;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || (ignore && (e.target as HTMLElement).closest(ignore))) {
      swipe.current.on = false;
      return;
    }
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, dx: 0, axis: '', on: true };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const s = swipe.current;
    if (!s.on) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return;
      // 세로가 조금이라도 우세하면 읽어 내려가는 중으로 본다 — 넘김은 확실히 가로일 때만.
      s.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      if (s.axis === 'y') {
        s.on = false;
        return;
      }
    }
    s.dx = dx;
    shift(dx * (canGo(dx < 0 ? 1 : -1) ? PULL : PULL_EDGE));
  };

  const onTouchEnd = () => {
    const s = swipe.current;
    if (!s.on) return;
    s.on = false;
    shift(null);
    if (s.axis !== 'x' || Math.abs(s.dx) < GO_PX) return;
    const dir: SwipeDir = s.dx < 0 ? 1 : -1;
    if (canGo(dir)) onGo(dir);
  };

  return {
    ref,
    // 넘길 대상에 그대로 펼쳐 붙인다. 세로 넘김은 브라우저가, 가로는 우리가 맡도록
    // 대상 쪽 CSS에 touch-action: pan-y를 함께 걸어야 한다.
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  };
}
