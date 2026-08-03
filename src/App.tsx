import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider, ToastViewport } from './context/ToastContext';
import { OverlayProvider } from './components/OverlayRoot';
import FitBox from './components/FitBox';
import TabBar from './components/TabBar';
import LoginScreen from './screens/LoginScreen';
import BriefScreen from './screens/BriefScreen';
import JourneyScreen from './screens/JourneyScreen';
import WriteScreen from './screens/WriteScreen';
import DecideScreen from './screens/DecideScreen';
import RankScreen from './screens/RankScreen';
import TypeTest from './screens/TypeScreen/TypeTest';
import ScheduleScreen from './screens/ScheduleScreen';
import PrayerScreen from './screens/PrayerScreen';
import QtScreen from './screens/QtScreen';
import NoticeScreen from './screens/NoticeScreen';
import type { ScreenId } from './types';
import styles from './App.module.css';

// 탭바가 없는 화면(login/brief)은 아래 여백을 줄여 그만큼 더 크게 담는다.
const SCREENS: { id: ScreenId; render: () => React.ReactNode }[] = [
  { id: 'login', render: () => <LoginScreen /> },
  { id: 'brief', render: () => <BriefScreen /> },
  { id: 'journey', render: () => <JourneyScreen /> },
  { id: 'write', render: () => <WriteScreen /> },
  { id: 'decide', render: () => <DecideScreen /> },
  { id: 'rank', render: () => <RankScreen /> },
  { id: 'type', render: () => <TypeTest /> },
  { id: 'schedule', render: () => <ScheduleScreen /> },
  { id: 'prayer', render: () => <PrayerScreen /> },
  { id: 'qt', render: () => <QtScreen /> },
  { id: 'notice', render: () => <NoticeScreen /> },
];

function Shell() {
  const { state, setTab } = useApp();
  const showTabbar = state.screen !== 'login' && state.screen !== 'brief';

  return (
    <div className={styles.app}>
      <OverlayProvider>
        {SCREENS.map(({ id, render }) => (
          <div
            key={id}
            className={[
              styles.screen,
              id === 'login' || id === 'brief' ? styles.screenBare : '',
              state.screen === id ? styles.screenActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <FitBox>{render()}</FitBox>
          </div>
        ))}
        {showTabbar && <TabBar active={state.activeTab} onSelect={setTab} />}
      </OverlayProvider>
      <ToastViewport />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ToastProvider>
  );
}
