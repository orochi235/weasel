import { describe, expect, it } from 'vitest';
import { lengthAtCurve, pathFromD, pathLengthTable, transformPath } from '@weasel-js/geom';
import { trimSpan } from './trimSpan';

const at = (segment: number, t: number) => ({ run: 0, segment, t });

describe('trimSpan', () => {
  it('resolves a trim on a path', () => {
    expect(trimSpan(pathFromD('M0 0 L100 0'), { end: 0.5 })).toEqual({ from: at(0, 0), to: at(0, 0.5) });
    expect(trimSpan(pathFromD('M0 0 L100 0'), { start: 0.6, end: 0.4 })).toBeNull();
    const rect = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 } as const;
    const span = trimSpan(rect, { end: { length: 120 } })!;
    expect(span.to.segment).toBe(1);
    expect(span.to.t).toBeCloseTo(0.4, 12);
  });

  it('counts anchors in authored numbering on a cornered path', () => {
    const path = { ...pathFromD('M0 0 L100 0 L100 100'), corners: [null, { shape: 'round', radius: 20 }, null] } as Parameters<typeof trimSpan>[0];
    const span = trimSpan(path, { end: { anchor: 1 } })!;
    // Straight 80, then half the quarter arc of radius 20.
    expect(lengthAtCurve(pathLengthTable(path), span.to)).toBeCloseTo(80 + (Math.PI * 20) / 4, 0);
  });

  it('names the same place on a copy carried through a transform', () => {
    const local = pathFromD('M0 0 L100 0 L100 50');
    const drawn = transformPath(local, [2, 0, 0, 1, 0, 0]);
    const span = trimSpan(local, { end: { length: 125 } })!;
    // 125 local units ends halfway down the vertical edge, which the stretch leaves as it was.
    expect(span.to).toEqual(at(1, 0.5));
    expect(lengthAtCurve(pathLengthTable(drawn), span.to)).toBeCloseTo(225, 9);
  });
});
