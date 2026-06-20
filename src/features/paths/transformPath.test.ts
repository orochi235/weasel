import { describe, it, expect } from 'vitest';
import { boxToBox, rotateAboutPoint } from '@weasel-js/geom';
import { rectPath, PathBuilder } from './builder';
import { boundsOfPath } from './bounds';
import { transformPath } from './transformPath';

describe('transformPath', () => {
  it('keeps a rect a rect under an axis-aligned box→box map', () => {
    const r = rectPath(0, 0, 10, 20);
    const m = boxToBox(0, 0, 10, 20, 100, 50, 30, 40); // 3× / 2×
    const out = transformPath(r, m);
    expect(out).toEqual({ kind: 'rect', x: 100, y: 50, width: 30, height: 40 });
  });

  it('normalizes a mirrored rect (negative scale) to positive extent', () => {
    const r = rectPath(0, 0, 10, 10);
    const m = boxToBox(0, 0, 10, 10, 0, 0, -10, 10); // flip x about 0
    const out = transformPath(r, m);
    expect(out).toEqual({ kind: 'rect', x: -10, y: 0, width: 10, height: 10 });
  });

  it('promotes a rotated rect to a polygon with baked corners', () => {
    const r = rectPath(0, 0, 10, 10);
    const m = rotateAboutPoint(5, 5, Math.PI / 4);
    const out = transformPath(r, m);
    expect(out.kind).toBe('polygon');
    const b = boundsOfPath(out);
    expect(b.width).toBeCloseTo(10 * Math.SQRT2, 4);
  });

  it('maps polygon coords and preserves commands + fillRule', () => {
    const p = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close().build();
    const m = boxToBox(0, 0, 10, 10, 0, 0, 20, 10); // x×2
    const out = transformPath(p, m);
    if (out.kind !== 'polygon') throw new Error('expected polygon');
    expect(out.fillRule).toBe(p.fillRule);
    expect(Array.from(out.commands)).toEqual(Array.from(p.commands));
    expect(out.coords[2]).toBeCloseTo(20, 5); // (10,0) -> (20,0)
  });
});
