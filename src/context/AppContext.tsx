import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import type { AppState, Day, ScreenId, TabId } from '../types';
import {
  loadLastId,
  loadState,
  saveLastId,
  saveState,
  loadGroup,
  saveGroup,
  clearLocalPlayer,
  hasSeenIntro,
  markIntroSeen,
} from '../lib/storage';
import { makePlayerCode } from '../lib/playerCode';
import { gasEnabled, loadRemoteProgress, saveRemoteProgress } from '../lib/gas';
import { saveRemoteProgress as saveLeaderboardScore, deleteRemotePlayer } from '../lib/sync';
import { useToast } from './ToastContext';

const TAB_SCREEN: Record<TabId, ScreenId> = {
  journey: 'journey',
  schedule: 'schedule',
  prayer: 'prayer',
  qt: 'qt',
  notice: 'notice',
};

type Action =
  | { type: 'ENROLL'; id: string; nick: string; nickname: string; group: string }
  | { type: 'RESTORE'; state: Partial<AppState> & { id: string; nick: string } }
  | { type: 'RESET' }
  | { type: 'GO_SCREEN'; screen: ScreenId }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'SELECT_DAY'; day: Day }
  | { type: 'SET_GROUP'; group: string }
  | { type: 'SET_VOW'; vow: string }
  | { type: 'OPEN_LOCK'; id: string };

const initialState: AppState = {
  id: null,
  nick: '',
  nickname: '',
  group: '',
  vow: '',
  day: 1,
  opened: {},
  screen: 'login',
  activeTab: 'journey',
};

// 이 기기에서 처음 앱을 여는 사람만 개요부터 시작한다.
// 이미 등록했거나(lastId) 개요를 본 적이 있으면 곧장 등록·이어하기 화면으로 간다.
function initScreen(base: AppState): AppState {
  if (loadLastId() || hasSeenIntro()) return base;
  return { ...base, screen: 'intro' };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ENROLL':
      // 다짐은 등록 다음 화면(브리핑)에서 적으므로 여기서는 비워둔 채로 시작한다.
      return {
        ...state,
        id: action.id,
        nick: action.nick,
        nickname: action.nickname,
        group: action.group,
        vow: '',
        screen: 'brief',
      };
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
    case 'SET_GROUP':
      return { ...state, group: action.group };
    case 'SET_VOW':
      return { ...state, vow: action.vow };
    case 'OPEN_LOCK':
      return { ...state, opened: { ...state.opened, [action.id]: true } };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  /** 등록. 닉네임으로 복구 코드를 만들어 그것을 id로 삼는다. */
  enroll: (name: string, nickname: string, group: string) => Promise<void>;
  restoreById: (id: string) => Promise<boolean>;
  goScreen: (screen: ScreenId) => void;
  setTab: (tab: TabId) => void;
  selectDay: (day: Day) => void;
  setGroup: (group: string) => void;
  setVow: (vow: string) => void;
  logout: () => void;
  openLock: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, initScreen);
  const toast = useToast();
  // 이어하기(lastId) 복원 중에는 구글 시트 조회가 끝나기 전까지 아무 것도 시트에 다시 쓰지 않는다.
  // 안 그러면 로컬 캐시로 보여준 화면이 그대로 저장 이펙트를 타면서, 관리자가 시트에서 지운 기록을
  // (조회 응답이 늦게 와서) 다시 만들어버리는 경합이 생길 수 있다. 이어할 게 없으면 바로 true.
  const [hydrated, setHydrated] = useState(() => !loadLastId());
  // 신규 등록으로 시트에 행을 처음 만들 권한. 등록 저장이 성공할 때까지만 켜져 있고,
  // 그 뒤의 진행 저장은 행을 새로 만들지 못한다(관리자가 지운 기록이 되살아나지 않도록).
  const allowCreate = useRef(false);
  // 순위판 쓰기가 삭제보다 늦게 도착해 지운 문서를 되살리는 걸 막기 위해 마지막 쓰기를 붙잡아 둔다.
  const pendingScoreWrite = useRef<Promise<unknown>>(Promise.resolve());

  // 시트(진짜 DB)에서 사라진 참가자를 이 기기와 실시간 순위판에서 완전히 지우고 로그인 화면으로 되돌린다.
  const wipePlayer = (id: string) => {
    clearLocalPlayer();
    allowCreate.current = false;
    dispatch({ type: 'RESET' });
    pendingScoreWrite.current.then(() => deleteRemotePlayer(id).catch(() => {}));
  };

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
      // group이 AppState에 없던 시절에 저장된 캐시는 따로 보관해둔 조를 쓴다.
      dispatch({ type: 'RESTORE', state: { ...local, id: lastId, group: local.group || loadGroup() || '' } });
    }
    if (!gasEnabled) {
      setHydrated(true);
      return;
    }
    loadRemoteProgress(lastId)
      .then((remote) => {
        if (!remote) {
          wipePlayer(lastId);
          return;
        }
        if (remote.group) saveGroup(remote.group);
        dispatch({
          type: 'RESTORE',
          state: {
            id: lastId,
            nick: remote.nick,
            nickname: remote.nickname || '',
            group: remote.group || loadGroup() || '',
            // 다짐은 등록할 때 한 번 쓰고 마는 값이라, 시트가 비어 있으면(옛 기록) 이 기기에 남은 걸 쓴다.
            vow: remote.vow || local?.vow || '',
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
    const group = state.group || loadGroup() || undefined;
    const id = state.id;
    const create = allowCreate.current;
    saveRemoteProgress(id, state.nick, state.day, state.opened, state.nickname, group, create, state.vow)
      .then((res) => {
        // 관리자가 시트에서 이 참가자를 지운 경우. 진행도를 다시 써넣지 않고 이 기기를 정리한다.
        if (res.missing) {
          wipePlayer(id);
          toast('관리자가 기록을 삭제했어요. 처음부터 다시 등록해주세요');
          return;
        }
        if (create) allowCreate.current = false;
      })
      .catch(() => {
        toast('저장에 실패했어요. 네트워크를 확인해주세요');
      });
    // 실시간 순위판(70명 동시 접속에도 안정적)을 위해 점수만 별도로 Firestore에도 기록한다.
    pendingScoreWrite.current = saveLeaderboardScore(id, state.nick, state.day, state.opened).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hydrated]);

  const enroll = async (name: string, nickname: string, group: string) => {
    // 같은 닉네임을 쓴 사람과 숫자까지 겹치면 서로의 기록을 덮어쓴다.
    // 시트에 이미 있는 코드면 다시 뽑는다. 조회 자체가 실패하면(네트워크 등) 등록을 막지 않고 그대로 진행한다.
    let id = makePlayerCode(nickname);
    if (gasEnabled) {
      for (let i = 0; i < 8; i++) {
        try {
          if (!(await loadRemoteProgress(id))) break;
        } catch {
          break;
        }
        id = makePlayerCode(nickname);
      }
    }
    saveLastId(id);
    saveGroup(group);
    // 신규 등록만 시트에 행을 새로 만들 수 있다. 저장이 성공해야 꺼지므로 실패하면 다음 저장에서 다시 시도된다.
    allowCreate.current = true;
    dispatch({ type: 'ENROLL', id, nick: name, nickname, group });
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
        group: remote?.group || local?.group || loadGroup() || '',
        vow: remote?.vow || local?.vow || '',
        day: ((remote?.day ?? local?.day ?? 1) as Day),
        opened: remote ? remote.opened : local?.opened ?? {},
      },
    });
    return true;
  };

  const goScreen = (screen: ScreenId) => dispatch({ type: 'GO_SCREEN', screen });
  const setTab = (tab: TabId) => dispatch({ type: 'SET_TAB', tab });
  const selectDay = (day: Day) => dispatch({ type: 'SELECT_DAY', day });
  // 내 조를 바꾼다. 등록할 때 골라둔 조가 없던 예전 참가자를 위한 보정용이고,
  // 다른 조 기도제목을 구경하는 건 이걸 건드리지 않는다(보기 전용).
  const setGroup = (group: string) => {
    saveGroup(group);
    dispatch({ type: 'SET_GROUP', group });
  };
  const setVow = (vow: string) => dispatch({ type: 'SET_VOW', vow });

  // 이 기기에서만 나간다. 시트와 순위판의 기록은 그대로 두므로, 복구 코드만 있으면 언제든 돌아올 수 있다.
  // (관리자가 참가자를 지웠을 때 쓰는 wipePlayer와 달리 원격 기록을 건드리지 않는다.)
  const logout = () => {
    clearLocalPlayer();
    // 개요를 이미 본 기기라는 표시까지 지워지면 다음에 켤 때 개요가 처음부터 다시 나온다. 그것만 되살린다.
    markIntroSeen();
    allowCreate.current = false;
    dispatch({ type: 'RESET' });
  };

  const openLock = (id: string) => dispatch({ type: 'OPEN_LOCK', id });

  return (
    <AppContext.Provider
      value={{ state, enroll, restoreById, goScreen, setTab, selectDay, setGroup, setVow, logout, openLock }}
    >
      {children}
    </AppContext.Provider>
  );
}
