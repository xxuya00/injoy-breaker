import styles from './EggCrack.module.css';

const EGG_PATH =
  'M100,10 C138,10 168,58 168,128 C168,190 138,232 100,232 C62,232 32,190 32,128 C32,58 62,10 100,10 Z';

const CRACKS = [
  'M100,22 L93,42 L104,56 L94,78',
  'M147,52 L133,66 L144,80 L128,94',
  'M53,62 L67,76 L54,90 L69,104',
  'M42,148 L60,154 L49,169 L63,184',
  'M158,148 L141,156 L153,171 L138,184',
  'M100,214 L91,197 L109,187 L96,169',
];

const RAYS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

interface Props {
  count: number;
  total: number;
}

export default function EggCrack({ count, total }: Props) {
  const complete = count >= total;
  const clamped = Math.min(count, total);

  return (
    <div className={styles.wrap}>
      <div className={styles.glow} />
      <svg className={styles.svg} viewBox="0 0 200 240">
        <defs>
          <linearGradient id="eggGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--text)" />
            <stop offset="100%" stopColor="var(--accent-soft)" />
          </linearGradient>
          <clipPath id="eggTopClip">
            <rect x="0" y="0" width="200" height="122" />
          </clipPath>
          <clipPath id="eggBottomClip">
            <rect x="0" y="118" width="200" height="122" />
          </clipPath>
        </defs>

        {!complete && (
          <g>
            <path d={EGG_PATH} fill="url(#eggGrad)" stroke="var(--ink)" strokeWidth="2" />
            {CRACKS.map((c, i) => (
              <path
                key={i}
                d={c}
                className={`${styles.crack} ${i < clamped ? styles.crackOn : ''}`}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>
        )}

        {complete && (
          <g className={styles.burst}>
            <g className={styles.rays}>
              {RAYS.map((deg) => (
                <line
                  key={deg}
                  x1="100"
                  y1="128"
                  x2={100 + 78 * Math.cos((deg * Math.PI) / 180)}
                  y2={128 + 78 * Math.sin((deg * Math.PI) / 180)}
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ))}
            </g>
            <g className={styles.eggTop} clipPath="url(#eggTopClip)">
              <path d={EGG_PATH} fill="url(#eggGrad)" stroke="var(--ink)" strokeWidth="2" />
              {CRACKS.map((c, i) => (
                <path key={i} d={c} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </g>
            <g className={styles.eggBottom} clipPath="url(#eggBottomClip)">
              <path d={EGG_PATH} fill="url(#eggGrad)" stroke="var(--ink)" strokeWidth="2" />
              {CRACKS.map((c, i) => (
                <path key={i} d={c} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </g>
          </g>
        )}
      </svg>

      <div className={styles.label}>
        {complete ? (
          <span className={styles.labelComplete}>💥 CRACK COMPLETE</span>
        ) : (
          <span className={styles.labelCount}>
            {clamped} / {total} CRACK
          </span>
        )}
      </div>
    </div>
  );
}
