/**
 * The range `useSceneSelectTool` hands the select tool and the `selectRange` dep: what a plain
 * click there could select, so nothing a click passes over.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import { useSceneAdapter } from 'canvas/useSceneAdapter';
import { useSceneSelectTool } from './useSceneSelectTool';
import type { RectPose } from 'core/geometry/rectPose';

type Layer = 'main' | 'shut' | 'off';

function harness(isPointerInteractive?: (id: string) => boolean) {
  return renderHook(() => {
    const scene = useScene<object, Layer, RectPose>({
      systemLayers: [{ id: 'main' }, { id: 'shut' }, { id: 'off' }],
    });
    const adapter = useSceneAdapter(scene);
    const tool = useSceneSelectTool({ scene, adapter, geometry: { picking: 'pose' }, ...(isPointerInteractive ? { isPointerInteractive } : {}) });
    return { scene, tool };
  });
}

const box = (x: number) => ({ x, y: 0, width: 10, height: 10 });

describe('useSceneSelectTool — range', () => {
  it('leaves out a node on a locked layer and one on a hidden layer', () => {
    const { result } = harness();
    const ids: string[] = [];
    act(() => {
      const s = result.current.scene;
      ids.push(s.add({ kind: 'mark', layer: 'main', pose: box(0), data: {} }));
      ids.push(s.add({ kind: 'mark', layer: 'shut', pose: box(20), data: {} }));
      ids.push(s.add({ kind: 'mark', layer: 'off', pose: box(40), data: {} }));
      ids.push(s.add({ kind: 'mark', layer: 'main', pose: box(60), data: {} }));
      s.setLayerLocked('shut', true);
      s.setLayerVisible('off', false);
    });
    expect(result.current.tool.selectRange.at(null)(ids[0] as never, ids[3] as never)).toEqual([ids[0], ids[3]]);
  });

  it('leaves out a node isPointerInteractive rejects', () => {
    let skip = '';
    const { result } = harness((id) => id !== skip);
    const ids: string[] = [];
    act(() => {
      const s = result.current.scene;
      for (const x of [0, 20, 40]) ids.push(s.add({ kind: 'mark', layer: 'main', pose: box(x), data: {} }));
    });
    skip = ids[1]!;
    expect(result.current.tool.selectRange.at(null)(ids[0] as never, ids[2] as never)).toEqual([ids[0], ids[2]]);
  });
});
