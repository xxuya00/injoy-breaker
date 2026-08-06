import { useRef, useState } from 'react';
import {
  DIAL_STORY,
  INNER_WORD,
  MIDDLE_WORD,
  OUTER_HOURS,
  SLOTS,
  THIRTEENTH,
  type DialOffsets,
  type RingId,
} from '../data/timeDial';
import { tapTick } from '../lib/feedback';
import styles from './TimeDial.module.css';

const VIEW = 320;
const C = VIEW / 2;
const STEP = 360 / SLOTS;
/** 이 각도 미만으로 움직였다 뗀 건 돌린 게 아니라 톡 누른 것으로 본다. */
const TAP_SLOP = 8;

interface RingGeom {
  id: RingId;
  /** 링이 차지하는 반지름 구간. 손가락이 어느 링을 잡았는지도 이걸로 가린다. */
  r0: number;
  r1: number;
  /** 글자가 놓이는 반지름 */
  rText: number;
  fontSize: number;
  labels: string[];
  /** 알파벳 링. 표제 글꼴을 쓰고, 다 맞으면 링 전체에 불이 들어온다(단어가 읽히기 시작하니까). */
  latin?: boolean;
  /** 시각 링. 글꼴은 알파벳과 같지만, 다 맞아도 밝아지는 건 열두 시에 선 12 하나뿐이다. */
  num?: boolean;
  /** 띠의 밝기 단계. 안으로 갈수록 밝아져서 세 겹이 층으로 보인다. */
  shade: 1 | 2 | 3;
}

// 바깥부터 시계판 → BREAKTHROUGH → FOREVER IN GOD. 셋 다 열두 칸으로 딱 떨어진다.
// 띠는 안으로 갈수록 한 단계씩 밝아진다(shade). 같은 색 고리 셋을 겹쳐두면 층이 안 보여서
// "글자가 잔뜩 그려진 원" 한 장으로 읽혔다.
const RINGS: RingGeom[] = [
  { id: 'outer', r0: 106, r1: 138, rText: 122, fontSize: 17, labels: OUTER_HOURS.map(String), num: true, shade: 1 },
  { id: 'middle', r0: 70, r1: 102, rText: 86, fontSize: 15, labels: MIDDLE_WORD, latin: true, shade: 2 },
  { id: 'inner', r0: 34, r1: 66, rText: 50, fontSize: 13, labels: INNER_WORD, latin: true, shade: 3 },
];

const RIM = 142;
/** 세 링을 가로지르는 열두 시 통로의 안쪽 끝 */
const CORRIDOR_R0 = RINGS[RINGS.length - 1].r0;

/** 열두 시 방향을 0도로 놓고 i번 칸의 좌표를 구한다. */
function slotPoint(index: number, radius: number) {
  const rad = ((index * STEP - 90) * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) };
}

/**
 * i번 칸 하나를 부채꼴로 오려낸 길. 표식 칸에는 이걸 깔아 "이 칸"이라고 말하고,
 * 열두 시 자리에는 같은 모양을 세 링에 걸쳐 깔아 "여기로 모으라"고 말한다.
 * 점 하나로 표식을 찍던 때보다, 칸이 통로에 들어맞는 그림이 훨씬 빨리 읽힌다.
 */
function slotCell(index: number, r0: number, r1: number) {
  const a0 = ((index - 0.5) * STEP - 90) * (Math.PI / 180);
  const a1 = ((index + 0.5) * STEP - 90) * (Math.PI / 180);
  const at = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;
  return `M${at(r0, a0)} A${r0} ${r0} 0 0 1 ${at(r0, a1)} L${at(r1, a1)} A${r1} ${r1} 0 0 0 ${at(r1, a0)} Z`;
}

export type DialPhase = 'turn' | 'solved' | 'broken';

interface Props {
  offsets: DialOffsets;
  /** 손가락이 잡은 링과 방향. 딸려 도는 링 처리는 data/timeDial의 turn()이 맡는다. */
  onTurn: (ring: RingId, dir: 1 | -1) => void;
  phase: DialPhase;
  /** 여정 화면에 얹는 미리보기처럼, 보여주기만 하고 돌리지는 못하게 할 때. */
  readOnly?: boolean;
  /**
   * 미리보기를 눌렀을 때. 예전에는 다이얼 아래에 "다이얼 돌리기" 버튼을 따로 뒀는데,
   * 돌리는 물건을 눈앞에 두고 손은 늘 그 아래 버튼으로 갔다. 다이얼 자체가 손잡이가 된다.
   */
  onOpen?: () => void;
  /** 가운데 판에 도는 빛. 눌러야 할 곳이 거기라는 걸 글자 없이 알린다. */
  hubGlow?: boolean;
  /**
   * 열두 칸을 다 맞춘 뒤 시계 방향으로 한 칸 더 밀어냈을 때.
   * 마지막 한 칸만 버튼으로 두면, 여기까지 손으로 돌려온 사람이 마지막에만 손을 떼고 버튼을
   * 누르게 된다. 원을 깨는 건 판정이 아니라 의식(儀式)이라, 그 손동작까지 같아야 한다.
   */
  onPush?: () => void;
}

export default function TimeDial({ offsets, onTurn, phase, readOnly, onOpen, hubGlow, onPush }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  // 드래그 한 번 동안의 누적치. 30도를 넘길 때마다 한 칸씩 끊어 돌린다.
  const drag = useRef<{ ring: RingId; last: number; acc: number; moved: number; steps: number } | null>(null);
  // 한 칸 걸릴 때마다 올라간다. 이 값을 포인터의 key로 써서 걸리는 연출을 처음부터 다시 재생시킨다.
  const [detent, setDetent] = useState(0);
  // 다 맞춘 뒤에도 손은 계속 다이얼 위에 있어야 한다. 다만 이때 받는 동작은 "한 칸 더 밀기" 하나뿐이다.
  const pushing = phase === 'solved' && !readOnly;
  const locked = readOnly || phase === 'broken';
  // 한 번의 드래그에서 한 번만 밀린다. 쭉 그으면 여러 칸이 넘어가는 평소와 달라야 한다.
  const pushed = useRef(false);

  /**
   * 한 칸 넘어갔다. 화면을 튕기고, 되는 기기라면 손끝과 귀에도 신호를 준다.
   * 걸리는 소리를 onTurn보다 먼저 내는 건, 마지막 한 칸에서 onTurn이 곧바로 열림 화음을
   * 울리기 때문이다. 순서가 반대면 화음이 먼저 시작하고 그 위에 톡 소리가 얹힌다.
   */
  const step = (ring: RingId, dir: 1 | -1) => {
    if (pushing) {
      // 되돌리는 방향(반시계)은 받지 않는다. 열세 번째 칸은 열둘 다음이지 열하나 앞이 아니다.
      if (dir !== 1 || pushed.current) return;
      pushed.current = true;
      onPush?.();
      return;
    }
    tapTick();
    setDetent((n) => n + 1);
    onTurn(ring, dir);
  };

  const angleAt = (e: React.PointerEvent) => {
    const el = svgRef.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * VIEW - C;
    const y = ((e.clientY - box.top) / box.height) * VIEW - C;
    return { angle: (Math.atan2(y, x) * 180) / Math.PI, dist: Math.hypot(x, y) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked) return;
    const at = angleAt(e);
    if (!at) return;
    // 링 사이 틈에서 손가락이 미끄러지지 않도록 판정만 살짝 넉넉하게 준다.
    const ring = RINGS.find((r) => at.dist >= r.r0 - 3 && at.dist <= r.r1 + 3);
    if (!ring) return;
    drag.current = { ring: ring.id, last: at.angle, acc: 0, moved: 0, steps: 0 };
    pushed.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const at = angleAt(e);
    if (!at) return;
    // -180과 180 사이를 넘어가도 한 바퀴로 세지 않도록 최단 방향으로 접어둔다.
    let delta = at.angle - d.last;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    d.last = at.angle;
    d.acc += delta;
    d.moved += Math.abs(delta);
    while (d.acc >= STEP) {
      d.acc -= STEP;
      d.steps++;
      step(d.ring, 1);
    }
    while (d.acc <= -STEP) {
      d.acc += STEP;
      d.steps++;
      step(d.ring, -1);
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    // 돌릴 생각 없이 톡 누른 것도 한 칸으로 받아준다. 작은 화면에서 안쪽 링을 끄는 건 꽤 성가시다.
    if (d && d.steps === 0 && d.moved < TAP_SLOP) step(d.ring, 1);
  };

  return (
    <div
      className={[styles.wrap, phase === 'solved' ? styles.wrapSolved : '', phase === 'broken' ? styles.wrapBroken : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.glow} />
      <svg
        ref={svgRef}
        className={`${styles.svg} ${onOpen ? styles.svgTap : ''}`}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onOpen}
        role={onOpen ? 'button' : 'group'}
        aria-label={
          onOpen
            ? '시간의 다이얼 열기'
            : pushing
              ? '시간의 다이얼 — 열두 칸이 다 맞았습니다. 링을 시계 방향으로 한 칸 더 밀어보세요'
              : '시간의 다이얼 — 세 개의 링을 돌려 표식 셋을 열두 시에 모으세요'
        }
      >
        {/* 다이얼을 감싼 테두리. 열린 뒤에는 12시 자리가 끊어지며 원이 열린다. */}
        <circle className={styles.rim} cx={C} cy={C} r={RIM} />

        {/* 바닥 — 띠와 표식 칸. 글자는 통로를 깐 다음에 그린다(글자 위에 반투명 판이 얹히면 흐려진다). */}
        {RINGS.map((ring) => {
          const deg = offsets[ring.id] * STEP;
          const spin = { transform: `rotate(${deg}deg)`, transformOrigin: `${C}px ${C}px` };
          return (
            <g key={`${ring.id}-band`} className={styles.ring} style={spin}>
              <circle
                className={`${styles.band} ${styles[`band${ring.shade}`]}`}
                cx={C}
                cy={C}
                r={(ring.r0 + ring.r1) / 2}
                strokeWidth={ring.r1 - ring.r0}
              />
              {/* 띠의 바깥 끝에 밝은 실선, 안쪽 끝에 그늘. 층이 겹쳐 있다는 걸 색이 아니라 빛으로 말한다. */}
              <circle className={styles.edgeLit} cx={C} cy={C} r={ring.r1 - 0.5} />
              <circle className={styles.edgeShade} cx={C} cy={C} r={ring.r0 + 0.5} />
              {/* 열두 시로 모아야 할 칸. 점 하나 대신 칸 하나를 통째로 밝혀둔다. */}
              <path className={styles.cell} d={slotCell(0, ring.r0 + 1.5, ring.r1 - 1.5)} />
            </g>
          );
        })}

        {/* 세 링을 관통하는 열두 시 통로. 표식 칸 셋이 이 통로에 들어차면 열린다.
            "표식을 열두 시에 모으세요"라는 문장이 하는 일을, 이 한 칸짜리 길이 대신 한다. */}
        <path className={styles.corridor} d={slotCell(0, CORRIDOR_R0, RIM)} />

        {/* 글자 — 통로 위에 올려야 흐려지지 않는다. */}
        {RINGS.map((ring) => {
          const deg = offsets[ring.id] * STEP;
          const spin = { transform: `rotate(${deg}deg)`, transformOrigin: `${C}px ${C}px` };
          return (
            <g key={`${ring.id}-text`} className={styles.ring} style={spin}>
              {ring.labels.map((label, i) => {
                const p = slotPoint(i, ring.rText);
                // 링이 돌아도 글자는 똑바로 서 있어야 읽힌다. 그래서 제자리에서 반대로 되돌린다.
                const upright = { transform: `rotate(${-deg}deg)`, transformOrigin: `${p.x}px ${p.y}px` };
                return (
                  <text
                    key={i}
                    className={[
                      styles.slot,
                      ring.latin ? styles.slotLatin : '',
                      ring.num ? styles.slotNum : '',
                      i === 0 ? styles.slotTarget : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    x={p.x}
                    y={p.y}
                    fontSize={ring.fontSize}
                    style={upright}
                  >
                    {label}
                  </text>
                );
              })}
            </g>
          );
        })}

        {/* 가운데에서 퍼져 나가는 물결. 여기를 누르라는 말을 글자 대신 빛으로 한다. */}
        {hubGlow && <circle className={styles.hubHalo} cx={C} cy={C} r={30} />}
        <circle className={`${styles.hub} ${hubGlow ? styles.hubLit : ''}`} cx={C} cy={C} r={30} />
        {/* 가운데 판이 말씀의 주소를 한 칸씩 완성해 간다.
            여정 화면의 미리보기에서는 손잡이라 "돌리기", 다이얼 앞에 선 순간 책 이름(전도서)이
            드러나고, 열두 칸이 맞으면 장(12)이, 한 칸을 더 밀면 절까지 붙어 12:13이 된다. */}
        {phase === 'turn' ? (
          <text className={`${styles.hubHint} ${hubGlow ? styles.hubHintLit : ''}`} x={C} y={C + 5} textAnchor="middle">
            {onOpen ? '돌리기' : DIAL_STORY.book}
          </text>
        ) : (
          <>
            <text className={styles.hubBook} x={C} y={C - 8} textAnchor="middle">
              {DIAL_STORY.book}
            </text>
            <text className={styles.hubRef} x={C} y={C + 12} textAnchor="middle">
              {phase === 'broken' ? DIAL_STORY.refShort : DIAL_STORY.chapter}
            </text>
          </>
        )}

        {/* 열두 시 표시. 세 링의 점이 여기로 모이면 열린다.
            key가 바뀌면 요소가 새로 그려지면서 걸리는 연출이 처음부터 다시 재생된다. */}
        <path key={detent} className={styles.pointer} d={`M${C} 3 l7 13 h-14 z`} />

        {/* 열두 칸이 다 맞은 순간, 어디로 밀어야 하는지 글자 대신 획으로 가리킨다.
            열두 시에서 한 칸 지난 자리 — 잠시 뒤 13이 앉을 바로 그 자리로 향하는 획이다. */}
        {pushing && (
          <g className={styles.pushArrow} aria-hidden="true">
            <path
              d={`M${slotPoint(0, 150).x} ${slotPoint(0, 150).y} A 150 150 0 0 1 ${slotPoint(1, 150).x} ${
                slotPoint(1, 150).y
              }`}
            />
            <path
              className={styles.pushArrowHead}
              d={`M${slotPoint(1, 150).x - 4} ${slotPoint(1, 150).y - 5} L${slotPoint(1, 150).x + 5} ${
                slotPoint(1, 150).y
              } L${slotPoint(1, 150).x - 4} ${slotPoint(1, 150).y + 5} Z`}
              transform={`rotate(${STEP} ${slotPoint(1, 150).x} ${slotPoint(1, 150).y})`}
            />
          </g>
        )}

        {/* 열세 번째 칸. 시계판에 자리가 없으니 테두리 바깥, 열두 시에서 한 칸 지난 자리에 놓인다. */}
        {phase === 'broken' && (
          <>
            <line
              className={styles.spillTick}
              x1={slotPoint(1, RIM + 1).x}
              y1={slotPoint(1, RIM + 1).y}
              x2={slotPoint(1, RIM + 5).x}
              y2={slotPoint(1, RIM + 5).y}
            />
            <text className={styles.spill} x={slotPoint(1, 157).x} y={slotPoint(1, 157).y} textAnchor="middle">
              {THIRTEENTH}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
