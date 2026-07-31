export interface TilePuzzle {
  tiles: string[];
  caption: string;
}

// tiles의 현재 순서 자체가 정답 순서. 화면에서는 이 배열을 섞어서 보여주고,
// 탭 두 번으로 자리를 바꿔가며 원래 순서로 되돌리면 통과.
export const TILE_PUZZLE: TilePuzzle = {
  tiles: ['🌅', '☀️', '🌇', '🌙'],
  caption: '하루의 흐름대로 순서를 맞춰보세요',
};
