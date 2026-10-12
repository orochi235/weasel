import type { DragSample } from '@weasel-js/routing';
import type { InsertPoint } from '../../gestures/types';
import type { InsertExtras } from '../depSchema';
import { applyUserRotation, buildExtras } from './extras';
import { computeBounds, effectiveOriginMode } from './geometry';
import type { InsertFrame } from './session';

/** The node kind a binding's resolved params ask for. */
export function insertKind(resolved: Record<string, unknown> | undefined): string {
  return (resolved?.['kind'] as string | undefined) ?? 'rect';
}

/** The effective endpoints: `shaped`, plus — for the `line` kind only — the
 *  alt/center reading as "mirror the start around the pointer" rather than
 *  "grow a symmetric AABB". */
function resolveEndpoints(
  shaped: InsertFrame['shaped'],
  kind: string,
  mode: 'corner' | 'center',
): { start: InsertPoint; current: InsertPoint } {
  let { start } = shaped;
  const { current } = shaped;

  // A line has no area, so "from center" means the drag is a half-line:
  // mirror the start to the far side of the pointer.
  if (kind === 'line' && mode === 'center') {
    start = { x: start.x - (current.x - start.x), y: start.y - (current.y - start.y) };
  }
  return { start, current };
}

export interface InsertShape {
  bounds: { x: number; y: number; width: number; height: number };
  extras: InsertExtras;
  /** Where the drag started, after the endpoints were resolved. */
  start: InsertPoint;
}

/** The shape an insert has at `frame`. The live overlay and the commit both
 *  read it from here, so they can't disagree. Extras are derived with the
 *  effective origin mode, so polygon/star center+radius follow the live Alt
 *  toggle and not the binding's nominal `originMode`. */
export function insertShape(
  resolved: Record<string, unknown> | undefined,
  frame: Pick<InsertFrame, 'shaped' | 'altHeld'>,
  points: ReadonlyArray<DragSample> | null,
  userRotation: number,
): InsertShape {
  const mode = effectiveOriginMode(resolved?.['originMode'], frame.altHeld);
  const { start, current } = resolveEndpoints(frame.shaped, insertKind(resolved), mode);
  const bounds = computeBounds(start.x, start.y, current.x, current.y, mode);
  const extras = buildExtras(
    { ...(resolved ?? {}), originMode: mode },
    start.x, start.y, current.x, current.y,
    points,
  );
  applyUserRotation(extras, userRotation);
  return { bounds, extras, start };
}

/** Whether a drag produced enough extent to be worth committing. The test
 *  is kind-aware because "zero size" isn't one shape:
 *   - pencil: a sample trail can be meaningful even when start ≈ end
 *     (a closed loop), so no guard at all.
 *   - line: has no area by construction. An axis-aligned line has a
 *     zero-height (or zero-width) AABB and is perfectly valid — only
 *     a zero-LENGTH drag is degenerate. (Shift-constrain makes
 *     axis-aligned the common case, which is how this surfaced.)
 *   - everything else: a zero extent in either axis is degenerate. */
export function isCommittableExtent(
  bounds: { width: number; height: number },
  kind: string,
): boolean {
  if (kind === 'pencil') return true;
  if (kind === 'line') return bounds.width !== 0 || bounds.height !== 0;
  return bounds.width !== 0 && bounds.height !== 0;
}
