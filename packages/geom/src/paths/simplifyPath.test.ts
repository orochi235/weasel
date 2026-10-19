import { describe, expect, it } from 'vitest';
import { PathBuilder } from './builder';
import { pathToAnchors, type PenAnchor } from './anchors';
import { cubicPointAt } from './cubicMath';
import { simplifyPath } from './simplifyPath';
import type { PolygonPath } from '../path';

/** A closed polygon of `n` vertices on a circle of radius `r`. */
function circle(n: number, r = 100): PolygonPath {
  const b = new PathBuilder();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (i === 0) b.moveTo(r * Math.cos(a), r * Math.sin(a));
    else b.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  b.close();
  return b.build();
}

/** Distance from every point on `path`'s segments to the circle of radius `r`. */
function worstRadialError(path: PolygonPath, r: number): number {
  const { anchors, closed } = pathToAnchors(path);
  let worst = 0;
  anchors.forEach((sub, s) => {
    const count = closed[s] ? sub.length : sub.length - 1;
    for (let i = 0; i < count; i++) {
      const a = sub[i];
      const b = sub[(i + 1) % sub.length];
      for (let k = 0; k <= 20; k++) {
        const p = cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, k / 20);
        worst = Math.max(worst, Math.abs(Math.hypot(p.x, p.y) - r));
      }
    }
  });
  return worst;
}

const anchorsOf = (p: PolygonPath): PenAnchor[][] => pathToAnchors(p).anchors;

/** Points every 1/40 of each segment along what `path` draws. */
function along(path: PolygonPath): { x: number; y: number }[] {
  const { anchors, closed } = pathToAnchors(path);
  const out: { x: number; y: number }[] = [];
  anchors.forEach((sub, s) => {
    const count = closed[s] ? sub.length : sub.length - 1;
    for (let i = 0; i < count; i++) {
      const a = sub[i];
      const b = sub[(i + 1) % sub.length];
      for (let k = 0; k < 40; k++) out.push(cubicPointAt(a, a.outHandle ?? a, b.inHandle ?? b, b, k / 40));
    }
  });
  return out;
}

/** How far the farthest point along `path` is from the polygon `poly`'s edges. */
function strayFrom(path: PolygonPath, poly: PolygonPath): number {
  const ring = anchorsOf(poly)[0];
  let worst = 0;
  for (const p of along(path)) {
    let best = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

describe('simplifyPath', () => {
  it('refits a dense polygon circle with a handful of anchors, within the tolerance', () => {
    const dense = circle(200);
    const simple = simplifyPath(dense, 0.5);
    const subs = anchorsOf(simple);
    expect(subs).toHaveLength(1);
    expect(subs[0].length).toBeLessThan(10);
    expect(pathToAnchors(simple).closed).toEqual([true]);
    expect(worstRadialError(simple, 100)).toBeLessThan(0.5 + 0.1);
  });

  it('uses fewer anchors as the tolerance grows', () => {
    const dense = circle(200);
    const tight = anchorsOf(simplifyPath(dense, 0.01))[0].length;
    const loose = anchorsOf(simplifyPath(dense, 2))[0].length;
    expect(loose).toBeLessThan(tight);
  });

  it('keeps a square as four straight corners', () => {
    const b = new PathBuilder();
    b.moveTo(0, 0); b.lineTo(50, 0); b.lineTo(100, 0); b.lineTo(100, 100); b.lineTo(0, 100); b.close();
    const subs = anchorsOf(simplifyPath(b.build(), 1));
    expect(subs[0].map((a) => [a.x, a.y])).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]]);
    expect(subs[0].every((a) => !a.inHandle && !a.outHandle)).toBe(true);
  });

  it('keeps the ends of an open subpath in place', () => {
    const b = new PathBuilder();
    for (let i = 0; i <= 60; i++) {
      const x = i * 2;
      const y = 20 * Math.sin(i / 10);
      if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
    }
    const path = b.build();
    const sub = anchorsOf(simplifyPath(path, 0.5))[0];
    expect(sub.length).toBeLessThan(10);
    expect(sub[0].x).toBeCloseTo(0);
    expect(sub[sub.length - 1].x).toBeCloseTo(120);
    expect(sub[sub.length - 1].y).toBeCloseTo(20 * Math.sin(6), 4);
    expect(pathToAnchors(simplifyPath(path, 0.5)).closed).toEqual([false]);
  });

  it('holds the whole result within the tolerance, not only where it samples the original', () => {
    // Long flats between quarter arcs of nine steps: a cubic fitted across an arc
    // and the start of the flat after it bulges where the flat has no samples.
    const b = new PathBuilder();
    const arc = (cx: number, cy: number, from: number, k0 = 0) => {
      for (let k = k0; k <= 9; k++) {
        const ang = ((from + k * 10) * Math.PI) / 180;
        b.lineTo(cx + 10 * Math.cos(ang), cy + 10 * Math.sin(ang));
      }
    };
    b.moveTo(-10, 0);
    arc(0, 0, 180, 1);
    b.lineTo(110, -10);
    arc(100, 100, 0);
    arc(0, 100, 90);
    b.close();
    const poly = b.build();
    expect(strayFrom(simplifyPath(poly, 0.1), poly)).toBeLessThan(0.1 + 1e-6);
  });

  it('keeps the fill rule and every subpath', () => {
    const ring = circle(80, 50);
    const outer = circle(80, 100);
    const both: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([...outer.commands, ...ring.commands]),
      coords: new Float32Array([...outer.coords, ...ring.coords]),
      fillRule: 'evenodd',
    };
    const simple = simplifyPath(both, 0.5);
    expect(simple.fillRule).toBe('evenodd');
    expect(anchorsOf(simple)).toHaveLength(2);
  });
});
