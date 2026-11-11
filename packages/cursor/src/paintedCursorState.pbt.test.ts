/**
 * Stateful test of the painted-cursor store: random base and override writes (fresh objects of equal value among
 * them), pointer moves, and leaves, against a model of what the layer should draw. Every step checks `current()`
 * and `active()`, that a change to what is drawn notifies once, and that a write changing nothing drawn by value,
 * or a pointer move with nothing painted, does not notify.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createPaintedCursorState, type PaintedCursor, type PaintedCursorFrame } from './paintedCursorState';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const cursor: fc.Arbitrary<PaintedCursor> = fc.record({
  glyph: fc.constantFrom('brush', 'crosshair'),
  mark: fc.option(fc.constantFrom('rect', 'add'), { nil: undefined }),
  angle: fc.constantFrom(0, 1),
  size: fc.option(fc.constantFrom(200, 300), { nil: undefined }),
  worldRadius: fc.option(fc.constantFrom(5, 10), { nil: undefined }),
}).map((c) => ({ kind: 'painted' as const, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) }) as PaintedCursor);

type Op =
  | { op: 'base'; c: PaintedCursor | null }
  | { op: 'override'; c: PaintedCursor | 'none' | null }
  | { op: 'pointer'; x: number; y: number }
  | { op: 'leave' };

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.option(cursor, { nil: null }).map((c) => ({ op: 'base' as const, c })),
  fc.oneof(fc.option(cursor, { nil: null }), fc.constant('none' as const)).map((c) => ({ op: 'override' as const, c })),
  fc.record({ x: fc.integer({ min: 0, max: 3 }), y: fc.integer({ min: 0, max: 3 }) }).map((p) => ({ op: 'pointer' as const, ...p })),
  fc.constant({ op: 'leave' as const }),
);

const value = (f: PaintedCursorFrame | null) => (f === null ? null : JSON.stringify({ ...f.cursor, at: f.at }));

describe('createPaintedCursorState, against a model of what it draws', () => {
  it('draws the override over the base while the pointer is in, and notifies exactly when that may change', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(op, { maxLength: 30 }), (ops) => {
      const state = createPaintedCursorState();
      let notes = 0;
      state.subscribe(() => { notes++; });
      let base: PaintedCursor | null = null;
      let override: PaintedCursor | 'none' | null = null;
      let at: { x: number; y: number } | null = null;
      const shown = () => (override === 'none' ? null : override ?? base);
      const json = (c: unknown) => JSON.stringify(c);
      for (const o of ops) {
        const before = value(state.current());
        const was = notes;
        let quiet = false;
        switch (o.op) {
          case 'base':
            quiet = json(base) === json(o.c);
            state.setBase(o.c && { ...o.c });
            base = o.c;
            break;
          case 'override':
            quiet = json(override) === json(o.c);
            state.setOverride(o.c && (o.c === 'none' ? 'none' : { ...o.c }));
            override = o.c;
            break;
          case 'pointer':
            quiet = shown() === null || (at !== null && at.x === o.x && at.y === o.y);
            state.setPointer(o.x, o.y);
            at = { x: o.x, y: o.y };
            break;
          case 'leave':
            quiet = at === null;
            state.clearPointer();
            at = null;
            break;
        }
        const s = shown();
        const want = s && at ? { cursor: s, at } : null;
        expect(value(state.current())).toBe(value(want));
        expect(state.active()).toBe(s !== null);
        expect(notes - was).toBeLessThanOrEqual(1);
        if (quiet) {
          t.count('quiet');
          expect(notes).toBe(was);
        }
        if (value(state.current()) !== before) {
          t.count('changed');
          expect(notes - was).toBe(1);
        }
      }
    }), runs(RUNS));
    t.atLeast('quiet', 200);
    t.atLeast('changed', 200);
  }, timeoutFor(RUNS, 2));
});
