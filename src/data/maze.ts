export interface MazeData {
  grid: number[][]; // 0 = 통로, 1 = 벽
  start: [number, number];
  end: [number, number];
}

export const MAZE: MazeData = {
  grid: [
    [0, 0, 0, 1, 0],
    [1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 0],
  ],
  start: [0, 0],
  end: [4, 4],
};
