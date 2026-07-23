export type LockType = 'quiz' | 'mission' | 'math' | 'locked-until' | 'final';

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
}

export interface DayData {
  caption: string;
  items: LockItem[];
}

export type Day = 1 | 2 | 3;

export type ScreenId =
  | 'login'
  | 'brief'
  | 'journey'
  | 'write'
  | 'decide'
  | 'rank'
  | 'type'
  | 'schedule'
  | 'prayer'
  | 'qt';
export type TabId = 'journey' | 'schedule' | 'prayer' | 'qt';

export interface AppState {
  id: string | null;
  nick: string;
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
