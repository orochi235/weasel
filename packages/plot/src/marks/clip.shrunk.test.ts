/** Counterexamples the clipper's property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { clipPolygon, rectArea } from './clip';

const finite = (pts: readonly { x: number; y: number }[]) => pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

describe('clipPolygon, shrunk', () => {
  it('cuts an edge crossed only far out, past where its ends are moved in, without NaN', () => {
    const square = rectArea({ x: 0, y: 0, width: 1, height: 1 });
    const out = clipPolygon(square, [{ x: 0, y: 2 }, { x: -Infinity, y: 0 }, { x: 0, y: 0 }]);
    expect(finite(out)).toBe(true);
    expect(out).toContainEqual({ x: 0, y: 1 });
  });

  it('cuts a long rect to a small polygon without NaN', () => {
    const small = [
      { x: 3, y: -1.070552360820166 }, { x: 4.035276180410083, y: -0.7931509443361071 }, { x: 4.793150944336107, y: -0.03527618041008318 },
      { x: 5.070552360820166, y: 0.9999999999999999 }, { x: 4.793150944336107, y: 2.0352761804100825 }, { x: 4.035276180410083, y: 2.793150944336107 },
      { x: 3.0000000000000004, y: 3.070552360820166 }, { x: 1.9647238195899177, y: 2.7931509443361073 }, { x: 1.2068490556638933, y: 2.035276180410084 },
      { x: 0.9294476391798341, y: 1.0000000000000004 }, { x: 1.2068490556638931, y: -0.03527618041008318 }, { x: 1.9647238195899162, y: -0.7931509443361062 },
    ];
    const out = clipPolygon(small, rectArea({ x: 0, y: 0, width: 29, height: 91 }));
    expect(out).toHaveLength(9);
    expect(finite(out)).toBe(true);
  });
});
