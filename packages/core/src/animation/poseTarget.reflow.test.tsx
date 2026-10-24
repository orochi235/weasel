/**
 * A pose target retargeted mid-run on a container whose layout reflows its
 * children: the target's own write lays them out again, the reflow publishes
 * their glides to the overrides, and the target must not read that as
 * something else overwriting its pose.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from '@weasel-js/animator/react';
import type { Animator } from '@weasel-js/animator';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import { asNodeId, type RectPose } from '../core/scene/types';
import type { LayoutStrategy } from '../layout/types';
import { createDepartures } from './departures';
import { scenePoseTarget } from './poseTarget';
import { bindPoseTransition } from './poseTransition';
import { createReflowTransition } from './reflow';

/** Children stacked top to bottom in child order, each 10 tall and as wide as the container. */
function stack(): LayoutStrategy<RectPose> {
  return {
    snap: { pickTarget: () => null },
    childPoses(container, children) {
      return new Map(children.map((c, i) => [c.id, {
        x: container.bounds.x, y: container.bounds.y + i * 10, width: container.bounds.width, height: 10,
      }]));
    },
    getDropTargets: () => [],
    reflowPoses: () => new Map(),
    commitDrop: () => [],
  };
}

const C = asNodeId('C');
/** The container at width `w`: a resize, which its layout answers by laying the children out again. */
const at = (w: number): RectPose => ({ x: 0, y: 0, width: w, height: 100 });

function setup() {
  const cbs: ((t: number) => void)[] = [];
  let clock = 0;
  const { result } = renderHook(() => useAnimator({
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => clock,
  }));
  const frame = (t: number) => {
    clock = t;
    act(() => { for (const cb of cbs.splice(0)) cb(t); });
  };
  const scene = createScene<null, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    initial: [
      { id: C, kind: 'group', layer: 'l', pose: at(10), data: null, layout: stack() },
      { id: asNodeId('a'), kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null, parent: C },
      { id: asNodeId('b'), kind: 'mark', layer: 'l', pose: { x: 0, y: 10, width: 10, height: 10 }, data: null, parent: C },
    ],
  });
  const transition = createReflowTransition(scene, result.current, { ms: 100, easing: linear });
  bindPoseTransition(scene, () => ({ transition }), createDepartures<RectPose, unknown>());
  // As the canvas's layout dep does: each layout write glides from where it was.
  scene.onReflow((moves) => {
    for (const m of moves) transition.settle(m.id as string, transition.poseOf(m.id as string) === undefined ? { from: m.from } : undefined);
  });
  const shown = () => effectivePose(scene, scene.get(C)!).width;
  return { animator: (): Animator => result.current, frame, scene, shown };
}

describe('a pose target on a container its layout reflows', () => {
  it('keeps running when retargeted mid-run, though its own write publishes the children\'s glides', () => {
    const { animator, frame, scene, shown } = setup();
    const target = scenePoseTarget(scene, C)!;
    act(() => { animator().tween({ target, to: at(100), ms: 100, easing: linear }); });
    frame(0);
    frame(20);
    expect(shown()).toBeCloseTo(28);
    const published = scene.overrides.getGeneration();
    act(() => { animator().tween({ target, to: at(200), ms: 100, easing: linear }); });
    // The premise: the retarget's write reached the children's reflow, which wrote overrides.
    expect(scene.overrides.getGeneration()).toBeGreaterThan(published);
    expect(scene.overrides.ids()).toEqual(expect.arrayContaining([C, 'a', 'b']));
    expect(target.active).toBe(true);
    expect(shown()).toBeCloseTo(28);
    frame(40);
    expect(target.active).toBe(true);
    expect(shown()).toBeGreaterThan(28);
    expect(shown()).toBeLessThan(100);
  });
});
