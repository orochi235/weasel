import { describe, expect, it } from 'vitest';
import { PathBuilder, polygonFromPoints, rectPath } from './builder';
import { boundsOfPath } from './bounds';
import { pathInWorld } from './pathInWorld';

describe('pathInWorld', () => {
  it('translates a rect to the pose origin when rotation is absent', () => {
    const r = rectPath(0, 0, 10, 20);
    const out = pathInWorld(r, { x: 100, y: 50, width: 10, height: 20 });
    expect(out).toEqual({ kind: 'rect', x: 100, y: 50, width: 10, height: 20 });
  });

  it('returns the same instance when no translation or rotation is needed', () => {
    const r = rectPath(5, 5, 10, 10);
    const out = pathInWorld(r, { x: 5, y: 5, width: 10, height: 10 });
    // identity case — translate skips the alloc.
    expect(out).toBe(r);
  });

  it('honors pose width/height for a resized rect (pose dims, not stored path dims)', () => {
    // A rect drawn 300×740 but resized to 400×547 — resize updates the pose,
    // not the stored RectPath. World geometry must match what the renderer
    // draws (pose dims), otherwise pathInWorld consumers (slice, booleans,
    // release-compound) operate on the stale pre-resize size.
    const r = rectPath(100, 80, 300, 740);
    const out = pathInWorld(r, { x: 100, y: 80, width: 400, height: 547 });
    expect(out).toEqual({ kind: 'rect', x: 100, y: 80, width: 400, height: 547 });
  });

  it('honors pose width/height for a resized + rotated rect', () => {
    const r = rectPath(100, 80, 300, 740);
    const out = pathInWorld(r, { x: 100, y: 80, width: 400, height: 547, rotation: Math.PI / 2 });
    if (out.kind !== 'polygon') throw new Error('expected polygon');
    const b = boundsOfPath(out);
    // Rotated 90° about pose AABB center: the unrotated 400×547 swaps to a
    // 547×400 AABB. (Stale path dims would give 740×300.)
    expect(b.width).toBeCloseTo(547, 4);
    expect(b.height).toBeCloseTo(400, 4);
  });

  it('translates a polygon so its AABB lands at pose.{x,y}', () => {
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const out = pathInWorld(p, { x: 100, y: 50, width: 10, height: 10 });
    if (out.kind !== 'polygon') throw new Error('expected polygon');
    const b = boundsOfPath(out);
    expect(b.x).toBe(100);
    expect(b.y).toBe(50);
  });

  it('rotates a polygon about the AABB center of the pose', () => {
    // Triangle whose source AABB origin is (0,0), pose origin (0,0), rotated 90°.
    // Pivot = (5, 5). Vertices (0,0), (10,0), (10,10) -> (10,0), (10,10), (0,10).
    const p = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const out = pathInWorld(p, { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 2 });
    if (out.kind !== 'polygon') throw new Error('expected polygon');
    expect(out.coords[0]).toBeCloseTo(10, 5);
    expect(out.coords[1]).toBeCloseTo(0, 5);
    expect(out.coords[2]).toBeCloseTo(10, 5);
    expect(out.coords[3]).toBeCloseTo(10, 5);
    expect(out.coords[4]).toBeCloseTo(0, 5);
    expect(out.coords[5]).toBeCloseTo(10, 5);
  });

  it('promotes a rotated rect to a polygon with baked corners', () => {
    // 10×10 rect rotated 45° about its center (5,5). Corners traverse to the
    // axis-extremal positions of the rotated square.
    const r = rectPath(0, 0, 10, 10);
    const out = pathInWorld(r, { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 4 });
    expect(out.kind).toBe('polygon');
    if (out.kind !== 'polygon') return;
    // Four corners + close => 8 floats.
    expect(out.coords.length).toBe(8);
    const b = boundsOfPath(out);
    // Rotated-square AABB has side = 10·√2; centered on (5,5).
    const half = (10 * Math.SQRT2) / 2;
    expect(b.x).toBeCloseTo(5 - half, 4);
    expect(b.y).toBeCloseTo(5 - half, 4);
    expect(b.width).toBeCloseTo(10 * Math.SQRT2, 4);
    expect(b.height).toBeCloseTo(10 * Math.SQRT2, 4);
  });

  it('bakes both translation and rotation in the right order', () => {
    // Single-point path at origin. Pose translates origin to (100, 100) then
    // rotates 90° about (105, 105) — the AABB center of pose w=h=10. The
    // point (100,100) rotates to (110,100).
    const p = new PathBuilder().moveTo(0, 0).lineTo(0, 0).build();
    const out = pathInWorld(p, { x: 100, y: 100, width: 10, height: 10, rotation: Math.PI / 2 });
    if (out.kind !== 'polygon') throw new Error('expected polygon');
    expect(out.coords[0]).toBeCloseTo(110, 5);
    expect(out.coords[1]).toBeCloseTo(100, 5);
  });

  it('rotates bezier control points as well as endpoints', () => {
    const p = new PathBuilder().moveTo(0, 0).curveTo(10, 0, 20, 10, 30, 10).build();
    const out = pathInWorld(p, { x: 0, y: 0, width: 30, height: 10, rotation: Math.PI });
    if (out.kind !== 'polygon') throw new Error('expected polygon');
    // 180° about (15, 5): (x,y) -> (30 - x, 10 - y)
    // Normalize -0 to 0 for stable equality.
    expect(Array.from(out.coords).map((n) => Math.round(n) + 0)).toEqual([30, 10, 20, 10, 10, 0, 0, 0]);
  });
});
