import type { NodeId } from 'core/scene/types';
import { pressSelects, type PressTargetTree } from '../pressTarget';

/** The ids a range click from `from` to `to` selects. */
export type RangeBetween = (from: NodeId, to: NodeId) => readonly NodeId[];

/** What a range click covers on a surface, for an action that applies a click outside the select
 *  tool (a diagram's edge label) to range the way the tool does. */
export interface SelectRangeDep {
  /** The range for a press inside `level` (the entered group, or null). */
  at(level: string | null): RangeBetween;
}

/** `between` narrowed to what a press inside `level` could select itself: a group whole, and
 *  nothing outside an entered group. */
export function rangeAmong(
  between: (from: string, to: string) => readonly string[],
  tree: PressTargetTree,
  level: string | null,
): RangeBetween {
  return (from, to) => between(from, to).filter((id) => pressSelects(tree, id, level)) as NodeId[];
}
