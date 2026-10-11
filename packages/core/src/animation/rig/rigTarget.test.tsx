import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { mat3 } from '../../renderer/math/mat3';
import type { SampledTrack } from '../timeline/types';
import { rigged } from './rigTarget.test-harness';
import type { Pose } from './types';

const TAU = Math.PI * 2;

const clip = (to: Pose, more: Partial<SampledTrack<Pose>>): SampledTrack<Pose> =>
  ({ kind: 'sampled', keys: [{ t: 0, value: {} }, { t: 100, value: to }], ...more });

describe('a rig as an animation target', () => {
  it('starts committed at the bind pose, and commits what pose() is given', () => {
    const { rig, shift } = rigged();
    expect(rig.target.read()).toEqual({});
    const p: Pose = { upper: { x: 7 } };
    rig.pose(p);
    expect(rig.target.read()).toBe(p);
    expect(shift()).toBeCloseTo(7, 6);
  });

  it('poses its nodes with a held value, leaving the committed pose alone', () => {
    const { rig, animator, step, shift, where, lower } = rigged();
    rig.pose({ upper: { x: 2 } });
    act(() => { animator.hold({ target: rig.target, value: { upper: { x: 30 } } }); });
    step(16);
    expect(shift()).toBeCloseTo(30, 6);
    expect(where(lower).x).toBeCloseTo(180, 6);
    expect(rig.target.read().upper!.x).toBeCloseTo(30, 6);
    act(() => { animator.cancelAll(); });
  });

  it('crossfades two clips by their weights', () => {
    const { rig, animator, step, shift, turn } = rigged();
    let w = 0.25;
    act(() => {
      animator.timeline({ tracks: [clip({ upper: { x: 40, rotation: 0.4 } }, { target: rig.target, weight: () => 1 - w })], duration: 1000 });
      animator.timeline({ tracks: [clip({ upper: { x: -20, rotation: -0.8 } }, { target: rig.target, weight: () => w })], duration: 1000 });
    });
    step(0);
    step(50);
    // Halfway through each clip: 20 and 0.2 against -10 and -0.4.
    expect(shift()).toBeCloseTo(0.75 * 20 + 0.25 * -10, 6);
    expect(turn()).toBeCloseTo(0.75 * 0.2 + 0.25 * -0.4, 6);
    w = 1;
    step(0);
    expect(shift()).toBeCloseTo(-10, 6);
    expect(turn()).toBeCloseTo(-0.4, 6);
  });

  it('adds a spring on top of a clip', () => {
    const { rig, animator, step, shift } = rigged();
    act(() => { animator.timeline({ tracks: [clip({ upper: { x: 40 } }, { target: rig.target })], duration: 10_000 }); });
    step(0);
    act(() => { animator.spring({ target: rig.target, from: { upper: { x: 12 } }, to: {} }); });
    step(0);
    expect(shift()).toBeCloseTo(12, 6);
    step(50);
    const sprung = shift() - 20;
    expect(Math.abs(sprung)).toBeGreaterThan(0.01);
    expect(Math.abs(sprung)).toBeLessThan(12);
    for (let i = 0; i < 400; i++) step(16);
    // The spring has settled; the clip's last key is what is left.
    expect(shift()).toBeCloseTo(40, 3);
  });

  it('adds an offset tween on top of a hold', () => {
    const { rig, animator, step, shift } = rigged();
    act(() => { animator.hold({ target: rig.target, value: { upper: { x: 30 } } }); });
    step(0);
    act(() => { animator.tween({ target: rig.target, from: { upper: { x: 10 } }, to: {}, ms: 100, easing: linear }); });
    step(0);
    step(50);
    expect(shift()).toBeCloseTo(35, 6);
  });

  it('blends rotation the short way round', () => {
    const { rig, animator, step, turn } = rigged();
    act(() => {
      animator.hold({ target: rig.target, value: { upper: { rotation: 0.1 } }, weight: 0.5 });
      animator.hold({ target: rig.target, value: { upper: { rotation: TAU - 0.1 } }, weight: 0.5 });
    });
    step(16);
    expect(turn()).toBeCloseTo(0, 6);
  });

  it('pulls toward the bind pose where the weights fall short of 1', () => {
    const { rig, animator, step, shift } = rigged();
    act(() => {
      animator.hold({ target: rig.target, value: { upper: { x: 10 } }, weight: 0.3 });
      animator.hold({ target: rig.target, value: { upper: { x: 30 }, lower: { scaleX: 3 } }, weight: 0.3 });
    });
    step(16);
    // An even mix of 10 and 30 at 60% strength over the bind pose's 0.
    expect(shift()).toBeCloseTo(12, 6);
    // Scale falls back to 1, not to 0: (0.3 * 1 + 0.3 * 3 + 0.4 * 1) is 1.6 on the lower joint.
    expect(rig.target.read().lower!.scaleX).toBeCloseTo(1.6, 6);
    expect(shift('lower')).toBeCloseTo(12, 6);
  });

  it('pulls toward the committed pose once pose() has set one', () => {
    const { rig, animator, step, shift } = rigged();
    rig.pose({ upper: { x: 100 } });
    act(() => { animator.hold({ target: rig.target, value: { upper: { x: 0 } }, weight: 0.25 }); });
    step(16);
    expect(shift()).toBeCloseTo(75, 6);
  });

  it('keeps a tween\'s offset on top of a pose() made under it', () => {
    const { rig, animator, step, shift } = rigged();
    act(() => { animator.tween({ target: rig.target, from: { upper: { x: 10 } }, to: {}, ms: 100, easing: linear }); });
    step(0);
    step(50);
    rig.pose({ upper: { x: 40 } });
    expect(shift()).toBeCloseTo(45, 6);
  });

  it('weighs a pose() made under a live hold in once the hold is read again', () => {
    const { rig, animator, step, shift } = rigged();
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: rig.target, value: { upper: { x: 0 } }, weight: 0.5 }); });
    step(16);
    rig.pose({ upper: { x: 40 } });
    act(() => { h.touch(); });
    step(16);
    expect(shift()).toBeCloseTo(20, 6);
  });

  it('keeps the root last given, for what the target shows and for a later pose()', () => {
    const { rig, animator, step, shift } = rigged();
    rig.place(mat3.translated(mat3.identity(), 5, 0));
    expect(shift()).toBeCloseTo(5, 6);
    act(() => { animator.hold({ target: rig.target, value: { upper: { x: 30 } } }); });
    step(16);
    expect(shift()).toBeCloseTo(35, 6);
    act(() => { animator.cancelAll(); });
    rig.pose({ upper: { x: 1 } });
    expect(shift()).toBeCloseTo(6, 6);
    rig.pose({ upper: { x: 1 } }, mat3.translated(mat3.identity(), -2, 0));
    expect(shift()).toBeCloseTo(-1, 6);
    rig.place();
    expect(shift()).toBeCloseTo(1, 6);
  });

  it('plays a targeted pose track with no interpolate, the short way on rotation', () => {
    const { rig, animator, step, turn } = rigged();
    const track: SampledTrack<Pose> = {
      kind: 'sampled',
      keys: [{ t: 0, value: { upper: { rotation: 0.2 } } }, { t: 100, value: { upper: { rotation: TAU - 0.2 } } }],
      target: rig.target,
    };
    act(() => { animator.timeline({ tracks: [track], duration: 1000 }); });
    step(0);
    step(25);
    expect(turn()).toBeCloseTo(0.1, 6);
    step(50);
    expect(turn()).toBeCloseTo(-0.1, 6);
    step(100);
    // Past its last key the track commits the pose and lets the rig go.
    expect(rig.target.active).toBe(false);
    expect(Math.cos(rig.target.read().upper!.rotation!)).toBeCloseTo(Math.cos(0.2), 6);
  });
});
