export interface ScheduleBlock {
  time: string;
  label: string;
}

export interface ScheduleDay {
  date: string;
  weekday: string;
  blocks: ScheduleBlock[];
}

// 전달받은 일정표 초안(8/28~8/30) 기준 — 정확한 시간은 확정본으로 교체 필요
export const SCHEDULE: ScheduleDay[] = [
  {
    date: '8/28',
    weekday: '금요일',
    blocks: [
      { time: '12:00–13:00', label: '등록 · 점심식사' },
      { time: '13:00–15:00', label: '이동' },
      { time: '15:00–18:00', label: '여는 예배 및 OT · 활동1' },
      { time: '18:00–20:00', label: '저녁식사' },
      { time: '20:00–22:00', label: '저녁집회' },
      { time: '22:00–23:00', label: '소그룹 모임' },
      { time: '23:00–24:00', label: '자유시간' },
    ],
  },
  {
    date: '8/29',
    weekday: '토요일',
    blocks: [
      { time: '8:00–9:00', label: '기상 및 아침식사' },
      { time: '9:00–10:00', label: '큐티' },
      { time: '10:00–12:00', label: '활동2' },
      { time: '12:00–13:00', label: '점심식사' },
      { time: '13:00–18:00', label: '물놀이' },
      { time: '18:00–20:00', label: '저녁식사' },
      { time: '20:00–22:00', label: '저녁집회' },
      { time: '22:00–23:00', label: '소그룹 모임' },
      { time: '23:00–24:00', label: '자유시간' },
    ],
  },
  {
    date: '8/30',
    weekday: '주일',
    blocks: [
      { time: '기상', label: '기상 및 아침큐티' },
      { time: '오전', label: '교회로!!' },
      { time: '12:00–13:00', label: '점심식사' },
      { time: '13:00–14:00', label: '활동3' },
      { time: '오후 3:30', label: '닫는 예배' },
    ],
  },
];
