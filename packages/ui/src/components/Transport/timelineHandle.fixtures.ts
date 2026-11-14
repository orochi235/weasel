import { vi } from 'vitest';
import type { TimelineHandle, Track } from '@weasel-js/animator';

/** A stand-in with the live-array semantics `createTimeline` actually has:
 *  `tracks()` returns the same array object every call, and `edit` runs the
 *  mutation against it. A fake returning a copy would make the splice below a
 *  no-op and the test would still pass, which is the bug this guards. */
export function fakeHandle(over: Partial<TimelineHandle> = {}): TimelineHandle & { live: Track[] } {
  const live: Track[] = [
    { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} } as Track,
  ];
  let t = 0;
  let paused = true;
  let loop: boolean | number = false;
  let scale = 1;
  const subscribers = new Set<() => void>();
  const playback = new Set<() => void>();
  const changed = (): void => { for (const cb of playback) cb(); };
  return {
    live,
    id: 1,
    cancel: vi.fn(), pause: vi.fn(() => { paused = true; changed(); }), resume: vi.fn(() => { paused = false; changed(); }),
    setTimeScale: vi.fn((s: number) => { scale = s; changed(); }),
    timeScale: () => scale,
    isPaused: () => paused,
    seek: vi.fn((to: number) => { t = to; changed(); }),
    time: () => t,
    duration: () => 1000,
    tracks: () => live,
    edit: vi.fn((fn: () => void) => { fn(); for (const cb of subscribers) cb(); }),
    subscribe: (cb: () => void) => { subscribers.add(cb); return () => { subscribers.delete(cb); }; },
    subscribePlayback: (cb: () => void) => { playback.add(cb); return () => { playback.delete(cb); }; },
    setLoop: vi.fn((next: boolean | number) => { loop = next; changed(); }),
    loop: () => loop,
    ...over,
  } as TimelineHandle & { live: Track[] };
}
