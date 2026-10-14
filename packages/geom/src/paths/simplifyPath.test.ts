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
