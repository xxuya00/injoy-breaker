import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { fetchNotices, gasEnabled, type NoticeEntry } from '../lib/gas';
import styles from './NoticeScreen.module.css';

export default function NoticeScreen() {
  const { state } = useApp();
  const toast = useToast();
  const [notices, setNotices] = useState<NoticeEntry[]>([]);
  const warnedRef = useRef(false);

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
        notices.map((n) => (
          <div className={styles.item} key={n.id}>
            <div className={styles.itemTitle}>{n.title}</div>
            <div className={styles.itemBody}>{n.body}</div>
          </div>
        ))
      )}
    </section>
  );
}
