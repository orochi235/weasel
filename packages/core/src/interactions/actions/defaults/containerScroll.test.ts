import { describe, expect, it } from 'vitest';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { IDENTITY_POSE_COMPOSITION, RIGID_POSE_COMPOSITION, type PoseComposition } from 'core/scene/composePose';
import { asNodeId, type RectPose } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { LayoutStrategy } from '../../../layout/types';
import { containerScrollAction, scrollRange } from './containerScroll';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';

/** Children stacked 40 tall from the container's top, running on past its
 *  bottom, with an extent covering every one of them. */
function overflowingStack(): LayoutStrategy<RectPose> {
  return {
    snap: { pickTarget: () => null },
    childPoses: (container, children) => new Map(children.map((c, i) => [c.id, {
      x: container.bounds.x, y: container.bounds.y + i * 40, width: container.bounds.width, height: 40,
    }])),
    contentExtent: (container, children) => ({
      ...container.bounds, height: Math.max(container.bounds.height, children.length * 40),
    }),
    getDropTargets: () => [],
    reflowPoses: () => new Map(),
    commitDrop: () => [],
  };
}

const C = asNodeId('C');

function setup(rows = 5, rotation = 0) {
  const scene = createScene<null, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    composition: RIGID_POSE_COMPOSITION,
    initial: [{
      id: C, kind: 'group', layer: 'l', pose: { x: 100, y: 100, width: 50, height: 100, rotation }, data: null, layout: overflowingStack(),
    }],
  });
  for (let i = 0; i < rows; i++) {
    scene.add({ kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 5, height: 5 }, data: null, parent: C });
  }
  let view: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };
  const deps = { scene, view: { get: () => view, set: (v: View) => { view = v; } } } as unknown as ActionDeps;
  return { scene, deps };
}

const wheel = (deps: ActionDeps, at: { x: number; y: number }, deltaY: number, swapAxis = false): void | 'pass' =>
  (containerScrollAction.invoker as ImmediateInvoker).run(deps, { world: { x: at.x, y: at.y }, deltaX: 0, deltaY, swapAxis });

describe('containerScrollAction', () => {
  it('reads the range from the strategy\'s contentExtent', () => {
    const { scene } = setup();
    expect(scrollRange(scene as never, C, AUTO_POSE_DESCRIPTOR)).toEqual({ x: [0, 0], y: [0, 100] });
  });

  it('takes a wheel over an overflowing container and declines one anywhere else', () => {
    const { deps } = setup();
    expect(containerScrollAction.enabled!(deps, { x: 120, y: 150 })).toBe(true);
    expect(containerScrollAction.enabled!(deps, { x: 20, y: 20 })).not.toBe(true);
    expect(containerScrollAction.enabled!(deps, undefined)).not.toBe(true);
  });

  it('declines over a container whose content fits', () => {
    const { deps } = setup(2);
    expect(containerScrollAction.enabled!(deps, { x: 120, y: 150 })).not.toBe(true);
  });

  it('scrolls by the wheel in world units, clamped to the extent, and moves no stored pose', () => {
    const { scene, deps } = setup();
    const stored = scene.childrenOf(C).map((id) => scene.get(id)!.pose);
    wheel(deps, { x: 120, y: 150 }, 60);
    expect(scene.scroll.get(C)).toEqual({ x: 0, y: 30 });
    wheel(deps, { x: 120, y: 150 }, 1000);
    expect(scene.scroll.get(C)).toEqual({ x: 0, y: 100 });
    wheel(deps, { x: 120, y: 150 }, -5000);
    expect(scene.scroll.get(C)).toBeUndefined();
    expect(scene.childrenOf(C).map((id) => scene.get(id)!.pose)).toEqual(stored);
  });

  it('leaves an axis with nowhere to go where it is, and passes the wheel on', () => {
    const { scene, deps } = setup();
    expect(wheel(deps, { x: 120, y: 150 }, 60, true)).toBe('pass');
    expect(scene.scroll.get(C)).toBeUndefined();
  });

  it('passes the wheel on at the end of its range, and takes it again turned back', () => {
    const { scene, deps } = setup();
    expect(wheel(deps, { x: 120, y: 150 }, -60)).toBe('pass');
    expect(wheel(deps, { x: 120, y: 150 }, 1000)).toBeUndefined();
    expect(wheel(deps, { x: 120, y: 150 }, 60)).toBe('pass');
    expect(scene.scroll.get(C)).toEqual({ x: 0, y: 100 });
    expect(wheel(deps, { x: 120, y: 150 }, -60)).toBeUndefined();
    expect(scene.scroll.get(C)).toEqual({ x: 0, y: 70 });
  });

  it('hands the wheel to the scrollable container holding one at the end of its range', () => {
    const { scene, deps } = setup(4);
    const inner = scene.add({
      kind: 'group', layer: 'l', pose: { x: 0, y: 0, width: 50, height: 40 }, data: null, parent: C, index: 0, layout: overflowingStack(),
    });
    for (let i = 0; i < 5; i++) {
      scene.add({ kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 5, height: 5 }, data: null, parent: inner });
    }
    const at = { x: 120, y: 110 };
    expect(wheel(deps, at, 1000)).toBeUndefined();
    expect(scene.scroll.get(inner)).toEqual({ x: 0, y: 160 });
    expect(scene.scroll.get(C)).toBeUndefined();
    expect(wheel(deps, at, 1000)).toBeUndefined();
    expect(scene.scroll.get(C)).toEqual({ x: 0, y: 100 });
    expect(wheel(deps, at, 1000)).toBe('pass');
  });

  it('measures a turned container\'s range along its own axes', () => {
    const { scene } = setup(5, Math.PI / 4);
    const r = scrollRange(scene as never, C, AUTO_POSE_DESCRIPTOR)!;
    [...r.x, ...r.y].forEach((v, i) => expect(v).toBeCloseTo([0, 0, 0, 100][i], 9));
  });

  it('takes a wheel only over a turned container\'s own area, not its box\'s corners', () => {
    const { deps } = setup(5, Math.PI / 4);
    expect(containerScrollAction.enabled!(deps, { x: 125, y: 150 })).toBe(true);
    expect(containerScrollAction.enabled!(deps, { x: 80, y: 105 })).not.toBe(true);
  });

  it('declines under a composition that cannot scroll', () => {
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      composition: IDENTITY_POSE_COMPOSITION as PoseComposition<RectPose>,
      initial: [{ id: C, kind: 'group', layer: 'l', pose: { x: 100, y: 100, width: 50, height: 100 }, data: null, layout: overflowingStack() }],
    });
    for (let i = 0; i < 5; i++) scene.add({ kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 5, height: 5 }, data: null, parent: C });
    expect(scrollRange(scene as never, C, AUTO_POSE_DESCRIPTOR)).toBeNull();
  });
});
