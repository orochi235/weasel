import type { DragSample } from '@weasel-js/routing';
import type { InsertPoint, InsertEnds, InsertExtras } from '@weasel-js/core/engine';
import { applyUserRotation, buildExtras } from './extras';
import { insertRectFor, effectiveOriginMode } from './geometry';
import type { InsertFrame } from './session';
import { minSizeOf, type MinSize } from '@weasel-js/core';
import { insertStyleOf, type InsertStyle } from './style';
import type { InsertParams } from '@weasel-js/core';
import type { Rect } from '@weasel-js/geom';

/** The node kind a binding's resolved params ask for. */
export function insertKind(resolved: Readonly<Partial<InsertParams>> | undefined): string {
  return resolved?.kind ?? 'rect';
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

/** `current` moved out from `start` until the box they make is no smaller
 *  than `min`, along the way the drag went (rightward and down when it has
 *  not gone either way). */
function reachMinimum(
  start: InsertPoint,
  current: InsertPoint,
  min: MinSize,
  mode: 'corner' | 'center',
): InsertPoint {
  // A center drag makes a box twice its reach.
  const k = mode === 'center' ? 0.5 : 1;
  const reach = (d: number, m: number) => (Math.abs(d) >= m * k ? d : (d < 0 ? -1 : 1) * m * k);
  return {
    ...current,
    x: start.x + reach(current.x - start.x, min.width),
    y: start.y + reach(current.y - start.y, min.height),
  };
}

/** Kinds a minimum size does not apply to: a line has no area, and a pencil
 *  trail is drawn where the pointer went. */
const NO_MINIMUM = new Set(['line', 'pencil']);

export interface InsertShape {
  bounds: Rect;
  extras: InsertExtras;
  /** Where the drag started, after the endpoints were resolved. */
  start: InsertPoint;
  /** The drag `bounds` came from. */
  ends: InsertEnds;
}

/** The shape an insert has at `frame`. The live overlay and the commit both
 *  read it from here, so they can't disagree. Extras are derived with the
 *  effective origin mode, so polygon/star center+radius follow the live Alt
 *  toggle and not the binding's nominal `originMode`. */
export function insertShape(
  resolved: Readonly<Partial<InsertParams>> | undefined,
  frame: Pick<InsertFrame, 'shaped' | 'altHeld'>,
  points: ReadonlyArray<DragSample> | null,
  userRotation: number,
  /** The snap's landing for an end at `p` (`SpanSnap.landingAt`). */
  landingAt?: (p: InsertPoint) => unknown,
): InsertShape {
  const mode = effectiveOriginMode(resolved?.['originMode'], frame.altHeld);
  const kind = insertKind(resolved);
  const ends = resolveEndpoints(frame.shaped, kind, mode);
  const { start } = ends;
  const min = NO_MINIMUM.has(kind) ? null : minSizeOf(resolved);
  const current = min ? reachMinimum(start, ends.current, min, mode) : ends.current;
  const bounds = insertRectFor(start.x, start.y, current.x, current.y, mode);
  const extras = buildExtras(
    { ...(resolved ?? {}), originMode: mode },
    start.x, start.y, current.x, current.y,
    points,
  );
  applyUserRotation(extras, userRotation);
  // The node keeps the minimum it was drawn to, whatever its kind's extras hold.
  if (min) (extras as { minSize?: MinSize }).minSize = min;
  const style = insertStyleOf(resolved);
  if (style) (extras as { style?: InsertStyle }).style = style;
  const landings = landingAt && endLandings(landingAt(start), landingAt(current));
  const drag: InsertEnds = {
    start: { x: start.x, y: start.y },
    end: { x: current.x, y: current.y },
    ...(mode === 'center' ? { fromCenter: true } : {}),
    ...(landings ? { landings } : {}),
  };
  return { bounds, extras, start, ends: drag };
}

function endLandings(start: unknown, end: unknown): InsertEnds['landings'] | undefined {
  if (start === undefined && end === undefined) return undefined;
  return { ...(start !== undefined ? { start } : {}), ...(end !== undefined ? { end } : {}) };
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
