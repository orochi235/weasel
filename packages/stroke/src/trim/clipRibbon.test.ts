/**
 * A clipped ribbon against the trimmed one `tessellateStroke` builds, sampled
 * on a grid the way a rasterizer would: a sample is ink where a triangle
 * covers it, and for the clipped ribbon only where the triangle's
 * interpolated length passes the window too.
 */
import { describe, expect, it } from 'vitest';
import { pathFromD, pointAlongPath, type Path } from '@weasel-js/geom';
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { Stroke, StrokeTrim } from '@weasel-js/paint';
import { tessellateStroke } from '../tessellate/stroke';
import { CLIP_CUT, CLIP_WHOLE, clipRibbon } from './clipRibbon';
import { clipWindow } from './clipWindow';

type Keep = (tri: number, w: [number, number, number]) => boolean;

const CELL = 8;
const cellOf = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;

/** A sampler for whether some triangle of `mesh` covers (x, y), and `keep` takes it there. */
function sampler(mesh: Mesh, keep?: Keep): (x: number, y: number) => boolean {
  const v = mesh.vertices, ix = mesh.indices;
  const cells = new Map<string, number[]>();
  for (let t = 0; t < ix.length; t += 3) {
    const xs = [v[ix[t] * 2], v[ix[t + 1] * 2], v[ix[t + 2] * 2]];
    const ys = [v[ix[t] * 2 + 1], v[ix[t + 1] * 2 + 1], v[ix[t + 2] * 2 + 1]];
    for (let cx = Math.floor(Math.min(...xs) / CELL); cx <= Math.floor(Math.max(...xs) / CELL); cx++) {
      for (let cy = Math.floor(Math.min(...ys) / CELL); cy <= Math.floor(Math.max(...ys) / CELL); cy++) {
        const key = `${cx},${cy}`;
        const list = cells.get(key) ?? [];
        list.push(t);
        cells.set(key, list);
      }
    }
  }
  return (x, y) => {
    for (const t of cells.get(cellOf(x, y)) ?? []) {
      const [p, q, r] = [ix[t] * 2, ix[t + 1] * 2, ix[t + 2] * 2];
      const d = (v[q + 1] - v[r + 1]) * (v[p] - v[r]) + (v[r] - v[q]) * (v[p + 1] - v[r + 1]);
      if (d === 0) continue;
      const w0 = ((v[q + 1] - v[r + 1]) * (x - v[r]) + (v[r] - v[q]) * (y - v[r + 1])) / d;
      const w1 = ((v[r + 1] - v[p + 1]) * (x - v[r]) + (v[p] - v[r]) * (y - v[r + 1])) / d;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      if (!keep || keep(t, [w0, w1, w2])) return true;
    }
    return false;
  };
}

/** The samples where the trimmed and the clipped ribbon disagree, its ends drawn as geometry
 *  for no length, a short one, and one longer than some windows. */
function disagreements(path: Path, stroke: Stroke, trim: StrokeTrim, insets = { start: 0, end: 0 }): [number, number][] {
  return [0, 1.5, 9].flatMap((seam) => disagreementsAt(path, stroke, trim, insets, seam));
}

function disagreementsAt(
  path: Path, stroke: Stroke, trim: StrokeTrim, insets: { start: number; end: number }, seam: number,
): [number, number][] {
  const cpu = tessellateStroke(path, { ...stroke, trim }, { startInset: insets.start, endInset: insets.end });
  const ribbon = clipRibbon(path, stroke, { startInset: insets.start, endInset: insets.end });
  const win = clipWindow(ribbon, path, trim, seam);
  const a = ribbon.trim, ix = ribbon.mesh.indices;
  const keep: Keep = (t, w) => {
    if (!win) return false;
    const vs = [ix[t], ix[t + 1], ix[t + 2]];
    const s = vs.reduce((sum, vi, k) => sum + a[vi * 4] * w[k], 0);
    const [lo, hi, kind] = [a[vs[2] * 4 + 1], a[vs[2] * 4 + 2], a[vs[2] * 4 + 3]];
    const inWin = s >= win.from && s <= win.to;
    const whole = win.from <= lo && hi <= win.to;
    return kind === CLIP_WHOLE ? whole : kind === CLIP_CUT ? inWin && !whole : inWin;
  };
  const theirs = sampler(cpu);
  const ours = sampler(ribbon.mesh, keep);
  const ends = win?.ends ? sampler(win.ends) : () => false;
  const out: [number, number][] = [];
  for (let y = -20.31; y < 140; y += 0.5) {
    for (let x = -20.27; x < 140; x += 0.5) {
      if (theirs(x, y) !== (ours(x, y) || ends(x, y))) out.push([x, y]);
    }
  }
  return out;
}

/** How far (x, y) is from segment `k` (x0, y0, x1, y1). */
function toSegment(k: number[], x: number, y: number): number {
  const [x0, y0, x1, y1] = k;
  const dx = x1 - x0, dy = y1 - y0;
  const f = Math.min(Math.max(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy), 0), 1);
  return Math.hypot(x0 + dx * f - x, y0 + dy * f - y);
}

/** The chord of `points` nearest (x, y). */
function chordNear(points: number[], x: number, y: number): number[] {
  let best: number[] = [];
  for (let i = 0; i + 3 < points.length; i += 2) {
    const k = points.slice(i, i + 4);
    if (best.length === 0 || toSegment(k, x, y) < toSegment(best, x, y)) best = k;
  }
  return best;
}

const BASE: Stroke = { paint: { color: '#000' }, width: 8 };
const ZIGZAG = pathFromD('M 0 0 L 60 0 L 60 50 L 110 50');
const SQUARE = pathFromD('M 10 10 L 90 10 L 90 90 L 10 90 Z');
const TWO = pathFromD('M 0 0 L 100 0 M 0 60 L 100 60');

describe('a clipped ribbon draws what the trimmed one does', () => {
  for (const cap of ['butt', 'round', 'square'] as const) {
    for (const join of ['miter', 'round', 'bevel'] as const) {
      it(`${cap} caps, ${join} joins, cut mid-segment`, () => {
        const stroke = { ...BASE, cap, join };
        for (const trim of [{ end: 0.2 }, { start: 0.3, end: 0.7 }, { start: 0.8 }, {}, { start: 0.1, end: 0.95 }]) {
          expect(disagreements(ZIGZAG, stroke, trim), JSON.stringify(trim)).toEqual([]);
        }
      });
    }
  }

  it('on a closed subpath, cut or whole', () => {
    for (const cap of ['butt', 'round'] as const) {
      for (const trim of [{}, { end: 0.4 }, { start: 0.1, end: 0.6 }, { start: 0.55 }]) {
        expect(disagreements(SQUARE, { ...BASE, cap }, trim), `${cap} ${JSON.stringify(trim)}`).toEqual([]);
      }
    }
  });

  it('across subpaths', () => {
    for (const trim of [{ start: 0.2, end: 0.8 }, { start: 0.6 }, { end: 0.3 }]) {
      expect(disagreements(TWO, { ...BASE, cap: 'round' }, trim), JSON.stringify(trim)).toEqual([]);
    }
  });

  it('with insets for heads at each run end', () => {
    for (const trim of [{ start: 0.2, end: 0.8 }, { start: 0.6 }, { end: 0.3 }, { start: 0.45, end: 0.55 }]) {
      expect(disagreements(TWO, { ...BASE, cap: 'square' }, trim, { start: 6, end: 9 }), JSON.stringify(trim)).toEqual([]);
    }
  });

  it('dashed, the pattern staying where the untrimmed stroke puts it', () => {
    for (const cap of ['butt', 'round'] as const) {
      const stroke: Stroke = { ...BASE, cap, dash: [14, 10] };
      for (const trim of [{ end: 0.27 }, { start: 0.33, end: 0.71 }, { start: 0.5 }]) {
        expect(disagreements(ZIGZAG, stroke, trim), `${cap} ${JSON.stringify(trim)}`).toEqual([]);
        expect(disagreements(SQUARE, stroke, trim), `${cap} ${JSON.stringify(trim)}`).toEqual([]);
      }
    }
  });

  it('on a curve, differs only beside the chord a cut lands on: the trimmed run ends on the curve, this on the chord', () => {
    const curve = pathFromD('M 0 100 C 20 0 100 0 120 100');
    const { points } = clipRibbon(curve, BASE).subpaths[0].polyline;
    for (const cap of ['butt', 'round'] as const) {
      for (const [start, end] of [[0.2, 0.6], [0, 0.45], [0.7, 1]]) {
        const cuts = [start, end].filter((t) => t > 0 && t < 1).map((t) => pointAlongPath(curve, t)!.point);
        const chords = cuts.map((c) => chordNear(points, c.x, c.y));
        for (const [x, y] of disagreements(curve, { ...BASE, cap }, { start, end })) {
          expect(Math.min(...chords.map((k) => toSegment(k, x, y))), `${cap} ${start}-${end} at ${x},${y}`)
            .toBeLessThan(BASE.width as number);
        }
      }
    }
  });

  it('draws nothing for an empty window', () => {
    expect(clipWindow(clipRibbon(ZIGZAG, BASE), ZIGZAG, { start: 0.6, end: 0.4 })).toBeNull();
  });
});
