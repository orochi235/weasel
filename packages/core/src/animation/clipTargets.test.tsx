import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { bindClip, toClip, type Clip, type Skeleton } from '@weasel-js/animator';
import { useAnimator } from '@weasel-js/animator/react';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import type { RectPose } from '../core/scene/types';
import { sceneClipTargets } from './clipTargets';
import { scenePoseTarget } from './poseTarget';
import { bindRig } from './rig';

const ARM: Skeleton = {
  joints: [
    { name: 'upper', parent: null, bind: { x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1 } },
    { name: 'lower', parent: 'upper', bind: { x: 50, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
  ],
};

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
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const box = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: {} });
  const hand = scene.add({ kind: 'mark', layer: 'main', pose: { x: 190, y: 95, width: 20, height: 10 }, data: {} });
  const rig = bindRig({ scene, skeleton: ARM, bindings: { lower: hand } });
  return { animator: () => result.current, frame, scene, box, hand, rig };
}

describe('sceneClipTargets', () => {
  it('names a node\'s pose target `pose:<id>` and a rig\'s `rig:<name>`', () => {
    const { scene, box, rig } = setup();
    const target = sceneClipTargets(scene, { rigs: { arm: rig } });
    expect(target(`pose:${box}`)).toBe(scenePoseTarget(scene, box));
    expect(target('rig:arm')).toBe(rig.target);
    expect(target('pose:nope')).toBeUndefined();
    expect(target('rig:leg')).toBeUndefined();
    expect(target('gain')).toBeUndefined();
  });

  it('holds only the joints a rig track names, wherever the skeleton has them', () => {
    const { animator, frame, scene, hand, rig } = setup();
    const clip: Clip = {
      version: 1,
      tracks: [{
        kind: 'sampled', target: 'rig:arm', axes: ['lower'],
        keys: [{ t: 0, value: {} }, { t: 1000, value: { upper: { rotation: 1 }, lower: { rotation: Math.PI / 2 } } }],
      }],
    };
    const live = bindClip(clip, { target: sceneClipTargets(scene, { rigs: { arm: rig } }) });
    act(() => { animator().timeline({ ...live, autoplay: false }).seek(500); });
    frame(16);
    // The upper joint is not the track's to move, so the elbow stays at (150, 100).
    const at = effectivePose(scene, scene.get(hand)!);
    expect(at.x + at.width / 2).toBeCloseTo(150 + 50 * Math.SQRT1_2, 3);
    expect(at.y + at.height / 2).toBeCloseTo(100 + 50 * Math.SQRT1_2, 3);
    expect(toClip(live)).toEqual(clip);
  });

  it('plays a clip read from JSON on a node and on a rig', () => {
    const { animator, frame, scene, box, hand, rig } = setup();
    const clip: Clip = JSON.parse(JSON.stringify({
      version: 1,
      tracks: [
        {
          kind: 'sampled', target: `pose:${box}`,
          keys: [{ t: 0, value: { x: 0, y: 0, width: 10, height: 10 } }, { t: 1000, value: { x: 100, y: 0, width: 10, height: 10 } }],
        },
        { kind: 'sampled', target: 'rig:arm', keys: [{ t: 0, value: {} }, { t: 1000, value: { lower: { rotation: Math.PI / 2 } } }] },
      ],
    }));
    const live = bindClip(clip, { target: sceneClipTargets(scene, { rigs: { arm: rig } }) });
    act(() => { animator().timeline({ ...live, autoplay: false }).seek(500); });
    frame(16);
    expect(effectivePose(scene, scene.get(box)!).x).toBeCloseTo(50, 4);
    // The hand's center rides 50 from the elbow at (150, 100), an eighth of a turn round.
    const at = effectivePose(scene, scene.get(hand)!);
    expect(at.x + at.width / 2).toBeCloseTo(150 + 50 * Math.SQRT1_2, 3);
    expect(at.y + at.height / 2).toBeCloseTo(100 + 50 * Math.SQRT1_2, 3);
    expect(toClip(live)).toEqual(clip);
  });
});
