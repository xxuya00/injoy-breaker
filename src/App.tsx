import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider, ToastViewport } from './context/ToastContext';
import { OverlayProvider } from './components/OverlayRoot';
import FitBox from './components/FitBox';
import Preloader from './components/Preloader';
import TabBar from './components/TabBar';
import IntroScreen from './screens/IntroScreen';
import LoginScreen from './screens/LoginScreen';
import BriefScreen from './screens/BriefScreen';
import JourneyScreen from './screens/JourneyScreen';
import IntroSheetScreen from './screens/IntroSheetScreen';
import DecideScreen from './screens/DecideScreen';
import RankScreen from './screens/RankScreen';
import TypeTest from './screens/TypeScreen/TypeTest';
import TypeShare from './screens/TypeScreen/TypeShare';
import ProverbScreen from './screens/TypeScreen/ProverbScreen';
import ScheduleScreen from './screens/ScheduleScreen';
import PrayerScreen from './screens/PrayerScreen';
import QtScreen from './screens/QtScreen';
import NoticeScreen from './screens/NoticeScreen';
import type { ScreenId } from './types';
import styles from './App.module.css';

// 탭바가 없는 화면(intro/login/brief)은 아래 여백을 줄여 그만큼 더 크게 담는다.
const BARE: ScreenId[] = ['intro', 'login', 'brief'];

const SCREENS: { id: ScreenId; render: () => React.ReactNode }[] = [
  { id: 'intro', render: () => <IntroScreen /> },
  { id: 'login', render: () => <LoginScreen /> },
  { id: 'brief', render: () => <BriefScreen /> },
  { id: 'journey', render: () => <JourneyScreen /> },
  { id: 'introsheet', render: () => <IntroSheetScreen /> },
  { id: 'decide', render: () => <DecideScreen /> },
  { id: 'rank', render: () => <RankScreen /> },
  { id: 'type', render: () => <TypeTest /> },
  { id: 'share', render: () => <TypeShare /> },
  { id: 'proverb', render: () => <ProverbScreen /> },
  { id: 'schedule', render: () => <ScheduleScreen /> },
  { id: 'prayer', render: () => <PrayerScreen /> },
  { id: 'qt', render: () => <QtScreen /> },
  { id: 'notice', render: () => <NoticeScreen /> },
];

function Shell() {
  const { state, setTab } = useApp();
  const showTabbar = !BARE.includes(state.screen);
  const [ready, setReady] = useState(false);
  // 개요부터 시작하는 첫 방문에서만 문을 좀 더 오래 닫아둔다(개요로 넘어가는 호흡을 만든다).
  // 이미 등록한 사람이 앱을 다시 열 때는 글꼴만 받고 곧장 지나간다.
  const [gateMs] = useState(() => (state.screen === 'intro' ? 1600 : 400));

  return (
    <div className={styles.app}>
      {!ready && <Preloader minMs={gateMs} onDone={() => setReady(true)} />}
      <OverlayProvider>
        {SCREENS.map(({ id, render }) => (
          <div
            key={id}
            className={[
              styles.screen,
              BARE.includes(id) ? styles.screenBare : '',
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
