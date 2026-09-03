import { describe, expect, it, vi } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { EventTrack, SampledTrack, TimelineHandle } from './types';

/** Fake animator table, modelling the three behaviors revival depends on: an
 *  entry returning true is deleted, a re-registered one starts at virtualNow 0,
 *  and a `cancelKey` claim evicts whoever holds the key. */
function harness() {
  interface Entry {
    id: number;
    cancelKey?: string;
    paused: boolean;
    scale: number;
    virtualNow: number;
    tick: (virtualNow: number) => boolean;
    onCancel?: () => void;
  }
  const table = new Map<number, Entry>();
  let registrations = 0;
  const drop = (e: Entry): void => { e.onCancel?.(); table.delete(e.id); };

  const register: TimelineRegister = (seed) => {
    registrations += 1;
    if (seed.cancelKey != null && !seed.keepExisting) {
      for (const e of [...table.values()]) if (e.cancelKey === seed.cancelKey) drop(e);
    }
    table.set(seed.id, { ...seed, paused: false, scale: 1, virtualNow: 0 });
    const at = (): Entry | undefined => table.get(seed.id);
    return {
      id: seed.id,
      cancel: () => { const e = at(); if (e) drop(e); },
      pause: () => { const e = at(); if (e) e.paused = true; },
      resume: () => { const e = at(); if (e) e.paused = false; },
      setTimeScale: (s) => { const e = at(); if (e) e.scale = s; },
      timeScale: () => at()?.scale ?? 1,
      isPaused: () => at()?.paused ?? false,
    };
  };

  return {
    register,
    /** One frame of `dt` real ms across every live entry. */
    frame(dt: number) {
      for (const e of [...table.values()]) {
        e.virtualNow += dt * (e.paused ? 0 : e.scale);
        if (e.tick(e.virtualNow)) table.delete(e.id);
      }
    },
    cancelKey(key: string) {
      for (const e of [...table.values()]) if (e.cancelKey === key) drop(e);
    },
    isLive: (id = 1) => table.has(id),
    registrations: () => registrations,
    /** Another animation claiming `key`, as a consumer's would. */
    claim(key: string) {
      const seen = { cancelled: false };
      register({
        id: 99, cancelKey: key, tick: () => false, onCancel: () => { seen.cancelled = true; },
      });
      return seen;
    },
  };
}

const numberTrack = (onTick: (v: number) => void = () => {}): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
  onTick,
});

describe('a finished timeline', () => {
  it('leaves the animator table rather than holding a slot forever', () => {
    const h = harness();
    createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(120);
    expect(h.isLive()).toBe(false);
  });

  it('is put back on the table by a seek', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(120);
    tl.seek(0);
    expect(h.isLive()).toBe(true);
    h.frame(10);
    expect(tl.time()).toBe(10);
  });

  it('resumes from the seeked position, with no jump from the fresh clock', () => {
    const h = harness();
    const seen: number[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack((v) => seen.push(v))] });
    h.frame(120);
    tl.seek(40);
    h.frame(25);
    expect(tl.time()).toBe(65);
    expect(seen.at(-1)).toBe(65);
  });

  it('keeps playing across the frames after a revival', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(120);
    tl.seek(0);
    h.frame(30);
    h.frame(30);
    expect(tl.time()).toBe(60);
  });

  it('is revived by an edit that extends the duration past the playhead', () => {
    const h = harness();
    const track = numberTrack();
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    h.frame(120);
    expect(h.isLive()).toBe(false);
    tl.edit(() => { track.keys.push({ t: 200, value: 200 }); });
    expect(h.isLive()).toBe(true);
    h.frame(20);
    expect(tl.time()).toBe(120);
  });

  it('stays finished after an edit that does not reach the playhead', () => {
    const h = harness();
    const track = numberTrack();
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    h.frame(120);
    tl.edit(() => { track.keys[1].value = 50; });
    expect(h.isLive()).toBe(false);
  });

  it('stays finished when the seek lands at or past the duration', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(120);
    tl.seek(100);
    expect(h.isLive()).toBe(false);
  });
});

describe('timeline revival and onDone', () => {
  it('fires again for a genuine replay', () => {
    const h = harness();
    const onDone = vi.fn();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()], onDone });
    h.frame(120);
    expect(onDone).toHaveBeenCalledTimes(1);
    tl.seek(0);
    h.frame(120);
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it('does not fire on the revival itself', () => {
    const h = harness();
    const onDone = vi.fn();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()], onDone });
    h.frame(120);
    tl.seek(50);
    h.frame(10);
    expect(tl.time()).toBe(60);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps the entry alive when the handler itself seeks back', () => {
    const h = harness();
    let tl: TimelineHandle | null = null;
    let replays = 0;
    tl = createTimeline(h.register, 1, {
      tracks: [numberTrack()],
      onDone: () => { if (replays++ === 0) tl?.seek(0); },
    });
    h.frame(120);
    expect(h.isLive()).toBe(true);
    expect(h.registrations()).toBe(1);
    h.frame(50);
    expect(tl.time()).toBe(50);
  });
});

describe('a cancelled timeline', () => {
  it('is not resurrected by a seek', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(50);
    tl.cancel();
    tl.seek(0);
    expect(h.isLive()).toBe(false);
    h.frame(30);
    expect(tl.time()).toBe(0);
  });

  it('is not resurrected after the animator cancelled it by key', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()], cancelKey: 'intro' });
    h.frame(50);
    h.cancelKey('intro');
    tl.seek(0);
    expect(h.isLive()).toBe(false);
  });

  it('is not resurrected by an edit that extends the duration', () => {
    const h = harness();
    const track = numberTrack();
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    h.frame(120);
    tl.cancel();
    tl.edit(() => { track.keys.push({ t: 200, value: 200 }); });
    expect(h.isLive()).toBe(false);
  });
});

describe('timeline revival and cancelKey', () => {
  it('does not cancel whoever claimed the key while it was finished', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()], cancelKey: 'intro' });
    h.frame(120);
    const other = h.claim('intro');
    tl.seek(0);
    expect(other.cancelled).toBe(false);
    expect(h.isLive()).toBe(true);
  });

  it('stays cancellable by that key after reviving', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()], cancelKey: 'intro' });
    h.frame(120);
    tl.seek(0);
    h.cancelKey('intro');
    expect(h.isLive()).toBe(false);
  });
});

describe('timeline revival and event tracks', () => {
  const beats = (fired: string[]): EventTrack => ({
    kind: 'event',
    events: [
      { t: 10, fire: () => fired.push('a') },
      { t: 90, fire: () => fired.push('b') },
    ],
  });

  it('replays a whole pass exactly once, with no double-fire at the seam', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [beats(fired)], duration: 100 });
    h.frame(120);
    expect(fired).toEqual(['a', 'b']);
    tl.seek(0);
    expect(fired).toEqual(['a', 'b']);
    h.frame(120);
    expect(fired).toEqual(['a', 'b', 'a', 'b']);
  });

  it('fires only the new events after an edit extends past the old end', () => {
    const h = harness();
    const fired: string[] = [];
    const track = beats(fired);
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    h.frame(120);
    tl.edit(() => { track.events.push({ t: 150, fire: () => fired.push('c') }); });
    h.frame(60);
    expect(fired).toEqual(['a', 'b', 'c']);
  });
});

describe('timeline revival and playback intent', () => {
  it('revives paused when the consumer paused it after it finished', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(120);
    tl.pause();
    tl.seek(0);
    expect(tl.isPaused()).toBe(true);
    h.frame(50);
    expect(tl.time()).toBe(0);
  });

  it('reports a pause taken while it was off the table', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(120);
    expect(tl.isPaused()).toBe(false);
    tl.pause();
    expect(tl.isPaused()).toBe(true);
  });

  it('revives playing after a pause the consumer already undid', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    tl.pause();
    tl.resume();
    h.frame(120);
    tl.seek(0);
    h.frame(20);
    expect(tl.time()).toBe(20);
  });

  it('reports the intent after the animator cancelled it', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()], cancelKey: 'intro' });
    tl.pause();
    h.cancelKey('intro');
    expect(tl.isPaused()).toBe(true);
  });

  it('carries the time scale across a revival', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    tl.setTimeScale(2);
    h.frame(60);
    expect(h.isLive()).toBe(false);
    tl.seek(0);
    h.frame(10);
    expect(tl.time()).toBe(20);
  });
});

describe('a revived timeline', () => {
  it('re-registers once across a drag of many seeks', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(120);
    tl.seek(40);
    tl.seek(60);
    tl.seek(40);
    expect(h.registrations()).toBe(2);
    h.frame(10);
    expect(tl.time()).toBe(50);
  });
});

describe('a live timeline', () => {
  it('is not re-registered by a seek', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack()] });
    h.frame(30);
    tl.seek(10);
    expect(h.registrations()).toBe(1);
    h.frame(20);
    expect(tl.time()).toBe(30);
  });
});
