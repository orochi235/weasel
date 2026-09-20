import { describe, expect, it } from 'vitest';
import { PORT_REACH, portControls as portControls2, portCurvePoints as points2 } from './portCurve2';
import { portControls as portControls3, portCurvePoints as points3 } from './3d/portCurve3';

describe('the port-curve rule', () => {
  it('pushes each control out along its port normal, by the reach fraction', () => {
    // 10 apart, so the reach is 10 * 0.4 = 4 in whichever direction the normal
    // points. c1 leaves along `out`; c2 is pushed *along* `in`, which points out
    // of the receiving port, so the curve arrives against it.
    const [c1, c2] = portControls2(0, 0, 10, 0, [0, -1], [0, 1]);
    expect(c1).toEqual([0, -4]);
    expect(c2).toEqual([10, 4]);
  });

  it('falls back to a lerp along the chord when a normal is absent', () => {
    const [c1, c2] = portControls2(0, 0, 10, 0, null, null);
    expect(c1).toEqual([4, 0]);
    expect(c2).toEqual([6, 0]);
  });

  it('takes the reach from the straight-line distance, not one axis', () => {
    // 3-4-5: the span is 5, so a unit normal reaches 5 * 0.4 = 2.
    const [c1] = portControls2(0, 0, 3, 4, [1, 0], null);
    expect(c1).toEqual([2, 0]);
  });

  it('samples without repeating the start point', () => {
    const pts = points2(0, 0, 10, 0, null, null, 4);
    expect(pts).toHaveLength(4);
    expect(pts[3]).toEqual([10, 0]);
  });

  it('exports the same reach from both dimensions', async () => {
    const three = await import('./3d/portCurve3');
    expect(three.PORT_REACH).toBe(PORT_REACH);
  });
});

// The 2D and 3D entry points wrap one implementation, and every operation in it
// is closed on the plane z = 0. These assert that rather than trusting it: if
// someone reimplements either wrapper, the two stop agreeing here.
describe('2D and 3D agree on a plane', () => {
  const cases: [string, [number, number], [number, number], [number, number] | null, [number, number] | null][] = [
    ['ported both ends', [0, 0], [10, 0], [0, -1], [0, 1]],
    ['no normals', [-3, 7], [11, -2], null, null],
    ['one end ported', [2, 2], [-8, 5], [1, 0], null],
    ['diagonal normals', [0, 0], [6, 8], [0.6, 0.8], [-0.6, -0.8]],
    ['zero-length span', [4, 4], [4, 4], [1, 0], [0, 1]],
  ];

  for (const [name, a, b, outN, inN] of cases) {
    it(name, () => {
      const flat2 = points2(a[0], a[1], b[0], b[1], outN, inN, 8).flat();
      const flat3 = points3(
        { x: a[0], y: a[1], z: 0 },
        { x: b[0], y: b[1], z: 0 },
        outN ? { x: outN[0], y: outN[1], z: 0 } : null,
        inN ? { x: inN[0], y: inN[1], z: 0 } : null,
        8,
      );
      expect(flat3.every((p) => p.z === 0)).toBe(true);
      expect(flat3.flatMap((p) => [p.x, p.y])).toEqual(flat2);
    });
  }

  it('leaves the plane when a normal does', () => {
    const [c1] = portControls3(
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      null,
    );
    expect(c1).toEqual({ x: 0, y: 0, z: 4 });
  });
});
