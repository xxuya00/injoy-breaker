import { useEffect, useRef, useState } from 'react';
import { SHARD_WORD } from '../../data/locks';
import type { MissionAnswers } from '../../lib/sync';
import type { LockItem } from '../../types';
import styles from './JourneyScreen.module.css';

// 알에서 떨어져 나온 껍질 조각. 크기도 변 수도 저마다 달라서, 같은 도장을 여섯 번 찍은 게
// 아니라 실제로 한 알이 깨져 나온 파편들로 보인다.
// cx·cy는 그 조각에 새길 글자가 앉을 자리다. 도형마다 무게중심이 달라서 상자 한가운데(12,12)에
// 두면 어떤 조각에서는 글자가 가장자리에 걸친다.
const SHARD_SHAPES = [
  { d: 'M12,1 L22,7 L19,18 L7,22 L2,12 Z', cx: 12.4, cy: 12 },
  { d: 'M3,5 L15,2 L22,11 L11,22 L2,15 Z', cx: 11, cy: 11.4 },
  { d: 'M6,2 L21,6 L22,17 L10,22 L2,13 Z', cx: 12.2, cy: 12 },
  { d: 'M2,10 L11,2 L22,9 L17,21 L6,19 Z', cx: 11.8, cy: 12.2 },
  { d: 'M10,1 L22,10 L12,23 L4,11 Z', cx: 12, cy: 11.6 },
  { d: 'M2,7 L14,3 L22,14 L13,20 L5,16 Z', cx: 11.4, cy: 12 },
];
// 조각에 새기는 글자의 실제 크기(px). 조각마다 크기가 달라서, 그림 좌표(24칸)로 환산해
// 어느 조각에 새기든 글자만은 같은 크기로 서게 한다 — 여섯 글자가 한 말이라 크기가 흔들리면 안 된다.
const SHARD_CHAR_PX = 15;

// 몇 번째 조각이고 어느 자리였는지는 aria-label과, 조각을 눌러 연 미션·기록 화면이 말해준다.
// 조각 옆에 번호를 붙여봤지만 그 숫자가 뜻하는 게 없었다 — 순서대로 찾는 것도 아니고
// 자리 이름도 아니어서 걷어냈다. 그 자리에 지금 들어가 있는 건 "초심을 찾아서" 여섯 글자다.
const SHARD_ORDINALS = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째', '여섯 번째'];

// 조각이 알 좌우에 세 개씩 자로 잰 듯 줄 서 있으면 깨진 껍질이 아니라 목록으로 보인다.
// 그래서 알 둘레 아무 데나 흩어 놓는다. x·y는 알 중심에서 떨어진 거리의 배수이고(실제 px는
// CSS의 --shard-x/--shard-y가 기기 폭에 맞춰 정한다), 기울기와 크기도 조각마다 어긋나게 둔다.
// 자리는 left/top으로 잡고 기울기는 아이콘에만 준다 — 조각이 튀어나오는 연출(shardFly)이
// transform을 쓰고 있어서, 자리까지 transform으로 잡으면 서로 덮어쓴다.
const SHARD_SCATTER = [
  { x: -1.12, y: -0.72, rot: -22, size: 46 },
  { x: 1.06, y: -0.86, rot: 27, size: 36 },
  { x: -1.26, y: 0.14, rot: 13, size: 34 },
  { x: 1.2, y: -0.04, rot: -31, size: 52 },
  { x: -0.92, y: 0.9, rot: 36, size: 40 },
  { x: 1.0, y: 0.82, rot: -11, size: 44 },
];

// QR을 찾으면 알에 금이 가고, 그 자리에서 껍질 조각 하나가 튀어나와 알 둘레에 흩어져 붙는다.
// 찾은 조각이 곧 기록의 손잡이라 목록을 따로 펼칠 일이 없다.
// 아직 못 찾은 조각은 자리조차 없다 — 빈 칸 여섯 개가 미리 서 있으면 "찾아냈다"가
// "칸을 채웠다"로 바뀌고, 남은 개수까지 세어 보여서 찾는 재미가 먼저 닳는다.
// 기록까지 남기면 조각에 불이 들어온다.
export default function EggStage({
  items,
  answers,
  opened,
  onWrite,
  onRead,
  children,
}: {
  items: LockItem[];
  answers: MissionAnswers;
  opened: Record<string, boolean>;
  onWrite: (item: LockItem) => void;
  onRead: (item: LockItem) => void;
  children: React.ReactNode;
}) {
  // 방금 찾은 조각 하나만 튀어나오는 걸 보여준다. 화면에 들어올 때마다 여섯 개가 전부
  // 다시 튀면 처음 온 사람과 다 찾은 사람이 같은 장면을 보게 된다.
  const foundIds = items.filter((i) => opened[i.id]).map((i) => i.id);
  const prevIds = useRef(foundIds);
  const [freshId, setFreshId] = useState<string | null>(null);
  useEffect(() => {
    const added = foundIds.find((id) => !prevIds.current.includes(id));
    prevIds.current = foundIds;
    if (!added) return;
    setFreshId(added);
    const t = setTimeout(() => setFreshId(null), 900);
    return () => clearTimeout(t);
    // foundIds는 매 렌더 새 배열이라 join한 값으로 비교한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foundIds.join(',')]);

  // 여섯 조각을 다 찾으면 흩어져 있던 글자가 "초심을 찾아서" 한 말이 된다. 그때 여섯 글자에
  // 차례로 불이 들어와, 조각을 다 모았다는 걸 개수가 아니라 읽히는 말로 알린다.
  const allFound = items.every((i) => opened[i.id]);

  return (
    <div className={`${styles.eggStage} ${allFound ? styles.eggStageDone : ''}`}>
      <div className={styles.eggSlot}>{children}</div>
      {items.map((item, idx) => {
        // 못 찾은 조각은 아예 그리지 않는다. 자리만 비워두는 게 아니라 없는 것이다.
        if (!opened[item.id]) return null;
        const answered = Boolean(answers[item.id]);
        const scatter = SHARD_SCATTER[idx % SHARD_SCATTER.length];
        const shape = SHARD_SHAPES[idx % SHARD_SHAPES.length];
        const char = SHARD_WORD[idx % SHARD_WORD.length];
        return (
          <button
            key={item.id}
            className={[styles.shard, answered ? styles.shardOn : '', freshId === item.id ? styles.shardFly : '']
              .filter(Boolean)
              .join(' ')}
            style={
              {
                '--x': scatter.x,
                '--y': scatter.y,
                '--rot': `${scatter.rot}deg`,
                '--shard-size': `${scatter.size}px`,
                '--i': idx,
              } as React.CSSProperties
            }
            onClick={() => (answered ? onRead(item) : onWrite(item))}
            // 눈에는 조각 모양과 글자만 보이지만, 화면을 읽어주는 기기에는 어느 자리인지까지 말해준다.
            aria-label={`${SHARD_ORDINALS[idx]} 조각 ${char} · ${item.name} · ${answered ? '기록함' : '기록하기'}`}
          >
            <svg className={styles.shardIcon} viewBox="0 0 24 24">
              <path d={shape.d} />
              {/* 조각은 저마다 기울어 있지만 글자는 똑바로 서 있어야 읽힌다.
                  그래서 조각에 준 기울기를 글자에서만 제자리로 되돌린다(TimeDial의 링 글자와 같은 방식). */}
              <text className={styles.shardChar} x={shape.cx} y={shape.cy} fontSize={(SHARD_CHAR_PX * 24) / scatter.size}>
                {char}
              </text>
            </svg>
          </button>
        );
      })}
    </div>
  );
}
