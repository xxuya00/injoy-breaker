import { useMemo } from 'react';
import { MERGED_BLOCKS, SCHEDULE, SCHEDULE_ROWS, type ScheduleSegment } from '../data/schedule';
import { useScrollFit } from '../components/FitBox';
import styles from './ScheduleScreen.module.css';

type Cell = { render: true; span: number; label: string | null } | { render: false };

function expandSegments(segments: ScheduleSegment[]): Cell[] {
  const cells: Cell[] = [];
  segments.forEach((seg) => {
    cells.push({ render: true, span: seg.span, label: seg.label });
    for (let i = 1; i < seg.span; i++) cells.push({ render: false });
  });
  return cells;
}

export default function ScheduleScreen() {
  // 탭으로 오가는 화면은 배율을 1로 고정한다. 내용이 적다고 FitBox가 키워 버리면
  // 탭을 옮길 때마다 같은 제목이 커졌다 작아졌다 해서 다른 앱처럼 보인다.
  useScrollFit();
  const dayCells = useMemo(() => SCHEDULE.map((day) => expandSegments(day.segments)), []);

  return (
    <section>
      <div className="eyebrow">Timetable</div>
      <h1>수련회 일정표</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        3일간의 일정을 미리 확인해보세요. (초안 · 변경될 수 있어요)
      </p>

      <div className={styles.wrap}>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.timeCol} />
            {SCHEDULE.map((day) => (
              <col className={styles.dayCol} key={day.date} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th></th>
              {SCHEDULE.map((day) => (
                <th key={day.date}>
                  {day.date}
                  <br />
                  {day.weekday}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_ROWS.map((rowLabel, r) => {
              const merged = MERGED_BLOCKS.find((b) => b.startRow === r);
              const mergedDates = merged ? new Set(merged.dayDates) : null;
              return (
                <tr key={rowLabel}>
                  <td className={styles.timeCell}>{rowLabel}</td>
                  {merged && mergedDates && (
                    <td className={styles.labelCell} colSpan={mergedDates.size} rowSpan={merged.span}>
                      {merged.label}
                    </td>
                  )}
                  {SCHEDULE.map((day, d) => {
                    if (mergedDates?.has(day.date)) return null;
                    const cell = dayCells[d][r];
                    if (!cell.render) return null;
                    if (cell.label === null) {
                      return <td key={day.date} className={styles.emptyCell} rowSpan={cell.span} />;
                    }
                    return (
                      <td key={day.date} className={styles.labelCell} rowSpan={cell.span}>
                        {cell.label}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
