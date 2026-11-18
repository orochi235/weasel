import { describe, expect, it } from 'vitest';
import { composeRects, rectsEqual } from './composeRects';
import type { Box } from './rect';

const box = (left: number, top: number, width: number, height: number): Box => ({
  left,
  top,
  width,
  height,
});

describe('composeRects', () => {
  it('reports tiles relative to the container origin', () => {
    const out = composeRects(box(100, 50, 800, 600), new Map([['a', box(140, 90, 200, 150)]]));
    expect(out.get('a')).toEqual({ x: 40, y: 40, width: 200, height: 150 });
  });

  it('works through a nested offset parent, because both are viewport-relative', () => {
    const out = composeRects(box(0, 0, 800, 600), new Map([['deep', box(310, 220, 90, 40)]]));
    expect(out.get('deep')).toEqual({ x: 310, y: 220, width: 90, height: 40 });
  });

  it('handles a container scrolled off the top of the viewport', () => {
    const out = composeRects(box(0, -200, 800, 600), new Map([['a', box(0, -150, 100, 100)]]));
    expect(out.get('a')).toEqual({ x: 0, y: 50, width: 100, height: 100 });
  });

  it('returns one entry per tile', () => {
    const out = composeRects(
      box(0, 0, 800, 600),
      new Map([
        ['a', box(0, 0, 10, 10)],
        ['b', box(20, 0, 10, 10)],
      ]),
    );
    expect([...out.keys()]).toEqual(['a', 'b']);
  });
});

describe('rectsEqual', () => {
  it('is false when the previous rect is missing', () => {
    expect(rectsEqual(undefined, { x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });

  it('compares every field', () => {
    const r = { x: 1, y: 2, width: 3, height: 4 };
    expect(rectsEqual({ ...r }, r)).toBe(true);
    expect(rectsEqual({ ...r, height: 5 }, r)).toBe(false);
  });
});
