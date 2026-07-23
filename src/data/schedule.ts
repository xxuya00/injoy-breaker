// 시간 축 — 8:00부터 24:00까지 1시간 단위 16칸
export const SCHEDULE_ROWS = [
  '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
];

export interface ScheduleSegment {
  span: number; // 몇 시간(행)을 차지하는지
  label: string | null; // null이면 빈 칸
}

export interface ScheduleDay {
  date: string;
  weekday: string;
  // segments의 span 합이 SCHEDULE_ROWS.length(16)와 같아야 함
  segments: ScheduleSegment[];
}

// 전달받은 일정표 초안(8/28~8/30) 기준 — 정확한 시간은 확정본으로 교체 필요
export const SCHEDULE: ScheduleDay[] = [
  {
    date: '8/28',
    weekday: '금요일',
    segments: [
      { span: 4, label: null },
      { span: 1, label: '등록 · 점심식사' },
      { span: 2, label: '이동' },
      { span: 3, label: '여는 예배 및 OT · 활동1' },
      { span: 2, label: '저녁식사' },
      { span: 2, label: '저녁집회' },
      { span: 1, label: '소그룹 모임' },
      { span: 1, label: '자유시간' },
    ],
  },
  {
    date: '8/29',
    weekday: '토요일',
    segments: [
      { span: 1, label: '기상 및 아침식사' },
      { span: 1, label: '큐티' },
      { span: 2, label: '활동2' },
      { span: 1, label: '점심식사' },
      { span: 5, label: '물놀이' },
      { span: 2, label: '저녁식사' },
      { span: 2, label: '저녁집회' },
      { span: 1, label: '소그룹 모임' },
      { span: 1, label: '자유시간' },
    ],
  },
  {
    date: '8/30',
    weekday: '주일',
    segments: [
      { span: 1, label: '기상 및 아침큐티' },
      { span: 3, label: '교회로!!' },
      { span: 1, label: '점심식사' },
      { span: 1, label: '활동3' },
      { span: 10, label: '오후 3:30 닫는 예배' },
    ],
  },
];
