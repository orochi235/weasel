import { describe, expect, it } from 'vitest';
import { pathFromD, transformPath } from '@weasel-js/geom';
import { spanOnPath, trimSpan } from './trimSpan';

describe('trimSpan', () => {
  it('resolves a trim on a path', () => {
    expect(trimSpan(pathFromD('M0 0 L100 0'), { end: 0.5 })).toEqual({ from: 0, to: 50 });
    expect(trimSpan(pathFromD('M0 0 L100 0'), { start: 0.6, end: 0.4 })).toBeNull();
    expect(trimSpan({ kind: 'rect', x: 0, y: 0, width: 100, height: 50 }, { end: { length: 120 } })).toEqual({ from: 0, to: 120 });
  });

  it('counts anchors in authored numbering on a cornered path', () => {
    const path = { ...pathFromD('M0 0 L100 0 L100 100'), corners: [null, { shape: 'round', radius: 20 }, null] } as Parameters<typeof trimSpan>[0];
    const span = trimSpan(path, { end: { anchor: 1 } })!;
    // Straight 80, then half the quarter arc of radius 20.
    expect(span.to).toBeCloseTo(80 + (Math.PI * 20) / 4, 0);
  });

  it('restates a span on the path as drawn by anchor position', () => {
    const local = pathFromD('M0 0 L100 0 L100 50');
    const drawn = transformPath(local, [2, 0, 0, 1, 0, 0]);
    const span = spanOnPath(trimSpan(local, { end: { length: 125 } })!, local, drawn)!;
    // 125 local units ends halfway down the vertical edge, which the stretch leaves as it was.
    expect(span.from).toBe(0);
    expect(span.to).toBeCloseTo(225, 9);
    expect(spanOnPath(span, local, local)).toBe(span);
  });
});
