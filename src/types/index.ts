export type LockType =
  | 'quiz'
  | 'mission'
  | 'memory'
  | 'tilepuzzle'
  | 'maze'
  | 'combo'
  | 'equation'
  | 'lightsout'
  | 'crossmath'
  | 'codebreak'
  | 'balance'
  | 'reflex'
  | 'locked-until'
  | 'final';

export interface LockItem {
  id: string;
  name: string;
  sub: string;
  type: LockType;
  q?: string;
  opts?: string[];
  answer?: number;
  reveal?: string;
  hint?: string;
  pill?: string;
}

export interface DayData {
  caption: string;
  items: LockItem[];
}

export type Day = 1 | 2 | 3;

export type ScreenId =
  | 'intro'
  | 'login'
  | 'brief'
  | 'journey'
  | 'write'
  | 'decide'
  | 'rank'
  | 'type'
  | 'share'
  | 'schedule'
  | 'prayer'
  | 'qt'
  | 'notice';
export type TabId = 'journey' | 'schedule' | 'prayer' | 'qt' | 'notice';

export interface AppState {
  id: string | null;
  nick: string;
  nickname: string;
  // 등록할 때 고른 내 조. 기도제목 화면이 이 조로 바로 열린다.
  group: string;
  // 등록할 때 적은 "나의 다짐". 여정 화면에서 언제든 다시 꺼내 볼 수 있고,
  // 기기를 바꿔도 그대로 따라오도록 시트에도 함께 남긴다.
  vow: string;
  day: Day;
  opened: Record<string, boolean>;
  screen: ScreenId;
  activeTab: TabId;
}

export interface RankEntry {
  nick: string;
  pt: number;
  me?: boolean;
}
