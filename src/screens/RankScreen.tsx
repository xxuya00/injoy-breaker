import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { firebaseEnabled, subscribeLeaderboard, type LeaderboardEntry } from '../lib/sync';
import { PRAYER_GROUPS } from '../data/prayerGroups';
import BackLink from '../components/BackLink';
import { useScrollFit } from '../components/FitBox';
import styles from './RankScreen.module.css';

interface GroupTotal {
  group: string;
  score: number;
  members: number;
}

export default function RankScreen() {
  // 조 수에 따라 목록 길이가 달라져도 제목 크기는 그대로여야 한다.
  useScrollFit();
  const { goScreen } = useApp();
  const toast = useToast();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!firebaseEnabled) return;
    const unsubscribe = subscribeLeaderboard(setEntries, () => {
      if (!warnedRef.current) {
        warnedRef.current = true;
        toast('순위판을 불러오지 못했어요. 네트워크를 확인해주세요');
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals: GroupTotal[] = PRAYER_GROUPS.map((group) => {
    const members = entries.filter((e) => e.group === group);
    return {
      group,
      score: members.reduce((sum, m) => sum + m.score, 0),
      members: members.length,
    };
  }).sort((a, b) => b.score - a.score);

  const topScore = Math.max(1, ...totals.map((t) => t.score));

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Team Rally</div>
      <h1>조별 순위판</h1>
      <p className="muted" style={{ marginBottom: 6 }}>
        조원이 자물쇠를 깰 때마다 조 점수가 함께 올라가요. 실시간으로 갱신됩니다.
      </p>
      <hr className="divider" />
      <div>
        {totals.map((t, i) => (
          <div className={styles.rankItem} key={t.group}>
            <span className={styles.no}>{i + 1}</span>
            <div className={styles.groupInfo}>
              <div className={styles.groupRow}>
                <span className={styles.nick}>{t.group}</span>
                <span className={styles.pt}>
                  {t.score} pt {t.members > 0 && `· ${t.members}명`}
                </span>
              </div>
              <div className={styles.bar}>
                <span className={styles.barFill} style={{ width: `${Math.min(100, (t.score / topScore) * 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="tiny">레크리에이션 등 오프라인 점수는 진행자가 별도로 합산해 안내해요.</p>
    </section>
  );
}
