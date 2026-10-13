import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { createTarget, type Target } from './target';
import type { SampledTrack } from './timeline/types';

type Point = { x: number; y: number };

/** A point the test owns, with x as axis 0 and y as axis 1. */
function point(x = 10, y = 10) {
  const p = { committed: { x, y }, target: null as unknown as Target<Point> };
  p.target = createTarget<Point>({ get: () => p.committed, set: (v) => { p.committed = v; } });
  return p;
}

function setup() {
  const cbs: ((t: number) => void)[] = [];
  let now = 0;
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
  }));
  const frame = (t: number): void => act(() => { now = t; for (const cb of cbs.splice(0)) cb(t); });
  return { animator: result.current, frame };
}

describe("a hold over some of a target's axes", () => {
  it('holds the axes it names and leaves the rest to the committed value', () => {
    const { animator } = setup();
    const p = point();
    act(() => { animator.hold({ target: p.target, value: { x: 70, y: 70 }, axes: [0] }); });
    expect(p.target.read()).toEqual({ x: 70, y: 10 });
  });

  it('sits at full strength beside a full-strength hold on the other axes', () => {
    const { animator } = setup();
    const p = point();
    act(() => {
      animator.hold({ target: p.target, value: { x: 100, y: 100 }, axes: [0] });
      animator.hold({ target: p.target, value: { x: 0, y: 50 }, axes: [1] });
    });
    expect(p.target.read()).toEqual({ x: 100, y: 50 });
  });

  it('shares only the axes it names with a hold over all of them', () => {
    const { animator } = setup();
    const p = point();
    act(() => {
      animator.hold({ target: p.target, value: { x: 100, y: 100 } });
      animator.hold({ target: p.target, value: { x: 0, y: 0 }, axes: [1] });
    });
    expect(p.target.read()).toEqual({ x: 100, y: 50 });
  });

  it('commits only its own axes when released', () => {
    const { animator } = setup();
    const p = point();
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target: p.target, value: { x: 70, y: 70 }, axes: [0] }); });
    act(() => { h.release(); });
    expect(p.committed).toEqual({ x: 70, y: 10 });
    expect(p.target.active).toBe(false);
  });

  it('keeps what the target shows when a hold over some axes leaves one over all of them', () => {
    const { animator } = setup();
    const p = point();
    let h!: ReturnType<typeof animator.hold>;
    act(() => {
      animator.hold({ target: p.target, value: { x: 100, y: 100 }, weight: 0.5 });
      h = animator.hold({ target: p.target, value: { x: 0, y: 30 }, weight: 0.25, axes: [1] });
    });
    const before = p.target.read();
    // 10 + 0.5 * 90 + 0.25 * 20
    expect(before.y).toBeCloseTo(60, 9);
    act(() => { h.release(); });
    expect(p.target.read().x).toBeCloseTo(before.x, 9);
    expect(p.target.read().y).toBeCloseTo(60, 9);
    expect(p.committed.x).toBe(10);
  });

  it('refuses an axis the target does not have', () => {
    const { animator } = setup();
    const p = point();
    expect(() => animator.hold({ target: p.target, value: { x: 0, y: 0 }, axes: [2] })).toThrow(/axes/);
  });

  it('holds the axes it names by the fields of the value', () => {
    const { animator } = setup();
    const p = point();
    act(() => { animator.hold({ target: p.target, value: { x: 70, y: 70 }, axes: ['y'] }); });
    expect(p.target.read()).toEqual({ x: 10, y: 70 });
  });

  it('refuses a name the target has no axis for', () => {
    const { animator } = setup();
    const p = point();
    // @ts-expect-error a point has no field `z`
    expect(() => animator.hold({ target: p.target, value: { x: 0, y: 0 }, axes: ['z'] })).toThrow(/`axes` names "z"/);
    expect(p.target.active).toBe(false);
  });

  it('holds a timeline track on the axes the track names by field', () => {
    const { animator, frame } = setup();
    const p = point();
    const track: SampledTrack<Point> = {
      kind: 'sampled',
      keys: [{ t: 0, value: { x: 0, y: 0 } }, { t: 100, value: { x: 100, y: 100 } }],
      target: p.target,
      axes: ['y'],
    };
    act(() => { animator.timeline({ tracks: [track], duration: 200 }); });
    frame(0);
    frame(40);
    expect(p.target.read().x).toBe(10);
    expect(p.target.read().y).toBeCloseTo(40, 9);
  });

  it('holds a timeline track on the axes the track names', () => {
    const { animator, frame } = setup();
    const p = point();
    const track: SampledTrack<Point> = {
      kind: 'sampled',
      keys: [{ t: 0, value: { x: 0, y: 0 } }, { t: 100, value: { x: 100, y: 100 } }],
      target: p.target,
      axes: [1],
    };
    act(() => { animator.timeline({ tracks: [track], duration: 200 }); });
    frame(0);
    frame(40);
    expect(p.target.read().x).toBe(10);
    expect(p.target.read().y).toBeCloseTo(40, 9);
  });
});
