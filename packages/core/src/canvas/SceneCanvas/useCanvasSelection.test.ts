import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import { useCanvasSelection } from './useCanvasSelection';

const sceneWithMark = () => {
  const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
  return { scene, id };
};

describe('useCanvasSelection', () => {
  it('seeds a swapped-in scene with the `initial` passed alongside it', () => {
    const a = sceneWithMark();
    const b = sceneWithMark();
    const { rerender } = renderHook(({ scene, initial }: { scene: typeof a.scene; initial: readonly NodeId[] }) =>
      useCanvasSelection({ scene, props: { selectionOptions: { initial } }, selectable: true, kindOf: undefined }),
    { initialProps: { scene: a.scene, initial: [a.id] } });
    expect(a.scene.getSelection()).toEqual([a.id]);
    rerender({ scene: b.scene, initial: [b.id] });
    expect(b.scene.getSelection()).toEqual([b.id]);
  });
});
