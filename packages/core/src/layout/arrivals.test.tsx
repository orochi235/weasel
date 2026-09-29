/**
 * Layouts reach the scene's arrival handler: a container's strategy decides
 * where an inserted or reparented child goes, in world coordinates, and the
 * scene stores the answer in each node's own frame.
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { composeRectPose, decomposeRectPose, IDENTITY_POSE_COMPOSITION } from 'features/groups/composePose';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { layoutArrivalHandler, useLayoutArrivals } from './arrivals';
import type { LayoutArrival, LayoutStrategy } from './types';

type P = { x: number; y: number; width: number; height: number };
const rect = (x: number, y: number, width = 10, height = 10): P => ({ x, y, width, height });
const LOCAL = { compose: composeRectPose, decompose: decomposeRectPose, closure: 'translation' as const };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

/** A strategy whose only opinion is `arrive`. */
function arriving(fn: NonNullable<LayoutStrategy<P>['arrive']>): LayoutStrategy<P> {
  return {
    snap: { pickTarget: () => null },
    childPoses: () => new Map(),
    getDropTargets: () => [],
    reflowPoses: () => new Map(),
    commitDrop: () => [],
    arrive: vi.fn(fn),
  };
}

function sceneWithBox(boxPose = rect(100, 100, 50, 50)) {
  const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'container', id: 'box' as NodeId, layer: 'main', data: {}, pose: boxPose });
  return scene;
}

describe('layoutArrivalHandler', () => {
  it('hands the strategy world poses and stores its answer in the local frame', () => {
    const scene = sceneWithBox();
    const seen: unknown[] = [];
    const grid = arriving((container, children, arrivals) => {
      seen.push({ bounds: container.bounds, children, arrivals: [...arrivals] });
      return { poses: new Map([['kid', rect(120, 130)]]) };
    });
    scene.setArrivalHandler(layoutArrivalHandler(scene, { layouts: { box: grid }, poseComposition: LOCAL as never }));
    // Stored relative to the box: world (105, 105).
    scene.add({ kind: 'leaf', id: 'kid' as NodeId, parent: 'box' as NodeId, layer: 'main', data: {}, pose: rect(5, 5) });
    expect(seen).toEqual([{
      bounds: rect(100, 100, 50, 50),
      children: [{ id: 'kid', pose: rect(105, 105) }],
      arrivals: ['kid'],
    }]);
    expect(scene.get('kid' as NodeId)!.pose).toEqual(rect(20, 30));
  });

  it('resizes the container and rebases children into its new frame', () => {
    const scene = sceneWithBox();
    const grid = arriving((): LayoutArrival<P> => ({
      poses: new Map([['kid', rect(100, 160)]]),
      bounds: rect(100, 100, 50, 80),
    }));
    scene.setArrivalHandler(layoutArrivalHandler(scene, { layouts: { box: grid }, poseComposition: LOCAL as never }));
    scene.add({ kind: 'leaf', id: 'kid' as NodeId, parent: 'box' as NodeId, layer: 'main', data: {}, pose: rect(0, 0) });
    expect(scene.get('box' as NodeId)!.pose).toEqual(rect(100, 100, 50, 80));
    expect(scene.get('kid' as NodeId)!.pose).toEqual(rect(0, 60));
    scene.undo();
    expect(scene.get('box' as NodeId)!.pose).toEqual(rect(100, 100, 50, 50));
  });

  it('refuses when the strategy does, and leaves containers without arrive alone', () => {
    const scene = sceneWithBox();
    scene.add({ kind: 'container', id: 'free' as NodeId, layer: 'main', data: {}, pose: rect(0, 0, 50, 50) });
    const handler = layoutArrivalHandler(scene, {
      layouts: (id) => (id === 'box' ? arriving(() => null) : null),
      poseComposition: IDENTITY_POSE_COMPOSITION as never,
    });
    scene.setArrivalHandler(handler);
    expect(() => scene.add({ kind: 'leaf', parent: 'box' as NodeId, layer: 'main', data: {}, pose: rect(0, 0) })).toThrow();
    expect(scene.childrenOf('box' as NodeId)).toHaveLength(0);
    scene.add({ kind: 'leaf', id: 'k' as NodeId, parent: 'free' as NodeId, layer: 'main', data: {}, pose: rect(3, 4) });
    expect(scene.get('k' as NodeId)!.pose).toEqual(rect(3, 4));
  });
});

describe('useLayoutArrivals', () => {
  it('installs while mounted and reads the latest layouts', () => {
    const scene = sceneWithBox(rect(0, 0, 50, 50));
    const first = arriving(() => ({ poses: new Map() }));
    const second = arriving(() => ({ poses: new Map() }));
    const { rerender, unmount } = renderHook(
      ({ layouts }) => useLayoutArrivals(scene, { layouts }),
      { initialProps: { layouts: { box: first } } },
    );
    rerender({ layouts: { box: second } });
    scene.add({ kind: 'leaf', parent: 'box' as NodeId, layer: 'main', data: {}, pose: rect(0, 0) });
    expect(first.arrive).not.toHaveBeenCalled();
    expect(second.arrive).toHaveBeenCalledTimes(1);
    unmount();
    scene.add({ kind: 'leaf', parent: 'box' as NodeId, layer: 'main', data: {}, pose: rect(0, 0) });
    expect(second.arrive).toHaveBeenCalledTimes(1);
  });

  it('is wired by <SceneCanvas layouts>', () => {
    const scene = sceneWithBox(rect(0, 0, 50, 50));
    const grid = arriving(() => ({ poses: new Map([['kid', rect(40, 40)]]) }));
    render(<SceneCanvas scene={scene} layers={{}} width={200} height={200} layouts={{ box: grid }} />);
    act(() => {
      scene.add({ kind: 'leaf', id: 'kid' as NodeId, parent: 'box' as NodeId, layer: 'main', data: {}, pose: rect(0, 0) });
    });
    expect(scene.get('kid' as NodeId)!.pose).toEqual(rect(40, 40));
  });
});
