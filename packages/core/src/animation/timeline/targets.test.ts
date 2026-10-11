import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from '../useAnimator';
import { createTarget, type Target } from '../target';
import type { SampledTrack, TimelineHandle } from './types';

/** Manual frame pump so the test owns the frame clock; `now` can run ahead of the last frame. */
function pump() {
  const cbs: ((t: number) => void)[] = [];
  const p = {
    clock: 0,
    requestFrame: (cb: (t: number) => void) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => p.clock,
    frame: (t: number) => { p.clock = t; const batch = cbs.splice(0); for (const cb of batch) cb(t); },
  };
  return p;
}

function box(start = 0) {
  const b = { committed: start, shown: [] as number[], target: null as unknown as Target<number> };
  b.target = createTarget<number>({
    get: () => b.committed,
    set: (v) => { b.committed = v; },
    show: (v) => { b.shown.push(v); },
  });
  return b;
}

function setup() {
  const p = pump();
  const { result } = renderHook(() =>
    useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }),
  );
  return { p, animator: result.current, frame: (t: number) => act(() => p.frame(t)) };
}

const ramp = (target: Target<number>, more: Partial<SampledTrack<number>> = {}): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
  target,
  ...more,
});

describe('a sampled track on a target', () => {
  it('shows its sampled value the frame the playhead moves, with the committed value left alone', () => {
    const { animator, frame } = setup();
    const b = box(7);
    act(() => { animator.timeline({ tracks: [ramp(b.target)], duration: 200 }); });
    frame(0);
    expect(b.shown.at(-1)).toBe(0);
    frame(30);
    expect(b.shown.at(-1)).toBeCloseTo(30, 9);
    frame(55);
    expect(b.shown.at(-1)).toBeCloseTo(55, 9);
    expect(b.target.read()).toBeCloseTo(55, 9);
    expect(b.committed).toBe(7);
  });

  it('still calls an onTick given beside the target', () => {
    const { animator, frame } = setup();
    const b = box(0);
    const seen: number[] = [];
    act(() => { animator.timeline({ tracks: [ramp(b.target, { onTick: (v) => seen.push(v) })] }); });
    frame(0);
    frame(40);
    expect(seen.at(-1)).toBeCloseTo(40, 9);
    expect(b.shown.at(-1)).toBeCloseTo(40, 9);
  });

  it('carries a tween on the same target on top of it', () => {
    const { animator, frame } = setup();
    const b = box(0);
    act(() => { animator.timeline({ tracks: [ramp(b.target)], duration: 1000 }); });
    frame(0);
    act(() => { animator.tween({ target: b.target, from: 20, to: 0, ms: 100, easing: linear }); });
    frame(50);
    expect(b.shown.at(-1)).toBeCloseTo(50 + 10, 6);
  });

  it('pulls toward the committed value at a weight below 1', () => {
    const { animator, frame } = setup();
    const b = box(10);
    act(() => { animator.timeline({ tracks: [ramp(b.target, { weight: 0.5 })], duration: 200 }); });
    frame(0);
    frame(50);
    expect(b.shown.at(-1)).toBeCloseTo(30, 9);
  });

  it('shows a seek while paused at the next frame', () => {
    const { animator, frame } = setup();
    const b = box(0);
    let tl!: TimelineHandle;
    act(() => { tl = animator.timeline({ tracks: [ramp(b.target)], duration: 200 }); });
    frame(0);
    frame(20);
    act(() => { tl.pause(); });
    frame(40);
    expect(b.shown.at(-1)).toBeCloseTo(20, 9);
    act(() => { tl.seek(80); });
    frame(60);
    expect(b.shown.at(-1)).toBeCloseTo(80, 9);
    act(() => { animator.pause(); tl.seek(35); });
    frame(80);
    expect(b.shown.at(-1)).toBeCloseTo(35, 9);
  });

  it('shows an edit while paused at the next frame', () => {
    const { animator, frame } = setup();
    const b = box(0);
    const track = ramp(b.target);
    let tl!: TimelineHandle;
    act(() => { tl = animator.timeline({ tracks: [track], duration: 200 }); });
    frame(0);
    frame(50);
    act(() => { tl.pause(); });
    act(() => { tl.edit(() => { track.keys[1].value = 200; }); });
    frame(70);
    expect(b.shown.at(-1)).toBeCloseTo(100, 9);
  });

  it('lets go of a target whose track an edit removed, leaving it where it was', () => {
    const { animator, frame } = setup();
    const b = box(0);
    const tracks = [ramp(b.target)];
    let tl!: TimelineHandle;
    act(() => { tl = animator.timeline({ tracks, duration: 200 }); });
    frame(0);
    frame(50);
    act(() => { tl.edit(() => { tracks.length = 0; }); });
    frame(60);
    expect(b.target.active).toBe(false);
    expect(b.committed).toBeCloseTo(50, 9);
  });

  it('holds across a loop seam, showing the new lap the frame it wraps', () => {
    const { animator, frame } = setup();
    const b = box(0);
    act(() => { animator.timeline({ tracks: [ramp(b.target)], loop: true }); });
    frame(0);
    frame(90);
    expect(b.shown.at(-1)).toBeCloseTo(90, 9);
    frame(115);
    expect(b.shown.at(-1)).toBeCloseTo(15, 9);
    expect(b.committed).toBe(0);
    expect(b.target.active).toBe(true);
  });

  it('leaves its target where the last key put it when the timeline finishes', () => {
    const { animator, frame } = setup();
    const b = box(7);
    let done = 0;
    act(() => { animator.timeline({ tracks: [ramp(b.target)], onDone: () => { done += 1; } }); });
    frame(0);
    frame(60);
    frame(130);
    expect(done).toBe(1);
    expect(b.committed).toBe(100);
    expect(b.shown.at(-1)).toBe(100);
    expect(b.target.active).toBe(false);
    expect(animator.isActive()).toBe(false);
  });

  it('commits a track the playhead has passed while the timeline plays on, and lets go of the target', () => {
    const { animator, frame } = setup();
    const b = box(7);
    act(() => { animator.timeline({ tracks: [ramp(b.target)], duration: 500 }); });
    frame(0);
    frame(60);
    frame(130);
    expect(b.committed).toBe(100);
    expect(b.target.active).toBe(false);
    expect(b.shown.at(-1)).toBe(100);
  });

  it('commits the last key of a track one frame steps clean over', () => {
    const { animator, frame } = setup();
    const b = box(7);
    const track = ramp(b.target, { keys: [{ t: 40, value: 1 }, { t: 60, value: 9 }] });
    act(() => { animator.timeline({ tracks: [track], duration: 500 }); });
    frame(0);
    frame(30);
    expect(b.target.active).toBe(false);
    expect(b.committed).toBe(7);
    frame(90);
    expect(b.committed).toBe(9);
  });

  it('stays where it was when the timeline is canceled', () => {
    const { animator, frame } = setup();
    const b = box(7);
    let tl!: TimelineHandle;
    act(() => { tl = animator.timeline({ tracks: [ramp(b.target)] }); });
    frame(0);
    frame(40);
    act(() => { tl.cancel(); });
    expect(b.committed).toBeCloseTo(40, 9);
    expect(b.target.read()).toBeCloseTo(40, 9);
    expect(b.target.active).toBe(false);
  });

  it('samples a nested timeline at its own time', () => {
    const { animator, frame } = setup();
    const b = box(0);
    act(() => {
      animator.timeline({
        tracks: [{ kind: 'timeline', at: 50, timeline: { tracks: [ramp(b.target)] } }],
      });
    });
    frame(0);
    expect(b.target.active).toBe(false);
    frame(80);
    expect(b.shown.at(-1)).toBeCloseTo(30, 9);
    frame(150);
    expect(b.committed).toBe(100);
  });

  it('shows a seek back into a finished timeline, and plays on from there', () => {
    const { animator, frame } = setup();
    const b = box(0);
    let tl!: TimelineHandle;
    act(() => { tl = animator.timeline({ tracks: [ramp(b.target)] }); });
    frame(0);
    frame(120);
    expect(b.committed).toBe(100);
    act(() => { tl.seek(25); });
    frame(120);
    expect(b.shown.at(-1)).toBeCloseTo(25, 9);
    frame(130);
    expect(b.shown.at(-1)).toBeCloseTo(35, 9);
  });
});

describe('one clock', () => {
  it('lands a timeline event and a tween of the same length, started between frames, on one frame', () => {
    const { p, animator, frame } = setup();
    const b = box(0);
    const plain: number[] = [];
    const sampled: number[] = [];
    const at = { event: -1, plainDone: -1, arrived: -1 };
    act(() => { animator.keepAlive(); });
    frame(0);
    frame(20);
    p.clock = 30;
    act(() => {
      animator.timeline({
        tracks: [
          { kind: 'event', events: [{ t: 100, fire: () => { at.event = p.clock; } }] },
          { kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }], onTick: (v) => sampled.push(v) },
        ],
      });
      animator.tween({ from: 0, to: 100, ms: 100, easing: linear, onTick: (v) => plain.push(v), onDone: () => { at.plainDone = p.clock; } });
      animator.tween({ target: b.target, from: 0, to: 100, ms: 100, easing: linear });
    });
    for (let t = 40; t <= 160; t += 20) {
      frame(t);
      if (at.arrived < 0 && b.shown.at(-1) === 100) at.arrived = t;
    }
    expect(at).toEqual({ event: 120, plainDone: 120, arrived: 120 });
    expect(plain).toEqual(sampled);
    expect(plain.slice(0, 2)).toEqual([20, 40]);
  });
});
