import { useEffect, useRef, useState } from 'react';
import styles from './Preloader.module.css';

// 글꼴이 아직 안 왔으면 진행바를 여기서 붙잡아 두고 기다린다.
const WAIT_CAP = 0.92;
// 문이 닫힌 채로 끝없이 기다리지 않도록 하는 안전장치(글꼴 요청이 막히거나 아주 느린 망에서).
const HARD_TIMEOUT_MS = 4000;
// 사라지는 데 걸리는 시간 — CSS의 transition과 같아야 한다.
const FADE_MS = 450;

interface Props {
  /** 이만큼은 무조건 보여준다. 개요가 이어질 때만 길게 두고, 평소엔 짧게 스친다. */
  minMs: number;
  onDone: () => void;
}

export default function Preloader({ minMs, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let fadeTimer = 0;
    const start = performance.now();
    let ready = false;
    // 글꼴이 준비되면(또는 실패하면) 진행바를 끝까지 보낸다.
    const fonts = document.fonts?.ready ?? Promise.resolve();
    fonts.then(() => (ready = true)).catch(() => (ready = true));
    const hardStop = window.setTimeout(() => (ready = true), HARD_TIMEOUT_MS);

    const tick = (now: number) => {
      const elapsed = (now - start) / minMs;
      const v = Math.min(ready ? 1 : WAIT_CAP, elapsed);
      // 폭 대신 통째로 밀어 넣는다 — 매 프레임 레이아웃을 다시 잡지 않는다.
      if (barRef.current) barRef.current.style.transform = `translateX(${-100 + v * 100}%)`;
      if (v >= 1) {
        setLeaving(true);
        fadeTimer = window.setTimeout(onDone, FADE_MS);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hardStop);
      clearTimeout(fadeTimer);
    };
  }, [minMs, onDone]);

  return (
    <div className={`${styles.gate} ${leaving ? styles.leaving : ''}`} aria-hidden={leaving}>
      <div className={styles.brand}>
        BR<span className={styles.crack}>/</span>EAKER
      </div>
      <div className={styles.label}>UNLOCKING…</div>
      <div className={styles.barWrap}>
        <span ref={barRef} className={styles.bar} />
      </div>
    </div>
  );
}
