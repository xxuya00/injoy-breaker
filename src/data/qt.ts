export interface QtContent {
  day: 2 | 3;
  passageRef: string;
  passageText: string;
  questions: string[];
}

// TODO: 실제 큐티 본문/질문으로 교체 필요 (플레이스홀더)
export const QT_CONTENT: QtContent[] = [
  {
    day: 2,
    passageRef: '본문 준비 중',
    passageText: '2일차 아침 큐티 본문이 아직 준비되지 않았어요. 실제 본문과 질문을 알려주시면 채워드릴게요.',
    questions: ['질문 1 (준비 중)', '질문 2 (준비 중)'],
  },
  {
    day: 3,
    passageRef: '본문 준비 중',
    passageText: '3일차 아침 큐티 본문이 아직 준비되지 않았어요. 실제 본문과 질문을 알려주시면 채워드릴게요.',
    questions: ['질문 1 (준비 중)', '질문 2 (준비 중)'],
  },
];
