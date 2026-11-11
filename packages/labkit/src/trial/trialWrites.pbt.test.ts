/**
 * Stateful property test of a trial's config writes and its undo: random writes to a few paths, pauses, undos,
 * and redos through `useTrialWrites` over a real lab store, against a model of the steps. A run of writes to one
 * path, each within the gesture window of the last, is one step; any other write is a step of its own and drops
 * what Redo could make again; a write of the value a path holds does nothing, and a gesture back where it began
 * leaves no step; Undo returns the config and the state to what they were before the step, and Redo to what they
 * were after it. Checked after every command.
 */
import { act, renderHook } from '@testing-library/react';
import { deepEqual } from '@weasel-js/registry';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { valueAtPath, withValueAtPath } from '../config/path';
import { defineInstrument } from '../instrument/defineInstrument';
import { unruledConfigSchema } from '../instrument/serializers';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { createLabStore, type LabStore } from '../state/store';
import { addTrial } from './trialOps';
import { type TrialWrites, useTrialWrites } from './useTrialWrites';

const RUNS = 60;
const GESTURE_MS = 500;

/** The state the instrument derives from its config, so a config back where it was is a trial back where it was. */
const sumOf = (c: { a: number; b: number; g: { c: boolean } }): number =>
  c.a + c.b + (c.g.c ? 10 : 0);

const instrument = defineInstrument({
  name: 'Model',
  config: f.schema({ a: f.number(0), b: f.number(0), g: f.group({ c: f.boolean(false) }) }),
  initialState: (config) => ({ sum: sumOf(config) }),
  undo: {},
  onConfigChange: (config) => ({ sum: sumOf(config) }),
  render: () => null,
});
const schema = unruledConfigSchema(instrument);
if (!schema) throw new Error('the instrument declares a schema');

interface Snap {
  config: unknown;
}

interface Model {
  now: Snap;
  undo: { before: Snap; after?: Snap }[];
  redo: { before: Snap; after: Snap }[];
  /** The write a next one to the same path continues, while nothing has been undone or redone since. */
  last: { path: string; at: number; start: Snap } | null;
  clock: number;
}

interface Real {
  store: LabStore;
  trialId: string;
  writes: () => TrialWrites;
}

const t = tally();

function check(m: Model, r: Real): void {
  const record = r.store.getState().trials.find((x) => x.id === r.trialId);
  if (!record) throw new Error('the trial is open');
  expect(record.config).toEqual(m.now.config);
  expect(record.state).toEqual({ sum: sumOf(m.now.config as Parameters<typeof sumOf>[0]) });
  const history = record.history;
  expect(history?.undoDepth() ?? 0).toBe(m.undo.length);
  expect(history?.redoDepth() ?? 0).toBe(m.redo.length);
}

const PATHS = ['a', 'b', 'g.c'] as const;

class Write implements fc.Command<Model, Real> {
  constructor(
    readonly path: (typeof PATHS)[number],
    readonly n: number,
  ) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const value = this.path === 'g.c' ? this.n % 2 === 1 : this.n;
    act(() => r.writes().setConfig(this.path, value));
    if (valueAtPath(m.now.config, this.path) === value) {
      t.count('wrote what it held');
      check(m, r);
      return;
    }
    const last = m.last;
    const same = last !== null && last.path === this.path && m.clock - last.at < GESTURE_MS;
    const start = same ? last.start : m.now;
    if (same) t.count('continued a gesture');
    else {
      t.count('new step');
      m.undo.push({ before: m.now });
      m.redo = [];
    }
    m.now = { config: withValueAtPath(m.now.config, this.path, value) };
    m.last = { path: this.path, at: m.clock, start };
    if (same && deepEqual(m.now, start)) {
      t.count('a gesture back where it began');
      m.undo.pop();
      m.last = null;
    }
    check(m, r);
  }
  toString = (): string => `write(${this.path}, ${this.n})`;
}

class Wait implements fc.Command<Model, Real> {
  constructor(readonly ms: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    m.clock += this.ms;
    vi.setSystemTime(m.clock);
    check(m, r);
  }
  toString = (): string => `wait(${this.ms})`;
}

class Undo implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>): boolean => m.undo.length > 0;
  run(m: Model, r: Real): void {
    t.count('undo');
    const step = m.undo.pop();
    if (!step) return;
    m.redo.unshift({ before: step.before, after: m.now });
    m.now = step.before;
    m.last = null;
    const history = r.store.getState().trials.find((x) => x.id === r.trialId)?.history;
    act(() => history?.undo());
    check(m, r);
  }
  toString = (): string => 'undo';
}

class Redo implements fc.Command<Model, Real> {
  check = (m: Readonly<Model>): boolean => m.redo.length > 0;
  run(m: Model, r: Real): void {
    t.count('redo');
    const step = m.redo.shift();
    if (!step) return;
    m.undo.push(step);
    m.now = step.after;
    m.last = null;
    const history = r.store.getState().trials.find((x) => x.id === r.trialId)?.history;
    act(() => history?.redo());
    check(m, r);
  }
  toString = (): string => 'redo';
}

/** A slider's drag: writes to one path, each a moment after the last. */
class Drag implements fc.Command<Model, Real> {
  constructor(
    readonly path: (typeof PATHS)[number],
    readonly ns: readonly number[],
  ) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    for (const n of this.ns) {
      new Wait(40).run(m, r);
      new Write(this.path, n).run(m, r);
    }
  }
  toString = (): string => `drag(${this.path}, ${this.ns.join(' ')})`;
}

const commands = [
  fc
    .tuple(
      fc.constantFrom(...PATHS),
      fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 2, maxLength: 5 }),
    )
    .map(([p, ns]) => new Drag(p, ns)),
  fc
    .tuple(fc.constantFrom(...PATHS), fc.integer({ min: 0, max: 3 }))
    .map(([p, n]) => new Write(p, n)),
  fc.constantFrom(10, 200, 499, 500, 2000).map((ms) => new Wait(ms)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a trial’s config writes and its undo', () => {
  it(
    'step as one entry a gesture, and undo and redo the config and the state together',
    () => {
      fc.assert(
        fc.property(fc.commands(commands, { maxCommands: 40, size: '+1' }), (cmds) => {
          const start = 1_000_000;
          vi.setSystemTime(start);
          const store = createLabStore({ instruments: [instrument] });
          store.setState({ trials: addTrial([], [instrument], 'Model') });
          const record = store.getState().trials[0];
          if (!record) throw new Error('a trial opened');
          const hook = renderHook(() =>
            useTrialWrites({ store, trialId: record.id, instrument, schema }),
          );
          const model: Model = {
            now: { config: record.config },
            undo: [],
            redo: [],
            last: null,
            clock: start,
          };
          try {
            fc.modelRun(
              () => ({
                model,
                real: { store, trialId: record.id, writes: () => hook.result.current },
              }),
              cmds,
            );
          } finally {
            hook.unmount();
          }
        }),
        runs(RUNS),
      );
      for (const what of [
        'continued a gesture',
        'new step',
        'wrote what it held',
        'a gesture back where it began',
        'undo',
        'redo',
      ])
        t.atLeast(what, 20);
    },
    timeoutFor(RUNS, 60),
  );
});
