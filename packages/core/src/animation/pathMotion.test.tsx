import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { linear, pathFromD } from '@weasel-js/geom';
import { useAnimator } from '@weasel-js/animator/react';
import { createScene } from '../core/scene/scene';
import { effectivePose } from '../core/scene/effectivePose';
import { sceneToAdapter } from '../canvas/sceneAdapter';
import { pathMotion } from './pathMotion';
import { tweenPose, type PoseAnimationAdapter } from './poseHelpers';

type Box = { x: number; y: number; width: number; height: number; rotation?: number };

/** Right 100, then down 100: 200 long, turning a corner a straight lerp would cut. */
const ELL = pathFromD('M 0 0 L 100 0 L 100 100');
const BOX: Box = { x: 500, y: 500, width: 20, height: 10 };
const center = (p: Box) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

describe('pathMotion', () => {
  const motion = pathMotion<Box>(ELL);

  it('puts the center on the path start and end at the endpoints', () => {
    expect(center(motion.lerp(BOX, BOX, 0))).toEqual({ x: 0, y: 0 });
    expect(center(motion.lerp(BOX, BOX, 1))).toEqual({ x: 100, y: 100 });
    expect(motion.at(BOX, 1)).toEqual(motion.lerp(BOX, motion.at(BOX, 1), 1));
  });

  it('travels by length: halfway is the corner, a quarter is halfway along the first leg', () => {
    expect(center(motion.lerp(BOX, BOX, 0.5))).toEqual({ x: 100, y: 0 });
    expect(center(motion.lerp(BOX, BOX, 0.25))).toEqual({ x: 50, y: 0 });
    expect(center(motion.lerp(BOX, BOX, 0.75))).toEqual({ x: 100, y: 50 });
  });

  it('lerps the rest of the pose by the descriptor', () => {
    const p = motion.lerp(BOX, { ...BOX, width: 40 }, 0.5);
    expect(p.width).toBe(30);
    expect(center(p)).toEqual({ x: 100, y: 0 });
  });

  it('turns with the tangent under orient, plus the offset', () => {
    const turning = pathMotion<Box>(ELL, { orient: true });
    expect(turning.lerp(BOX, BOX, 0.25).rotation).toBeCloseTo(0, 9);
    expect(turning.lerp(BOX, BOX, 0.75).rotation).toBeCloseTo(Math.PI / 2, 9);
    const offset = pathMotion<Box>(ELL, { orient: true, rotationOffset: -Math.PI / 2 });
    expect(offset.lerp(BOX, BOX, 0.75).rotation).toBeCloseTo(0, 9);
    expect(motion.lerp({ ...BOX, rotation: 0.3 }, { ...BOX, rotation: 0.3 }, 0.75).rotation).toBeCloseTo(0.3, 9);
  });

  it('rides on its anchor, which turns with the pose', () => {
    const corner = pathMotion<Box>(ELL, { anchor: { x: 0, y: 0 } });
    const p = corner.lerp(BOX, BOX, 0.25);
    expect({ x: p.x, y: p.y }).toEqual({ x: 50, y: 0 });
    // Turned a quarter, the top-left corner sits at center + R(90°)·(-10, -5) = center + (5, -10).
    const turned = pathMotion<Box>(ELL, { anchor: { x: 0, y: 0 }, orient: true }).lerp(BOX, BOX, 0.75);
    const c = center(turned);
    expect(c.x + 5).toBeCloseTo(100, 9);
    expect(c.y - 10).toBeCloseTo(50, 9);
  });

  it('refuses orient on a descriptor that cannot rotate, and a 3D table', () => {
    const { withRotation: _drop, ...flat } = pathMotion<Box>(ELL);
    expect(() => pathMotion<Box>(ELL, { orient: true, descriptor: flat })).toThrow(/withRotation/);
    expect(() => pathMotion({ ...motion.table, dim: 3 })).toThrow(/pathMotion3/);
  });
});

describe('tweenPose along a pathMotion', () => {
  it('shows the node on the path each frame, with the destination committed at the start', () => {
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
    const scene = createScene<object, 'main', Box>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 20, height: 10, rotation: 0 }, data: {} });
    const adapter = sceneToAdapter(scene) as unknown as PoseAnimationAdapter<Box>;
    const motion = pathMotion<Box>(ELL, { orient: true });
    const to = motion.at(scene.get(id)!.pose, 1);
    act(() => { tweenPose(result.current, adapter, { id, to, geometry: motion, ms: 100, easing: linear, recordOp: false }); });
    expect(scene.get(id)!.pose).toEqual(to);
    frame(0);
    frame(50);
    const shown = effectivePose(scene, scene.get(id)!);
    expect(center(shown).x).toBeCloseTo(100, 3);
    expect(center(shown).y).toBeCloseTo(0, 3);
    frame(75);
    const later = effectivePose(scene, scene.get(id)!);
    expect(center(later).x).toBeCloseTo(100, 3);
    expect(center(later).y).toBeCloseTo(50, 3);
    expect(later.rotation).toBeCloseTo(Math.PI / 2, 3);
    frame(150);
    expect(effectivePose(scene, scene.get(id)!)).toEqual(to);
  });

  it('rides a path measured from an origin where the origin puts it', () => {
    const far = pathFromD('M 20000 0 L 20010 0');
    expect(far.origin).toBeDefined();
    expect(center(pathMotion<Box>(far).at(BOX, 0))).toEqual({ x: 20000, y: 0 });
  });
});
