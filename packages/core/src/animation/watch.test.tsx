import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { linear } from '@weasel-js/geom';
import { useAnimator } from './useAnimator';
import { AnimatorEventHub } from './observe';
import type { AnimatorEvent, Animator } from './types';
import type { EventTrack } from './timeline/types';

/** Manual frame pump. `now` tracks the last frame, so an animation registered
 *  mid-run gets a zero first dt. */
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
  return { animator: (): Animator => result.current, frame };
}

/** Records every event as `type:kind:label`, plus the raw events. */
function record(animator: Animator) {
  const events: AnimatorEvent[] = [];
  const stop = animator.watch((e) => events.push(e));
  const lines = () => events.map((e) => `${e.type}:${e.animation.kind}:${e.animation.label ?? e.animation.key ?? ''}`);
  return { events, lines, stop };
}

const tween = (a: Animator, label: string, extra: { cancelKey?: string; ms?: number } = {}) =>
  a.tween<number>({ from: 0, to: 1, ms: extra.ms ?? 100, easing: linear, onTick: () => {}, label, cancelKey: extra.cancelKey });

afterEach(() => { vi.restoreAllMocks(); });

describe('animator.watch', () => {
  it('delivers start, then end once the tween finishes', () => {
    const { animator, frame } = setup();
    const r = record(animator());
    act(() => { tween(animator(), 'a'); });
    expect(r.lines()).toEqual(['start:tween:a']);
    frame(0);
    frame(50);
    expect(r.lines()).toEqual(['start:tween:a']);
    frame(100);
    expect(r.lines()).toEqual(['start:tween:a', 'end:tween:a']);
  });

  it('delivers the same info object for every event of one animation', () => {
    const { animator, frame } = setup();
    const r = record(animator());
    let id = 0;
    act(() => { id = animator().tween<number>({ from: 0, to: 1, ms: 10, onTick: () => {}, cancelKey: 'pose:a', label: 'fade' }).id; });
    frame(0);
    frame(10);
    expect(r.events).toHaveLength(2);
    expect(r.events[0].animation).toBe(r.events[1].animation);
    expect(r.events[0].animation).toEqual({ id, kind: 'tween', key: 'pose:a', label: 'fade' });
  });

  it('reports cancel for every cancel path, and no end after it', () => {
    const { animator, frame } = setup();
    const r = record(animator());
    act(() => {
      const h = tween(animator(), 'byHandle');
      tween(animator(), 'byKey', { cancelKey: 'k' });
      const viaAnimator = tween(animator(), 'byAnimator');
      tween(animator(), 'byAll');
      h.cancel();
      animator().cancelKey('k');
      animator().cancel(viaAnimator);
      animator().cancelAll();
    });
    frame(0);
    frame(200);
    expect(r.lines().filter((l) => !l.startsWith('start'))).toEqual([
      'cancel:tween:byHandle', 'cancel:tween:byKey', 'cancel:tween:byAnimator', 'cancel:tween:byAll',
    ]);
  });

  it('reports a tween that cancels itself from its last onTick as canceled, not ended', () => {
    const { animator, frame } = setup();
    const r = record(animator());
    act(() => {
      const h = animator().tween<number>({ from: 0, to: 1, ms: 10, label: 'self', onTick: (v) => { if (v === 1) h.cancel(); } });
    });
    frame(0);
    frame(10);
    expect(r.lines()).toEqual(['start:tween:self', 'cancel:tween:self']);
  });

  it('reports a stolen cancelKey as interrupt, naming the thief, before the thief starts', () => {
    const { animator } = setup();
    const r = record(animator());
    act(() => { tween(animator(), 'old', { cancelKey: 'pose:a' }); });
    act(() => { tween(animator(), 'new', { cancelKey: 'pose:a' }); });
    expect(r.lines()).toEqual(['start:tween:old', 'interrupt:tween:old', 'start:tween:new']);
    const interrupt = r.events[1];
    expect(interrupt.type === 'interrupt' && interrupt.by).toBe(r.events[2].animation);
  });

  it('reports a finished loop as ended, with its children in between', () => {
    const { animator, frame } = setup();
    const r = record(animator());
    act(() => {
      animator().tweenLoop<number>({ from: 0, to: 1, ms: 10, count: 2, onTick: () => {}, label: 'breathe' });
    });
    frame(0);
    frame(10);
    frame(20);
    frame(30);
    expect(r.lines()).toEqual([
      'start:tweenLoop:breathe',
      'start:tween:', 'end:tween:',
      'start:tween:', 'end:tween:',
      'end:tweenLoop:breathe',
    ]);
  });

  it('reports a finished stagger as ended', () => {
    const { animator, frame } = setup();
    const r = record(animator());
    act(() => {
      animator().stagger([0], 0, () => tween(animator(), 'child', { ms: 10 }), { label: 'fan' });
    });
    frame(0);
    frame(10);
    expect(r.lines()).toEqual(['start:stagger:fan', 'start:tween:child', 'end:tween:child', 'end:stagger:fan']);
  });

  it('delivers timeline event-track crossings with their path, laps, then end', () => {
    const { animator, frame } = setup();
    const r = record(animator());
    const order: string[] = [];
    const root: EventTrack = { kind: 'event', label: 'root', events: [{ t: 10, fire: () => order.push('own:root') }] };
    const inner: EventTrack = { kind: 'event', label: 'inner', events: [{ t: 5, fire: () => order.push('own:inner') }] };
    animator().watch((e) => { if (e.type === 'fire') order.push(`watch:${e.track.label}`); });
    act(() => {
      animator().timeline({
        label: 'intro',
        loop: 1,
        duration: 40,
        tracks: [
          { kind: 'sampled', keys: [{ t: 0, value: 0 }], onTick: () => {} },
          root,
          { kind: 'timeline', at: 20, timeline: { tracks: [inner] } },
        ],
      });
    });
    frame(0);
    frame(30);
    frame(50);
    frame(90);
    const fires = r.events.filter((e) => e.type === 'fire');
    expect(fires.map((e) => e.type === 'fire' && [e.track.label, e.path, e.lateBy])).toEqual([
      ['root', [1], 20],
      ['inner', [2, 0], 5],
      ['root', [1], 0],
      ['inner', [2, 0], 15],
    ]);
    expect(r.lines().filter((l) => !l.startsWith('fire'))).toEqual([
      'start:timeline:intro', 'lap:timeline:intro', 'end:timeline:intro',
    ]);
    const lap = r.events.find((e) => e.type === 'lap');
    expect(lap?.type === 'lap' && lap.lap).toBe(1);
    // The event's own handler runs first; the watcher hears about it after.
    expect(order.slice(0, 4)).toEqual(['own:root', 'watch:root', 'own:inner', 'watch:inner']);
  });

  it('reports a revived timeline as starting again under the same id', () => {
    const { animator, frame } = setup();
    const r = record(animator());
    let tl!: ReturnType<Animator['timeline']>;
    act(() => { tl = animator().timeline({ label: 'tl', tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 10, value: 1 }], onTick: () => {} }] }); });
    frame(0);
    frame(10);
    act(() => { tl.seek(0); });
    expect(r.lines()).toEqual(['start:timeline:tl', 'end:timeline:tl', 'start:timeline:tl']);
    expect(r.events[2].animation.id).toBe(tl.id);
  });

  it('labels keepAlive entries and physics kinds', () => {
    const { animator } = setup();
    const r = record(animator());
    act(() => {
      const stop = animator().keepAlive();
      animator().spring<number>({ from: 0, to: 1, onTick: () => {} });
      animator().decay<number>({ from: 0, velocity: 10, add: (a, b) => a + b, scale: (v, k) => v * k, magnitude: Math.abs, onTick: () => {} });
      animator().physics<number>({ from: 0, to: null, velocity: 10, onTick: () => {} });
      stop();
    });
    expect(r.lines()).toEqual([
      'start:keepAlive:', 'start:spring:', 'start:decay:', 'start:physics:', 'cancel:keepAlive:',
    ]);
  });

  it('stops delivering once unsubscribed, and one throwing listener does not starve the rest', () => {
    const { animator } = setup();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = record(animator());
    const stop = animator().watch(() => { throw new Error('boom'); });
    act(() => { tween(animator(), 'a'); });
    expect(r.lines()).toEqual(['start:tween:a']);
    expect(err).toHaveBeenCalledTimes(1);
    stop();
    r.stop();
    act(() => { tween(animator(), 'b'); });
    expect(r.lines()).toEqual(['start:tween:a']);
    expect(err).toHaveBeenCalledTimes(1);
  });
});

describe('animator.live', () => {
  it('lists what is running, with progress where it has an end', () => {
    const { animator, frame } = setup();
    let tl!: ReturnType<Animator['timeline']>;
    act(() => {
      animator().tween<number>({ from: 0, to: 1, ms: 100, onTick: () => {}, label: 'fade', cancelKey: 'pose:a' });
      animator().spring<number>({ from: 0, to: 1, onTick: () => {} });
      tl = animator().timeline({ tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 200, value: 1 }], onTick: () => {} }] });
    });
    frame(0);
    act(() => { tl.setTimeScale(0.5); });
    frame(50);
    const rows = animator().live();
    expect(rows.map((a) => a.kind)).toEqual(['tween', 'spring', 'timeline']);
    expect(rows[0]).toMatchObject({ kind: 'tween', key: 'pose:a', label: 'fade', paused: false, timeScale: 1, elapsed: 50, progress: 0.5 });
    expect(rows[1].progress).toBeUndefined();
    expect(rows[2]).toMatchObject({ timeScale: 0.5, elapsed: 25, progress: 0.125 });
  });

  it('drops an animation once it ends', () => {
    const { animator, frame } = setup();
    act(() => { tween(animator(), 'a', { ms: 10 }); });
    expect(animator().live()).toHaveLength(1);
    frame(0);
    frame(10);
    expect(animator().live()).toEqual([]);
  });
});

describe('animator.watch cost', () => {
  // A proxy, not a heap measurement: every event is built as the argument to
  // `AnimatorEventHub.emit`, so no emit call means no event was allocated.
  it('builds no event while nobody is watching', () => {
    const emit = vi.spyOn(AnimatorEventHub.prototype, 'emit');
    const { animator, frame } = setup();
    const events: EventTrack = { kind: 'event', events: [{ t: 5 }, { t: 15 }] };
    act(() => {
      tween(animator(), 'a', { cancelKey: 'k' });
      tween(animator(), 'b', { cancelKey: 'k' });
      animator().tweenLoop<number>({ from: 0, to: 1, ms: 10, count: 3, onTick: () => {} });
      animator().timeline({ loop: 2, tracks: [events, { kind: 'timeline', at: 0, timeline: { tracks: [events] } }] });
    });
    for (let t = 0; t <= 200; t += 5) frame(t);
    act(() => { animator().cancelAll(); });
    expect(emit).not.toHaveBeenCalled();

    // The control: the same hub does emit once someone listens.
    const stop = animator().watch(() => {});
    act(() => { tween(animator(), 'c'); });
    expect(emit).toHaveBeenCalled();
    stop();
  });
});
