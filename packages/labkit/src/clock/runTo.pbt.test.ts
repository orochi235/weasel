/**
 * Properties of running a clock that cannot seek to a time, as a still or a held clock does: it lands paused exactly
 * where a seekable clock of the same declaration would seek to, never in a frame longer than its step, and the same
 * wherever it was declared to open, short of opening past that time.
 */
import { createClock } from '@weasel-js/clock';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { runTo } from './runTo';

const RUNS = 200;

const spec = fc
  .record(
    {
      duration: fc.integer({ min: 1, max: 2000 }),
      loop: fc.oneof(fc.boolean(), fc.integer({ min: 1, max: 4 })),
      start: fc.oneof(fc.integer({ min: 0, max: 3000 }), fc.constant('end' as const)),
      rate: fc.constantFrom(0, 1, 2, 0.5),
    },
    { requiredKeys: [] },
    // A run that never ends has no end to open at, which `createClock` refuses.
  )
  .filter((s) => s.start !== 'end' || (s.duration !== undefined && s.loop !== true));
const step = fc.oneof(
  fc.integer({ min: 1, max: 500 }),
  fc.double({ min: 0.5, max: 64, noNaN: true }),
);
const at = fc.oneof(
  fc.integer({ min: 0, max: 6000 }),
  fc.double({ min: 0, max: 6000, noNaN: true }),
);

describe('running a clock to a time', () => {
  it(
    'lands paused where a seek would put it, in frames no longer than its step',
    () => {
      const t = tally();
      fc.assert(
        fc.property(spec, step, at, (s, dt, to) => {
          const running = createClock({ ...s, seekable: false }).clock;
          const sought = createClock({ ...s, seekable: true }).clock;
          const from = running.elapsed;
          let last = 0;
          let frames = 0;
          const sync = running.sync.bind(running);
          running.sync = (now: number) => {
            expect(now - last).toBeLessThanOrEqual(dt + 1e-12 * Math.max(1, now));
            expect(now).toBeGreaterThanOrEqual(last);
            last = now;
            frames += 1;
            sync(now);
          };
          runTo(running, to, dt);
          expect(running.rate).toBe(0);
          expect(Number.isFinite(running.elapsed)).toBe(true);
          if (to <= from) {
            t.count('opens past it');
            expect(running.elapsed).toBe(from);
            return;
          }
          sought.seek(to);
          t.count(sought.ended ? 'ends first' : 'reaches it');
          expect(Math.abs(running.elapsed - sought.elapsed)).toBeLessThanOrEqual(
            1e-9 * Math.max(1, to),
          );
          expect(running.ended).toBe(sought.ended);
          expect(frames).toBeLessThanOrEqual(Math.ceil((to - from) / dt) + 2);
        }),
        runs(RUNS),
      );
      t.atLeast('reaches it', RUNS / 10);
      t.atLeast('ends first', RUNS / 10);
      t.atLeast('opens past it', RUNS / 20);
    },
    timeoutFor(RUNS, 5),
  );

  it(
    'reaches the same place whatever its step',
    () => {
      fc.assert(
        fc.property(spec, step, step, at, (s, a, b, to) => {
          const one = createClock({ ...s, seekable: false }).clock;
          const two = createClock({ ...s, seekable: false }).clock;
          runTo(one, to, a);
          runTo(two, to, b);
          expect(Math.abs(one.elapsed - two.elapsed)).toBeLessThanOrEqual(1e-9 * Math.max(1, to));
          expect(one.pass).toBe(two.pass);
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 5),
  );
});
