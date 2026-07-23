import { useState } from 'react';
import { QT_CONTENT } from '../data/qt';
import { useToast } from '../context/ToastContext';
import styles from './QtScreen.module.css';

export default function QtScreen() {
  const toast = useToast();
  const [day, setDay] = useState<2 | 3>(2);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const content = QT_CONTENT.find((c) => c.day === day)!;

  return (
    <section>
      <div className="eyebrow">Quiet Time</div>
      <h1>아침 큐티</h1>
      <p className="muted" style={{ marginBottom: 4 }}>
        하루를 시작하며 말씀 앞에 잠시 머물러요.
      </p>

      <div className={styles.dayTabRow}>
        {[2, 3].map((d) => (
          <div
            key={d}
            className={`${styles.dayTab} ${day === d ? styles.dayTabOn : ''}`}
            onClick={() => setDay(d as 2 | 3)}
          >
            DAY {d}
          </div>
        ))}
      </div>

      <div className="eyebrow" style={{ marginBottom: 4 }}>
        {content.passageRef}
      </div>
      <div className="verse" style={{ marginTop: 6 }}>
        {content.passageText}
      </div>

      {content.questions.map((q, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14.5, marginBottom: 8 }}>{q}</p>
          <textarea
            className="field"
            style={{ minHeight: 90, resize: 'none' }}
            placeholder="묵상한 내용을 적어보세요"
            value={answers[`${day}_${i}`] ?? ''}
            onChange={(e) => setAnswers((a) => ({ ...a, [`${day}_${i}`]: e.target.value }))}
          />
        </div>
      ))}

      <button className="btn" onClick={() => toast('큐티 기록이 저장됐어요')}>
        기록 저장
      </button>
    </section>
  );
}
