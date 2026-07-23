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
    id: 'write',
    label: '기록',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 20h16M6 16l9-9 3 3-9 9H6z" />
      </svg>
    ),
  },
  {
    id: 'rank',
    label: '순위',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z" />
      </svg>
    ),
  },
  {
    id: 'decide',
    label: '결단',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 3l2 5 5 .5-4 3.5 1 5-4-2.5L8 20l1-5-4-3.5 5-.5z" />
      </svg>
    ),
  },
  {
    id: 'type',
    label: '유형',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="2.6" />
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
