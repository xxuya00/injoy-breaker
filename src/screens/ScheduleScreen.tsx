import { SCHEDULE } from '../data/schedule';
import styles from './ScheduleScreen.module.css';

export default function ScheduleScreen() {
  return (
    <section>
      <div className="eyebrow">Timetable</div>
      <h1>수련회 일정표</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        3일간의 일정을 미리 확인해보세요. (초안 · 변경될 수 있어요)
      </p>

      {SCHEDULE.map((day) => (
        <div className={styles.dayCard} key={day.date}>
          <div className={styles.dayHead}>
            <span className={styles.dayDate}>{day.date}</span>
            <span className={styles.dayWeekday}>{day.weekday}</span>
          </div>
          {day.blocks.map((b, i) => (
            <div className={styles.block} key={i}>
              <div className={styles.blockTime}>{b.time}</div>
              <div className={styles.blockLabel}>{b.label}</div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
