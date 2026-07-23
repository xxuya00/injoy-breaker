import { useMemo } from 'react';
import { SCHEDULE, SCHEDULE_ROWS, type ScheduleSegment } from '../data/schedule';
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
            {SCHEDULE_ROWS.map((rowLabel, r) => (
              <tr key={rowLabel}>
                <td className={styles.timeCell}>{rowLabel}</td>
                {SCHEDULE.map((day, d) => {
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
