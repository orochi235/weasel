/** Counterexamples the clipper's property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { circleArea, clipPolygon, clipPolyline, insideArea, rectArea } from './clip';

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

  it('holds an area with no inside to the segment or point it is', () => {
    const line = rectArea({ x: 5, y: 5, width: 10, height: 0 });
    expect(insideArea(line, { x: 100, y: 5 })).toBe(false);
    expect(insideArea(line, { x: 10, y: 5 })).toBe(true);
    const dot = rectArea({ x: 5, y: 5, width: 0, height: 0 });
    expect(insideArea(dot, { x: 100, y: -50 })).toBe(false);
    expect(clipPolyline(dot, [{ x: 100, y: 100 }, { x: -100, y: 3 }])).toEqual([]);
    expect(insideArea(circleArea({ x: 5, y: 5 }, 0), { x: 100, y: -50 })).toBe(false);
  });

  it('pulls a crossing a rounding outside the area inside it', () => {
    const area = [
      { x: 5, y: -187.78254751155208 }, { x: 82.23130556292534, y: -150.58991097507854 }, { x: 101.30586280543925, y: -67.01881526914543 },
      { x: 47.86014107387006, y: -1.4210854715202004e-14 }, { x: -37.86014107387004, y: 0 }, { x: -91.30586280543925, y: -67.01881526914542 },
      { x: -72.23130556292536, y: -150.5899109750785 },
    ];
    const runs = clipPolyline(area, [{ x: -208, y: 0 }, { x: 1e12, y: 0 }, { x: 5, y: -187.78254751155208 }]);
    for (const p of runs.flat()) expect(insideArea(area, p)).toBe(true);
  });
});
