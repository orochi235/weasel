/**
 * A timeline whose own event handlers act on it while it fires them: cancel it, pause it, or seek
 * it, at any event of any plan, on any frames.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clocked, runs, tally, timeoutFor } from '../pbt.fixture';
import { build, plan } from './timeline.fixture';
import type { TimelineHandle } from './types';

const RUNS = 150;
const frames = fc.array(fc.integer({ min: 1, max: 120 }), { minLength: 1, maxLength: 20 });
type Act = 'cancel' | 'pause' | 'seek';

describe('timeline handlers, property', () => {
  it('a handler that cancels, pauses, or seeks its timeline leaves it where that act puts it', () => {
    const t = tally();
    fc.assert(fc.property(plan, fc.nat(), fc.constantFrom<Act>('cancel', 'pause', 'seek'), fc.integer({ min: 0, max: 500 }), frames,
      (p, which, act, to, ds) => {
        const b = build(p);
        const h = clocked();
        h.at(0);
        let done = 0;
        let acted = -1;
        let tl: TimelineHandle | null = null;
        const evs = b.tracks.flatMap((tr) => (tr.kind === 'event' ? tr.events : []));
        if (evs.length === 0) return;
        const ev = evs[which % evs.length]!;
        const fire = ev.fire!;
        ev.fire = (late) => {
          fire(late);
          if (acted >= 0 || !tl) return;
          acted = b.fired.length;
          if (act === 'cancel') tl.cancel();
          else if (act === 'pause') tl.pause();
          else tl.seek(to);
        };
        tl = h.animator.timeline({ tracks: b.tracks, duration: p.duration, onDone: () => { done++; } });
        let now = 0;
        let at = -1;
        for (const d of ds) {
          now += d;
          h.at(now);
          expect(Number.isFinite(tl.time())).toBe(true);
          if (acted >= 0 && at < 0) {
            at = tl.time();
            // A cancel or a seek stops the rest of the frame's crossings; a pause leaves the frame as played.
            if (act !== 'pause') expect(b.fired.length).toBe(acted);
            acted = b.fired.length;
          }
        }
        if (acted < 0) return;
        t.count(act);
        if (act === 'cancel') {
          expect(b.fired.length).toBe(acted);
          expect(done).toBe(0);
          expect(tl.time()).toBe(at);
          expect(h.animator.isActive()).toBe(false);
        } else if (act === 'pause') {
          expect(tl.time()).toBe(at);
          expect(b.fired.length).toBe(acted);
          expect(tl.isPaused()).toBe(true);
        } else {
          expect(at).toBe(Math.min(to, tl.duration()));
        }
      }), runs(RUNS));
    t.atLeast('cancel', 15);
    t.atLeast('pause', 15);
    t.atLeast('seek', 15);
  }, timeoutFor(RUNS, 10));
});
