import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { AppState, Day, ScreenId, TabId } from '../types';
import { loadLastId, loadState, saveLastId, saveState } from '../lib/storage';
import { gasEnabled, loadRemoteProgress, saveRemoteProgress } from '../lib/gas';
import { useToast } from './ToastContext';

const TAB_SCREEN: Record<TabId, ScreenId> = {
  journey: 'journey',
  schedule: 'schedule',
  prayer: 'prayer',
  qt: 'qt',
  notice: 'notice',
};

type Action =
  | { type: 'ENROLL'; id: string; nick: string }
  | { type: 'RESTORE'; state: Partial<AppState> & { id: string; nick: string } }
  | { type: 'GO_SCREEN'; screen: ScreenId }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SELECT_DAY'; day: Day }
  | { type: 'OPEN_LOCK'; id: string };

const initialState: AppState = {
  id: null,
  nick: '',
  day: 1,
  opened: {},
  screen: 'login',
  activeTab: 'journey',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ENROLL':
      return { ...state, id: action.id, nick: action.nick, screen: 'brief' };
    case 'RESTORE':
      return { ...state, ...action.state, screen: 'journey', activeTab: 'journey' };
    case 'GO_SCREEN':
      return { ...state, screen: action.screen };
    case 'SET_TAB':
      return { ...state, activeTab: action.tab, screen: TAB_SCREEN[action.tab] };
    case 'SELECT_DAY':
      return { ...state, day: action.day };
    case 'OPEN_LOCK':
      return { ...state, opened: { ...state.opened, [action.id]: true } };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  enroll: (nick: string, id: string) => void;
  restoreById: (id: string) => Promise<boolean>;
  goScreen: (screen: ScreenId) => void;
  setTab: (tab: TabId) => void;
  selectDay: (day: Day) => void;
  openLock: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toast = useToast();

  // resume session on load
  useEffect(() => {
    const lastId = loadLastId();
    if (!lastId) return;
    const local = loadState(lastId);
    if (local) {
      dispatch({ type: 'RESTORE', state: { ...local, id: lastId } });
    }
    if (gasEnabled) {
      loadRemoteProgress(lastId)
        .then((remote) => {
          if (!remote) return;
          dispatch({
            type: 'RESTORE',
            state: {
              id: lastId,
              nick: remote.nick,
              day: (Math.max(local?.day ?? 1, remote.day) as Day) ?? remote.day,
              opened: { ...local?.opened, ...remote.opened },
            },
          });
        })
        .catch(() => {
          // 백그라운드 동기화 실패는 조용히 무시 (로컬 데이터로 계속 진행)
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist on every change once we have an id
  useEffect(() => {
    if (!state.id) return;
    saveState(state.id, state);
    saveRemoteProgress(state.id, state.nick, state.day, state.opened).catch(() => {
      toast('저장에 실패했어요. 네트워크를 확인해주세요');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const enroll = (nick: string, id: string) => {
    saveLastId(id);
    dispatch({ type: 'ENROLL', id, nick });
  };

  const restoreById = async (id: string): Promise<boolean> => {
    const local = loadState(id);
    let remote = null;
    try {
      remote = await loadRemoteProgress(id);
    } catch {
      toast('네트워크 오류로 이어하기에 실패했어요');
    }
    if (!local && !remote) return false;
    saveLastId(id);
    dispatch({
      type: 'RESTORE',
      state: {
        id,
        nick: remote?.nick ?? local?.nick ?? '',
        day: (Math.max(local?.day ?? 1, remote?.day ?? 1) as Day),
        opened: { ...local?.opened, ...remote?.opened },
      },
    });
    return true;
  };

  const goScreen = (screen: ScreenId) => dispatch({ type: 'GO_SCREEN', screen });
  const setTab = (tab: TabId) => dispatch({ type: 'SET_TAB', tab });
  const selectDay = (day: Day) => dispatch({ type: 'SELECT_DAY', day });
  const openLock = (id: string) => dispatch({ type: 'OPEN_LOCK', id });

  return (
    <AppContext.Provider value={{ state, enroll, restoreById, goScreen, setTab, selectDay, openLock }}>
      {children}
    </AppContext.Provider>
  );
}
