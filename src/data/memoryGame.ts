export interface MemoryChallenge {
  sequence: string[];
  options: string[][];
  correctIndex: number;
}

export const MEMORY_CHALLENGE: MemoryChallenge = {
  sequence: ['🕯️', '📖', '🍞', '✝️'],
  options: [
    ['🕯️', '📖', '🍞', '✝️'],
    ['📖', '🕯️', '🍞', '✝️'],
    ['🕯️', '🍞', '📖', '✝️'],
    ['✝️', '📖', '🍞', '🕯️'],
  ],
  correctIndex: 0,
};
