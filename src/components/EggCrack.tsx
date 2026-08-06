import { useEffect, useRef, useState } from 'react';
import styles from './EggCrack.module.css';

const EGG_PATH =
  'M100,10 C138,10 168,58 168,128 C168,190 138,232 100,232 C62,232 32,190 32,128 C32,58 62,10 100,10 Z';

// 금은 곧은 선 하나로 나지 않는다. 꺾이며 뻗고 곁가지를 친다.
// 본선과 곁가지를 따로 두면 곁가지가 한 박자 늦게 뻗어나가 "쩍" 벌어지는 느낌이 난다.
// 차례는 껍질을 위아래로 오가게 짰다. 위쪽부터 순서대로 나면 절반을 찾을 때까지
// 금이 머리에만 몰려 껍질이 갈라지는 게 아니라 한쪽이 깨진 것처럼 보인다.
const CRACKS: { main: string; branch: string; from: [number, number] }[] = [
  { main: 'M100,22 L93,42 L104,58 L95,78 L103,96', branch: 'M104,58 L121,63', from: [100, 22] },
  { main: 'M40,150 L58,157 L46,172 L63,186', branch: 'M58,157 L63,140', from: [40, 150] },
  { main: 'M150,56 L134,70 L147,84 L131,96 L139,112', branch: 'M147,84 L162,79', from: [150, 56] },
  { main: 'M100,216 L90,197 L108,187 L96,169 L104,151', branch: 'M108,187 L124,191', from: [100, 216] },
  { main: 'M50,64 L67,77 L53,92 L69,104 L59,120', branch: 'M53,92 L37,87', from: [50, 64] },
  { main: 'M160,150 L142,157 L154,172 L137,186', branch: 'M142,157 L137,140', from: [160, 150] },
];

// 껍질에 얹는 옅은 얼룩. 돌처럼 보이라고 두는 것이라 규칙 없이 흩어놓는다.
const SPECKLES: [number, number, number, number][] = [
  [78, 52, 13, 8],
  [124, 88, 9, 6],
  [62, 126, 11, 7],
  [138, 160, 12, 8],
  [96, 196, 10, 6],
  [110, 40, 7, 5],
];

// 금이 하나 날 때 그 자리에서 튀는 껍질 조각. [x방향, y방향, 회전]
const CHIPS: [number, number, number][] = [
  [-13, -10, -140],
  [11, -14, 120],
  [4, 12, 60],
];

// 껍질이 갈라지는 자리. 반듯한 가로선으로 자르면 잘린 종이처럼 보여서 지그재그로 낸다.
const SPLIT: [number, number][] = [
  [0, 116], [18, 127], [36, 113], [52, 126], [68, 114], [84, 127],
  [100, 112], [118, 126], [134, 114], [150, 127], [166, 113], [182, 126], [200, 118],
];
const SPLIT_LINE = SPLIT.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
const TOP_CLIP = `${SPLIT_LINE} L200,0 L0,0 Z`;
const BOTTOM_CLIP = `${SPLIT_LINE} L200,240 L0,240 Z`;

const RAYS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
// 깨진 순간 사방으로 흩어지는 껍질 부스러기. [각도, 거리, 크기]
const DEBRIS: [number, number, number][] = [
  [18, 82, 5], [64, 96, 3.4], [112, 74, 4.4], [156, 92, 3], [198, 86, 4.8],
  [242, 70, 3.6], [286, 98, 4.2], [330, 78, 3.2],
];

interface Props {
  count: number;
  total: number;
  /** 아래 글자(n/6 CRACK). 이미 같은 말을 하는 문구가 옆에 있는 자리에서는 끈다. */
  label?: boolean;
}

function Shell({ litCount, fresh }: { litCount: number; fresh: number }) {
  return (
    <>
      <path d={EGG_PATH} fill="url(#eggShell)" />
      <path d={EGG_PATH} fill="url(#eggSheen)" />
      <g className={styles.speckles}>
        {SPECKLES.map(([cx, cy, rx, ry], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />
        ))}
      </g>
      <path d={EGG_PATH} fill="none" stroke="url(#eggRim)" strokeWidth="1.8" />

      {/* 금 하나에 선을 두 벌 겹친다: 넓게 번지는 빛과, 그 위에 또렷한 실금. */}
      {CRACKS.map((c, i) =>
        i < litCount ? (
          <g key={i} className={`${styles.crack} ${i === fresh ? styles.crackFresh : ''}`}>
            <path className={styles.crackHalo} d={c.main} />
            <path className={styles.crackGap} d={c.main} />
            <path className={styles.crackLine} d={c.main} />
            {/* 곁가지는 본선이 다 그어진 뒤에 뻗는다(같이 그어지면 한 덩어리로 보인다). */}
            <g className={styles.branchG}>
              <path className={styles.crackHalo} d={c.branch} />
              <path className={styles.crackGap} d={c.branch} />
              <path className={`${styles.crackLine} ${styles.crackBranch}`} d={c.branch} />
            </g>
          </g>
        ) : null,
      )}
    </>
  );
}

export default function EggCrack({ count, total, label = true }: Props) {
  const complete = count >= total;
  const clamped = Math.min(count, total);

  // 방금 난 금만 그어지는 걸 보여준다. 화면에 들어올 때마다 여섯 개가 전부 다시 그어지면
  // 처음 보는 사람과 다 깬 사람이 같은 장면을 보게 된다.
  const prev = useRef(count);
  const [fresh, setFresh] = useState(-1);
  useEffect(() => {
    if (count > prev.current) {
      setFresh(count - 1);
      prev.current = count;
      const t = setTimeout(() => setFresh(-1), 900);
      return () => clearTimeout(t);
    }
    prev.current = count;
  }, [count]);

  return (
    <div
      className={styles.wrap}
      style={{ ['--lit' as string]: total > 0 ? String(clamped / total) : '0' }}
    >
      <div className={styles.glow} />
      <svg className={`${styles.svg} ${fresh >= 0 ? styles.shake : ''}`} viewBox="0 0 200 240">
        <defs>
          <linearGradient id="eggShell" x1="0.2" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#4c4133" />
            <stop offset="46%" stopColor="#332b22" />
            <stop offset="100%" stopColor="#1d1812" />
          </linearGradient>
          <radialGradient id="eggSheen" cx="0.33" cy="0.22" r="0.62">
            <stop offset="0%" stopColor="#f1e9db" stopOpacity="0.34" />
            <stop offset="60%" stopColor="#f1e9db" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#f1e9db" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="eggRim" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#f6c3cd" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#f1e9db" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#f1e9db" stopOpacity="0.04" />
          </linearGradient>
          <radialGradient id="eggCore">
            <stop offset="0%" stopColor="#fff8f4" stopOpacity="0.98" />
            <stop offset="38%" stopColor="#f6c3cd" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ec93a3" stopOpacity="0" />
          </radialGradient>
          <clipPath id="eggTopClip">
            <path d={TOP_CLIP} />
          </clipPath>
          <clipPath id="eggBottomClip">
            <path d={BOTTOM_CLIP} />
          </clipPath>
        </defs>

        {/* 껍질 안에서 차오르는 빛. 금이 늘수록 밝아져, 다 깨지기 전부터 안에 뭔가 있다는 게 보인다. */}
        <ellipse className={styles.inner} cx="100" cy="128" rx="62" ry="86" fill="url(#eggCore)" />

        {!complete && (
          <>
            <g className={styles.egg}>
              <Shell litCount={clamped} fresh={fresh} />
            </g>
            {fresh >= 0 && (
              <g style={{ transform: `translate(${CRACKS[fresh].from[0]}px, ${CRACKS[fresh].from[1]}px)` }}>
                {CHIPS.map(([dx, dy, r], i) => (
                  <path
                    key={i}
                    className={styles.chip}
                    d="M0,0 L7,2.5 L2.5,8 Z"
                    style={{
                      ['--dx' as string]: `${dx}px`,
                      ['--dy' as string]: `${dy}px`,
                      ['--r' as string]: `${r}deg`,
                      animationDelay: `${i * 45}ms`,
                    }}
                  />
                ))}
              </g>
            )}
          </>
        )}

        {complete && (
          <g>
            <circle className={styles.shock} cx="100" cy="128" r="46" />
            <g className={styles.rays}>
              {RAYS.map((deg, i) => (
                <line
                  key={deg}
                  x1={100 + 30 * Math.cos((deg * Math.PI) / 180)}
                  y1={128 + 30 * Math.sin((deg * Math.PI) / 180)}
                  x2={100 + 92 * Math.cos((deg * Math.PI) / 180)}
                  y2={128 + 92 * Math.sin((deg * Math.PI) / 180)}
                  strokeWidth={i % 2 === 0 ? 3.2 : 1.6}
                />
              ))}
            </g>
            <circle className={styles.core} cx="100" cy="128" r="44" fill="url(#eggCore)" />
            <path
              className={styles.spark}
              d="M100,74 L104.5,123.5 L154,128 L104.5,132.5 L100,182 L95.5,132.5 L46,128 L95.5,123.5 Z"
            />
            <g className={styles.eggTop} clipPath="url(#eggTopClip)">
              <Shell litCount={total} fresh={-1} />
            </g>
            <g className={styles.eggBottom} clipPath="url(#eggBottomClip)">
              <Shell litCount={total} fresh={-1} />
            </g>
            <g className={styles.debris}>
              {DEBRIS.map(([deg, dist, size], i) => (
                <path
                  key={i}
                  d={`M0,0 L${size * 1.6},${size * 0.6} L${size * 0.6},${size * 1.8} Z`}
                  style={{
                    ['--dx' as string]: `${dist * Math.cos((deg * Math.PI) / 180)}px`,
                    ['--dy' as string]: `${dist * Math.sin((deg * Math.PI) / 180)}px`,
                    ['--r' as string]: `${deg * 2}deg`,
                    animationDelay: `${120 + i * 25}ms`,
                  }}
                />
              ))}
            </g>
          </g>
        )}
      </svg>

      {label && (
        <div className={styles.label}>
          {complete ? (
            <span className={styles.labelComplete}>CRACK COMPLETE</span>
          ) : (
            <span className={styles.labelCount}>
              <b>{clamped}</b> / {total} CRACK
            </span>
          )}
        </div>
      )}
    </div>
  );
}
