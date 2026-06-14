import type { Op } from '@weasel-js/core';
import type { ControlPoint } from './CurveEditor';

/**
 * The adapter contract for {@link createSetCurveOp}. Consumers wire
 * this to whatever state container holds the curve's value — typically
 * a small callback that calls a React state setter or dispatches a
 * Redux/Zustand action.
 */
export interface SetCurveAdapter {
  setValue(id: string, next: readonly ControlPoint[]): void;
}

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
 * The op's `apply(adapter)` calls `adapter.setValue(id, to)`. `invert()`
 * returns a mirror op with `from`/`to` swapped. When `from` and `to`
 * are structurally equal, `apply` returns `false` so history can skip
 * the entry — same convention as `createSetPathOp`.
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
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}
