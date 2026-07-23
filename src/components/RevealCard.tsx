import type { ReactNode } from 'react';
import styles from './RevealCard.module.css';

interface Props {
  pill: string;
  title: string;
  children: ReactNode;
  footnote?: string;
}

export default function RevealCard({ pill, title, children, footnote }: Props) {
  return (
    <div className={styles.reveal}>
      <div className={styles.key}>
        <svg viewBox="0 0 24 24">
          <circle cx="8" cy="15" r="5" />
          <path d="M11.5 11.5L20 3M17 6l2 2M14 9l2 2" />
        </svg>
      </div>
      <span className="pill">{pill}</span>
      <h2 style={{ margin: '12px 0 8px' }}>{title}</h2>
      <div style={{ color: '#c9d2f2', fontSize: 15, marginBottom: 8 }}>{children}</div>
      {footnote && <p className="muted" style={{ fontSize: 12.5 }}>{footnote}</p>}
    </div>
  );
}
