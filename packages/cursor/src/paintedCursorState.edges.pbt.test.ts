/**
 * Stateful test of the painted-cursor store at its edges, the second pass: runs of up to 80 writes whose numbers
 * are `NaN`, signed zeros, infinities, and the double range's ends, pointers among them, against a model in which a
 * number equals itself, `NaN` included. A write or a move that changes nothing drawn never notifies, and one that
 * does notifies once.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createPaintedCursorState, type PaintedCursor } from './paintedCursorState';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

const edge = fc.constantFrom(Number.NaN, 0, -0, Infinity, -Infinity, Number.MAX_VALUE, Number.MIN_VALUE, 1);

const cursor: fc.Arbitrary<PaintedCursor> = fc.record({
  glyph: fc.constantFrom('brush', 'crosshair'),
  angle: edge,
  size: fc.option(edge, { nil: undefined }),
  worldRadius: fc.option(edge, { nil: undefined }),
}).map((c) => ({ kind: 'painted' as const, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) }) as PaintedCursor);

type Op =
  | { op: 'base'; c: PaintedCursor | null }
  | { op: 'override'; c: PaintedCursor | 'none' | null }
  | { op: 'pointer'; x: number; y: number }
  | { op: 'leave' };

const op: fc.Arbitrary<Op> = fc.oneof(
  fc.option(cursor, { nil: null }).map((c) => ({ op: 'base' as const, c })),
  fc.oneof(fc.option(cursor, { nil: null }), fc.constant('none' as const)).map((c) => ({ op: 'override' as const, c })),
  { weight: 2, arbitrary: fc.record({ x: edge, y: edge }).map((p) => ({ op: 'pointer' as const, ...p })) },
  fc.constant({ op: 'leave' as const }),
);

/** A number equal to itself, `NaN` included, and `-0` to `0`. */
const eq = (a: unknown, b: unknown): boolean => a === b || (Number.isNaN(a) && Number.isNaN(b));
const sameCursor = (a: PaintedCursor | 'none' | null, b: PaintedCursor | 'none' | null): boolean => {
  if (a === null || b === null || a === 'none' || b === 'none') return a === b;
  return a.glyph === b.glyph && eq(a.angle, b.angle) && eq(a.size, b.size) && eq(a.worldRadius, b.worldRadius);
};

const hasNaN = (v: unknown): boolean =>
  Number.isNaN(v) || (typeof v === 'object' && v !== null && Object.values(v).some(hasNaN));

describe('createPaintedCursorState, at its edges', () => {
  it('notifies once for a change to what it draws and never for a write of the same numbers, NaN included', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(op, { minLength: 20, maxLength: 80 }), (ops) => {
      const state = createPaintedCursorState();
      let notes = 0;
      state.subscribe(() => { notes++; });
      let base: PaintedCursor | null = null;
      let override: PaintedCursor | 'none' | null = null;
      let at: { x: number; y: number } | null = null;
      const shown = () => (override === 'none' ? null : override ?? base);
      for (const o of ops) {
        const was = notes;
        let quiet = false;
        switch (o.op) {
          case 'base':
            quiet = sameCursor(base, o.c);
            state.setBase(o.c && { ...o.c });
            base = o.c;
            break;
          case 'override':
            quiet = sameCursor(override, o.c);
            state.setOverride(o.c && (o.c === 'none' ? 'none' : { ...o.c }));
            override = o.c;
            break;
          case 'pointer':
            quiet = shown() === null || (at !== null && eq(at.x, o.x) && eq(at.y, o.y));
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
        const frame = state.current();
        expect(frame === null).toBe(!(s && at));
        if (frame && s && at) {
          expect(sameCursor(frame.cursor, s)).toBe(true);
          expect(eq(frame.at.x, at.x) && eq(frame.at.y, at.y)).toBe(true);
        }
        expect(state.active()).toBe(s !== null);
        expect(notes - was).toBeLessThanOrEqual(1);
        if (quiet) {
          t.count('quiet');
          if (hasNaN(o)) t.count('quiet NaN');
          expect(notes).toBe(was);
        }
      }
    }), runs(RUNS));
    t.atLeast('quiet', 200);
    t.atLeast('quiet NaN', 20);
  }, timeoutFor(RUNS, 4));
});
