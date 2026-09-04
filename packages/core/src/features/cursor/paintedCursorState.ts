/**
 * The painted cursor a surface is currently showing, shared between whoever
 * decides it and the layer that draws it.
 *
 * Two slots rather than one, mirroring the precedence the cursor pipeline
 * already has: `<Canvas>` writes the active tool's cursor to `base` from
 * render, and the hover pump writes an affordance's or an action's cursor to
 * `override` imperatively. The override wins while it is set, and clearing it
 * restores the base without a React commit — the same reason the pump uses an
 * inline style for the CSS tier.
 */

import type { ResolvedCursor } from '@weasel-js/cursor';

/** The painted arm of `ResolvedCursor` — what this module stores. */
export type PaintedCursor = Extract<ResolvedCursor, { kind: 'painted' }>;

export interface PaintedCursorFrame {
  readonly cursor: PaintedCursor;
  /** Pointer position in the layer's own space: canvas-local CSS px. */
  readonly at: { readonly x: number; readonly y: number };
}

export interface PaintedCursorState {
  setBase(cursor: PaintedCursor | null): void;
  setOverride(cursor: PaintedCursor | null): void;
  /** Canvas-local CSS px. */
  setPointer(x: number, y: number): void;
  /** Pointer left the surface: nothing to draw until it returns. */
  clearPointer(): void;
  /**
   * Whether a painted cursor is set at all, regardless of where the pointer is.
   *
   * Lets the pointer path skip measuring the canvas rect on every move in the
   * overwhelmingly common case where the compositor is drawing the cursor and
   * nothing here needs its position.
   */
  active(): boolean;
  /** What the layer should draw this frame, or null for none. */
  current(): PaintedCursorFrame | null;
  /** Run `fn` whenever the answer to `current()` may have changed. */
  subscribe(fn: () => void): () => void;
}

/**
 * Structural, not `Object.is`. Both writers rebuild their cursor object from a
 * spec every time they run — the pump on every pointermove, `<Canvas>` on
 * every render — so identity comparison would report a change constantly and
 * drive a repaint per pointer event.
 */
function same(a: PaintedCursor | null, b: PaintedCursor | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.glyph === b.glyph &&
    a.angle === b.angle &&
    a.size === b.size &&
    a.worldRadius === b.worldRadius
  );
}

export function createPaintedCursorState(): PaintedCursorState {
  let base: PaintedCursor | null = null;
  let override: PaintedCursor | null = null;
  let at: { x: number; y: number } | null = null;
  const subs = new Set<() => void>();

  const notify = (): void => {
    for (const fn of subs) fn();
  };

  return {
    setBase(cursor) {
      if (same(base, cursor)) return;
      base = cursor;
      notify();
    },
    setOverride(cursor) {
      if (same(override, cursor)) return;
      override = cursor;
      notify();
    },
    setPointer(x, y) {
      // A moved pointer only matters while something is being painted; a
      // notify per pointermove otherwise would request a redraw per event
      // for a cursor the compositor is drawing itself.
      if (at && at.x === x && at.y === y) return;
      at = { x, y };
      if (override ?? base) notify();
    },
    clearPointer() {
      if (at === null) return;
      at = null;
      notify();
    },
    active() {
      return (override ?? base) !== null;
    },
    current() {
      const cursor = override ?? base;
      if (!cursor || !at) return null;
      return { cursor, at };
    },
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
  };
}
