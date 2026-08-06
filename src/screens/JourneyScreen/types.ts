import type { CodeBreakOp, ShapeId } from '../../data/codeBreak';
import type { LockItem } from '../../types';
import { TIMED_KINDS } from './config';

export type SheetState =
  | { kind: 'quiz'; item: LockItem }
  | { kind: 'mission'; item: LockItem }
  | { kind: 'memory'; item: LockItem }
  | { kind: 'maze'; item: LockItem }
  | { kind: 'combo'; item: LockItem }
  | { kind: 'equation'; item: LockItem }
  | { kind: 'lightsout'; item: LockItem }
  | { kind: 'crossmath'; item: LockItem }
  | { kind: 'codebreak'; item: LockItem }
  | { kind: 'baseball'; item: LockItem }
  | { kind: 'reflex'; item: LockItem }
  | { kind: 'intro'; item: LockItem }
  | { kind: 'reveal'; item: LockItem }
  // 알이 다 깨진 순간에 열리는 "초심" 화면. 자물쇠 하나에 딸린 화면이 아니라
  // 여섯 개를 통과한 뒤의 마무리라, 마지막으로 깬 자물쇠를 들고 다니지 않는다.
  | { kind: 'eggComplete' };

type TimedKind = 'equation' | 'combo' | 'lightsout' | 'reflex' | 'crossmath' | 'codebreak' | 'baseball' | 'maze' | 'memory';
type TimedSheetState = Extract<SheetState, { kind: TimedKind }>;
export function isTimedSheet(s: SheetState | null): s is TimedSheetState {
  return !!s && TIMED_KINDS.has(s.kind);
}

// 부호 해독 힌트로 화면에 띄워둔 사실. 도형 하나가 확정된 경우, 두 도형의 관계만 확정된 경우,
// 그리고 둘 다 없을 때 답 자체에 대해 말해줄 수 있는 것(푸는 법·홀짝·범위)이 있다.
export type CbFact =
  | { kind: 'fixed'; shape: ShapeId; value: number }
  | { kind: 'rel'; a: ShapeId; b: ShapeId; op: CodeBreakOp; result: number }
  | { kind: 'note'; id: string; text: string };
