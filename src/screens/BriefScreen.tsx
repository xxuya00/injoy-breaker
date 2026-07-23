import { useApp } from '../context/AppContext';
import styles from './BriefScreen.module.css';

export default function BriefScreen() {
  const { state, setTab } = useApp();

  return (
    <section>
      <div className="eyebrow">Mission Briefing</div>
      <h1>{state.nick}, 브레이커</h1>
      <div className={styles.briefCard}>
        <div className={styles.q}>사건</div>
        <p style={{ fontSize: 15, marginTop: 2 }}>
          3천 년 전, 솔로몬은 세상 모든 것을 누려보았습니다.{' '}
          <b style={{ color: 'var(--gold-soft)' }}>지혜</b>의 사람이었던 그가, 마지막에 찾아낸{' '}
          <b style={{ color: 'var(--gold-soft)' }}>단 하나의 진리</b>가 무엇인지— 3일 끝에 당신이 직접 열게 됩니다.
        </p>
      </div>

      <div className="verse">
        "눈은 보아도 족함이 없고 귀는 들어도 차지 아니하는도다"
        <br />
        <span className="muted" style={{ fontStyle: 'normal' }}>
          — 전도서 1:8
        </span>
      </div>

      <p className="muted">
        당신은 브레이커로써 임명받았습니다. 임무는 3일간 잠긴 자물쇠를 하나씩 깨는 것.
      </p>

      <div style={{ height: 22 }} />
      <button className="btn" onClick={() => setTab('journey')}>
        여정 시작하기
      </button>
    </section>
  );
}
