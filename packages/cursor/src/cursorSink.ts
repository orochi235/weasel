/**
 * Where a surface's cursor is written: the `cursor` style of its element, and
 * the painted-cursor state its layer draws from.
 *
 * Two slots, as `PaintedCursorState` has: a base (the active tool's cursor)
 * and an override (an affordance's or action's) that wins while it is set.
 * One writer owns the element's style, so clearing the override puts the base
 * back; two writers sharing that one inline property cannot.
 */

import type { PaintedCursorState } from './paintedCursorState';
import type { ResolvedCursor } from './resolve';

export interface CursorSink {
  /** The cursor shown while nothing overrides it, or null for none. `rest`
   *  is the CSS value shown then, the element's own cursor where it has one. */
  setBase(cursor: ResolvedCursor | null, rest?: string): void;
  /** A cursor that wins over the base while set. Null clears it. */
  setOverride(cursor: ResolvedCursor | null): void;
}

export interface CursorSinkTarget {
  /** The element whose `cursor` style is written, read at each write. */
  element: () => { style: { cursor: string } } | null | undefined;
  /** The painted tier's state, read at each write. */
  painted: () => PaintedCursorState | undefined;
}

/** A painted cursor is two writes: the native one gets out of the way, and
 *  the layer is told what to draw. */
const cssOf = (cursor: ResolvedCursor): string => (cursor.kind === 'css' ? cursor.css : 'none');

const shown = (cursor: ResolvedCursor | null): ResolvedCursor | null =>
  (cursor !== null && cssOf(cursor) !== '' ? cursor : null);

/**
 * A sink over `target`. Until `setBase` is called it owns only what it wrote:
 * an override is written and later removed, and a cursor some other code put
 * on the element is otherwise left alone.
 */
export function createCursorSink(target: CursorSinkTarget): CursorSink {
  let base: ResolvedCursor | null = null;
  let rest = '';
  let override: ResolvedCursor | null = null;
  let ownsBase = false;
  let wroteOverride = false;

  const write = (): void => {
    const painted = target.painted();
    if (ownsBase) painted?.setBase(base?.kind === 'painted' ? base : null);
    // A CSS override silences the layer too, or a painted base keeps drawing
    // under the native cursor.
    painted?.setOverride(override === null ? null : override.kind === 'painted' ? override : 'none');
    const el = target.element();
    if (!el) return;
    if (override) {
      el.style.cursor = cssOf(override);
      wroteOverride = true;
      return;
    }
    if (ownsBase) el.style.cursor = base ? cssOf(base) : rest;
    else if (wroteOverride) el.style.cursor = '';
    wroteOverride = false;
  };

  return {
    setBase(cursor, restCss = '') {
      base = shown(cursor);
      rest = restCss;
      ownsBase = true;
      write();
    },
    setOverride(cursor) {
      override = shown(cursor);
      write();
    },
  };
}
