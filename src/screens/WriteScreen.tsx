import { useState } from 'react';
import { useToast } from '../context/ToastContext';

export default function WriteScreen() {
  const toast = useToast();
  const [copy, setCopy] = useState('');
  const [confront, setConfront] = useState('');

  return (
    <section>
      <div className="eyebrow">Day 2 · Stillness</div>
      <h1>숲의 기록</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        계곡과 숲을 걸으며 마주한 것을 남겨보세요. 빠르게 넘길 필요 없어요. 이 화면엔 순위도, 타이머도 없습니다.
      </p>

      <h2 style={{ fontSize: 15, color: 'var(--gold-soft)' }}>① 필사</h2>
      <p className="muted" style={{ marginBottom: 8 }}>
        전도서 2:11을 눌러 그대로 옮겨 적어보세요.
      </p>
      <div className="verse" style={{ marginTop: 6, marginBottom: 10 }}>
        "내가 나의 손으로 한 모든 일과 수고를 돌아본즉 모든 것이 헛되어 바람을 잡으려는 것이며 해 아래에서 무익한 것이로다"
      </div>
      <textarea
        className="field"
        style={{ minHeight: 120, resize: 'none', lineHeight: 1.7 }}
        placeholder="여기에 옮겨 적어보세요…"
        value={copy}
        onChange={(e) => setCopy(e.target.value)}
      />

      <h2 style={{ fontSize: 15, color: 'var(--gold-soft)', marginTop: 8 }}>② 마주하기</h2>
      <p className="muted" style={{ marginBottom: 8 }}>
        하나님보다 더 사랑했던 것, 내 안의 자물쇠는 무엇인가요?
      </p>
      <textarea
        className="field"
        style={{ minHeight: 120, resize: 'none', lineHeight: 1.7 }}
        placeholder="아무도 보지 않아요. 솔직하게…"
        value={confront}
        onChange={(e) => setConfront(e.target.value)}
      />

      <button className="btn" onClick={() => toast('기록이 저장됐어요')}>
        기록 저장
      </button>
      <p className="tiny">저장한 기록은 마지막 날 결단 카드에서 다시 만나요.</p>
    </section>
  );
}
