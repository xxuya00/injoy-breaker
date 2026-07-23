import type { TabId } from '../types';
import styles from './TabBar.module.css';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'journey',
    label: '여정',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    ),
  },
  {
    id: 'qt',
    label: '큐티',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 3v3M5 6l2 2M19 6l-2 2M4 14a8 8 0 1 1 16 0c0 3-2 4-2 6H6c0-2-2-3-2-6z" />
      </svg>
    ),
  },
  {
    id: 'schedule',
    label: '일정',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M4 9h16M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    id: 'prayer',
    label: '기도',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 5h16v10H8l-4 4V5z" />
      </svg>
    ),
  },
  {
    id: 'notice',
    label: '공지',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 4h16v12l-4-2H4z" />
        <path d="M8 9h8M8 12h5" />
      </svg>
    ),
  },
];

interface Props {
  active: TabId;
  onSelect: (tab: TabId) => void;
}

export default function TabBar({ active, onSelect }: Props) {
  return (
    <nav className={styles.tabbar}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${active === tab.id ? styles.tabOn : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
