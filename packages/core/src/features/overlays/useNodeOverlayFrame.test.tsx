import { beforeAll, describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { renderHook } from '@testing-library/react';
import { createScene } from '../../core/scene';
import { asNodeId, type NodeId, type RectPose } from '../../core/scene/types';
import type { View } from '../../core/viewport/view';
import { useNodeOverlayFrame, type NodeOverlayFrame } from './useNodeOverlayFrame';

beforeAll(() => {
  if (typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver === 'undefined') {
    class StubRO {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubRO }).ResizeObserver = StubRO;
  }
});

interface Data { label: string }
type Layer = 'main';

const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function container(width = 800, height = 600): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      width, height, x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, toJSON() {},
    }),
  });
  return el;
}

function sceneWith(
  nodes: readonly { id: string; pose: RectPose; parent?: string; kind?: 'leaf' | 'container' }[],
): ReturnType<typeof createScene<Data, Layer>> {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  for (const n of nodes) {
    scene.add({
      id: asNodeId(n.id),
      kind: n.kind ?? 'leaf',
      layer: 'main',
      pose: n.pose,
      data: { label: n.id },
      parent: n.parent === undefined ? null : asNodeId(n.parent),
    });
  }
  return scene;
}

function frameFor(
  scene: ReturnType<typeof createScene<Data, Layer>>,
  id: string | null,
  view: View = IDENTITY,
  el: HTMLDivElement = container(),
): NodeOverlayFrame | null {
  const { result } = renderHook(() => {
    const ref = useRef<HTMLDivElement>(el);
    return useNodeOverlayFrame(scene, ref, id as NodeId | null, { view });
  });
  return result.current;
}

const near = (p: { x: number; y: number }, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
};

describe('useNodeOverlayFrame', () => {
  it('reports the container size and the node box it maps from', () => {
    const scene = sceneWith([{ id: 'a', pose: { x: 10, y: 20, width: 100, height: 50 } }]);
    const frame = frameFor(scene, 'a', IDENTITY, container(640, 480));
    expect(frame).not.toBeNull();
    expect(frame!.width).toBe(640);
    expect(frame!.height).toBe(480);
    expect(frame!.box).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('projects the node frame through a panned, anisotropic view', () => {
    const scene = sceneWith([{ id: 'a', pose: { x: 10, y: 20, width: 100, height: 50 } }]);
    const frame = frameFor(scene, 'a', { x: 5, y: 5, scale: { x: 2, y: 3 } });
    near(frame!.toScreen({ x: 10, y: 20 }), 10, 45);
    near(frame!.toLocal({ x: 10, y: 45 }), 10, 20);
  });

  // The regression: `pose.rotation` is ignored end to end today, so handles on
  // a rotated node sit where the node would be if it had never been rotated.
  it('rotates about the pose center on the way to the screen', () => {
    const scene = sceneWith([
      { id: 'a', pose: { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 } },
    ]);
    const frame = frameFor(scene, 'a');
    // The box's right-edge midpoint swings to the bottom-edge midpoint.
    near(frame!.toScreen({ x: 100, y: 50 }), 50, 100);
    near(frame!.toScreen({ x: 50, y: 50 }), 50, 50);
  });

  it('inverts rotation on the way back from the screen', () => {
    const scene = sceneWith([
      { id: 'a', pose: { x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 } },
    ]);
    const frame = frameFor(scene, 'a');
    near(frame!.toLocal({ x: 50, y: 100 }), 100, 50);
  });

  it('round-trips a point through rotation, pan and anisotropic zoom', () => {
    const scene = sceneWith([
      { id: 'a', pose: { x: 40, y: 60, width: 120, height: 80, rotation: 0.7 } },
    ]);
    const frame = frameFor(scene, 'a', { x: -12, y: 30, scale: { x: 2.5, y: 1.25 } });
    const p = { x: 73, y: 91 };
    near(frame!.toLocal(frame!.toScreen(p)), p.x, p.y);
  });

  it('composes ancestor poses into the box', () => {
    const scene = sceneWith([
      { id: 'g', kind: 'container', pose: { x: 100, y: 200, width: 400, height: 400 } },
      { id: 'a', pose: { x: 10, y: 20, width: 30, height: 40 }, parent: 'g' },
    ]);
    const frame = frameFor(scene, 'a');
    expect(frame!.box).toEqual({ x: 110, y: 220, width: 30, height: 40 });
    near(frame!.toScreen({ x: 110, y: 220 }), 110, 220);
  });

  it('is null with no node id, an unknown id, or an unmeasured container', () => {
    const scene = sceneWith([{ id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } }]);
    expect(frameFor(scene, null)).toBeNull();
    expect(frameFor(scene, 'nope')).toBeNull();
    expect(frameFor(scene, 'a', IDENTITY, container(0, 0))).toBeNull();
  });
});
