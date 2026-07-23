export interface MathPuzzle {
  question: string;
  options: number[];
  answer: number;
}

export const MATH_PUZZLES: MathPuzzle[] = [
  { question: '2, 4, 8, 16, ?', options: [24, 32, 30, 20], answer: 32 },
  { question: '1, 1, 2, 3, 5, 8, ?', options: [10, 11, 13, 21], answer: 13 },
  { question: '3, 6, 11, 18, ?', options: [25, 26, 27, 29], answer: 27 },
];
