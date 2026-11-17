import { describe, expect, it } from 'vitest';
import { createTarget } from '../target';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { OpenTrackHold } from './trackHolds';
import type { TimelineHandle, Track } from './types';

/** A timeline on a fake animator whose holds count as open until they leave. */
function rig(build: (handle: () => TimelineHandle) => { tracks: Track[]; duration?: number; loop?: boolean }) {
  let tick: ((v: number, s?: number) => boolean) | null = null;
  let onCancel: (() => void) | undefined;
  const open = new Set<object>();
  const hold: OpenTrackHold = () => {
    const h = { touch: () => {}, leave: () => { open.delete(h); } };
    open.add(h);
    return h;
  };
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    onCancel = seed.onCancel;
    return {
      id: seed.id, cancel: () => onCancel?.(), pause: () => {}, resume: () => {},
      setTimeScale: () => {}, timeScale: () => 1, isPaused: () => false,
    };
  };
  let handle: TimelineHandle | null = null;
  handle = createTimeline(register, 1, build(() => handle!), undefined, hold);
  return { handle, open, frame: (v: number) => tick!(v, 1) };
}

let v = 0;
const target = createTarget<number>({ get: () => v, set: (n) => { v = n; } });
const ramp = (more = {}): Track => ({ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }], target, ...more });

describe('a timeline canceled partway through a frame', () => {
  it('holds no target once an event at the end of a lap cancels it as the frame wraps', () => {
    const r = rig((h) => ({
      duration: 100,
      loop: true,
      tracks: [ramp(), { kind: 'event', events: [{ t: 95, fire: () => h().cancel() }] }],
    }));
    r.frame(0);
    r.frame(90);
    expect(r.open.size).toBe(1);
    expect(r.frame(110)).toBe(true);
    expect(r.open.size).toBe(0);
  });

  it("holds no later track's target, and fires nothing, once a track's onTick cancels it", () => {
    const fired: number[] = [];
    let cancelAt = Infinity;
    const r = rig((h) => ({
      duration: 200,
      tracks: [
        { kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }], onTick: (v: number) => { if (v >= cancelAt) h().cancel(); } },
        ramp(),
        { kind: 'event', events: [{ t: 40, fire: () => fired.push(40) }] },
      ],
    }));
    r.frame(0);
    r.frame(20);
    cancelAt = 50;
    expect(r.frame(50)).toBe(true);
    expect(r.open.size).toBe(0);
    expect(fired).toEqual([]);
  });
});
