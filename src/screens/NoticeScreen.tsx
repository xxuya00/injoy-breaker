import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { fetchNotices, gasEnabled, sendMessage, type NoticeEntry } from '../lib/gas';
import { useFillFit } from '../components/FitBox';
import styles from './NoticeScreen.module.css';

export default function NoticeScreen() {
  // 공지가 몇 개 올라올지는 정해져 있지 않다. 남는 높이를 목록 쪽에 몰아주면,
  // 공지가 적은 날에도 아래가 텅 비는 대신 "진행자에게 한마디"가 화면 아래에 앉는다.
  useFillFit();
  const { state } = useApp();
  const toast = useToast();
  const [notices, setNotices] = useState<NoticeEntry[]>([]);
  const warnedRef = useRef(false);
  const [msgText, setMsgText] = useState('');
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
      await sendMessage(state.id ?? '', state.nick || '나', v);
      setMsgText('');
      toast('진행자에게 전달했어요');
    } catch {
      toast('전달에 실패했어요. 다시 시도해주세요');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <div className="eyebrow">Notice</div>
        <h1>공지사항</h1>
        <p className="muted" style={{ marginBottom: 18 }}>
          진행자가 올린 안내를 확인하세요.
        </p>
      </div>

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

      {/* 공지를 읽는 곳과 진행자에게 말을 거는 곳은 하는 일이 다르다. 선 하나로 나누는 대신
          칸 안에 넣어, 위는 읽는 화면 · 아래는 적는 화면으로 눈에 먼저 갈리게 한다. */}
      <div className={styles.report}>
        {/* 위 공지와 같은 짜임(영문 표제 + 제목 + 한 줄 안내)으로 맞춘다. 같은 화면 안에서
            두 덩어리가 같은 규칙으로 서 있어야 나란한 두 가지 일로 읽힌다. */}
        <div className={`eyebrow ${styles.reportEyebrow}`}>Message to Staff</div>
        <h2 className={styles.reportTitle}>진행자에게 한마디</h2>
        {/* "불편한 점·문제 상황"만 적어두면 고장 신고함이 되어, 그 밖의 말은 여기 적는 게
            아닌 줄 알고 삼킨다. 그렇다고 좋은 말을 콕 집어 청하면 칭찬을 구걸하는 꼴이라,
            무엇이든 괜찮다는 것만 말하고 종류는 고르지 않는다. */}
        <p className={`muted ${styles.reportNote}`}>
          진행자만 확인해요. 불편한 점이든 하고 싶은 말이든 편하게 남겨주세요.
        </p>
        {/* 적는 칸은 넉넉하게, 보내는 버튼은 작게. 몇 줄이나 적어도 되는지는 칸의 크기가 말해준다 —
            칸이 두 줄만 하고 버튼이 크면 한마디만 적고 마는 자리로 읽힌다. */}
        <textarea
          className="field"
          style={{ minHeight: 132, resize: 'none', marginBottom: 10 }}
          placeholder="예: 3동 화장실 물이 안 나와요"
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
        />
        <div className={styles.reportSubmit}>
          <button className="btn xs" onClick={submitMessage} disabled={sending || !msgText.trim()}>
            {sending ? '전달 중…' : '전달'}
          </button>
        </div>
      </div>
    </section>
  );
}
