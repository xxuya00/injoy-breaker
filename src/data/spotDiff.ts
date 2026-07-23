export interface SpotDiffPuzzle {
  items: string[];
  diffIndex: number;
  diffItem: string;
}

export const SPOT_DIFF: SpotDiffPuzzle = {
  items: ['🕊️', '📖', '🕯️', '⛪', '🍞', '🍇'],
  diffIndex: 4,
  diffItem: '🥖',
};
