import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { wrapAngle } from '@weasel-js/geom';
import { createElementTarget } from '../../elementTarget';
import { createTarget, type TargetAxes } from '../../target';
import type { PhysicsHandle } from '../../types';
import { element, FakeAnimation, setup } from './testing/fakeAnimate';

/** A plain `{ x }` target: the same animation run on the main thread, to compare against. */
function plain(x = 0) {
  let v = { x };
  return createTarget({ get: () => v, set: (n) => { v = n; } });
}

describe('physics handed to the compositor', () => {
  it('a spring moves as the main-thread spring does, frame for frame', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    const p = plain();
    act(() => {
      animator.spring({ target: e.target, to: { x: 100 }, preset: 'wobbly', velocity: { x: 300 }, compositor: 'auto' });
      animator.spring({ target: p, to: { x: 100 }, preset: 'wobbly', velocity: { x: 300 }, compositor: 'off' });
    });
    expect(e.made).toHaveLength(1);
    step(0);
    for (let i = 0; i < 60; i++) {
      step(16);
      expect(e.target.read().x).toBeCloseTo(p.read().x, 3);
    }
  });

  it('a coast moves as the main-thread decay does, and commits where it stops', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    const p = plain();
    let done = 0;
    act(() => {
      animator.decay({ target: e.target, velocity: { x: 800 }, friction: 0.2, onDone: () => { done += 1; }, compositor: 'auto' });
      animator.decay({ target: p, velocity: { x: 800 }, friction: 0.2, compositor: 'off' });
    });
    step(0);
    for (let i = 0; i < 40; i++) {
      step(16);
      expect(e.target.read().x).toBeCloseTo(p.read().x, 3);
    }
    for (let i = 0; i < 400 && done === 0; i++) step(16);
    expect(done).toBe(1);
    expect(e.target.committed().x).toBeCloseTo(p.committed().x, 1);
    expect(e.inlineX()).toBeCloseTo(e.target.committed().x, 2);
  });

  it('a spring on an angle turns the short way round, as on the main thread', () => {
    const { animator, step, timeline } = setup();
    const angle: TargetAxes<number> = { count: 1, to: (r) => [r], from: (a) => a[0]!, angles: [0] };
    const el = document.createElement('div');
    const made: FakeAnimation[] = [];
    (el as unknown as { animate: unknown }).animate = (frames: Record<string, string>[], o: { duration: number }) => {
      made.push(new FakeAnimation(frames, o.duration, timeline));
      return made[made.length - 1];
    };
    const e = createElementTarget({ element: el, value: 6, axes: angle, style: (r) => ({ rotate: `${r}rad` }) });
    let r = 6;
    const p = createTarget({ get: () => r, set: (n) => { r = n; }, axes: angle });
    act(() => {
      animator.spring({ target: e, to: 0.1, compositor: 'auto' });
      animator.spring({ target: p, to: 0.1, compositor: 'off' });
    });
    expect(made).toHaveLength(1);
    step(0);
    for (let i = 0; i < 30; i++) {
      step(16);
      expect(wrapAngle(e.read() - p.read())).toBeCloseTo(0, 3);
    }
  });

  it('setTarget stays on the compositor and carries the velocity over', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    const p = plain();
    let a: PhysicsHandle<{ x: number }>;
    let b: PhysicsHandle<{ x: number }>;
    act(() => {
      a = animator.physics({ target: e.target, to: { x: 100 }, preset: 'gentle', compositor: 'auto' });
      b = animator.physics({ target: p, to: { x: 100 }, preset: 'gentle', compositor: 'off' });
    });
    step(0);
    for (let i = 0; i < 10; i++) step(16);
    act(() => { a.setTarget({ x: -50 }); b.setTarget({ x: -50 }); });
    expect(e.made).toHaveLength(2);
    expect(e.made[0]!.canceled).toBe(true);
    expect(e.target.committed()).toEqual({ x: -50 });
    for (let i = 0; i < 30; i++) {
      step(16);
      expect(e.target.read().x).toBeCloseTo(p.read().x, 3);
    }
  });

  it('taken back mid-flight, a spring carries on on the main thread with the same motion', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    const p = plain();
    act(() => {
      animator.spring({ target: e.target, to: { x: 100 }, preset: 'wobbly', compositor: 'auto' });
      animator.spring({ target: p, to: { x: 100 }, preset: 'wobbly', compositor: 'off' });
    });
    step(0);
    for (let i = 0; i < 10; i++) step(16);
    // A second animation that adds nothing still takes the run back.
    act(() => {
      animator.tween({ target: e.target, to: e.target.committed(), ms: 1000 });
      animator.tween({ target: p, to: p.committed(), ms: 1000, compositor: 'off' });
    });
    expect(e.last().canceled).toBe(true);
    for (let i = 0; i < 30; i++) {
      step(16);
      expect(e.target.read().x).toBeCloseTo(p.read().x, 2);
    }
  });

  it('a spring already at rest runs on the main thread, which ends it at once', () => {
    const { animator, timeline } = setup();
    const e = element(timeline, 100);
    act(() => { animator.spring({ target: e.target, to: { x: 100 }, compositor: 'auto' }); });
    expect(e.made).toHaveLength(0);
  });
});
