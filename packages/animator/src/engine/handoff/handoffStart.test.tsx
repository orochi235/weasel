import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import type { AnimatorEvent } from '../../types';
import { element, setup } from './testing/fakeAnimate';

/** An element target with a main-thread tween holding `k` on it, and the animator's events. */
function moving() {
  const r = setup();
  const e = element(r.timeline);
  const events: AnimatorEvent[] = [];
  act(() => {
    r.animator.watch((ev) => { events.push(ev); });
    r.animator.tween({ target: e.target, to: { x: 100 }, ms: 200, cancelKey: 'k' });
  });
  r.step(0);
  r.step(50);
  return { ...r, e, events };
}

describe('a call handed to the compositor, as it starts', () => {
  it('names an animation that starts when its interrupt falls back to the main thread', () => {
    const r = moving();
    act(() => {
      r.animator.spring({ target: r.e.target, to: r.e.target.read(), velocity: { x: 0 }, cancelKey: 'k', compositor: 'auto' });
    });
    const by = r.events.find((ev) => ev.type === 'interrupt');
    expect(by && 'by' in by).toBe(true);
    const id = (by as Extract<AnimatorEvent, { type: 'interrupt' }>).by.id;
    expect(r.events.some((ev) => ev.type === 'start' && ev.animation.id === id)).toBe(true);
  });

  it('refuses a `to` of the wrong shape before it interrupts what holds its key', () => {
    const r = moving();
    expect(() => r.animator.spring({ target: r.e.target, to: 5 as never, cancelKey: 'k', compositor: 'auto' })).toThrow();
    expect(() => r.animator.tween({ target: r.e.target, to: 5 as never, ms: 100, cancelKey: 'k', compositor: 'auto' })).toThrow();
    expect(r.events.some((ev) => ev.type === 'interrupt')).toBe(false);
    expect(r.animator.live()).toHaveLength(1);
  });

  it('refuses spring constants it cannot run before it interrupts what holds its key', () => {
    const r = moving();
    expect(() => r.animator.spring({ target: r.e.target, to: { x: 0 }, stiffness: -1, cancelKey: 'k', compositor: 'auto' })).toThrow();
    expect(r.animator.live()).toHaveLength(1);
  });
});
