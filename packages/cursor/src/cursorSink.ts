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

/** The one writer of a surface's cursor: a base slot and an override slot that wins while set. */
export interface CursorSink {
  /** The cursor shown while nothing overrides it, or null for none. `rest`
   *  is the CSS value shown then, the element's own cursor where it has one. */
  setBase(cursor: ResolvedCursor | null, rest?: string): void;
  /** A cursor that wins over the base while set. Null clears it. */
  setOverride(cursor: ResolvedCursor | null): void;
}

/** What a {@link CursorSink} writes to: an element's `cursor` style and the painted-cursor state. */
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
 * an override is written and later removed, putting back the cursor it replaced
 * unless other code has written one since, and a cursor some other code put on
 * the element is otherwise left alone. When `element()` starts answering another
 * element, the one it wrote to is given back what it showed before the sink
 * wrote there; when `painted()` starts answering another state, the slots it
 * set on the old one are cleared.
 */
export function createCursorSink(target: CursorSinkTarget): CursorSink {
  type El = { style: { cursor: string } };
  let base: ResolvedCursor | null = null;
  let rest = '';
  let override: ResolvedCursor | null = null;
  let ownsBase = false;
  /** The element the sink last wrote, what it showed before, and what the sink wrote there. */
  let written: { el: El; prior: string; css: string } | null = null;
  let paintedTo: PaintedCursorState | undefined;

  const giveBack = (): void => {
    if (!written) return;
    const { el, prior, css } = written;
    written = null;
    if (el.style.cursor === css) el.style.cursor = prior;
  };

  const writePainted = (): void => {
    const painted = target.painted();
    if (paintedTo && paintedTo !== painted) {
      if (ownsBase) paintedTo.setBase(null);
      paintedTo.setOverride(null);
    }
    paintedTo = painted;
    if (!painted) return;
    if (ownsBase) painted.setBase(base?.kind === 'painted' ? base : null);
    // A CSS override silences the layer too, or a painted base keeps drawing
    // under the native cursor.
    painted.setOverride(override === null ? null : override.kind === 'painted' ? override : 'none');
  };

  const write = (): void => {
    writePainted();
    const el = target.element();
    if (written && written.el !== el) giveBack();
    if (!el) return;
    const css = override ? cssOf(override) : ownsBase ? (base ? cssOf(base) : rest) : null;
    if (css === null) {
      giveBack();
      return;
    }
    // Other code wrote over the sink's cursor since: that is what to put back now.
    const prior = written && el.style.cursor === written.css ? written.prior : el.style.cursor;
    el.style.cursor = css;
    // The style hands back its own serialization (`'Grab '` reads `'grab'`), which is what later reads compare.
    written = { el, prior, css: el.style.cursor };
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
