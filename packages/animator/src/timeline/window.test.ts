import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import { createTarget, type Target } from '../target';
import { bindClip, toClip, type Clip } from './clip';
import type { SampledTrack } from './types';

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

function setup() {
  const p = pump();
  const { result } = renderHook(() => useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }));
  return { animator: result.current, frame: (t: number) => act(() => p.frame(t)) };
}

function cell<T>(start: T) {
  const c = { committed: start, shown: start, target: null as unknown as Target<T> };
  c.target = createTarget<T>({ get: () => c.committed, set: (v) => { c.committed = v; c.shown = v; }, show: (v) => { c.shown = v; } });
  return c;
}

describe('a nested timeline with a window', () => {
  it('samples its tracks only inside the window, and holds `shown` at 1 there and 0 outside', () => {
    const { animator, frame } = setup();
    const x = cell(0);
    const visible = cell(1);
    let ticks = 0;
    const ramp: SampledTrack<number> = {
      kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 400, value: 400 }], target: x.target, onTick: () => { ticks += 1; },
    };
    act(() => {
      animator.timeline({ tracks: [{ kind: 'timeline', at: 0, timeline: { tracks: [ramp] }, window: [100, 300], shown: visible.target }] });
    });
    frame(0);
    frame(50);
    expect(visible.shown).toBe(0);
    expect(ticks).toBe(0);
    frame(150);
    expect(visible.shown).toBe(1);
    expect(x.shown).toBe(150);
    frame(250);
    expect(x.shown).toBe(250);
    const inside = ticks;
    frame(350);
    expect(visible.shown).toBe(0);
    expect(ticks).toBe(inside);
  });

  it('plays the timeline on to the out point, past its last key, so what it shows is hidden there', () => {
    const { animator, frame } = setup();
    const visible = cell(1);
    let handle!: ReturnType<typeof animator.timeline>;
    act(() => {
      handle = animator.timeline({
        tracks: [{ kind: 'timeline', at: 0, timeline: { tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 50, value: 1 }] }] }, window: [0, 200], shown: visible.target }],
      });
    });
    expect(handle.duration()).toBe(200);
    frame(0);
    frame(100);
    expect(visible.shown).toBe(1);
    frame(250);
    expect(visible.committed).toBe(0);
  });

  it('round-trips its window and shown target through a clip', () => {
    const visible = cell(1);
    const clip: Clip = {
      version: 1,
      tracks: [{ kind: 'timeline', at: 10, timeline: { tracks: [] }, window: [20, 80], shown: 'layer.shown' }],
    };
    const bound = bindClip(clip, { target: (name) => (name === 'layer.shown' ? visible.target : undefined) });
    expect(bound.tracks[0]).toMatchObject({ window: [20, 80], shown: visible.target, shownName: 'layer.shown' });
    expect(toClip(bound)).toEqual(clip);
    expect(() => bindClip(clip, { target: () => undefined })).toThrow('no target named "layer.shown"');
  });
});
