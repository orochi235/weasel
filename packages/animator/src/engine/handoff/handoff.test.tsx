import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { createTarget } from '../../target';
import { element, setup } from './fakeAnimate.testing';

const tween = (a: ReturnType<typeof setup>['animator'], target: ReturnType<typeof element>['target'], to: number, extra = {}) =>
  a.tween({ target, to: { x: to }, ms: 1000, easing: linear, ...extra });

describe('a tween on an element target', () => {
  it('goes to Element.animate, and its keyframes are its path', () => {
    const { animator, timeline } = setup();
    const e = element(timeline);
    act(() => { tween(animator, e.target, 100); });
    expect(e.made).toHaveLength(1);
    const ks = e.last().keyframes;
    expect(ks[0]).toMatchObject({ transform: 'translateX(0px)', offset: 0 });
    expect(ks[ks.length - 1]).toMatchObject({ transform: 'translateX(100px)', offset: 1 });
    expect(e.last().duration).toBe(1000);
    expect(animator.live()[0]).toMatchObject({ kind: 'tween', compositor: true });
  });

  it('runs no frame work per element: its style is not asked for again until it ends', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    act(() => { tween(animator, e.target, 100); });
    step(0);
    const before = e.styled();
    for (let i = 0; i < 30; i++) step(16);
    expect(e.styled()).toBe(before);
  });

  it('asks for no frames while it runs, and is woken to end by the browser finishing it', () => {
    const { animator, step, timeline, pending } = setup();
    const e = element(timeline);
    let done = 0;
    act(() => { tween(animator, e.target, 100, { onDone: () => { done += 1; } }); });
    step(0);
    expect(pending()).toBe(0);
    step(600);
    expect(e.target.read().x).toBeCloseTo(60, 6);
    expect(pending()).toBe(0);
    step(500);
    expect(done).toBe(1);
    expect(e.inlineX()).toBe(100);
    expect(animator.isActive()).toBe(false);
  });

  it('keeps the browser on its own clock, and reads where the browser shows it', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    act(() => { tween(animator, e.target, 100); });
    step(0);
    step(250);
    expect(e.last().currentTime).toBeCloseTo(250, 6);
    expect(e.last().shownX()).toBeCloseTo(25, 6);
    expect(e.target.read().x).toBeCloseTo(25, 6);
    expect(e.target.active).toBe(true);
  });

  it('ends on its destination: written inline, and the browser animation canceled', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    let done = 0;
    act(() => { tween(animator, e.target, 100, { onDone: () => { done += 1; } }); });
    step(0);
    for (let t = 0; t < 1100; t += 100) step(100);
    expect(done).toBe(1);
    expect(e.inlineX()).toBe(100);
    expect(e.last().canceled).toBe(true);
    expect(e.target.committed()).toEqual({ x: 100 });
    expect(e.target.active).toBe(false);
  });

  it('cancels where the browser shows it, committing that', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    let h: ReturnType<typeof tween>;
    act(() => { h = tween(animator, e.target, 100); });
    step(0);
    step(400);
    act(() => h.cancel());
    expect(e.target.committed().x).toBeCloseTo(40, 6);
    expect(e.inlineX()).toBeCloseTo(40, 6);
    expect(e.last().canceled).toBe(true);
    expect(animator.isActive()).toBe(false);
  });

  it('stops with the target, as target.stop does for any animation', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    act(() => { tween(animator, e.target, 100); });
    step(0);
    step(500);
    act(() => e.target.stop());
    expect(e.target.committed().x).toBeCloseTo(50, 6);
    expect(animator.isActive()).toBe(false);
  });
});

describe('the browser animation follows the animator clock', () => {
  it('pauses and resumes with the handle', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    let h: ReturnType<typeof tween>;
    act(() => { h = tween(animator, e.target, 100); });
    step(0);
    step(200);
    act(() => h.pause());
    step(300);
    expect(e.last().paused).toBe(true);
    expect(e.last().currentTime).toBeCloseTo(200, 6);
    act(() => h.resume());
    step(100);
    expect(e.last().currentTime).toBeCloseTo(300, 6);
    expect(e.target.read().x).toBeCloseTo(30, 6);
  });

  it('pauses with the animator, and takes its time scale', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    act(() => { tween(animator, e.target, 100); });
    step(0);
    step(100);
    act(() => animator.pause());
    step(500);
    expect(e.last().currentTime).toBeCloseTo(100, 6);
    act(() => { animator.resume(); animator.setTimeScale(0.5); });
    step(200);
    expect(e.last().playbackRate).toBe(0.5);
    expect(e.last().currentTime).toBeCloseTo(200, 6);
    expect(e.target.read().x).toBeCloseTo(20, 6);
  });

  it('plays backward with a negative time scale and ends at its start', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    let h: ReturnType<typeof tween>;
    let done = 0;
    act(() => { h = tween(animator, e.target, 100, { onDone: () => { done += 1; } }); });
    step(0);
    step(300);
    act(() => h.setTimeScale(-1));
    step(100);
    expect(e.last().playbackRate).toBe(-1);
    expect(e.last().currentTime).toBeCloseTo(200, 6);
    for (let i = 0; i < 4; i++) step(100);
    expect(done).toBe(1);
    expect(e.target.committed().x).toBe(0);
    expect(e.inlineX()).toBe(0);
  });
});

describe('another animation on a handed-off target', () => {
  it('takes it back to the main thread, where the two add without a jump', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    let done = 0;
    act(() => { tween(animator, e.target, 100, { onDone: () => { done += 1; } }); });
    step(0);
    step(500);
    const at = e.target.read().x;
    act(() => { animator.tween({ target: e.target, to: { x: 300 }, ms: 1000, easing: linear, compositor: 'off' }); });
    expect(e.last().canceled).toBe(true);
    expect(e.target.read().x).toBeCloseTo(at, 6);
    expect(animator.live().some((r) => r.compositor)).toBe(false);
    for (let i = 0; i < 12; i++) step(100);
    expect(done).toBe(1);
    expect(e.target.committed().x).toBe(300);
  });

  it('a hold takes it back too', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    act(() => { tween(animator, e.target, 100); });
    step(0);
    step(500);
    act(() => { animator.hold({ target: e.target, value: { x: 7 } }); });
    expect(e.last().canceled).toBe(true);
    step(16);
    expect(e.target.read().x).toBeCloseTo(7, 6);
  });

  it('under the same cancelKey interrupts it, and the new one is handed off in its place', () => {
    const { animator, step, timeline } = setup();
    const e = element(timeline);
    act(() => { tween(animator, e.target, 100, { cancelKey: 'k' }); });
    step(0);
    step(500);
    act(() => { tween(animator, e.target, 0, { cancelKey: 'k' }); });
    expect(e.made).toHaveLength(2);
    expect(e.made[0]!.canceled).toBe(true);
    expect(e.last().keyframes[0]!.transform).toBe('translateX(50px)');
  });
});

describe('what stays on the main thread', () => {
  it('a plain target, an onTick, and a property the compositor does not run', () => {
    const { animator, timeline } = setup();
    const plain = createTarget({ get: () => 0, set: () => {} });
    act(() => { animator.tween({ target: plain, to: 1, ms: 100 }); });
    const ticked = element(timeline);
    act(() => { tween(animator, ticked.target, 10, { onTick: () => {} }); });
    const colored = element(timeline, 0, { backgroundColor: 'red' });
    act(() => { tween(animator, colored.target, 10); });
    expect(ticked.made).toHaveLength(0);
    expect(colored.made).toHaveLength(0);
    expect(animator.live().some((r) => r.compositor)).toBe(false);
  });

  it("'require' says why", () => {
    const { animator, timeline } = setup();
    const colored = element(timeline, 0, { backgroundColor: 'red' });
    expect(() => tween(animator, colored.target, 10, { compositor: 'require' })).toThrow(/backgroundColor/);
  });
});
