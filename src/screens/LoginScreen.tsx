import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { generateId } from '../lib/id';
import styles from './LoginScreen.module.css';

export default function LoginScreen() {
  const { enroll, restoreById } = useApp();
  const toast = useToast();
  const [mode, setMode] = useState<'new' | 'restore'>('new');
  const [nick, setNick] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState('');
  const [restoring, setRestoring] = useState(false);

  const handleGenerate = () => {
    const v = nick.trim();
    if (!v) {
      toast('코드네임을 입력해주세요');
      return;
    }
    setPendingId(generateId(v));
  };

  const handleCopy = async () => {
    if (!pendingId) return;
    await navigator.clipboard.writeText(pendingId);
    toast('아이디가 복사됐어요');
  };

  const handleConfirm = () => {
    if (!pendingId) return;
    enroll(nick.trim(), pendingId);
  };

  const handleRestore = async () => {
    const v = restoreId.trim();
    if (!v) {
      toast('아이디를 입력해주세요');
      return;
    }
    setRestoring(true);
    const ok = await restoreById(v);
    setRestoring(false);
    if (!ok) toast('해당 아이디를 찾을 수 없어요');
  };

  if (mode === 'restore') {
    return (
      <section className="center-min">
        <div className={styles.brand}>
          BR<span className={styles.crack}>/</span>EAKER
        </div>
        <div className={styles.tagline}>아이디로 이어하기</div>
        <hr className="divider" />
        <p className="lead" style={{ marginBottom: 22 }}>
          등록할 때 받은 아이디를 입력하면
          <br />
          진행 상황을 그대로 이어갈 수 있어요.
        </p>
        <input
          className="field"
          placeholder="예: 여니-4821"
          value={restoreId}
          onChange={(e) => setRestoreId(e.target.value)}
          maxLength={20}
        />
        <button className="btn" onClick={handleRestore} disabled={restoring}>
          {restoring ? '확인 중…' : '이어하기'}
        </button>
        <button className={styles.switchLink} onClick={() => setMode('new')}>
          처음이신가요? 새로 등록하기
        </button>
      </section>
    );
  }

  return (
    <section className="center-min">
      <div className={styles.brand}>
        BR<span className={styles.crack}>/</span>EAKER
      </div>
      <div className={styles.tagline}>내 안의 우상을 깨뜨리다</div>

      <hr className="divider" />
      <p className="lead" style={{ marginBottom: 22 }}>
        당신과 하나님 사이를 가두는 잠금장치는 얼마나 있나요?
        <br />
        수많은 자극이 참된 평안과 쉼을 가둬 놓았어요.
        <br />
        <span style={{ color: 'var(--gold-soft)' }}>앞으로 3일, 당신은 ??? 브레이커입니다.</span>
      </p>

      {!pendingId ? (
        <>
          <input
            className="field"
            placeholder="코드네임을 입력하세요"
            maxLength={12}
            value={nick}
            onChange={(e) => setNick(e.target.value)}
          />
          <button className="btn" onClick={handleGenerate}>
            브레이커로 등록
          </button>
          <p className="tiny">별명·이니셜 무엇이든 좋아요.</p>
          <button className={styles.switchLink} onClick={() => setMode('restore')}>
            이미 아이디가 있나요? 이어하기
          </button>
        </>
      ) : (
        <>
          <div className={styles.idCard}>
            <span className={styles.idCode}>{pendingId}</span>
            <button className={styles.copyBtn} onClick={handleCopy}>
              복사
            </button>
          </div>
          <p className="tiny" style={{ marginTop: 0, marginBottom: 14 }}>
            이 아이디를 꼭 저장해두세요. 다른 기기에서도 이 아이디로 이어할 수 있어요.
          </p>
          <button className="btn" onClick={handleConfirm}>
            브레이커로 등록
          </button>
        </>
      )}
    </section>
  );
}
