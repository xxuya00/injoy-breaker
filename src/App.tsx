import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
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
import type { ScreenId } from './types';
import styles from './App.module.css';

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
];

function Shell() {
  const { state, setTab } = useApp();
  const showTabbar = state.screen !== 'login' && state.screen !== 'brief';

  return (
    <div className={styles.app}>
      {SCREENS.map(({ id, render }) => (
        <div key={id} className={`${styles.screen} ${state.screen === id ? styles.screenActive : ''}`}>
          {render()}
        </div>
      ))}
      {showTabbar && <TabBar active={state.activeTab} onSelect={setTab} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AppProvider>
  );
}
