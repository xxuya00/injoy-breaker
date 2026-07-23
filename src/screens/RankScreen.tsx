import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { fetchLeaderboard, gasEnabled, type LeaderboardEntry } from '../lib/gas';
import Sheet from '../components/Sheet';
import BackLink from '../components/BackLink';
import styles from './RankScreen.module.css';

const SEED: LeaderboardEntry[] = [
  { id: 'seed-1', nick: '양파링', score: 1240 },
  { id: 'seed-2', nick: 'J.KIM', score: 1180 },
  { id: 'seed-3', nick: '코난', score: 1090 },
  { id: 'seed-4', nick: '성실이', score: 970 },
  { id: 'seed-5', nick: '라온', score: 820 },
];

export default function RankScreen() {
  const { state, goScreen } = useApp();
  const toast = useToast();
  const [entries, setEntries] = useState<LeaderboardEntry[]>(SEED);
  const [alertOpen, setAlertOpen] = useState(false);
  const [seconds, setSeconds] = useState(15);
  const [picked, setPicked] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const warnedRef = useRef(false);
  useEffect(() => {
    if (!gasEnabled || state.screen !== 'rank') return;
    let cancelled = false;
    const poll = () => {
      fetchLeaderboard()
        .then((data) => {
          if (!cancelled && data.length) setEntries(data);
        })
        .catch(() => {
          if (!cancelled && !warnedRef.current) {
            warnedRef.current = true;
            toast('순위판을 불러오지 못했어요. 네트워크를 확인해주세요');
          }
        });
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.screen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const withMe = state.id && !entries.find((e) => e.id === state.id)
    ? [...entries, { id: state.id, nick: state.nick || '나', score: Object.keys(state.opened).length, me: true } as LeaderboardEntry & { me: boolean }]
    : entries;
  const sorted = [...withMe].sort((a, b) => b.score - a.score);

  const startAlert = () => {
    setAlertOpen(true);
    setPicked(null);
    setSeconds(15);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setAlertOpen(false);
          toast('시간 종료!');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const answer = (ok: boolean) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPicked(ok);
    setTimeout(() => {
      setAlertOpen(false);
      toast(ok ? '정답! +80pt · 3등으로 올라왔어요' : '아쉬워요. 다음 알림을 노려요');
    }, 600);
  };

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Speed Rounds</div>
      <h1>돌발 순위판</h1>
      <p className="muted" style={{ marginBottom: 6 }}>
        알림이 뜨면 다 함께, 가장 빨리 맞춘 순서대로. 이건 경쟁— 깨어 있는지 확인하는 훈련이에요.
      </p>
      <hr className="divider" />
      <div>
        {sorted.map((r, i) => (
          <div className={styles.rankItem} key={r.id}>
            <span className={styles.no}>{i + 1}</span>
            <span className={styles.nick} style={(r as { me?: boolean }).me ? { color: 'var(--gold)' } : undefined}>
              {r.nick}
              {(r as { me?: boolean }).me ? ' · 나' : ''}
            </span>
            <span className={styles.pt}>{r.score} pt</span>
          </div>
        ))}
      </div>
      <div style={{ height: 20 }} />
      <button className="btn ghost" onClick={startAlert}>
        ⚡ 돌발 퀴즈 시뮬레이션
      </button>
      <p className="tiny">실제 수련회에선 진행자가 아무 때나 이 알림을 띄웁니다.</p>

      <Sheet open={alertOpen} onClose={() => setAlertOpen(false)}>
        <span className="pill alert">⚡ 돌발 · 60초</span>
        <span className={styles.timer}>0:{String(seconds).padStart(2, '0')}</span>
        <h2 style={{ margin: '6px 0 16px', clear: 'both' }}>
          "전도서"는 히브리어로 '모으는 자'라는 뜻이다. 참일까?
        </h2>
        <button className={`opt ${picked === true ? 'correct' : ''}`} onClick={() => answer(true)}>
          참
        </button>
        <button className={`opt ${picked === false ? 'wrong' : ''}`} onClick={() => answer(false)}>
          거짓
        </button>
      </Sheet>
    </section>
  );
}
