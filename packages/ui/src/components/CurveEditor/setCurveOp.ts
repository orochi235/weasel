import type { Op } from '@weasel-js/history';
import type { ControlPoint } from './CurveEditor';
import { sameList } from '@weasel-js/registry';

/** The adapter contract for {@link createSetCurveOp}. Consumers wire this
 *  to whatever state container holds the curve's value. */
export interface SetCurveAdapter {
  setValue(id: string, next: readonly ControlPoint[]): void;
}

/**
 * Arguments for {@link createSetCurveOp}. `coalesceKey` merges consecutive
 * edits sharing it into one history entry.
 */
export interface CreateSetCurveOpArgs {
  /** Stable id the consumer uses for this curve. Used so a single
   *  adapter can handle multiple curves; the op's apply routes by id. */
  id: string;
  from: readonly ControlPoint[];
  to: readonly ControlPoint[];
  label?: string;
  coalesceKey?: string;
}

/**
 * Op factory for editing a CurveEditor's value through weasel-history.
 *
 *     history.applyOps(
 *       [createSetCurveOp({ id: 'easing', from, to, label: 'Edit easing' })],
 *       'Edit easing',
 *     );
 *
 * When `from` and `to` are structurally equal, `apply` returns `false`
 * so history can skip the entry.
 */
export function createSetCurveOp(args: CreateSetCurveOpArgs): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    name: 'setCurve',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      if (controlPointsEqual(from, to)) return false;
      (adapter as SetCurveAdapter).setValue(id, to);
      return undefined;
    },
    invert() {
      return createSetCurveOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

function controlPointsEqual(
  a: readonly ControlPoint[],
  b: readonly ControlPoint[],
): boolean {
  return sameList(a, b, (p, q) => p.x === q.x && p.y === q.y && !p.locked === !q.locked);
}
