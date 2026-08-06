import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Sheet from '../components/Sheet';
import RevealCard from '../components/RevealCard';
import BackLink from '../components/BackLink';
import TimeDial, { type DialPhase } from '../components/TimeDial';
import { useScrollFit } from '../components/FitBox';
import {
  DIAL_STORY,
  SOLVED,
  hintMove,
  isSolved,
  readMiddle,
  shuffle,
  turn,
  type DialOffsets,
  type RingId,
} from '../data/timeDial';
import { breakChime, unlockChime } from '../lib/feedback';
import { loadMissionAnswers, saveMissionAnswer } from '../lib/sync';
import styles from './DecideScreen.module.css';

/** 이만큼 돌려보고도 못 맞춘 사람에게만 힌트를 내민다. 처음부터 보이면 먼저 눌러보게 된다. */
const HINT_AFTER_TURNS = 12;
/** 마지막 한 칸을 이만큼 밀어보고도 못 민 사람에게만 버튼을 내민다. */
const PUSH_FALLBACK_MS = 12000;

export default function DecideScreen() {
  useScrollFit();
  const { state, openLock, setTab, goScreen } = useApp();
  const toast = useToast();

  // 이미 다이얼을 연 사람은 다시 풀지 않는다. 깨진 원과 자기가 적은 결단을 보러 들어온 것이다.
  const alreadyOpen = !!state.opened['d3a'];
  const [offsets, setOffsets] = useState<DialOffsets>(() => (alreadyOpen ? SOLVED : shuffle()));
  const [phase, setPhase] = useState<DialPhase>(alreadyOpen ? 'broken' : 'turn');
  const [turns, setTurns] = useState(0);
  // 마지막 한 칸을 한참 못 민 상태
  const [pushStuck, setPushStuck] = useState(false);
  const [decision, setDecision] = useState('');
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState(false);

  // 전에 적어둔 결단을 불러와 이어 쓸 수 있게 한다. QR 미션 기록과 같은 곳에 쌓인다.
  useEffect(() => {
    if (!state.id) return;
    let live = true;
    loadMissionAnswers(state.id)
      .then((data) => {
        const prev = data?.[DIAL_STORY.recordId]?.answer;
        if (live && prev) {
          setDecision(prev);
          setSaved(true);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [state.id]);

  // 손가락을 빠르게 그으면 pointermove 한 번에 두 칸 이상이 넘어간다. 그때 화면에 반영되기 전의
  // offsets로 다음 칸을 계산하면 한 칸이 통째로 사라지므로, 지금 값을 ref로 따로 붙잡아 둔다.
  const live = useRef(offsets);

  // 화면들은 앱이 켜질 때 한꺼번에 만들어지는데, 그때는 아직 저장된 진행도가 도착하기 전이다.
  // 그래서 위의 첫 상태(alreadyOpen)만 믿으면, 어제 다이얼을 연 사람이 앱을 다시 켰을 때
  // 섞인 판을 처음부터 다시 풀게 된다. 진행도가 도착해 "이미 열었다"가 되는 순간 깨진 원으로 맞춘다.
  useEffect(() => {
    if (!alreadyOpen) return;
    live.current = SOLVED;
    setOffsets(SOLVED);
    setPhase('broken');
  }, [alreadyOpen]);

  const handleTurn = (ring: RingId, dir: 1 | -1) => {
    const next = turn(live.current, ring, dir);
    live.current = next;
    setOffsets(next);
    setTurns((n) => n + 1);
    if (isSolved(next)) {
      setPhase('solved');
      unlockChime();
    }
  };

  const useHint = () => {
    const move = hintMove(live.current);
    if (!move) return;
    handleTurn(move.ring, move.dir);
    toast('한 칸 대신 돌려드렸어요');
  };

  // 열두 칸을 다 맞추고 나면 손은 다이얼 위에 그대로 둔다. 마지막 한 칸도 지금까지처럼
  // 시계 방향으로 밀어서 넘긴다 — 여기서만 버튼으로 옮겨 타면 손동작의 결이 끊긴다.
  useEffect(() => {
    if (phase !== 'solved') return;
    const t = setTimeout(() => setPushStuck(true), PUSH_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // 원을 깨는 마지막 한 칸. 다이얼을 한 칸 더 민 순간(또는 끝내 못 민 사람이 버튼을 누른 순간).
  const pushThirteenth = () => {
    setPushStuck(false);
    setPhase('broken');
    breakChime();
    openLock('d3a');
  };

  const saveDecision = () => {
    const trimmed = decision.trim();
    if (!trimmed) {
      toast('한 줄만이라도 남겨보세요');
      return;
    }
    if (state.id) {
      saveMissionAnswer(state.id, DIAL_STORY.recordId, DIAL_STORY.recordTitle, trimmed).catch(() => {
        toast('기록 저장에 실패했어요. 네트워크를 확인해주세요');
      });
    }
    setSaved(true);
    setDone(true);
  };

  // 가운데 링을 열두 시부터 시계방향으로 읽은 것. 어긋나 있으면 말이 안 되고, 맞으면 BREAKTHROUGH가 된다.
  const reading = readMiddle(offsets.middle);
  const aligned = [offsets.outer, offsets.middle, offsets.inner].filter((v) => v === 0).length;

  return (
    <section>
      <BackLink onClick={() => goScreen('journey')} />
      <div className="eyebrow">Day 3 · Break Through</div>
      <h1>시간의 다이얼</h1>

      {phase === 'turn' && (
        <p className="lead" style={{ marginBottom: 14 }}>
          하나를 돌리면 다른 하나가 어긋나는 세 개의 고리가 서로 물려 있습니다. 세 고리의 표식을 모두 12시 방향에 모아보세요.
        </p>
      )}

      <TimeDial offsets={offsets} onTurn={handleTurn} phase={phase} onPush={pushThirteenth} />

      {phase === 'turn' && (
        <>
          <div className={styles.status}>
            <div className={styles.pips} aria-label={`링 ${aligned} / 3 정렬됨`}>
              {[offsets.outer, offsets.middle, offsets.inner].map((v, i) => (
                <span key={i} className={`${styles.statusPip} ${v === 0 ? styles.statusPipOn : ''}`} />
              ))}
            </div>
            <span className={`${styles.reading} ${offsets.middle === 0 ? styles.readingOn : ''}`}>{reading}</span>
          </div>
          <p className={styles.verseNote}>
            "바람은 이리 돌며 저리 돌아 그 불던 곳으로 돌아가고" — 전도서 1:6
          </p>
          {turns >= HINT_AFTER_TURNS && (
            <button className="btn ghost" onClick={useHint}>
              한 칸만 도와주세요
            </button>
          )}
        </>
      )}

      {phase === 'solved' && (
        <div className={styles.pushBox}>
          <div className="eyebrow ko">전도서 12장 · 열두 칸이 다 찼습니다</div>
          <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.75, margin: '8px 0 12px' }}>{DIAL_STORY.pushHint}</p>
          <p className={styles.pushNudge}>{DIAL_STORY.pushAction}</p>
          {/* 손으로 미는 게 이 마지막 한 칸의 전부지만, 여기서 막히면 그날의 마지막 문이 안 열린다.
              한참을 밀어보고도 안 된 사람에게만 뒤늦게 버튼을 내민다. */}
          {pushStuck && (
            <button className="btn ghost" onClick={pushThirteenth}>
              잘 안 되면 눌러서 밀기
            </button>
          )}
        </div>
      )}

      {phase === 'broken' && (
        <>
          <div className="decision-card" style={{ marginBottom: 20 }}>
            <div className="eyebrow ko" style={{ position: 'relative' }}>
              {DIAL_STORY.ref}
            </div>
            <p style={{ fontSize: 'var(--fs-lg)', marginTop: 10, position: 'relative', lineHeight: 1.75 }}>
              "일의 결국을 다 들었으니 <b style={{ color: 'var(--accent-soft)' }}>하나님을 경외하고 그의 명령들을 지킬지어다</b>{' '}
              이것이 모든 사람의 본분이니라"
            </p>
          </div>

          <p className={styles.verseNote} style={{ marginBottom: 20 }}>
            시계는 열두 칸에서 끝납니다. <b style={{ color: 'var(--accent)' }}>13</b>은 끝내 원 안에 앉지 못하고 밖으로
            밀려났어요. 해 아래를 아무리 돌아도 일의 결국은 그 원 바깥에 있었습니다.
          </p>

          <h2 style={{ fontSize: 'var(--fs-lg)' }}>돌아가서, 나는</h2>
          <p className="muted" style={{ marginBottom: 10 }}>
            깨어난 집중으로 세상에서 지켜낼 한 가지를 적어요.
          </p>
          <textarea
            className="field"
            style={{ minHeight: 120, resize: 'none', lineHeight: 1.7 }}
            placeholder="예: 아침에 눈뜨자마자 폰 대신 말씀 한 구절…"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
          />
          <button className="btn" onClick={saveDecision}>
            {saved ? '결단 다시 저장' : '결단 카드 완성'}
          </button>
        </>
      )}

      <Sheet open={done} onClose={() => setDone(false)}>
        <RevealCard pill="마지막 열쇠 · 획득" title={`${state.nick}, 당신은 돌파했습니다`}>
          솔로몬이 모든 것 끝에 찾은 열쇠는 <b style={{ color: 'var(--accent-soft)' }}>하나님을 경외함</b>이었습니다. 이제 그
          열쇠는 당신의 것입니다.
        </RevealCard>
        <div className={styles.wordBanner}>{DIAL_STORY.word}</div>
        <button
          className="btn"
          onClick={() => {
            setDone(false);
            setTab('journey');
          }}
        >
          여정 완료
        </button>
      </Sheet>
    </section>
  );
}
