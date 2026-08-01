import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react';
import type { AppState, Day, ScreenId, TabId } from '../types';
import { loadLastId, loadState, saveLastId, saveState, loadGroup, saveGroup, clearLocalPlayer } from '../lib/storage';
import { gasEnabled, loadRemoteProgress, saveRemoteProgress } from '../lib/gas';
import { saveRemoteProgress as saveLeaderboardScore } from '../lib/sync';
import { useToast } from './ToastContext';

const TAB_SCREEN: Record<TabId, ScreenId> = {
  journey: 'journey',
  schedule: 'schedule',
  prayer: 'prayer',
  qt: 'qt',
  notice: 'notice',
};

type Action =
  | { type: 'ENROLL'; id: string; nick: string; nickname: string }
  | { type: 'RESTORE'; state: Partial<AppState> & { id: string; nick: string } }
  | { type: 'RESET' }
  | { type: 'GO_SCREEN'; screen: ScreenId }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SELECT_DAY'; day: Day }
  | { type: 'OPEN_LOCK'; id: string };

const initialState: AppState = {
  id: null,
  nick: '',
  nickname: '',
  day: 1,
  opened: {},
  screen: 'login',
  activeTab: 'journey',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ENROLL':
      return { ...state, id: action.id, nick: action.nick, nickname: action.nickname, screen: 'brief' };
    case 'RESTORE':
      return { ...state, ...action.state, screen: 'journey', activeTab: 'journey' };
    case 'RESET':
      return initialState;
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
  enroll: (name: string, nickname: string, group: string, id: string) => void;
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
  // 이어하기(lastId) 복원 중에는 구글 시트 조회가 끝나기 전까지 아무 것도 시트에 다시 쓰지 않는다.
  // 안 그러면 로컬 캐시로 보여준 화면이 그대로 저장 이펙트를 타면서, 관리자가 시트에서 지운 기록을
  // (조회 응답이 늦게 와서) 다시 만들어버리는 경합이 생길 수 있다. 이어할 게 없으면 바로 true.
  const [hydrated, setHydrated] = useState(() => !loadLastId());

  // resume session on load.
  // 클리어 여부(opened)의 기준은 항상 구글 시트(진짜 DB)다. 로컬 캐시는 시트 응답이 오기 전까지
  // 화면을 빨리 보여주기 위한 임시값일 뿐이고, 시트 응답이 오면 그 값으로 완전히 덮어쓴다.
  // 시트에 그 id의 기록이 아예 없으면(관리자가 지웠거나 처음부터 없던 id) 로그인 정보를 포함해
  // 이 기기에 남아있던 캐시도 전부 초기화한다.
  useEffect(() => {
    const lastId = loadLastId();
    if (!lastId) return;
    const local = loadState(lastId);
    if (local) {
      dispatch({ type: 'RESTORE', state: { ...local, id: lastId } });
    }
    if (!gasEnabled) {
      setHydrated(true);
      return;
    }
    loadRemoteProgress(lastId)
      .then((remote) => {
        if (!remote) {
          clearLocalPlayer(lastId);
          dispatch({ type: 'RESET' });
          return;
        }
        if (remote.group) saveGroup(remote.group);
        dispatch({
          type: 'RESTORE',
          state: {
            id: lastId,
            nick: remote.nick,
            nickname: remote.nickname || '',
            day: (remote.day as Day) || 1,
            opened: remote.opened || {},
          },
        });
      })
      .catch(() => {
        // 네트워크 오류 등 조회 실패는 조용히 무시 (로컬 데이터로 계속 진행, 초기화하지 않음)
      })
      .finally(() => setHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist on every change once we have an id — 단, 시트 조회가 끝나 hydrated된 뒤부터만.
  useEffect(() => {
    if (!state.id || !hydrated) return;
    saveState(state.id, state);
    const group = loadGroup() ?? undefined;
    saveRemoteProgress(state.id, state.nick, state.day, state.opened, state.nickname, group).catch(() => {
      toast('저장에 실패했어요. 네트워크를 확인해주세요');
    });
    // 실시간 순위판(70명 동시 접속에도 안정적)을 위해 점수만 별도로 Firestore에도 기록한다.
    saveLeaderboardScore(state.id, state.nick, state.day, state.opened).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hydrated]);

  const enroll = (name: string, nickname: string, group: string, id: string) => {
    saveLastId(id);
    saveGroup(group);
    dispatch({ type: 'ENROLL', id, nick: name, nickname });
  };

  const restoreById = async (id: string): Promise<boolean> => {
    const local = loadState(id);
    let remote: Awaited<ReturnType<typeof loadRemoteProgress>> = null;
    let remoteFetchFailed = false;
    if (gasEnabled) {
      try {
        remote = await loadRemoteProgress(id);
      } catch {
        remoteFetchFailed = true;
        toast('네트워크 오류로 이어하기에 실패했어요');
      }
      // 시트 조회에 성공했는데 기록이 없다면 유효하지 않은 id다 — 로컬 캐시가 있어도 신뢰하지 않는다.
      if (!remoteFetchFailed && !remote) return false;
    }
    if (!local && !remote) return false;
    saveLastId(id);
    if (remote?.group) saveGroup(remote.group);
    dispatch({
      type: 'RESTORE',
      state: {
        id,
        nick: remote?.nick ?? local?.nick ?? '',
        nickname: remote?.nickname ?? local?.nickname ?? '',
        day: ((remote?.day ?? local?.day ?? 1) as Day),
        opened: remote ? remote.opened : local?.opened ?? {},
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
