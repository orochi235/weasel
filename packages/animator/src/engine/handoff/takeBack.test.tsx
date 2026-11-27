import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { element, setup } from './testing/fakeAnimate';

type Animator = ReturnType<typeof setup>['animator'];
type Target = ReturnType<typeof element>['target'];

const tween = (a: Animator, target: Target, to: number, extra = {}) =>
  a.tween({ target, to: { x: to }, ms: 1000, easing: linear, compositor: 'auto', ...extra });

describe('a run handed to the compositor', () => {
  it('is not taken back by another animator, which is refused first', () => {
    const one = setup();
    const two = setup();
    const e = element(one.timeline);
    act(() => { tween(one.animator, e.target, 100); });
    one.step(0);
    one.step(500);
    expect(() => two.animator.tween({ target: e.target, to: { x: 0 }, ms: 100 })).toThrow(/another animator/);
    expect(() => two.animator.hold({ target: e.target, value: { x: 0 } })).toThrow(/another animator/);
    expect(e.last().canceled).toBe(false);
    expect(one.animator.live()[0]).toMatchObject({ compositor: true });
  });
});

describe('a run taken back to the main thread', () => {
  it('paused while it plays backward, carries on backward to its start', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    let h: ReturnType<typeof tween>;
    act(() => { h = tween(animator, e.target, 100); });
    step(0);
    step(500);
    act(() => { h.setTimeScale(-1); });
    step(100);
    act(() => { h.pause(); });
    step(100);
    act(() => { e.target.commit(e.target.committed()); });
    act(() => { h.resume(); });
    for (let i = 0; i < 6; i++) step(100);
    expect(e.target.read().x).toBeCloseTo(0, 6);
    expect(e.target.committed().x).toBe(0);
    expect(animator.isActive()).toBe(false);
  });
});

describe('a run whose target setter throws as it is canceled', () => {
  it('still cancels its browser animation and lets go of the target', () => {
    const { animator, step, timeline } = setup();
    let bad = false;
    const e = element(timeline, 0, {}, () => { if (bad) throw new Error('set'); });
    let h: ReturnType<typeof tween>;
    act(() => { h = tween(animator, e.target, 100); });
    step(0);
    step(500);
    bad = true;
    expect(() => act(() => { h.cancel(); })).toThrow('set');
    expect(e.last().canceled).toBe(true);
    expect(animator.isActive()).toBe(false);
    bad = false;
    act(() => { tween(animator, e.target, 0); });
    expect(e.made).toHaveLength(2);
  });
});
