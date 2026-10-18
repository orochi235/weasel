import { describe, expect, it } from 'vitest';
import type { PathConstraint } from '@weasel-js/geom';
import { constraintGlyphs, constraintMarkAt } from './constraintGlyphs';

const STYLE = { stroke: 'ok', conflictStroke: 'bad' };
const SQUARE = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

const colorOf = (cmd: unknown) => (cmd as { stroke: { paint: { color: string } } }).stroke.paint.color;

describe('constraintGlyphs', () => {
  it('draws one mark per constraint, a conflicting one in the conflict color', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'parallel', segments: [[0, 1], [3, 2]] },
      { kind: 'fixed', anchor: 0 },
    ];
    const marks = constraintGlyphs(SQUARE, constraints, new Set([1]), STYLE);
    expect(marks.map(colorOf)).toEqual(['ok', 'bad', 'ok']);
  });

  it('sets a segment mark off the segment, not on it', () => {
    const [mark] = constraintGlyphs(SQUARE, [{ kind: 'length', segment: [0, 1], length: 100 }], new Set(), STYLE);
    const coords = (mark as { path: { coords: Float32Array } }).path.coords;
    const ys = Array.from(coords).filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys.map(Math.abs))).toBeGreaterThan(5);
  });

  it('finds the mark under a point, inside the shape, and draws the selected one heavier', () => {
    const constraints: PathConstraint[] = [
      { kind: 'horizontal', segment: [0, 1] },
      { kind: 'vertical', segment: [1, 2] },
    ];
    expect(constraintMarkAt(SQUARE, constraints, { x: 50, y: 12 }, 8)).toBe(0);
    expect(constraintMarkAt(SQUARE, constraints, { x: 88, y: 50 }, 8)).toBe(1);
    expect(constraintMarkAt(SQUARE, constraints, { x: 50, y: -12 }, 8)).toBe(-1);
    const widths = constraintGlyphs(SQUARE, constraints, new Set(), STYLE, 1)
      .map((cmd) => (cmd as { stroke: { width: number } }).stroke.width);
    expect(widths).toEqual([1.5, 3]);
  });

  it('marks a tangent inside the shape by its anchor, where a click finds it', () => {
    const [mark] = constraintGlyphs(SQUARE, [{ kind: 'tangent', anchor: 2 }], new Set(), STYLE);
    expect(mark).toBeDefined();
    const inward = 13 / Math.SQRT2;
    expect(constraintMarkAt(SQUARE, [{ kind: 'tangent', anchor: 2 }], { x: 100 - inward, y: 100 - inward }, 8)).toBe(0);
  });

  it('draws nothing for a constraint naming an anchor the path lacks', () => {
    expect(constraintGlyphs(SQUARE, [{ kind: 'fixed', anchor: 9 }], new Set(), STYLE)).toEqual([]);
  });
});
