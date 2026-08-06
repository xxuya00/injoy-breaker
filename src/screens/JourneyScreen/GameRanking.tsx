import { useEffect, useState } from 'react';
import { subscribeGameLeaderboard, type GameTimeEntry } from '../../lib/sync';
import { formatElapsed, formatPreciseElapsed, isPreciseGame } from './format';
import styles from './JourneyScreen.module.css';

// 시상대(높이가 다른 세 블록)는 자리를 크게 먹으면서 정작 읽어야 할 값 — 이름·시간·힌트 —
// 은 블록 위에 얹힌 잔글씨로 밀려났다. 게다가 기록이 한둘뿐이면 이 빠진 시상대가 된다.
// 순위는 결국 줄 세우기라, 한 줄에 한 명씩 놓는 목록이 짧고 정확하다.
// meId는 아직 등록 전(null)일 수 있다. 그때는 어느 줄과도 같지 않아 내 줄 강조만 빠진다.
export default function GameRanking({ gameId, meId }: { gameId: string; meId?: string | null }) {
  const [entries, setEntries] = useState<GameTimeEntry[]>([]);
  useEffect(() => {
    const unsub = subscribeGameLeaderboard(gameId, setEntries, () => {});
    return unsub;
  }, [gameId]);
  // 아직 아무 기록도 없으면 제목까지 통째로 감춘다. 제목만 남고 아래가 비면 고장난 화면처럼 보인다.
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <div className={styles.sectionLabel}>이 게임 TOP {entries.length}</div>
      <ol className={styles.rankList}>
        {entries.map((entry, i) => (
          <li key={entry.id} className={`${styles.rankRow} ${entry.id === meId ? styles.rankRowMe : ''}`}>
            <span className={styles.rankNum}>{i + 1}</span>
            <span className={styles.rankNick}>{entry.nick}</span>
            {/* 순위를 가른 첫 잣대가 힌트 횟수라, 시간만 보여주면 왜 이 순서인지 알 수 없다. */}
            <span className={styles.rankHints}>힌트 {entry.hints}</span>
            <span className={styles.rankTime}>
              {isPreciseGame(gameId) ? formatPreciseElapsed(entry.elapsedMs) : formatElapsed(entry.elapsedMs)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
