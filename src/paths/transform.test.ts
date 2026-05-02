import { describe, expect, it } from 'vitest';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';
import { boundsOfPath } from './bounds';
import { scalePathToBounds, translatePath, translatePolygonInPlace } from './transform';

describe('translatePath', () => {
  it('translates a RectPath without allocating coords', () => {
    const r = rectPath(10, 20, 30, 40);
    const t = translatePath(r, 5, -7);
    expect(t).toEqual({ kind: 'rect', x: 15, y: 13, width: 30, height: 40 });
  });

  it('returns a fresh PolygonPath with shifted coords', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const t = translatePath(p, 100, 50);
    expect(t.kind).toBe('polygon');
    if (t.kind !== 'polygon') return;
    expect(Array.from(t.coords)).toEqual([100, 50, 110, 50, 110, 60]);
    // commands buffer is shared (immutable), coords are fresh.
    expect(t.commands).toBe(p.commands);
    expect(t.coords).not.toBe(p.coords);
  });

  it('shifts both bezier control points and endpoint', () => {
    const p = new PathBuilder().moveTo(0, 0).curveTo(10, 0, 20, 10, 30, 10).build();
    const t = translatePath(p, 1, 2);
    if (t.kind !== 'polygon') throw new Error('expected polygon');
    expect(Array.from(t.coords)).toEqual([1, 2, 11, 2, 21, 12, 31, 12]);
  });
});

describe('translatePolygonInPlace', () => {
  it('mutates the same coord buffer and returns it', () => {
    const p = polygonFromPoints([{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }]);
    const buf = p.coords;
    const ret = translatePolygonInPlace(p, 10, 20);
    expect(ret).toBe(p);
    expect(p.coords).toBe(buf);
    expect(Array.from(p.coords)).toEqual([11, 22, 13, 24, 15, 26]);
  });
});

describe('scalePathToBounds', () => {
  it('scales a RectPath to the target rect verbatim', () => {
    const r = rectPath(10, 20, 30, 40);
    const t = scalePathToBounds(r, { kind: 'rect', x: 0, y: 0, width: 60, height: 80 });
    expect(t).toEqual({ kind: 'rect', x: 0, y: 0, width: 60, height: 80 });
  });

  it('scales a polygon\'s coords so its AABB matches the target', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]);
    const t = scalePathToBounds(p, { kind: 'rect', x: 0, y: 0, width: 50, height: 200 });
    if (t.kind !== 'polygon') throw new Error('expected polygon');
    const b = boundsOfPath(t);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.width).toBe(50);
    expect(b.height).toBe(200);
    // Vertices are scaled proportionally from the source AABB origin.
    expect(Array.from(t.coords)).toEqual([0, 0, 50, 0, 25, 200]);
  });

  it('repositions the AABB origin', () => {
    const p = polygonFromPoints([{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 15, y: 20 }]);
    const t = scalePathToBounds(p, { kind: 'rect', x: 100, y: 200, width: 10, height: 10 });
    if (t.kind !== 'polygon') throw new Error('expected polygon');
    const b = boundsOfPath(t);
    expect(b).toEqual({ kind: 'rect', x: 100, y: 200, width: 10, height: 10 });
  });

  it('collapses degenerate axes without dividing by zero', () => {
    // A vertical line (width 0) scaled into a non-degenerate rect collapses
    // every x coord to the new x origin.
    const line = polygonFromPoints([{ x: 5, y: 0 }, { x: 5, y: 10 }]);
    const t = scalePathToBounds(line, { kind: 'rect', x: 50, y: 0, width: 30, height: 20 });
    if (t.kind !== 'polygon') throw new Error('expected polygon');
    expect(t.coords[0]).toBe(50);
    expect(t.coords[2]).toBe(50);
  });
});
