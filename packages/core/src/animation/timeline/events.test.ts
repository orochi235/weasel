import { describe, expect, it } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { EventTrack } from './types';

function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    return {
      id: seed.id, cancel: () => {}, pause: () => {}, resume: () => {},
      setTimeScale: () => {}, isPaused: () => false,
    };
  };
  return { register, advance: (t: number) => tick!(t) };
}

const eventTrack = (fire: (label: string) => void): EventTrack => ({
  kind: 'event',
  events: [
    { t: 10, fire: () => fire('a') },
    { t: 50, fire: () => fire('b') },
    { t: 90, fire: () => fire('c') },
  ],
});

describe('event tracks', () => {
  it('fires an event keyed at t=0 on the very first tick', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 100,
      tracks: [{ kind: 'event', events: [{ t: 0, fire: () => fired.push('zero') }] }],
    });
    h.advance(0);
    expect(fired).toEqual(['zero']);
  });

  it('fires each event once as the playhead crosses it', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(20);
    h.advance(60);
    expect(fired).toEqual(['a', 'b']);
  });

  it('does not re-fire an event already crossed', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(20);
    h.advance(21);
    h.advance(22);
    expect(fired).toEqual(['a']);
  });

  it('fires every event inside one long advance, in order', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(95);
    expect(fired).toEqual(['a', 'b', 'c']);
  });

  it('stays silent on seek', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(5);
    tl.seek(95);
    expect(fired).toEqual([]);
  });

  it('does not replay earlier events after seeking forward past them', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    tl.seek(60);
    h.advance(95);
    expect(fired).toEqual(['c']);
  });

  it('re-arms events after seeking backward', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(95);
    fired.length = 0;
    tl.seek(0);
    h.advance(190);
    expect(fired).toEqual(['a', 'b', 'c']);
  });

  it('fires an event in the tail of a pass straddling the loop seam', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 100,
      loop: true,
      tracks: [{ kind: 'event', events: [{ t: 98, fire: () => fired.push('late') }] }],
    });
    h.advance(95);
    h.advance(150);
    expect(fired).toEqual(['late']);
  });

  it('re-arms events on a loop wrap', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      tracks: [eventTrack((l) => fired.push(l))], duration: 100, loop: true,
    });
    h.advance(95);
    h.advance(195);
    expect(fired).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  it('never fires an event past the declared duration', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 100,
      tracks: [{ kind: 'event', events: [{ t: 150, fire: () => fired.push('past') }] }],
    });
    h.advance(200);
    expect(fired).toEqual([]);
  });
});
