import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeTimeline, type MakeTimelineOptions } from './createTimeline.test-harness';
import type { EventTrack, TimelineEvent } from './types';

const START = 5000;

interface Booked { label: string; when: number; stopped: boolean }

/** A timeline on a fake clock whose events record every booking. `frame(wall)`
 *  moves the clock to `START + wall` and ticks the timeline at `virtual`, which
 *  is `wall` at a time scale of 1. */
function rig(opts: MakeTimelineOptions & { lookahead?: number; maxLate?: number }) {
  let now = START;
  const log: Booked[] = [];
  const tl = makeTimeline({
    ...opts,
    booking: { clock: { now: () => now }, lookahead: opts.lookahead ?? 100, maxLate: opts.maxLate },
  });
  return {
    ...tl,
    log,
    live: () => log.filter((b) => !b.stopped),
    whens: () => log.map((b) => b.when),
    setClock: (wall: number) => { now = START + wall; },
    frame: (wall: number, virtual = wall) => { now = START + wall; tl.advance(virtual); },
  };
}

function bookingEvent(log: Booked[], t: number, label = `@${t}`): TimelineEvent {
  return {
    t,
    book: (when) => {
      const entry = { label, when, stopped: false };
      log.push(entry);
      return { stop: () => { entry.stopped = true; } };
    },
  };
}

/** Builds the track after the rig, so its events write to the rig's log. */
function withEvents(
  opts: MakeTimelineOptions & { lookahead?: number; maxLate?: number },
  times: number[],
) {
  const track: EventTrack = { kind: 'event', events: [] };
  const r = rig({ ...opts, tracks: [track] });
  track.events = times.map((t) => bookingEvent(r.log, t));
  return { ...r, track };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('event booking', () => {
  it('books an event before its frame arrives, at its true time on the clock', () => {
    const r = withEvents({ duration: 1000 }, [150]);
    r.frame(0);
    expect(r.log).toEqual([]);
    r.frame(60);
    expect(r.log).toEqual([{ label: '@150', when: START + 150, stopped: false }]);
  });

  it('books an event keyed at t=0 on the very first tick', () => {
    const r = withEvents({ duration: 1000 }, [0]);
    r.frame(0);
    expect(r.whens()).toEqual([START]);
  });

  it('books each event once however many frames its window spans', () => {
    const r = withEvents({ duration: 1000 }, [150]);
    for (const wall of [60, 70, 80, 150, 200]) r.frame(wall);
    expect(r.log).toHaveLength(1);
  });

  it('books every event one long frame crossed, clamped to now', () => {
    const r = withEvents({ duration: 1000, lookahead: 10 }, [20, 30]);
    r.frame(0);
    r.frame(100);
    expect(r.whens()).toEqual([START + 100, START + 100]);
  });

  it('drops an event discovered later than maxLate instead of booking it', () => {
    const r = withEvents({ duration: 1000, lookahead: 10, maxLate: 50 }, [20, 70]);
    r.frame(0);
    r.frame(100);
    expect(r.log.map((b) => b.label)).toEqual(['@70']);
    expect(r.whens()).toEqual([START + 100]);
  });

  it('measures lookahead in clock ms, so a faster timeline books further ahead', () => {
    const r = withEvents({ duration: 1000 }, [150]);
    r.handle.setTimeScale(2);
    r.frame(0);
    expect(r.whens()).toEqual([START + 75]);
  });

  it('calls fire on the crossing frame as well as booking ahead of it', () => {
    const fired: number[] = [];
    const track: EventTrack = { kind: 'event', events: [] };
    const r = rig({ duration: 1000, tracks: [track] });
    track.events = [{ ...bookingEvent(r.log, 50), fire: (lateBy) => fired.push(lateBy) }];
    r.frame(0);
    expect(r.log).toHaveLength(1);
    expect(fired).toEqual([]);
    r.frame(60);
    expect(fired).toEqual([10]);
    expect(r.log).toHaveLength(1);
  });

  it('books a nested timeline event at its root time', () => {
    const track: EventTrack = { kind: 'event', events: [] };
    const r = rig({
      duration: 2000,
      tracks: [{ kind: 'timeline', at: 1000, timeline: { tracks: [track] } }],
    });
    track.events = [bookingEvent(r.log, 10)];
    r.frame(0);
    r.frame(950);
    expect(r.whens()).toEqual([START + 1010]);
  });

  it('warns once when an event can book but the timeline has no clock', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const book = vi.fn();
    const tl = makeTimeline({
      duration: 1000,
      tracks: [{ kind: 'event', events: [{ t: 0, book }, { t: 10, book }] }],
    });
    tl.advance(0);
    tl.advance(20);
    expect(book).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('event booking across transport changes', () => {
  it('does not book the span a seek skips, and retracts what it left behind', () => {
    const r = withEvents({ duration: 1000 }, [50, 250, 500]);
    r.frame(0);
    r.handle.seek(400);
    r.frame(20);
    expect(r.log).toEqual([
      { label: '@50', when: START + 50, stopped: true },
      { label: '@500', when: START + 100, stopped: false },
    ]);
  });

  it('retracts on pause and rebooks against the clock on resume', () => {
    const r = withEvents({ duration: 1000 }, [80]);
    r.frame(0);
    r.setClock(10);
    r.handle.pause();
    expect(r.log[0].stopped).toBe(true);
    r.frame(300, 0);
    r.handle.resume();
    r.frame(500, 0);
    expect(r.live().map((b) => b.when)).toEqual([START + 580]);
  });

  it('leaves a booking the clock has already reached, and never books it twice', () => {
    const r = withEvents({ duration: 1000 }, [30]);
    r.frame(0);
    r.setClock(40);
    r.handle.pause();
    r.handle.resume();
    r.frame(40, 0);
    r.frame(100, 60);
    expect(r.log).toEqual([{ label: '@30', when: START + 30, stopped: false }]);
  });

  it('never retracts or rebooks an event whose book returned no stop', () => {
    const track: EventTrack = { kind: 'event', events: [] };
    const r = rig({ duration: 1000, tracks: [track] });
    const whens: number[] = [];
    track.events = [{ t: 80, book: (when) => { whens.push(when); } }];
    r.frame(0);
    r.handle.pause();
    r.handle.resume();
    r.frame(10);
    r.frame(100);
    expect(whens).toEqual([START + 80]);
  });

  it('retimes a pending booking when the time scale changes', () => {
    const r = withEvents({ duration: 1000 }, [80]);
    r.frame(0);
    r.handle.setTimeScale(2);
    r.frame(10, 20);
    expect(r.log).toEqual([
      { label: '@80', when: START + 80, stopped: true },
      { label: '@80', when: START + 40, stopped: false },
    ]);
  });

  it('leaves a booking a tiny scale change barely moves', () => {
    const r = withEvents({ duration: 1000 }, [80]);
    r.frame(0);
    r.handle.setTimeScale(1.001);
    r.frame(10, 10.01);
    expect(r.log).toHaveLength(1);
    expect(r.log[0].stopped).toBe(false);
  });

  it('retracts and rebooks an event an edit moved', () => {
    const r = withEvents({ duration: 1000 }, [80]);
    r.frame(0);
    r.setClock(10);
    r.handle.edit(() => { r.track.events[0].t = 90; });
    r.frame(10);
    expect(r.log).toEqual([
      { label: '@80', when: START + 80, stopped: true },
      { label: '@80', when: START + 90, stopped: false },
    ]);
  });

  it('retracts pending bookings when canceled', () => {
    const r = withEvents({ duration: 1000 }, [80]);
    r.frame(0);
    r.handle.cancel();
    expect(r.log[0].stopped).toBe(true);
  });
});

describe('event booking on a loop', () => {
  it('books across the seam into the next lap at its true time, once per lap', () => {
    const r = withEvents({ duration: 100, loop: true }, [10]);
    for (const wall of [0, 50, 105, 150]) r.frame(wall);
    expect(r.log.map((b) => [b.when, b.stopped])).toEqual([
      [START + 10, false], [START + 110, false], [START + 210, false],
    ]);
  });

  it('does not book into a lap the loop policy will not play', () => {
    const r = withEvents({ duration: 100, loop: 1 }, [10]);
    for (const wall of [0, 50, 150, 190]) r.frame(wall);
    expect(r.whens()).toEqual([START + 10, START + 110]);
  });

  it('retracts a booking in a lap that setLoop(false) removed', () => {
    const r = withEvents({ duration: 100, loop: true }, [10]);
    r.frame(0);
    r.frame(50);
    r.handle.setLoop(false);
    expect(r.log.map((b) => [b.when, b.stopped])).toEqual([
      [START + 10, false], [START + 110, true],
    ]);
  });
});

describe('event booking clock mapping', () => {
  const FRAME = 16;

  it('books evenly spaced events evenly when the clock read jitters per frame', () => {
    const track: EventTrack = { kind: 'event', events: [] };
    const r = rig({ duration: 4000, tracks: [track] });
    track.events = Array.from({ length: 80 }, (_, i) => bookingEvent(r.log, i * 50));
    for (let k = 0; k * FRAME <= 4000; k += 1) {
      const wall = k * FRAME;
      r.frame(wall + (k % 2 ? 8 : 0), wall);
    }
    const settled = r.log.filter((_, i) => i * 50 >= 1000).map((b) => b.when);
    const gaps = settled.slice(1).map((w, i) => w - settled[i]);
    for (const gap of gaps) expect(Math.abs(gap - 50)).toBeLessThan(0.5);
  });

  it('follows a clock that drifts from the frame clock', () => {
    const RATE = 1.0005;
    const track: EventTrack = { kind: 'event', events: [] };
    const r = rig({ duration: 61000, tracks: [track] });
    track.events = Array.from({ length: 120 }, (_, i) => bookingEvent(r.log, i * 500));
    for (let k = 0; k * FRAME <= 60000; k += 1) {
      const wall = k * FRAME;
      r.frame(wall * RATE, wall);
    }
    const late = r.log.filter((_, i) => i * 500 >= 10000);
    late.forEach((b, j) => {
      const u = (j + 20) * 500;
      expect(Math.abs(b.when - (START + u * RATE))).toBeLessThan(1);
    });
  });

  it('resyncs to the clock after a jump the frame clock never saw', () => {
    const r = withEvents({ duration: 2000 }, [600]);
    for (let wall = 0; wall <= 500; wall += FRAME) r.frame(wall);
    r.frame(496 + 1000, 496);
    r.frame(506 + 1000, 506);
    expect(r.whens()).toEqual([START + 1000 + 600]);
  });
});
