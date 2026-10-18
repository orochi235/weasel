import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAlign, type AlignAdapter } from './align';
import type { Op } from 'core/ops/types';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose } from 'core/scene/types';

const RED = { kind: 'solid', color: '#f00' } as const;

function setup() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: asNodeId('a'), kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 20, height: 20 },
    data: { shape: 'rect', stroke: { paint: RED, width: 10 } },
  } as never);
  scene.add({
    id: asNodeId('b'), kind: 'leaf', layer: 'main', pose: { x: 50, y: 0, width: 20, height: 20 },
    data: { shape: 'rect', stroke: { paint: RED, width: { px: 4 } } },
  } as never);
  const moved: Record<string, RectPose> = {};
  const adapter: AlignAdapter<RectPose> = {
    getSelection: () => ['a', 'b'] as NodeId[],
    getPose: (id) => scene.get(id)!.pose,
    getParent: () => null,
    applyOps: (ops: Op[]) => {
      for (const op of ops) op.apply({ setPose: (id: string, pose: RectPose) => { moved[id] = pose; } } as never);
    },
  };
  return { scene, adapter, moved };
}

describe('useAlign over a scene', () => {
  it('lines up the drawn edges, stroke included', () => {
    const { scene, adapter, moved } = setup();
    const { result } = renderHook(() => useAlign(adapter, { scene }));
    act(() => { result.current.align('left'); });
    // a's drawn left is -5; b's stroke reaches 2 past its box at scale 1.
    expect(moved.b?.x).toBe(-3);
  });

  it('resolves a screen-pixel stroke at the scale it is given', () => {
    const { scene, adapter, moved } = setup();
    const { result } = renderHook(() => useAlign(adapter, { scene, viewScale: () => 2 }));
    act(() => { result.current.align('left'); });
    expect(moved.b?.x).toBe(-4);
  });

  it('lines up pose boxes with no scene', () => {
    const { adapter, moved } = setup();
    const { result } = renderHook(() => useAlign(adapter));
    act(() => { result.current.align('left'); });
    expect(moved.b?.x).toBe(0);
  });
});
