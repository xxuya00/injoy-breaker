import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './FitBox.module.css';

// 기기마다 화면 높이가 제각각이라, 내용을 통째로 줄이거나 키워서 언제나 한 화면에 꽉 차게 담는다.
//  · 내용이 넘치면 담길 때까지 줄인다 (작은 기기)
//  · 내용이 남으면 화면을 채울 때까지 키운다 (큰 기기)
// 이 배율보다 더 줄여야 담기는 화면(기도제목처럼 개수가 정해지지 않은 목록)은 글씨가
// 읽기 힘들어지므로 여기서 멈추고, 그런 화면에서만 예외적으로 스크롤을 연다.
const MIN_SCALE = 0.5;
// 반대로, 내용이 적은 화면(브리핑처럼 카드 하나뿐인 화면)을 남는 높이만큼 무한정 키우면
// 글씨만 커진 확대경처럼 보인다. 여기까지만 키우고 그래도 남는 높이는 위아래로 나눠 가운데에 놓는다.
const MAX_SCALE = 1.4;
// 배율을 0.005 단위로 끊어, 재계산이 미세하게 반복되며 화면이 떨리는 걸 막는다.
const STEP = 0.005;

// 크기 변화가 몰아칠 때(글꼴 로딩·회전·키보드) 이 시간 안에 이만큼까지만 다시 맞춘다.
const BURST_MS = 200;
const BURST_LIMIT = 6;

function quantize(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.floor(v / STEP) * STEP));
}

interface Props {
  children: ReactNode;
}

export default function FitBox({ children }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  // 화면 높이와 "배율 1일 때의 내용 높이"가 그대로면 지난번 답을 재사용하기 위한 기억.
  const lastAvailRef = useRef(-1);
  const lastNaturalRef = useRef(-1);
  const lastScaleRef = useRef(1);

  const fit = useCallback(() => {
    const outer = outerRef.current;
    const sizer = sizerRef.current;
    const inner = innerRef.current;
    if (!outer || !sizer || !inner) return;

    const avail = outer.clientHeight;
    // getBoundingClientRect는 배율이 반영된 "눈에 보이는" 높이를 준다.
    const measure = () => inner.getBoundingClientRect().height;
    const setScale = (v: number) => {
      if (v === scaleRef.current) return;
      scaleRef.current = v;
      inner.style.setProperty('--fit-scale', String(v));
    };
    const fits = (v: number) => {
      setScale(v);
      return measure() <= avail + 0.5;
    };

    if (avail > 0) {
      // 탐색은 언제나 배율 1에서 다시 시작한다. 직전 배율에서 출발하면 "폭이 달라진 상태"에서만
      // 맞는 답에 갇혀, 같은 화면이 기기마다 다르게 커지거나 작아진다.
      setScale(1);
      const natural = measure();

      if (avail === lastAvailRef.current && Math.abs(natural - lastNaturalRef.current) < 0.5) {
        // 화면 높이도 내용도 그대로면 지난번에 찾은 답을 그대로 쓴다(매 렌더 재탐색 방지).
        setScale(lastScaleRef.current);
      } else {
        // 배율을 바꾸면 폭이 함께 달라져 줄바꿈·칸 크기가 바뀌고 높이도 따라 바뀐다. 그래서
        // "높이 = 배율 × 무엇" 같은 식으로 한 번에 풀 수 없고, 담기는 가장 큰 배율을 이분 탐색으로 찾는다.
        // lo는 언제나 "담기는 배율", hi는 "담기지 않는 배율"로 두고 간격을 좁힌다.
        let lo: number;
        let hi: number;
        if (natural > avail) {
          lo = MIN_SCALE; // 최소 배율로도 안 담기는 화면이 있어서, 마지막에 넘침을 다시 확인한다.
          hi = 1;
        } else if (fits(MAX_SCALE)) {
          lo = MAX_SCALE; // 최대까지 키워도 담긴다. 더 찾을 게 없다.
          hi = MAX_SCALE;
        } else {
          lo = 1;
          hi = MAX_SCALE;
        }
        while (hi - lo > STEP * 1.5) {
          const mid = quantize((lo + hi) / 2);
          if (mid <= lo || mid >= hi) break;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        setScale(lo);
        lastAvailRef.current = avail;
        lastNaturalRef.current = natural;
        lastScaleRef.current = lo;
      }
    }

    const visual = measure();
    const height = `${Math.ceil(visual)}px`;
    if (sizer.style.height !== height) sizer.style.height = height;
    // 최소 배율로도 담기지 않을 때만 스크롤을 연다. 담기는 화면은 남는 높이를 위아래로 나눠
    // 가운데에 놓아, 아래쪽만 휑하게 비는 일이 없도록 한다.
    outer.classList.toggle(styles.scrolls, avail > 0 && visual > avail + 1);
    outer.classList.toggle(styles.center, visual <= avail + 1);
  }, []);

  // 내용이 바뀔 때마다(=매 렌더) 다시 맞춘다. 그리기 전에 끝나므로 깜빡이지 않는다.
  useLayoutEffect(fit);

  // 화면 회전·주소창 높이 변화·키보드·글꼴 로딩처럼 React 렌더 밖에서 생기는 변화까지 따라간다.
  useLayoutEffect(() => {
    // ResizeObserver 콜백은 화면을 그리기 직전에 오므로 여기서 바로 맞춰야 깜빡이지 않는다.
    // 다만 우리가 바꾼 크기 때문에 다시 불려올 수 있어서 짧은 시간 안의 반복 횟수를 제한한다.
    // 넘친 요청을 그냥 버리면 마지막 변화가 영영 반영되지 않아 화면이 어긋난 채로 굳으므로,
    // 버리지 않고 잠시 뒤로 미뤄 반드시 한 번은 반영되게 한다.
    let windowStart = 0;
    let runs = 0;
    let deferred = 0;
    const schedule = () => {
      const now = performance.now();
      if (now - windowStart > BURST_MS) {
        windowStart = now;
        runs = 0;
      }
      if (runs++ > BURST_LIMIT) {
        if (!deferred) deferred = window.setTimeout(() => {
          deferred = 0;
          schedule();
        }, BURST_MS);
        return;
      }
      fit();
    };
    const ro = new ResizeObserver(schedule);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    // 모바일에서 키보드가 올라오거나 주소창이 접힐 때는 window resize가 오지 않을 수 있다.
    window.visualViewport?.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule).catch(() => {});
    return () => {
      clearTimeout(deferred);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [fit]);

  return (
    <div ref={outerRef} className={styles.outer}>
      <div ref={sizerRef} className={styles.sizer}>
        <div ref={innerRef} className={styles.inner}>
          {children}
        </div>
      </div>
    </div>
  );
}
