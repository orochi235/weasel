import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { useContentBounds } from './useContentBounds';

describe('useContentBounds', () => {
  it('boxes the content again when the bounds source changes, with the scene unchanged', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
    const box = (size: number) => (): Bounds => ({ x: 0, y: 0, width: size, height: size });
    const { result, rerender } = renderHook(({ boundsOf }) => useContentBounds<RectPose>({
      scene: scene as never, boundsOf, boundsOfPose: () => null,
      adapter: { getPose: (id) => scene.get(id as never)!.pose },
      gestureSource: undefined, previewPoseExtra: undefined,
    }), { initialProps: { boundsOf: box(10) } });
    expect(result.current()?.width).toBe(10);
    rerender({ boundsOf: box(40) });
    expect(result.current()?.width).toBe(40);
  });
});
