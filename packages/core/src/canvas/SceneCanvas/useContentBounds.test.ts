import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { translate } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { effectivePose } from 'core/scene/effectivePose';
import type { RectPose } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';
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

  it('reaches the copies a group draws', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const g = scene.add({
      kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 }, data: null,
      copiesFromPose: () => [translate(100, 0)],
    });
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null, parent: g });
    const { result } = renderHook(() => useContentBounds<RectPose>({
      scene: scene as never, boundsOf: () => ({ x: 0, y: 0, width: 10, height: 10 }), boundsOfPose: () => null,
      adapter: { getPose: (id) => scene.get(id as never)!.pose },
      gestureSource: undefined, previewPoseExtra: undefined,
    }));
    expect(result.current()).toEqual({ x: 0, y: 0, width: 110, height: 10 });
  });

  it('boxes the content again when a pose override moves a node, which leaves the version alone', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
    const { result } = renderHook(() => useContentBounds<RectPose>({
      scene: scene as never, boundsOf: (n) => effectivePose(scene, scene.get(n as never)!), boundsOfPose: () => null,
      adapter: { getPose: (n) => effectivePose(scene, scene.get(n as never)!) },
      gestureSource: undefined, previewPoseExtra: undefined,
    }));
    expect(result.current()?.x).toBe(0);
    scene.overrides.set(id, { pose: { x: 5000, y: 0, width: 10, height: 10 } });
    scene.overrides.commit();
    expect(result.current()?.x).toBe(5000);
  });
  it('boxes the content again when the camera it is boxed under moves', () => {
    const scene = createScene<null, 'main' | 'far', RectPose>({ systemLayers: [{ id: 'main' }, { id: 'far', parallax: { pan: 0.5 } }] });
    scene.add({ kind: 'mark', layer: 'far', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
    let view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const { result } = renderHook(() => useContentBounds<RectPose>({
      scene: scene as never, boundsOf: () => ({ x: view.x / 2, y: 0, width: 10 * view.scale.x, height: 10 }), boundsOfPose: () => null,
      adapter: { getPose: (id) => scene.get(id as never)!.pose }, getView: () => view,
      gestureSource: undefined, previewPoseExtra: undefined,
    }));
    expect(result.current()).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    view = { x: 100, y: 0, scale: { x: 2, y: 2 } };
    expect(result.current()).toEqual({ x: 50, y: 0, width: 20, height: 10 });
  });

  it('keeps the box across a pan with no parallax layer to move it', () => {
    const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null });
    let view: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    let boxed = 0;
    const { result } = renderHook(() => useContentBounds<RectPose>({
      scene: scene as never, boundsOf: () => { boxed++; return { x: 0, y: 0, width: 10, height: 10 }; }, boundsOfPose: () => null,
      adapter: { getPose: (id) => scene.get(id as never)!.pose }, getView: () => view,
      gestureSource: undefined, previewPoseExtra: undefined,
    }));
    result.current();
    view = { x: 500, y: 20, scale: { x: 1, y: 1 } };
    result.current();
    expect(boxed).toBe(1);
  });
});
