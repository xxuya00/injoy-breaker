import type { TabId } from '../types';
import styles from './TabBar.module.css';

// 여정이 이 여정 앱의 중심이므로 5칸 중 정가운데(3번째)에 둔다.
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
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
    id: 'qt',
    label: '큐티',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 3v3M5 6l2 2M19 6l-2 2M4 14a8 8 0 1 1 16 0c0 3-2 4-2 6H6c0-2-2-3-2-6z" />
      </svg>
    ),
  },
  {
    id: 'journey',
    // 줄 세 개는 어느 앱에서나 "메뉴"로 읽힌다. 여정은 날마다 자물쇠를 여는 미션 화면이라
    // 목표를 세워둔 깃발로 바꿨다(길 모양은 22px에서 그냥 S자로만 보였다).
    label: '여정',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M6.2 21V3.6" />
        <path d="M6.2 4.6h11.3l-2.4 3.6 2.4 3.6H6.2z" />
      </svg>
    ),
  },
  {
    id: 'prayer',
    // 말풍선은 공지와 똑같이 생겨서 둘을 나란히 두면 구분되지 않았다. 모은 두 손으로 바꿨다.
    // 위아래가 다 뾰족하면 나뭇잎으로 읽히므로, 손목 쪽(아래)은 평평하게 끊는다.
    label: '기도',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 12 8.2 8.2a2.7 2.7 0 1 1 3.8-3.8 2.7 2.7 0 1 1 3.8 3.8z" />
        <path d="M4.3 13v2a4 4 0 0 0 4 4h7.4a4 4 0 0 0 4-4v-2" />
      </svg>
    ),
  },
  {
    id: 'notice',
    // 알리는 일이니 확성기. 종은 큐티의 해 모양과 실루엣이 겹쳐 작게 그리면 헷갈린다.
    label: '공지',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3.5 10.6v2.8a1.5 1.5 0 0 0 1.1 1.5l11.6 3.2a.9.9 0 0 0 1.2-.9V6.8a.9.9 0 0 0-1.2-.9L4.6 9.1a1.5 1.5 0 0 0-1.1 1.5z" />
        <path d="M7.6 15.7V19a1.7 1.7 0 0 0 3.4 0v-2.4" />
        <path d="M20.5 10.4v3.2" />
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
