import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { fetchNotices, gasEnabled, sendMessage, type NoticeEntry } from '../lib/gas';
import { useScrollFit } from '../components/FitBox';
import styles from './NoticeScreen.module.css';

export default function NoticeScreen() {
  // 공지 개수에 따라 내용 길이가 크게 달라진다. 배율을 1로 고정하지 않으면
  // 공지가 없을 때만 글씨가 커지는, 같은 화면인데 매번 다른 크기가 된다.
  useScrollFit();
  const { state } = useApp();
  const toast = useToast();
  const [notices, setNotices] = useState<NoticeEntry[]>([]);
  const warnedRef = useRef(false);
  const [msgText, setMsgText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!gasEnabled || state.screen !== 'notice') return;
    let cancelled = false;
    const poll = () => {
      fetchNotices()
        .then((data) => {
          if (!cancelled) setNotices(data);
        })
        .catch(() => {
          if (!cancelled && !warnedRef.current) {
            warnedRef.current = true;
            toast('공지사항을 불러오지 못했어요. 네트워크를 확인해주세요');
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

  const submitMessage = async () => {
    const v = msgText.trim();
    if (!v) return;
    setSending(true);
    try {
      await sendMessage(state.id ?? '', state.nick || '나', v, urgent);
      setMsgText('');
      setUrgent(false);
      toast('진행자에게 전달했어요');
    } catch {
      toast('전달에 실패했어요. 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  return (
    <section>
      <div className="eyebrow">Notice</div>
      <h1>공지사항</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        진행자가 올린 안내를 확인하세요.
      </p>

      {notices.length === 0 ? (
        <p className={styles.empty}>아직 공지사항이 없어요.</p>
      ) : (
        <div className={styles.list}>
          {notices.map((n) => (
            <div className={styles.item} key={n.id}>
              <div className={styles.itemTitle}>{n.title}</div>
              <div className={styles.itemBody}>{n.body}</div>
            </div>
          ))}
        </div>
      )}

      <hr className={styles.divider} />
      <div className="eyebrow">Report to Staff</div>
      <h2 style={{ margin: '6px 0 4px' }}>건의 · 신고하기</h2>
      <p className="muted" style={{ marginBottom: 14 }}>
        진행자만 확인해요. 불편한 점이나 문제 상황을 알려주세요.
      </p>
      <textarea
        className="field"
        style={{ minHeight: 90, resize: 'none' }}
        placeholder="예: 3동 화장실 물이 안 나와요"
        value={msgText}
        onChange={(e) => setMsgText(e.target.value)}
      />
      <button className={`opt ${urgent ? 'selected' : ''}`} style={{ marginBottom: 12 }} onClick={() => setUrgent((v) => !v)}>
        🚨 지금 바로 도움이 필요해요
      </button>
      <button className="btn" onClick={submitMessage} disabled={sending || !msgText.trim()}>
        {sending ? '전달하는 중…' : '진행자에게 전달'}
      </button>
    </section>
  );
}
