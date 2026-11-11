/**
 * Path data through `serializeSvg` and `parseSvg` at every magnitude a stored coordinate can have: each command
 * and coordinate reads back as the six-decimal number written for it (to float32's rounding of the path's size), exponent forms (`1e+21`) included, and
 * the document's viewBox stays finite.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PATH_C, PATH_L, PATH_Q, PathBuilder, trimNumber, worldCoords } from '@weasel-js/geom';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgPathNode } from './types';
import { runs, timeoutFor } from './pbt.fixture';

const N = 300;
const F32_MAX = 3.4028234663852886e38;

/** A float32 coordinate, from tiny to near float32's limit. */
const coord = fc.oneof(
  fc.integer({ min: -8000, max: 8000 }).map((n) => n / 8),
  fc.float({ noNaN: true, noDefaultInfinity: true, min: -F32_MAX / 4, max: F32_MAX / 4 }),
  fc.tuple(fc.integer({ min: -9, max: 9 }), fc.integer({ min: -12, max: 37 })).map(([m, e]) => Math.fround(m * 10 ** e)),
).map((v) => v + 0);
const pt = fc.tuple(coord, coord);
const segment = fc.oneof(
  pt.map((p) => ({ cmd: PATH_L, pts: [p] })),
  fc.tuple(pt, pt).map((ps) => ({ cmd: PATH_Q, pts: ps })),
  fc.tuple(pt, pt, pt).map((ps) => ({ cmd: PATH_C, pts: ps })),
);
const subpath = fc.record({ start: pt, segs: fc.array(segment, { minLength: 1, maxLength: 4 }), closed: fc.boolean() });

describe('path data at any magnitude, property', () => {
  it('reads back every command, and every coordinate as written to six decimals', () => {
    let exponents = 0;
    fc.assert(fc.property(fc.array(subpath, { minLength: 1, maxLength: 3 }), (subs) => {
      const b = new PathBuilder();
      for (const s of subs) {
        b.moveTo(...s.start);
        for (const g of s.segs) {
          const xs = g.pts.flat();
          if (g.cmd === PATH_L) b.lineTo(xs[0]!, xs[1]!);
          else if (g.cmd === PATH_Q) b.quadTo(xs[0]!, xs[1]!, xs[2]!, xs[3]!);
          else b.curveTo(xs[0]!, xs[1]!, xs[2]!, xs[3]!, xs[4]!, xs[5]!);
        }
        if (s.closed) b.close();
      }
      const path = b.build();
      // Unstroked: boxing a stroke this large is slow (docs/PERF.md).
      const node: SvgPathNode = { kind: 'path', path, fill: { kind: 'none' } };
      const xml = serializeSvg([node]);
      if (/\de[+-]\d/.test(xml)) exponents++;
      const out = parseSvg(xml);
      expect(out.warnings, xml).toEqual([]);
      expect(out.nodes, xml).toHaveLength(1);
      for (const v of Object.values(out.viewBox ?? {})) expect(Number.isFinite(v), xml).toBe(true);
      const back = (out.nodes[0] as SvgPathNode).path;
      if (back.kind !== 'polygon' || path.kind !== 'polygon') throw new Error('not a polygon');
      expect(Array.from(back.commands), xml).toEqual(Array.from(path.commands));
      const want = Array.from(worldCoords(path), (v) => Number(trimNumber(v)));
      const got = worldCoords(back);
      expect(got.length).toBe(want.length);
      // Within float32's rounding of the path's extent: a path stores float32 coordinates about an origin.
      const size = Math.max(...want.map(Math.abs));
      want.forEach((w, i) => expect(Math.abs(got[i]! - w), `${i}: ${got[i]} vs ${w} in ${xml}`).toBeLessThanOrEqual(size * 2 ** -22));
    }), runs(N));
    expect(exponents).toBeGreaterThan(runs(N).numRuns / 5);
  }, timeoutFor(N, 10));
});

