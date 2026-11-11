/**
 * Stateful model test of hold-to-repeat stepping: starts, stops, and time passing in uneven slices, over a bounded
 * value that runs out of room, against a model of the hold's schedule. Each step checks the value, the key held,
 * and that exactly one timer waits while something is held.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { fakeScheduler, runs, tally, timeoutFor } from './pbt.fixture';
import { createStepRepeat, type StepRepeat } from './stepRepeat';

const RUNS = 200;
type K = 1 | -1;

interface Model { value: number; held: K | null; next: number; now: number; steps: number }
interface Real { repeat: StepRepeat<K>; value: () => number; steps: () => number; clock: ReturnType<typeof fakeScheduler> }
interface Config { max: number; delayMs: number; everyMs: number }

const t = tally();

const spentIn = (m: Model, cfg: Config, k: K): boolean => (k > 0 ? m.value >= cfg.max : m.value <= 0);
const stepIn = (m: Model, cfg: Config, k: K): void => {
  m.value = Math.min(cfg.max, Math.max(0, m.value + k));
  m.steps++;
};

function check(m: Model, r: Real): void {
  expect(r.value()).toBe(m.value);
  expect(r.steps()).toBe(m.steps);
  expect(r.repeat.held()).toBe(m.held);
  expect(r.clock.pending()).toBe(m.held === null ? 0 : 1);
}

const commands = (cfg: Config) => fc.commands([
  fc.constantFrom<K>(1, -1).map((k): fc.Command<Model, Real> => ({
    check: () => true,
    run(m, r) {
      m.held = k;
      stepIn(m, cfg, k);
      m.next = m.now + cfg.delayMs;
      r.repeat.start(k);
      t.count('start');
      check(m, r);
    },
    toString: () => `start(${k})`,
  })),
  fc.constant<fc.Command<Model, Real>>({
    check: () => true,
    run(m, r) {
      m.held = null;
      r.repeat.stop();
      check(m, r);
    },
    toString: () => 'stop',
  }),
  fc.integer({ min: 0, max: 700 }).map((ms): fc.Command<Model, Real> => ({
    check: () => true,
    run(m, r) {
      const end = m.now + ms;
      while (m.held !== null && m.next <= end) {
        m.now = m.next;
        if (spentIn(m, cfg, m.held)) { m.held = null; t.count('spent'); break; }
        stepIn(m, cfg, m.held);
        m.next = m.now + cfg.everyMs;
        t.count('repeat');
      }
      m.now = end;
      r.clock.advance(ms);
      check(m, r);
    },
    toString: () => `advance(${ms})`,
  })),
], { maxCommands: 30 });

describe('createStepRepeat — stateful model', () => {
  it('steps at once, then after the delay every interval, until stopped, replaced, or spent', () => {
    fc.assert(fc.property(
      fc.record({ max: fc.integer({ min: 0, max: 40 }), delayMs: fc.integer({ min: 0, max: 500 }), everyMs: fc.integer({ min: 1, max: 120 }) })
        .chain((cfg) => fc.tuple(fc.constant(cfg), fc.integer({ min: 0, max: cfg.max }), commands(cfg))),
      ([cfg, start, cmds]) => {
        const setup = () => {
          const clock = fakeScheduler();
          let value = start;
          let steps = 0;
          const repeat = createStepRepeat<K>(
            (k) => { value = Math.min(cfg.max, Math.max(0, value + k)); steps++; },
            (k) => (k > 0 ? value >= cfg.max : value <= 0),
            { delayMs: cfg.delayMs, everyMs: cfg.everyMs, scheduler: clock.scheduler },
          );
          return {
            model: { value: start, held: null, next: 0, now: 0, steps: 0 } as Model,
            real: { repeat, value: () => value, steps: () => steps, clock } as Real,
          };
        };
        fc.modelRun(setup, cmds);
      },
    ), runs(RUNS));
    t.atLeast('start', RUNS);
    t.atLeast('repeat', RUNS);
    t.atLeast('spent', RUNS / 10);
  }, timeoutFor(RUNS, 10));
});
