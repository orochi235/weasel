/**
 * Stateful property test of `useJob` against a model: runs started, canceled, and superseded while each one sends
 * totals, items, and failures and then finishes or throws, in any order, the superseded ones included. Only the run
 * in flight reaches the progress and the state; every run it superseded or a cancel ended is aborted.
 */
import { act, renderHook } from '@testing-library/react';
import fc from 'fast-check';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import type { JobCapability, JobEvent, JobFailure, JobStatus } from './types';
import { useJob } from './useJob';

const RUNS = 40;

/** One run's events, handed over as a test sends them. */
class Channel {
  private queue: (JobEvent<number> | { kind: 'end' } | { kind: 'throw' })[] = [];
  private wake: (() => void) | null = null;
  closed = false;
  constructor(readonly signal: AbortSignal) {}
  send(e: JobEvent<number> | { kind: 'end' } | { kind: 'throw' }): void {
    if (this.closed) return;
    this.queue.push(e);
    this.wake?.();
  }
  async *events(): AsyncGenerator<JobEvent<number>> {
    try {
      for (;;) {
        while (this.queue.length === 0) await new Promise<void>((r) => (this.wake = r));
        const e = this.queue.shift() as JobEvent<number> | { kind: 'end' } | { kind: 'throw' };
        if (e.kind === 'end') return;
        if (e.kind === 'throw') throw new Error('run died');
        yield e;
      }
    } finally {
      this.closed = true;
    }
  }
}

interface Model {
  status: JobStatus;
  done: number;
  total: number | null;
  failures: JobFailure[];
  error: string | null;
  items: number[];
  /** Index into `real.runs` of the run in flight. */
  current: number | null;
}

interface Real {
  runs: Channel[];
  result: { current: ReturnType<typeof useHarness> };
}

function useHarness(capability: JobCapability<number[], null, number>) {
  const [state, setState] = useState<number[]>([]);
  const job = useJob({ capability, config: null, state, setState });
  return { state, job };
}

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

async function check(model: Model, real: Real): Promise<void> {
  await flush();
  const { job, state } = real.result.current;
  expect({
    status: job.status,
    done: job.done,
    total: job.total,
    failures: job.failures,
    error: job.error,
  }).toEqual({
    status: model.status,
    done: model.done,
    total: model.total,
    failures: model.failures,
    error: model.error,
  });
  expect(state).toEqual(model.items);
  real.runs.forEach((r, i) => {
    expect(r.signal.aborted).toBe(i !== model.current);
  });
}

const open = (real: Real, which: number): number | undefined => {
  const live = real.runs.map((r, i) => (r.closed ? -1 : i)).filter((i) => i >= 0);
  return live.length === 0 ? undefined : live[which % live.length];
};

type Cmd = fc.AsyncCommand<Model, Real>;

function commands(t: ReturnType<typeof tally>): fc.Arbitrary<Cmd>[] {
  const start: Cmd = {
    check: () => true,
    async run(model, real) {
      const before = real.runs.length;
      act(() => real.result.current.job.start());
      await flush();
      expect(real.runs).toHaveLength(before + 1);
      for (const r of real.runs.slice(0, before)) expect(r.signal.aborted).toBe(true);
      Object.assign(model, { status: 'running', done: 0, total: null, failures: [], error: null });
      model.current = before;
      t.count('start');
      await check(model, real);
    },
    toString: () => 'start',
  };
  const cancel: Cmd = {
    check: () => true,
    async run(model, real) {
      act(() => real.result.current.job.cancel());
      for (const r of real.runs) expect(r.signal.aborted).toBe(true);
      Object.assign(model, { status: 'idle', done: 0, total: null, failures: [], error: null });
      model.current = null;
      t.count('cancel');
      await check(model, real);
    },
    toString: () => 'cancel',
  };
  const send = fc
    .tuple(
      fc.nat(),
      fc.oneof(
        fc.integer({ min: 0, max: 9 }).map((item): JobEvent<number> => ({ kind: 'item', item })),
        fc.integer({ min: 0, max: 9 }).map((item): JobEvent<number> => ({ kind: 'item', item })),
        fc.integer({ min: 0, max: 9 }).map((total): JobEvent<number> => ({ kind: 'total', total })),
        fc
          .nat(9)
          .map((index): JobEvent<number> => ({ kind: 'failed', index, error: `bad ${index}` })),
        fc.constant({ kind: 'end' as const }),
        fc.constant({ kind: 'throw' as const }),
      ),
    )
    .map(
      ([which, event]): Cmd => ({
        check: () => true,
        async run(model, real) {
          const at = open(real, which);
          if (at === undefined) return;
          (real.runs[at] as Channel).send(event);
          const mine = at === model.current;
          t.count(mine ? `${event.kind} in flight` : 'superseded');
          if (mine) {
            if (event.kind === 'item') {
              model.items = [...model.items, event.item];
              model.done += 1;
            } else if (event.kind === 'total') model.total = event.total;
            else if (event.kind === 'failed')
              model.failures = [...model.failures, { index: event.index, error: event.error }];
            else if (event.kind === 'end') model.status = 'done';
            else Object.assign(model, { status: 'error', error: 'run died' });
          }
          await check(model, real);
        },
        toString: () => `send(#${which}, ${JSON.stringify(event)})`,
      }),
    );
  return [
    fc.constant(start),
    fc.constant(start),
    fc.constant(cancel),
    send,
    send,
    send,
    send,
    send,
  ];
}

describe('a job against a model', () => {
  it(
    'reports only the run in flight, folds only its items, and aborts every run it superseded',
    async () => {
      const t = tally();
      await fc.assert(
        fc.asyncProperty(
          fc.commands(commands(t), { maxCommands: 25, size: '+1' }),
          async (cmds) => {
            const real = { runs: [] as Channel[] } as Real;
            const capability: JobCapability<number[], null, number> = {
              run: ({ signal }) => {
                const channel = new Channel(signal);
                real.runs.push(channel);
                return channel.events();
              },
              onItem: (item, state) => [...state, item],
            };
            const hook = renderHook(() => useHarness(capability));
            real.result = hook.result;
            const model: Model = {
              status: 'idle',
              done: 0,
              total: null,
              failures: [],
              error: null,
              items: [],
              current: null,
            };
            try {
              await fc.asyncModelRun(() => ({ model, real }), cmds);
            } finally {
              hook.unmount();
            }
            for (const r of real.runs) expect(r.signal.aborted).toBe(true);
          },
        ),
        runs(RUNS),
      );
      for (const what of [
        'start',
        'cancel',
        'item in flight',
        'superseded',
        'end in flight',
        'throw in flight',
      ])
        t.atLeast(what, RUNS / 4);
    },
    timeoutFor(RUNS, 200),
  );
});
