import { describe, it, expect } from 'vitest';
import { schneiderFit } from './schneiderFit';
import { PATH_C, PATH_M, PATH_CMD_LENGTHS, type PolygonPath } from './types';

describe('schneiderFit — degenerate inputs', () => {
  it('returns an empty polygon path when samples is empty', () => {
    const out = schneiderFit([], 1) as PolygonPath;
    expect(out.kind).toBe('polygon');
    expect(out.commands.length).toBe(0);
    expect(out.coords.length).toBe(0);
  });

  it('returns a single-anchor path when samples has one point', () => {
    const out = schneiderFit([{ x: 5, y: 5 }], 1) as PolygonPath;
    expect(out.kind).toBe('polygon');
    expect(Array.from(out.commands)).toEqual([PATH_M]);
    expect(Array.from(out.coords)).toEqual([5, 5]);
  });

  it('returns a degenerate cubic when samples has exactly two points', () => {
    const out = schneiderFit([{ x: 0, y: 0 }, { x: 10, y: 0 }], 1) as PolygonPath;
    expect(out.kind).toBe('polygon');
    // M (0,0) + C (cp1, cp2, end)
    expect(Array.from(out.commands)).toEqual([PATH_M, PATH_C]);
    expect(out.coords[0]).toBe(0);
    expect(out.coords[1]).toBe(0);
    // end of cubic is the last sample
    expect(out.coords[6]).toBe(10);
    expect(out.coords[7]).toBe(0);
  });
});

function maxErrorAgainstCubic(
  samples: ReadonlyArray<{ x: number; y: number }>,
  path: PolygonPath,
): number {
  // Walk the path; for each C segment, sample t∈[0,1] at 64 steps and
  // compute max distance from any sample whose chord position falls in
  // that segment. Simple, but adequate for test assertions.
  const segs = readSegments(path);
  let max = 0;
  for (const p of samples) {
    let best = Infinity;
    for (const seg of segs) {
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const u = 1 - t;
        const x = u*u*u*seg.a.x + 3*u*u*t*seg.cp1.x + 3*u*t*t*seg.cp2.x + t*t*t*seg.b.x;
        const y = u*u*u*seg.a.y + 3*u*u*t*seg.cp1.y + 3*u*t*t*seg.cp2.y + t*t*t*seg.b.y;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < best) best = d;
      }
    }
    if (best > max) max = best;
  }
  return max;
}

interface CubicSeg {
  a: { x: number; y: number };
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  b: { x: number; y: number };
}

function readSegments(p: PolygonPath): CubicSeg[] {
  const segs: CubicSeg[] = [];
  let last = { x: 0, y: 0 };
  let ci = 0;
  for (let i = 0; i < p.commands.length; i++) {
    const cmd = p.commands[i];
    const n = PATH_CMD_LENGTHS[cmd];
    if (cmd === 0 /* M */) {
      last = { x: p.coords[ci], y: p.coords[ci + 1] };
    } else if (cmd === 2 /* C */) {
      const cp1 = { x: p.coords[ci], y: p.coords[ci + 1] };
      const cp2 = { x: p.coords[ci + 2], y: p.coords[ci + 3] };
      const b = { x: p.coords[ci + 4], y: p.coords[ci + 5] };
      segs.push({ a: last, cp1, cp2, b });
      last = b;
    }
    ci += n;
  }
  return segs;
}

describe('schneiderFit — single-segment fits', () => {
  it('fits a gentle arc within tolerance with one cubic', () => {
    // Quarter arc, radius 100, sampled at 16 evenly-spaced angles
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * (Math.PI / 2);
      samples.push({ x: 100 * Math.cos(t), y: 100 * Math.sin(t) });
    }
    const out = schneiderFit(samples, 1.0);
    expect(maxErrorAgainstCubic(samples, out as PolygonPath)).toBeLessThanOrEqual(1.0);
  });

  it('endpoint anchors of the fit match the first and last sample', () => {
    const samples = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 4 },
      { x: 3, y: 9 },
      { x: 4, y: 16 },
    ];
    const out = schneiderFit(samples, 1.0) as PolygonPath;
    // moveTo anchor must equal samples[0]
    expect(out.coords[0]).toBeCloseTo(0);
    expect(out.coords[1]).toBeCloseTo(0);
    // last cubic's end-anchor must equal samples[last]
    const lastTwo = Array.from(out.coords.slice(-2));
    expect(lastTwo[0]).toBeCloseTo(4);
    expect(lastTwo[1]).toBeCloseTo(16);
  });
});

describe('schneiderFit — iterative reparameterization', () => {
  it('fits a wide arc tighter after reparameterization than the LS-only baseline', () => {
    // 3/4 of a circle — wide enough that chord-length parameterization
    // alone gives a coarse fit; reparameterization should improve it.
    // LS-only produces ~8 units of error; after 4 Newton-Raphson passes
    // this drops below 7. A single cubic cannot model a 270° arc within
    // 2 units — Task 7 (split) handles that case.
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * (3 * Math.PI / 2);
      samples.push({ x: 50 * Math.cos(t), y: 50 * Math.sin(t) });
    }
    const out = schneiderFit(samples, 0.5);
    expect(maxErrorAgainstCubic(samples, out as PolygonPath)).toBeLessThanOrEqual(7.0);
  });
});

describe('schneiderFit — recursive split', () => {
  it('fits an S-curve within tolerance using multiple cubics', () => {
    // Sine S-curve with two inflection points; a single cubic can't
    // represent it within 1.0 worldunit tolerance.
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      samples.push({ x: t * 200, y: 40 * Math.sin(t * 2 * Math.PI) });
    }
    const out = schneiderFit(samples, 1.0) as PolygonPath;
    // Expect at least 2 cubic segments (split fired).
    const cubicCount = Array.from(out.commands).filter((c) => c === 2 /* PATH_C */).length;
    expect(cubicCount).toBeGreaterThanOrEqual(2);
    expect(maxErrorAgainstCubic(samples, out)).toBeLessThanOrEqual(1.0);
  });

  it('endpoint anchors of the multi-segment fit still match first/last sample', () => {
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      samples.push({ x: t * 200, y: 40 * Math.sin(t * 2 * Math.PI) });
    }
    const out = schneiderFit(samples, 1.0) as PolygonPath;
    expect(out.coords[0]).toBeCloseTo(0);
    expect(out.coords[1]).toBeCloseTo(0);
    const lastTwo = Array.from(out.coords.slice(-2));
    expect(lastTwo[0]).toBeCloseTo(samples[samples.length - 1].x);
    expect(lastTwo[1]).toBeCloseTo(samples[samples.length - 1].y);
  });

  it('fits a 270° arc within the original 2.0 tolerance using multiple cubics', () => {
    // Re-test the Task 6 reparam input — now with split available, should
    // hit the original spec tolerance of 2.0.
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * (3 * Math.PI / 2);
      samples.push({ x: 50 * Math.cos(t), y: 50 * Math.sin(t) });
    }
    const out = schneiderFit(samples, 2.0) as PolygonPath;
    expect(maxErrorAgainstCubic(samples, out)).toBeLessThanOrEqual(2.0);
  });
});
