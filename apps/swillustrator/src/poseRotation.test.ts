import { describe, it, expect } from 'vitest';

// We test the pure setPose/getPose round-trip logic by reproducing the
// behavior the adapter encodes. This is intentionally lifted into a
// helper so we can unit-test it without mounting App.tsx.
import { applyPoseToObj } from './poseUpdate';
import type { Obj } from './poseUpdate';

describe('rotation round-trip via setPose', () => {
  it('stores rotation on a rect', () => {
    const r: Obj = { id: 'r', kind: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#000', stroke: '#000', strokeWidth: 0 };
    const next = applyPoseToObj(r, { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 4 });
    expect(next.rotation).toBeCloseTo(Math.PI / 4);
  });

  it('preserves rotation=0 when omitted (undefined)', () => {
    const r: Obj = { id: 'r', kind: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#000', stroke: '#000', strokeWidth: 0 };
    const next = applyPoseToObj(r, { x: 0, y: 0, width: 10, height: 10 });
    expect(next.rotation).toBeUndefined();
  });

  it('preserves an existing rotation when caller leaves it out', () => {
    const r: Obj = { id: 'r', kind: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#000', stroke: '#000', strokeWidth: 0, rotation: 1 };
    const next = applyPoseToObj(r, { x: 5, y: 5, width: 10, height: 10 });
    expect(next.rotation).toBeCloseTo(1);
  });
});
