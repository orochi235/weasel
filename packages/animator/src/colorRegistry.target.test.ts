import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import { ColorOverrideRegistry } from './colorRegistry';
import { tweenVertexColors, springVertexColors, staggerVertexColors } from './colorHelpers';
import { cycleVertexColors } from './colorCycle';

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => {
      now += dt;
      const due = Array.from(cbs.values());
      cbs.clear();
      for (const cb of due) cb(now);
    },
  };
}

function setup() {
  const clock = makeClock();
  const { result } = renderHook(() => useAnimator(clock));
  const animator = result.current;
  return {
    animator,
    registry: animator.colorOverrides,
    step: (ms: number) => act(() => clock.advance(ms)),
    /** What a painter would paint on `a`'s fill over `base`. */
    painted: (base?: readonly number[]) => animator.colorOverrides.resolve('a', 'fill', base, clock.now()),
  };
}

function expectClose(actual: readonly number[] | undefined, expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((e, i) => expect(actual![i]).toBeCloseTo(e, 6));
}

const BLACK = [0, 0, 0, 1];
const RED = [1, 0, 0, 1];
const GREEN = [0, 1, 0, 1];
const BASE = [0.5, 0.5, 0.5, 1];

describe('ColorOverrideRegistry.target', () => {
  it('hands two callers one target for a node and channel, and another per channel', () => {
    const r = new ColorOverrideRegistry();
    expect(r.target('a', 'fill', 4)).toBe(r.target('a', 'fill', 4));
    expect(r.target('a', 'stroke', 4)).not.toBe(r.target('a', 'fill', 4));
    expect(r.target('b', 'fill', 4)).not.toBe(r.target('a', 'fill', 4));
  });

  it('refuses a length that is not whole colors', () => {
    const r = new ColorOverrideRegistry();
    expect(() => r.target('a', 'fill', 6)).toThrow('multiple of 4');
  });

  it('refuses another length while the target is moving, and takes it once it rests', () => {
    const { animator, registry, step } = setup();
    act(() => { animator.tween({ target: registry.target('a', 'fill', 4), from: BLACK, to: RED, ms: 100 }); });
    expect(() => registry.target('a', 'fill', 8)).toThrow('is moving');
    step(0);
    step(100);
    expect(registry.target('a', 'fill', 8).read()).toHaveLength(8);
  });

  it('paints nothing of its own until something moves it', () => {
    const r = new ColorOverrideRegistry();
    r.target('a', 'fill', 4);
    expect(r.resolve('a', 'fill', BASE, 0)).toBe(BASE);
    expect(r.get('a', 'fill')).toBeUndefined();
  });

  it('paints an animation on it in place of the base colors, and bumps the version as it moves', () => {
    const { animator, registry, step, painted } = setup();
    const v0 = registry.version();
    act(() => { animator.tween({ target: registry.target('a', 'fill', 4), from: BLACK, to: RED, ms: 100, easing: linear }); });
    expect(registry.version()).toBeGreaterThan(v0);
    expect(registry.has('a')).toBe(true);
    expectClose(painted(BASE), BLACK);
    step(0);
    const v1 = registry.version();
    step(50);
    expect(registry.version()).toBeGreaterThan(v1);
    expectClose(painted(BASE), [0.5, 0, 0, 1]);
    expectClose(painted(undefined), [0.5, 0, 0, 1]);
  });
});

describe('color animations on one node and channel', () => {
  it('two tweens add, and neither cancels the other', () => {
    const { animator, step, painted } = setup();
    act(() => { tweenVertexColors(animator, { id: 'a', channel: 'fill', from: BLACK, to: RED, ms: 100, easing: linear }); });
    step(0);
    step(50);
    expectClose(painted(BASE), [0.5, 0, 0, 1]);
    act(() => { tweenVertexColors(animator, { id: 'a', channel: 'fill', from: BLACK, to: GREEN, ms: 100, easing: linear }); });
    expect(animator.live()).toHaveLength(2);
    step(25);
    // Green's own 0.25 of the way, with the first tween's last quarter of red still to come.
    expectClose(painted(BASE), [-0.25, 0.25, 0, 1]);
    step(25);
    expectClose(painted(BASE), [0, 0.5, 0, 1]);
    expect(animator.live()).toHaveLength(1);
    step(50);
    expect(painted(BASE)).toBe(BASE);
  });

  it('a spring interrupts the one before it and carries its velocity', () => {
    const { animator, registry, step, painted } = setup();
    act(() => { springVertexColors(animator, { id: 'a', channel: 'fill', from: BLACK, to: RED, preset: 'gentle' }); });
    step(0);
    step(64);
    const here = painted(BASE)!.slice();
    expect(here[0]).toBeGreaterThan(0);
    expect(here[0]).toBeLessThan(1);
    // Nowhere to go from here, so only the velocity it inherits can move it.
    act(() => { springVertexColors(animator, { id: 'a', channel: 'fill', from: here, to: here, preset: 'gentle' }); });
    expect(animator.live()).toHaveLength(1);
    step(16);
    // Still running, and painting its own colors: a spring at rest would have finished here.
    expect(animator.live()).toHaveLength(1);
    expect(painted(undefined)![0]).toBeGreaterThan(here[0]! + 1e-4);
    for (let i = 0; i < 600 && animator.live().length > 0; i++) step(16);
    expect(animator.live()).toHaveLength(0);
    expect(registry.has('a')).toBe(false);
  });

  it('clears what it painted when the last animation finishes', () => {
    const { animator, registry, step, painted } = setup();
    act(() => { tweenVertexColors(animator, { id: 'a', channel: 'fill', from: BLACK, to: RED, ms: 100 }); });
    step(0);
    step(100);
    expect(registry.get('a', 'fill')).toBeUndefined();
    expect(registry.has('a')).toBe(false);
    expect(painted(BASE)).toBe(BASE);
  });

  it('holds the colors a canceled animation stopped on until they are cleared', () => {
    const { animator, registry, step, painted } = setup();
    let handle = null as { cancel(): void } | null;
    act(() => { handle = tweenVertexColors(animator, { id: 'a', channel: 'fill', from: BLACK, to: RED, ms: 100, easing: linear }); });
    step(0);
    step(50);
    act(() => { handle!.cancel(); });
    step(50);
    expectClose(painted(BASE), [0.5, 0, 0, 1]);
    expectClose(registry.get('a', 'fill') as number[], [0.5, 0, 0, 1]);
    registry.clear('a', 'fill');
    expect(painted(BASE)).toBe(BASE);
    expect(registry.has('a')).toBe(false);
  });

  it('a stagger adds to a tween in flight', () => {
    const { animator, step, painted } = setup();
    act(() => { tweenVertexColors(animator, { id: 'a', channel: 'fill', from: BLACK, to: RED, ms: 100, easing: linear }); });
    step(0);
    step(50);
    act(() => {
      staggerVertexColors(animator, {
        id: 'a', channel: 'fill', from: RED, to: [1, 1, 0, 1], anchorMs: 100, perAnchorDelay: 0, easing: linear,
      });
    });
    expect(animator.live()).toHaveLength(2);
    step(25);
    expectClose(painted(BASE), [0.75, 0.25, 0, 1]);
  });
});

describe('a color animation over an override', () => {
  it('adds what it has left to travel to a function override, and leaves the override when it finishes', () => {
    const { animator, registry, step, painted } = setup();
    const dim = (base: readonly number[]): number[] => base.map((x) => x * 0.5);
    registry.set('a', 'fill', dim);
    act(() => { tweenVertexColors(animator, { id: 'a', channel: 'fill', from: [0.4, 0, 0, 0], to: [0, 0, 0, 0], ms: 100, easing: linear }); });
    expect(registry.get('a', 'fill')).toBe(dim);
    expectClose(painted(BASE), [0.65, 0.25, 0.25, 0.5]);
    step(0);
    step(50);
    expectClose(painted(BASE), [0.45, 0.25, 0.25, 0.5]);
    step(50);
    expect(registry.get('a', 'fill')).toBe(dim);
    expectClose(painted(BASE), [0.25, 0.25, 0.25, 0.5]);
  });

  it('adds to a static override the same way', () => {
    const { animator, registry, step, painted } = setup();
    registry.set('a', 'fill', GREEN);
    act(() => { tweenVertexColors(animator, { id: 'a', channel: 'fill', from: RED, to: BLACK, ms: 100, easing: linear }); });
    step(0);
    step(50);
    expectClose(painted(BASE), [0.5, 1, 0, 1]);
    step(50);
    expect(painted(BASE)).toBe(GREEN);
  });

  it('keeps a tween running when a cycle under it is canceled', () => {
    const { animator, step, painted } = setup();
    let cycle = null as { cancel(): void } | null;
    act(() => { cycle = cycleVertexColors(animator, { id: 'a', channel: 'fill', msPerCycle: 1000 }); });
    act(() => { tweenVertexColors(animator, { id: 'a', channel: 'fill', from: BLACK, to: RED, ms: 100, easing: linear }); });
    step(0);
    step(50);
    act(() => { cycle!.cancel(); });
    expectClose(painted(BASE), [0.5, 0, 0, 1]);
    step(50);
    expect(painted(BASE)).toBe(BASE);
  });

  it('leaves an override of another length standing', () => {
    const { animator, registry, step, painted } = setup();
    const eight = [...GREEN, ...GREEN];
    registry.set('a', 'fill', eight);
    act(() => { tweenVertexColors(animator, { id: 'a', channel: 'fill', from: RED, to: BLACK, ms: 100, easing: linear }); });
    step(0);
    step(50);
    expect(painted(BASE)).toBe(eight);
  });
});
