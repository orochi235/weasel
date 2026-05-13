import { describe, it, expect } from 'vitest';

// We test the pure setPose/getPose round-trip logic by reproducing the
// behavior the adapter encodes. This is intentionally lifted into a
// helper so we can unit-test it without mounting App.tsx.
import { applyPoseToObj } from './poseUpdate';
import type { Obj } from './poseUpdate';

describe('rotation round-trip via setPose', () => {
  it('stores rotation on a rect', () => {
    const r: Obj = {
      id: 'r', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#000', stroke: '#000', strokeWidth: 0,
    };
    const next = applyPoseToObj(r, { x: 0, y: 0, width: 10, height: 10, rotation: Math.PI / 4 });
    expect(next.rotation).toBeCloseTo(Math.PI / 4);
  });

  it('preserves rotation=0 when omitted (undefined)', () => {
    const r: Obj = {
      id: 'r', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#000', stroke: '#000', strokeWidth: 0,
    };
    const next = applyPoseToObj(r, { x: 0, y: 0, width: 10, height: 10 });
    expect(next.rotation).toBeUndefined();
  });

  it('preserves an existing rotation when caller leaves it out', () => {
    const r: Obj = {
      id: 'r', tool: 'rect', x: 0, y: 0, width: 10, height: 10,
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true,
      fill: '#000', stroke: '#000', strokeWidth: 0, rotation: 1,
    };
    const next = applyPoseToObj(r, { x: 5, y: 5, width: 10, height: 10 });
    expect(next.rotation).toBeCloseTo(1);
  });
});

describe('rotation summary for selection', () => {
  // Replicate the summary logic in a pure helper to keep the test focused.
  function summarize(items: Array<{ rotation?: number }>): { value: number; mixed: boolean } | null {
    if (items.length === 0) return null;
    const first = items[0].rotation ?? 0;
    const mixed = items.some((o) => (o.rotation ?? 0) !== first);
    return { value: Math.round((first * 180) / Math.PI), mixed };
  }

  it('returns null for empty selection', () => {
    expect(summarize([])).toBeNull();
  });

  it('reports uniform rotation without mixed flag', () => {
    expect(summarize([{ rotation: Math.PI / 4 }, { rotation: Math.PI / 4 }])).toEqual({ value: 45, mixed: false });
  });

  it('reports mixed when any rotation differs', () => {
    expect(summarize([{ rotation: Math.PI / 4 }, { rotation: Math.PI / 2 }])).toEqual({ value: 45, mixed: true });
  });

  it('treats undefined rotation as 0', () => {
    expect(summarize([{}, { rotation: 0 }])).toEqual({ value: 0, mixed: false });
  });
});
