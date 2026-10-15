import { describe, expect, it } from 'vitest';
import type { PathConstraint } from '@weasel-js/geom';
import { constraintGlyphs } from './constraintGlyphs';

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

  it('draws nothing for a constraint naming an anchor the path lacks', () => {
    expect(constraintGlyphs(SQUARE, [{ kind: 'fixed', anchor: 9 }], new Set(), STYLE)).toEqual([]);
  });
});
