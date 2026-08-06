import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { firebaseEnabled, subscribeLeaderboard, type LeaderboardEntry } from '../lib/sync';
import { gasEnabled, fetchTeamBonuses, type TeamBonus } from '../lib/gas';
import { PRAYER_GROUPS } from '../data/prayerGroups';
import BackLink from '../components/BackLink';
import { useFillFit } from '../components/FitBox';
import styles from './RankScreen.module.css';

interface GroupTotal {
  group: string;
  /** 조원들이 자물쇠를 깨서 자동으로 쌓인 점수 */
  earned: number;
  /** 진행자가 시트에서 직접 얹은 점수(음수면 감점) */
  bonus: number;
  bonusNote: string;
  score: number;
  members: number;
}

export default function RankScreen() {
  // 여덟 조는 개수가 정해져 있다. 남는 높이를 아래에 몰아두는 대신 줄 사이로 나눠 주면
  // 세로가 긴 폰에서는 넉넉한 순위판이, SE에서는 지금과 똑같이 촘촘한 순위판이 된다.
  useFillFit();
  const { goScreen } = useApp();
  const toast = useToast();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [bonuses, setBonuses] = useState<Record<string, TeamBonus>>({});
  const warnedRef = useRef(false);
  const warnedBonusRef = useRef(false);

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

  // 진행자가 teamScores 시트에 적은 가감점을 주기적으로 확인한다.
  // 자물쇠 점수는 Firestore가 실시간으로 밀어주지만 이쪽은 구글 시트라 폴링밖에 없다.
  // 레크리에이션 점수를 적자마자 화면 앞에서 결과를 보는 자리라 자물쇠 설정(1분)보다 자주 본다.
  useEffect(() => {
    if (!gasEnabled) return;
    let cancelled = false;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      fetchTeamBonuses()
        .then((map) => {
          if (!cancelled) setBonuses(map);
        })
        // 반복해서 도는 폴링이라 실패할 때마다 토스트를 띄우면 화면을 계속 가린다.
        // 다만 조용히 삼키면 가감점이 통째로 안 붙은 걸 아무도 모르므로 콘솔에는 한 번 남긴다.
        .catch((err) => {
          if (!warnedBonusRef.current) {
            warnedBonusRef.current = true;
            console.warn('[teamScores] 조별 가감점을 불러오지 못했어요 — 자물쇠 점수만 표시됩니다.', err);
          }
        });
    };
    load();
    const interval = setInterval(load, 20000);
    document.addEventListener('visibilitychange', load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  const totals: GroupTotal[] = PRAYER_GROUPS.map((group) => {
    const members = entries.filter((e) => e.group === group);
    const earned = members.reduce((sum, m) => sum + m.score, 0);
    const adjust = bonuses[group];
    const bonus = adjust?.bonus ?? 0;
    return {
      group,
      earned,
      bonus,
      bonusNote: adjust?.note ?? '',
      score: earned + bonus,
      members: members.length,
    };
    // 점수가 같으면 조 번호 순으로 둔다. 정렬이 안정적이지 않으면 폴링이 한 번 돌 때마다
    // 0점끼리 자리를 바꿔서, 아무 일도 없었는데 순위가 요동치는 것처럼 보인다.
  }).sort((a, b) => b.score - a.score || PRAYER_GROUPS.indexOf(a.group) - PRAYER_GROUPS.indexOf(b.group));

  // 막대 길이의 기준. 감점으로 전부 0 이하가 되어도 0으로 나누지 않도록 최소 1을 둔다.
  const topScore = Math.max(1, ...totals.map((t) => t.score));

  // 같은 점수는 같은 등수다. 대회에서 하듯 다음 등수는 그만큼 건너뛴다(1, 1, 3…).
  // 그냥 1~8을 매기면 0점끼리도 순서가 있는 것처럼 보여서, 아직 아무 일도 안 일어났는데
  // 누가 앞선 것처럼 읽힌다. 0점인 조는 아예 등수 대신 줄표를 둔다 —
  // 시작 직후 여덟 조에 "1"이 여덟 번 찍히는 것도 고장난 화면처럼 보이기 때문이다.
  let lastScore: number | null = null;
  let lastRank = 0;
  const ranked = totals.map((t, i) => {
    const rank = lastScore !== null && t.score === lastScore ? lastRank : i + 1;
    lastScore = t.score;
    lastRank = rank;
    return { ...t, rank: t.score === 0 ? null : rank };
  });

  return (
    <section className={styles.wrap}>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Team Rally</div>
      <h1>조별 순위판</h1>
      {/* 여덟 조가 한 화면에 다 들어와야 하는 자리다. 안내는 한 줄로 줄이고, 제목과 목록 사이의
          구분선은 뺐다 — 줄 하나가 아니라 그 위아래 여백까지 스무 남짓을 가져가기 때문이다. */}
      <p className="muted" style={{ marginBottom: 10 }}>
        조원이 자물쇠를 깰 때마다 조 점수가 올라가요.
      </p>
      <div className={styles.list}>
        {ranked.map((t) => (
          <div className={styles.rankItem} key={t.group}>
            <span className={`${styles.no} ${t.rank === null ? styles.noEmpty : ''}`}>{t.rank ?? '–'}</span>
            <div className={styles.groupInfo}>
              <div className={styles.groupRow}>
                <span className={styles.nick}>{t.group}</span>
                <span className={styles.pt}>
                  {t.score} pt{t.members > 0 && ` · ${t.members}명`}
                  {/* 진행자가 얹은 점수는 따로 적어둔다. 총점만 보이면 자물쇠를 몇 개 깼는데
                      점수가 왜 이런지 설명이 안 돼서, 순위판을 못 믿게 된다.
                      줄을 새로 내주면 여덟 조가 한 화면에 안 들어오므로 같은 줄 끝에 잇는다. */}
                  {t.bonus !== 0 && (
                    <span className={styles.split}>
                      {' · '}자물쇠 {t.earned} · 진행자{' '}
                      <b className={t.bonus > 0 ? styles.bonusUp : styles.bonusDown}>
                        {t.bonus > 0 ? `+${t.bonus}` : t.bonus}
                      </b>
                    </span>
                  )}
                </span>
              </div>
              <div className={styles.bar}>
                <span
                  className={styles.barFill}
                  style={{ width: `${Math.max(0, Math.min(100, (t.score / topScore) * 100))}%` }}
                />
              </div>
              {/* 진행자가 사유까지 적어둔 조에만 한 줄 더. 보통은 비어 있다. */}
              {t.bonus !== 0 && t.bonusNote && <div className={styles.bonusNote}>{t.bonusNote}</div>}
            </div>
          </div>
        ))}
      </div>
      <p className={`tiny ${styles.footnote}`}>레크리에이션 등 오프라인 점수는 진행자가 직접 더해요.</p>
    </section>
  );
}
