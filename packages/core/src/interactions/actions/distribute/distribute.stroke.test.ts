import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDistribute, type DistributeAdapter } from './distribute';
import type { Op } from 'core/ops/types';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose } from 'core/scene/types';

const RED = { kind: 'solid', color: '#f00' } as const;

function setup() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const add = (id: string, x: number, width: number | { px: number }) => scene.add({
    id: asNodeId(id), kind: 'mark', layer: 'main', pose: { x, y: 0, width: 20, height: 20 },
    data: { shape: 'rect', stroke: { paint: RED, width } },
  } as never);
  add('a', 0, 20);
  add('b', 40, 0);
  add('c', 100, { px: 4 });
  const moved: Record<string, RectPose> = {};
  const adapter: DistributeAdapter<RectPose> = {
    getSelection: () => ['a', 'b', 'c'] as NodeId[],
    getPose: (id) => scene.get(id)!.pose,
    getParent: () => null,
    applyOps: (ops: Op[]) => {
      for (const op of ops) op.apply({ setPose: (id: string, pose: RectPose) => { moved[id] = pose; } } as never);
    },
  };
  return { scene, adapter, moved };
}

describe('useDistribute over a scene', () => {
  it('spaces the drawn boxes, stroke included', () => {
    const { scene, adapter, moved } = setup();
    const { result } = renderHook(() => useDistribute(adapter, { scene }));
    act(() => { result.current.distribute('x', 'gaps'); });
    // Drawn: a -10..30, b 40..60, c 98..122 at scale 1: a span of 132 less 84 drawn is two gaps of 24.
    expect(moved.b?.x).toBe(54);
  });

  it('resolves a screen-pixel stroke at the scale it is given', () => {
    const { scene, adapter, moved } = setup();
    const { result } = renderHook(() => useDistribute(adapter, { scene, viewScale: () => 2 }));
    act(() => { result.current.distribute('x', 'gaps'); });
    // c's 4px stroke is 2 world units at scale 2: c draws 99..121, span 131 less 82 is two gaps of 24.5.
    expect(moved.b?.x).toBe(54.5);
  });

  it('spaces pose boxes with no scene', () => {
    const { adapter, moved } = setup();
    const { result } = renderHook(() => useDistribute(adapter));
    act(() => { result.current.distribute('x', 'gaps'); });
    expect(moved.b?.x).toBe(50);
  });
});
