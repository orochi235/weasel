import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import type { AnimatorEvent, Animator } from './types';
import { createTarget } from './target';

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
  return { animator: (): Animator => result.current, frame, pending: () => cbs.length };
}

const boom = new Error('boom');

afterEach(() => { vi.restoreAllMocks(); });

describe('useAnimator — a tick that throws', () => {
  it('retires the thrower and keeps every other animation running', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { animator, frame, pending } = setup();
    const before: number[] = [];
    const after: number[] = [];
    const doneA = vi.fn();
    const doneB = vi.fn();
    const subscriber = vi.fn();
    act(() => {
      animator().onTick(subscriber);
      animator().tween<number>({ from: 0, to: 1, ms: 100, easing: linear, onTick: (v) => before.push(v), onDone: doneA });
      animator().tween<number>({ from: 0, to: 1, ms: 100, easing: linear, onTick: () => { throw boom; } });
      animator().tween<number>({ from: 0, to: 1, ms: 100, easing: linear, onTick: (v) => after.push(v), onDone: doneB });
    });
    frame(0);
    expect(pending()).toBe(1);
    expect(subscriber).toHaveBeenCalledTimes(1);
    frame(50);
    frame(100);
    expect(before.at(-1)).toBe(1);
    expect(after.at(-1)).toBe(1);
    expect(doneA).toHaveBeenCalledOnce();
    expect(doneB).toHaveBeenCalledOnce();
    expect(animator().isActive()).toBe(false);
    expect(errors).toHaveBeenCalledOnce();
    expect(errors.mock.calls[0]).toContain(boom);
  });

  it('never calls the thrower\'s onDone', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { animator, frame } = setup();
    const onDone = vi.fn();
    act(() => {
      animator().spring<number>({ from: 0, to: 1, onTick: () => { throw boom; }, onDone });
    });
    frame(0);
    frame(16);
    expect(animator().isActive()).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('delivers an error event in place of cancel', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { animator, frame } = setup();
    const events: AnimatorEvent[] = [];
    act(() => {
      animator().watch((e) => events.push(e));
      animator().tween<number>({ from: 0, to: 1, ms: 100, onTick: () => { throw boom; }, label: 'bad' });
    });
    frame(0);
    frame(50);
    expect(events.map((e) => e.type)).toEqual(['start', 'error']);
    const err = events[1];
    expect(err.type === 'error' && err.error).toBe(boom);
    expect(err.animation.label).toBe('bad');
  });

  it('delivers error after end when onDone throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { animator, frame } = setup();
    const events: AnimatorEvent[] = [];
    act(() => {
      animator().watch((e) => events.push(e));
      animator().tween<number>({ from: 0, to: 1, ms: 10, onTick: () => {}, onDone: () => { throw boom; } });
    });
    frame(0);
    frame(10);
    expect(events.map((e) => e.type)).toEqual(['start', 'end', 'error']);
    expect(animator().isActive()).toBe(false);
  });
});

describe('useAnimator — a target whose show throws', () => {
  it('stops what moves that target, and keeps every other animation running', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { animator, frame } = setup();
    let a = 0;
    let shows = 0;
    const bad = createTarget<number>({
      get: () => a, set: (v) => { a = v; }, show: () => { shows += 1; if (shows === 3) throw boom; },
    });
    let b = 0;
    const good = createTarget<number>({ get: () => b, set: (v) => { b = v; }, show: () => {} });
    act(() => {
      animator().tween({ target: bad, to: 100, ms: 100, easing: linear });
      animator().tween({ target: good, to: 100, ms: 100, easing: linear });
    });
    for (let t = 0; t <= 200; t += 16) frame(t);
    expect(good.read()).toBe(100);
    expect(bad.active).toBe(false);
    expect(animator().isActive()).toBe(false);
    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/show threw/), boom);
  });
});
