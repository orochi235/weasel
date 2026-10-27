import { describe, expect, it } from 'vitest';
import type { AnchorSet } from './anchorEdits';
import type { PenAnchor } from './anchors';
import { anchorsUnderBrush } from './anchorBrush';
import { cubicPointAt, type Point } from './cubicMath';
import { nearestOnLine } from '../nearest';
import { simplifyAnchorsAt } from './simplifyAnchors';

/** Mulberry32: a seeded generator, so a failure names the case that made it. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A dense freehand-like polyline: a wandering heading, with now and then a
 *  sharp turn or a loop, sampled every 1–3 units. */
function freehand(rand: () => number, closed: boolean): AnchorSet {
  const n = 80 + Math.floor(rand() * 200);
  let x = 0, y = 0, heading = rand() * Math.PI * 2, turn = 0;
  const pts: PenAnchor[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x, y });
    if (rand() < 0.04) heading += (rand() - 0.5) * Math.PI * 1.6;
    turn += (rand() - 0.5) * 0.08;
    turn *= 0.97;
    heading += turn;
    const step = 1 + rand() * 2;
    x += step * Math.cos(heading);
    y += step * Math.sin(heading);
  }
  return { anchors: [pts], closed: [closed] };
}

/** Points along every segment of `sub`, the closing one too when `closed`. */
function sampled(sub: readonly PenAnchor[], closed: boolean): Point[] {
  const out: Point[] = [];
  const count = closed ? sub.length : sub.length - 1;
  for (let i = 0; i < count; i++) {
    const a = sub[i], b = sub[(i + 1) % sub.length];
    const c1 = a.outHandle ?? a, c2 = b.inHandle ?? b;
    // A unit apart at most: a long refit cubic read through a dozen chords strays from itself.
    const reach = Math.hypot(c1.x - a.x, c1.y - a.y) + Math.hypot(c2.x - c1.x, c2.y - c1.y) + Math.hypot(b.x - c2.x, b.y - c2.y);
    const steps = Math.max(12, Math.ceil(reach));
    for (let k = 0; k < steps; k++) out.push(cubicPointAt(a, c1, c2, b, k / steps));
  }
  out.push(closed ? sub[0] : sub[sub.length - 1]);
  return out;
}

/** The farthest any point of `pts` lies from the polyline `line`, its
 *  segments bucketed on a grid so each point checks only those near it. */
function farthestFrom(pts: readonly Point[], line: readonly Point[], reach: number): number {
  const cell = Math.max(reach, 1);
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1];
    for (let cx = Math.floor(Math.min(a.x, b.x) / cell); cx <= Math.floor(Math.max(a.x, b.x) / cell); cx++) {
      for (let cy = Math.floor(Math.min(a.y, b.y) / cell); cy <= Math.floor(Math.max(a.y, b.y) / cell); cy++) {
        const k = key(cx, cy);
        const list = grid.get(k) ?? [];
        list.push(i);
        grid.set(k, list);
      }
    }
  }
  let worst = 0;
  for (const p of pts) {
    let best = Infinity;
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const i of grid.get(key(cx + dx, cy + dy)) ?? []) {
          const a = line[i], b = line[i + 1];
          best = Math.min(best, nearestOnLine(p.x, p.y, a.x, a.y, b.x, b.y).dist);
        }
      }
    }
    // Nothing within a cell: farther than `reach`, which is all a failure needs to say.
    worst = Math.max(worst, best === Infinity ? cell : best);
  }
  return worst;
}

describe('simplifyAnchorsAt, on random freehand paths and random sweeps', () => {
  it('stays within the tolerance of the original, both ways, everywhere', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 60; seed++) {
      const rand = rng(seed);
      const closed = rand() < 0.3;
      const original = freehand(rand, closed);
      const set: AnchorSet = structuredClone(original);
      const sub = original.anchors[0];
      // A brush dragged along a stretch of the path, wobbling off it.
      const from = Math.floor(rand() * sub.length);
      const length = 5 + Math.floor(rand() * sub.length * 0.8);
      const radius = 2 + rand() * 20;
      const gathered = new Set<number>();
      let prev: Point | null = null;
      for (let k = 0; k <= length; k += 3) {
        const a = sub[(from + k) % sub.length];
        const p = { x: a.x + (rand() - 0.5) * radius, y: a.y + (rand() - 0.5) * radius };
        for (const i of anchorsUnderBrush(original, prev ?? p, p, { radiusPx: radius })) gathered.add(i);
        prev = p;
      }
      const tolerance = 0.2 + rand() * 3;
      simplifyAnchorsAt(set, gathered, tolerance);
      const before = sampled(sub, closed);
      const after = sampled(set.anchors[0], closed);
      const reach = tolerance * 4;
      const out = farthestFrom(after, before, reach);
      const back = farthestFrom(before, after, reach);
      // A little over the tolerance: the fitter measures against samples of the original.
      if (Math.max(out, back) > tolerance * 1.1 + 0.05) {
        failures.push(`seed ${seed}: tolerance ${tolerance.toFixed(2)}, off by ${out.toFixed(2)} / back ${back.toFixed(2)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
