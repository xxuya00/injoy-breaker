import { useMemo } from 'react';
import { DAY_END, DAY_START, SCHEDULE } from '../data/schedule';
import { useScrollFit } from '../components/FitBox';
import styles from './ScheduleScreen.module.css';

// 한 칸 = 30분. 선은 정시에만 긋는다. 그래서 9:30에 시작하는 일정은 9시 선과 10시 선
// 사이(칸 하나 아래)에서 시작해, 눈으로도 "반 시간 늦게 시작한다"가 보인다.
const SLOT_MIN = 30;

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

const START = toMin(DAY_START);
const END = toMin(DAY_END);
const SLOTS = (END - START) / SLOT_MIN;

// 격자 줄 번호. 1번 줄은 날짜 머리글이 쓰므로 시간 칸은 2번부터 시작한다.
const rowOf = (min: number) => (min - START) / SLOT_MIN + 2;

export default function ScheduleScreen() {
  // 일정표는 화면보다 길다. 배율을 줄여 억지로 담으면 글씨가 안 보이므로 넘치는 만큼 스크롤한다.
  useScrollFit();

  // 정시마다 선 하나와 시각 하나. 맨 윗줄(8시)은 머리글 아래 테두리가 이미 선을 대신하므로
  // 시각만 얹고, 맨 아랫줄(24시)은 표의 바닥 테두리가 끝을 알려주므로 넣지 않는다.
  const ticks = useMemo(() => {
    const out: { min: number; row: number; label: string }[] = [];
    for (let m = START; m < END; m += 60) {
      out.push({ min: m, row: rowOf(m), label: `${m / 60}:00` });
    }
    return out;
  }, []);

  return (
    <section>
      <div className="eyebrow">Timetable</div>
      <h1>일정표</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        INJOY 수련회에 오신 것을 환영하고 축복합니다 (๑'ᵕ'๑)⸝*
      </p>

      <div
        className={styles.board}
        style={{ gridTemplateRows: `auto repeat(${SLOTS}, minmax(var(--slot), auto))` }}
      >
        {/* 날짜 머리글 — 왼쪽 시각 자리는 비워둔다 */}
        <div className={styles.corner} />
        {SCHEDULE.map((day, d) => (
          <div className={styles.dayHead} key={day.date} style={{ gridColumn: d + 2 }}>
            <span className={styles.headDate}>{day.date}</span>
            <span className={styles.headWeekday}>{day.weekday}</span>
          </div>
        ))}

        {/* 날짜를 가르는 세로 선. 칸이 비어 있는 시간대에도 세 날짜가 나뉘어 보이게 한다. */}
        {SCHEDULE.map((day, d) => (
          <div
            key={`col_${day.date}`}
            className={styles.col}
            style={{ gridColumn: d + 2, gridRow: `2 / span ${SLOTS}` }}
          />
        ))}

        {/* 정시 선과 시각. 시각은 선 위에 걸터앉아 "이 선이 몇 시인지"를 가리킨다. */}
        {ticks.map((t) => (
          <span key={`time_${t.min}`} className={styles.tickLabel} style={{ gridRow: t.row }}>
            {t.label}
          </span>
        ))}
        {ticks.map((t) =>
          t.min === START ? null : (
            <span key={`line_${t.min}`} className={styles.tickLine} style={{ gridRow: t.row }} />
          ),
        )}

        {/* 일정 칸. 선보다 나중에 그려져 지나가는 선을 덮는다. */}
        {SCHEDULE.map((day, d) =>
          day.items.map((it) => (
            <div
              key={`${day.date}_${it.start}`}
              className={`${styles.item} ${styles[it.tone]}`}
              style={{
                gridColumn: `${d + 2} / span ${it.spanDays ?? 1}`,
                gridRow: `${rowOf(toMin(it.start))} / ${rowOf(toMin(it.end))}`,
              }}
            >
              <span className={styles.itemLabel}>{it.label}</span>
            </div>
          )),
        )}
      </div>
    </section>
  );
}
