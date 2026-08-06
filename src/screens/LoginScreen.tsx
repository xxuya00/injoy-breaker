import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { PRAYER_GROUPS } from '../data/prayerGroups';
import { looksLikePlayerCode, normalizePlayerCode } from '../lib/playerCode';
import styles from './LoginScreen.module.css';

export default function LoginScreen() {
  const { enroll, restoreById, goScreen } = useApp();
  const toast = useToast();
  const [mode, setMode] = useState<'new' | 'restore'>('new');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [restoring, setRestoring] = useState(false);

  const handleConfirm = async () => {
    const v = name.trim();
    const nv = nickname.trim();
    if (!v) {
      toast('이름을 입력해주세요');
      return;
    }
    if (!nv) {
      toast('닉네임을 입력해주세요');
      return;
    }
    if (!group) {
      toast('조를 선택해주세요');
      return;
    }
    setEnrolling(true);
    await enroll(v, nv, group);
    setEnrolling(false);
  };

  const handleRestore = async () => {
    const v = normalizePlayerCode(restoreCode);
    if (!v) {
      toast('복구 코드를 입력해주세요');
      return;
    }
    // 본명만 적어 넣는 경우가 가장 흔한 실수다. 무엇이 빠졌는지 먼저 알려준다.
    if (!looksLikePlayerCode(v)) {
      toast('복구 코드 형식이 아니에요 (예: 뿌셔뿌셔#428)');
      return;
    }
    setRestoring(true);
    const ok = await restoreById(v);
    setRestoring(false);
    if (!ok) toast('그 코드로 등록된 기록을 찾을 수 없어요');
  };

  if (mode === 'restore') {
    return (
      <section className="center-min">
        <div className={`${styles.brand} ${styles.brandSm}`}>
          BR<span className={styles.crack}>/</span>EAKER
        </div>
        <div className={styles.tagline}>복구 코드로 이어하기</div>
        <hr className="divider" />
        <p className="lead" style={{ marginBottom: 22 }}>
          등록할 때 받은 <b style={{ color: 'var(--accent-soft)' }}>복구 코드</b>로
          <br />
          진행 상황을 이어갈 수 있어요.
          <br />
          <span className="muted">본명으로는 들어올 수 없어요.</span>
        </p>
        <input
          className="field"
          placeholder="예: 뿌셔뿌셔#428"
          value={restoreCode}
          onChange={(e) => setRestoreCode(e.target.value)}
          maxLength={24}
        />
        <button className={`btn sm ${styles.submit}`} onClick={handleRestore} disabled={restoring}>
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
        하나님보다 앞에 둔 것, 하나쯤 있지 않나요?
        <br />
        그 자물쇠를 하나씩 열어 보는 3일.
        <br />
        <span style={{ color: 'var(--accent-soft)' }}>지금부터 당신은 브레이커입니다.</span>
      </p>

      <div className={styles.fieldLabel}>이름 (본명)</div>
      <input
        className="field"
        placeholder="예: 김여니"
        maxLength={20}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <p className="tiny" style={{ margin: '-8px 0 16px' }}>
        기도제목 등에 실명 그대로 쓰여요.
      </p>

      <div className={styles.fieldLabel}>닉네임</div>
      <input
        className="field"
        placeholder="예: 뿌셔뿌셔"
        maxLength={12}
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
      <p className="tiny" style={{ margin: '-8px 0 16px' }}>
        기록판에 보이고, 복구 코드에도 쓰여요.
      </p>

      <div className={styles.fieldLabel}>조 선택</div>
      <div className={styles.groupGrid}>
        {PRAYER_GROUPS.map((g) => (
          <button
            key={g}
            className={`${styles.groupBtn} ${group === g ? styles.groupBtnOn : ''}`}
            onClick={() => setGroup(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <button className={`btn sm ${styles.submit}`} onClick={handleConfirm} disabled={enrolling}>
        {enrolling ? '등록 중…' : '등록'}
      </button>
      <button className={styles.switchLink} onClick={() => setMode('restore')}>
        이미 등록했나요? 복구 코드로 이어하기
      </button>
      <button className={styles.switchLink} onClick={() => goScreen('intro')}>
        수련회 개요 다시 보기
      </button>
    </section>
  );
}
