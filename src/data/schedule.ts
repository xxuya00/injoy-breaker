// 일정표는 "몇 번째 칸"이 아니라 시각 그대로 적는다.
//
// 예전에는 한 시간에 한 줄씩 표를 그리고, 30분에 걸치는 일정 하나 때문에 15:30 줄을 따로
// 끼워 넣었다. 그러면 그 줄만 30분이라 같은 높이가 서로 다른 시간을 뜻하게 되고, 9시 반에
// 시작하는 일정은 적을 방법이 아예 없었다.
//
// 지금은 화면이 30분을 한 칸으로 쪼개 놓고 정시에만 선을 긋는다. 그래서 9:30에 시작하는
// 일정은 9시 선과 10시 선 사이에서 시작한다 — 여기서는 시작·끝 시각만 적으면 된다.
export const DAY_START = '8:00';
export const DAY_END = '25:00';

// 무엇을 하는 시간인지에 따라 칸 색이 갈린다. 색이 시간표를 읽는 첫 번째 단서가 되도록
// (밥 먹는 때가 어디인지, 집회가 언제인지) 종류를 적어둔다.
export type ScheduleTone = 'meal' | 'worship' | 'activity' | 'move' | 'rest';

export interface ScheduleItem {
  /** 'H:MM'. 30분 단위로 끊어 적는다. */
  start: string;
  end: string;
  label: string;
  tone: ScheduleTone;
  /** 옆 날짜와 일정이 똑같아 칸을 하나로 합칠 때, 며칠치를 덮는지 (기본 1일) */
  spanDays?: number;
}

export interface ScheduleDay {
  date: string;
  weekday: string;
  items: ScheduleItem[];
}

// 전달받은 일정표 초안(8/28~8/30) 기준 — 정확한 시간은 확정본으로 교체 필요
export const SCHEDULE: ScheduleDay[] = [
  {
    date: '8/28',
    weekday: '금요일',
    items: [
      { start: '8:00', end: '12:00', label: '사랑해요 인조이\n( • ᴗ - ) ✧', tone: 'rest' },
      { start: '12:00', end: '13:00', label: '등록 · 점심식사', tone: 'meal' },
      { start: '13:00', end: '15:00', label: '양평 숲속마을로\n٩₍ᐢ. ◞ . ᐢ₎۶ ⁼³₌₃', tone: 'move' },
      { start: '15:00', end: '15:30', label: '여는 예배 및 OT', tone: 'worship' },
      { start: '15:30', end: '18:00', label: 'BREAK AWAY', tone: 'activity' },
      // 아래 넷은 8/29도 일정이 똑같아 두 날짜 칸을 하나로 합쳐 보여준다.
      // 합쳐 보이는 게 싫으면 spanDays를 지우고 8/29 쪽에도 같은 줄을 적으면 된다.
      { start: '18:00', end: '20:00', label: '저녁식사', tone: 'meal', spanDays: 2 },
      { start: '20:00', end: '23:00', label: '저녁집회', tone: 'worship', spanDays: 2 },
      { start: '23:00', end: '24:00', label: '소그룹 모임', tone: 'worship', spanDays: 2 },
      { start: '24:00', end: '25:00', label: '자유시간', tone: 'rest', spanDays: 2 },
    ],
  },
  {
    date: '8/29',
    weekday: '토요일',
    items: [
      { start: '8:00', end: '9:00', label: '기상 및 아침식사', tone: 'meal' },
      { start: '9:00', end: '9:30', label: '큐티', tone: 'worship' },
      { start: '9:30', end: '12:00', label: 'BREAK DOWN', tone: 'activity' },
      { start: '12:00', end: '13:30', label: '점심식사', tone: 'meal' },
      { start: '13:30', end: '18:00', label: '물놀이\n٩(๑˃̵ᴗ˂̵๑)۶', tone: 'activity' },
      // 18:00 이후는 8/28 쪽에 합쳐 적어둔 칸이 이 자리까지 덮는다.
    ],
  },
  {
    date: '8/30',
    weekday: '주일',
    items: [
      { start: '8:00', end: '9:00', label: '기상 및 아침큐티', tone: 'worship' },
      { start: '9:00', end: '12:00', label: '교회로\n٩₍ᐢ. ◞ . ᐢ₎۶ ⁼³₌₃', tone: 'move' },
      { start: '12:00', end: '13:00', label: '점심식사', tone: 'meal' },
      { start: '13:00', end: '14:00', label: 'BREAK THROUGH', tone: 'activity' },
      { start: '14:00', end: '25:00', label: '오후 3:30\n닫는 예배\nദ്ദി(☆⸝⸝ʚ̴̶̷̆ ᴗ ʚ̴̶̷̆⸝⸝)\n\n.\n.\n.\n\nBREAK:\n초심을 찾아서\n\nThe End.', tone: 'worship' },
    ],
  },
];
