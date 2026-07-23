import { useState } from 'react';
import { useApp } from '../context/AppContext';
import Sheet from '../components/Sheet';
import RevealCard from '../components/RevealCard';

export default function DecideScreen() {
  const { state, openLock, setTab } = useApp();
  const [keep, setKeep] = useState('');
  const [done, setDone] = useState(false);

  const finish = () => {
    openLock('d3a');
    setDone(true);
  };

  return (
    <section>
      <div className="eyebrow">Day 3 · Break Through</div>
      <h1>마지막 열쇠</h1>
      <p className="lead" style={{ marginBottom: 18 }}>
        솔로몬이 모든 것을 누린 뒤 남긴 결론입니다.
      </p>
      <div className="decision-card" style={{ marginBottom: 22 }}>
        <div className="eyebrow" style={{ position: 'relative' }}>
          전도서 12:13
        </div>
        <p style={{ fontSize: 17, marginTop: 10, position: 'relative', lineHeight: 1.7 }}>
          "일의 결국을 다 들었으니{' '}
          <b style={{ color: 'var(--gold-soft)' }}>하나님을 경외하고 그의 명령들을 지킬지어다</b> 이것이 모든
          사람의 본분이니라"
        </p>
      </div>

      <h2 style={{ fontSize: 16 }}>돌아가서, 나는</h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        깨어난 집중으로 세상에서 지켜낼 한 가지를 적어요.
      </p>
      <textarea
        className="field"
        style={{ minHeight: 120, resize: 'none', lineHeight: 1.7 }}
        placeholder="예: 아침에 눈뜨자마자 폰 대신 말씀 한 구절…"
        value={keep}
        onChange={(e) => setKeep(e.target.value)}
      />
      <button className="btn" onClick={finish}>
        결단 카드 완성
      </button>

      <Sheet open={done} onClose={() => setDone(false)}>
        <RevealCard pill="마지막 열쇠 · 획득" title={`${state.nick}, 당신은 돌파했습니다`}>
          솔로몬이 모든 것 끝에 찾은 열쇠는 <b style={{ color: 'var(--gold-soft)' }}>하나님을 경외함</b>이었습니다.
          이제 그 열쇠는 당신의 것입니다.
        </RevealCard>
        <div style={{ height: 20 }} />
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
