import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { VOW_PROMPT, pickWelcomeVerse } from '../data/intro';
import styles from './BriefScreen.module.css';

export default function BriefScreen() {
  const { state, setVow, setTab } = useApp();
  const toast = useToast();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  // 이 화면은 등록 전부터 떠 있어(App이 모든 화면을 미리 그린다) 복구 코드가 생긴 뒤에 다시 고른다.
  const welcome = useMemo(() => pickWelcomeVerse(state.id ?? ''), [state.id]);

  const copyCode = async () => {
    if (!state.id) return;
    try {
      await navigator.clipboard.writeText(state.id);
      setCopied(true);
      toast('복구 코드를 복사했어요');
    } catch {
      // 클립보드를 막아둔 브라우저도 있다. 코드는 화면에 그대로 보이므로 적어두면 된다.
      toast('복사가 안 됐어요. 코드를 직접 적어두세요');
    }
  };

  const start = () => {
    const v = text.trim();
    if (!v) {
      toast('나의 다짐을 한 줄이라도 적어주세요');
      return;
    }
    setVow(v);
    setTab('journey');
  };

  return (
    <section>
      <div className="eyebrow">Mission Briefing</div>
      <h1 className={styles.title}>Breaker, {state.nickname}</h1>

      <div className="verse">
        "{welcome.verse}"
        <br />
        <span className="muted" style={{ fontStyle: 'normal' }}>
          — {welcome.ref}
        </span>
      </div>

      <h2 style={{ fontSize: 'var(--fs-lg)', marginTop: 18 }}>{VOW_PROMPT.label}</h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        {VOW_PROMPT.question}
        <br />
        {VOW_PROMPT.hint}
      </p>
      <textarea
        className="field"
        style={{ minHeight: 128, resize: 'none', lineHeight: 1.7 }}
        placeholder={VOW_PROMPT.placeholder}
        maxLength={300}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className={styles.codeCard}>
        <div className={styles.codeLabel}>내 복구 코드</div>
        <div className={styles.codeRow}>
          <div className={styles.code}>{state.id}</div>
          <button className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`} onClick={copyCode}>
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
        <p className={styles.codeHint}>
          다시 들어올 때 필요해요. 본명으로는 들어올 수 없어요.
        </p>
      </div>

      <button className="btn" onClick={start}>
        여정 시작하기
      </button>
      <p className="tiny">다짐과 복구 코드는 여정 화면 위쪽 버튼에서 다시 볼 수 있어요.</p>
    </section>
  );
}
