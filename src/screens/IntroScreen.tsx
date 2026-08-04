import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useFillFit } from '../components/FitBox';
import { INTRO_CTA, INTRO_SLIDES } from '../data/intro';
import { markIntroSeen } from '../lib/storage';
import styles from './IntroScreen.module.css';

// 한 줄이 떠오르는 간격. 줄 수가 많은 장에서도 마지막 줄이 너무 늦게 오지 않게 짧게 둔다.
const LINE_STEP_MS = 90;

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d={dir === 'right' ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

export default function IntroScreen() {
  const { state, goScreen } = useApp();
  useFillFit();
  const [idx, setIdx] = useState(0);
  const active = state.screen === 'intro';
  // 스와이프로 넘긴 직후에는 touchend에 이어 click까지 와서 두 장이 한 번에 넘어간다. 한 번만 막는다.
  const swiped = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const slide = INTRO_SLIDES[idx];
  const last = idx === INTRO_SLIDES.length - 1;

  // 등록 화면에서 "개요 다시 보기"로 들어올 때도 언제나 첫 장부터 시작한다.
  useEffect(() => {
    if (active) setIdx(0);
  }, [active]);

  // 처음 보는 사람은 등록 화면으로, 여정 중에 다시 꺼내 본 사람은 보던 자리로 되돌린다.
  const enrolled = !!state.id;
  const finish = useCallback(() => {
    markIntroSeen();
    goScreen(enrolled ? 'journey' : 'login');
  }, [goScreen, enrolled]);

  const next = useCallback(() => {
    setIdx((i) => {
      if (i < INTRO_SLIDES.length - 1) return i + 1;
      return i;
    });
  }, []);

  const prev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);

  // 인도자가 화면을 띄워놓고 넘길 때를 위해 키보드로도 넘어간다.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, prev]);

  // 화면 아무 곳이나 눌러 넘긴다. 왼쪽 1/3은 이전 장.
  const handleTap = (e: React.MouseEvent<HTMLElement>) => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.32) prev();
    else if (!last) next();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy)) return;
    swiped.current = true;
    if (dx < 0) {
      if (!last) next();
    } else {
      prev();
    }
  };

  const lines = slide.lines ?? [];
  // 줄이 다 떠오른 뒤에 아래쪽 버튼이 따라 나오도록, 마지막 줄 다음 순서를 계산해 둔다.
  const footDelay = (lines.length + 1) * LINE_STEP_MS;

  return (
    <section
      className={styles.stage}
      onClick={handleTap}
      onTouchStart={(e) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={handleTouchEnd}
    >
      <div className={styles.top}>
        <div className={styles.ticks}>
          {INTRO_SLIDES.map((_, i) => (
            <span key={i} className={`${styles.tick} ${i <= idx ? styles.tickOn : ''}`}>
              <span className={styles.tickFill} />
            </span>
          ))}
        </div>
        <button className={`${styles.skip} ${idx > 0 && !last ? styles.skipOn : ''}`} onClick={finish}>
          건너뛰기
        </button>
      </div>

      {/* key가 바뀌면 통째로 다시 그려져서, 장마다 떠오르는 애니메이션이 처음부터 다시 돈다. */}
      <div className={styles.body} key={idx}>
        {slide.eyebrow && (
          <div className={`${styles.eyebrow} ${styles.rise}`} style={{ animationDelay: '0ms' }}>
            {slide.eyebrow}
          </div>
        )}

        {slide.kind === 'cover' && slide.title && (
          <div className={`${styles.brand} ${styles.rise}`} style={{ animationDelay: `${LINE_STEP_MS}ms` }}>
            BR<span className={styles.crack}>/</span>EAKER
          </div>
        )}

        {slide.kind === 'verse' && (
          <>
            <div className={`${styles.verse} ${styles.rise}`} style={{ animationDelay: '0ms' }}>
              {slide.verse}
            </div>
            <div className={`${styles.ref} ${styles.rise}`} style={{ animationDelay: `${LINE_STEP_MS * 3}ms` }}>
              — {slide.ref}
            </div>
          </>
        )}

        {slide.kind === 'closing' && slide.title && (
          <div
            className={`${styles.brand} ${styles.rise}`}
            style={{ animationDelay: '0ms', fontSize: 44, marginBottom: 14 }}
          >
            BR<span className={styles.crack}>/</span>EAKER
          </div>
        )}

        {slide.kind === 'cover' ? (
          lines.map((line, i) => (
            <div
              key={i}
              className={`${styles.tagline} ${styles.rise}`}
              style={{ animationDelay: `${(i + 2) * LINE_STEP_MS}ms` }}
            >
              {line}
            </div>
          ))
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={`${styles.line} ${slide.accent?.includes(i) ? styles.lineAccent : ''} ${styles.rise}`}
              style={{ animationDelay: `${(i + 1) * LINE_STEP_MS}ms` }}
            >
              {line}
            </div>
          ))
        )}
      </div>

      {last ? (
        <div className={styles.rise} style={{ animationDelay: `${footDelay}ms` }}>
          <button className={`btn ${styles.cta}`} onClick={finish}>
            {enrolled ? '여정으로 돌아가기' : INTRO_CTA}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.foot}>
            <button className={styles.navBtn} onClick={prev} disabled={idx === 0}>
              <Chevron dir="left" />
              이전
            </button>
            <button className={`${styles.navBtn} ${styles.next}`} onClick={next}>
              다음
              <Chevron dir="right" />
            </button>
          </div>
          {idx === 0 && <div className={styles.hint}>화면을 눌러 넘겨보세요</div>}
        </>
      )}
    </section>
  );
}
