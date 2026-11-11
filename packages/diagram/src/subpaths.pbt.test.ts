/** `subpathOf`: a path's subpaths, taken in turn until the first null, are the path cut at each move. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PATH_M, PathBuilder, worldCoords, type PolygonPath } from '@weasel-js/geom';
import { gridCoord, runs, tally, timeoutFor } from './pbt.fixture';
import { subpathOf } from './subpaths';

const RUNS = 300;

type Step = ['M' | 'L' | 'Q' | 'C' | 'Z', number[]];
const step: fc.Arbitrary<Step> = fc.oneof(
  fc.tuple(fc.constant('M' as const), fc.array(gridCoord, { minLength: 2, maxLength: 2 })),
  fc.tuple(fc.constant('L' as const), fc.array(gridCoord, { minLength: 2, maxLength: 2 })),
  fc.tuple(fc.constant('Q' as const), fc.array(gridCoord, { minLength: 4, maxLength: 4 })),
  fc.tuple(fc.constant('C' as const), fc.array(gridCoord, { minLength: 6, maxLength: 6 })),
  fc.tuple(fc.constant('Z' as const), fc.constant([])),
);

const path = fc.tuple(fc.array(gridCoord, { minLength: 2, maxLength: 2 }), fc.array(step, { maxLength: 10 }), fc.constantFrom('nonzero', 'evenodd') as fc.Arbitrary<'nonzero' | 'evenodd'>)
  .map(([[x, y], steps, rule]) => {
    const b = new PathBuilder().setFillRule(rule).moveTo(x!, y!);
    for (const [cmd, c] of steps) {
      if (cmd === 'M') b.moveTo(c[0]!, c[1]!);
      else if (cmd === 'L') b.lineTo(c[0]!, c[1]!);
      else if (cmd === 'Q') b.quadTo(c[0]!, c[1]!, c[2]!, c[3]!);
      else if (cmd === 'C') b.curveTo(c[0]!, c[1]!, c[2]!, c[3]!, c[4]!, c[5]!);
      else b.close();
    }
    return b.build() as PolygonPath;
  });

describe('subpathOf', () => {
  it('cuts a path at each move into subpaths that rejoin as the path', () => {
    const seen = tally();
    fc.assert(fc.property(path, (p) => {
      const parts: PolygonPath[] = [];
      for (let i = 0; ; i++) {
        const part = subpathOf(p, i);
        if (part === null) break;
        parts.push(part as PolygonPath);
        expect(i).toBeLessThan(p.commands.length + 1);
      }
      const moves = Array.from(p.commands).filter((c) => c === PATH_M).length;
      expect(parts).toHaveLength(moves);
      if (moves > 1) seen.count('several');
      for (const part of parts) {
        expect(part.commands[0]).toBe(PATH_M);
        expect(Array.from(part.commands).filter((c) => c === PATH_M)).toHaveLength(1);
        expect(part.fillRule).toBe(p.fillRule);
      }
      expect(parts.flatMap((q) => Array.from(q.commands))).toEqual(Array.from(p.commands));
      expect(parts.flatMap((q) => Array.from(worldCoords(q)))).toEqual(Array.from(worldCoords(p)));
    }), runs(RUNS));
    seen.atLeast('several', RUNS / 4);
  }, timeoutFor(RUNS, 1));
});
