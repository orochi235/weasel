/**
 * Stateful property test of `useAutosave` against a model of one pending save: renders that change the document
 * or leave it, with and without a `revision`, time passing, the page going away, and an unmount, at any delay, an
 * infinite one and one past what a timer holds included. Each change is written once, with the latest document, a
 * delay after the change that scheduled it, or at once when the page goes away or the hook unmounts; nothing is
 * written while nothing is pending, and every write is reported to `onSaved`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { renderHook } from '@testing-library/react';
import { useAutosave, type AutosaveOptions } from './useAutosave';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

type Op = { op: 'render'; doc: string } | { op: 'wait'; ms: number } | { op: 'pagehide' };
const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom('a', 'b', 'c').map((doc) => ({ op: 'render' as const, doc })) },
  { weight: 3, arbitrary: fc.oneof(fc.integer({ min: 0, max: 700 }), fc.constantFrom(2 ** 31, 3e9)).map((ms) => ({ op: 'wait' as const, ms })) },
  fc.constant({ op: 'pagehide' as const }),
);
const delay = fc.constantFrom<number | undefined>(undefined, 0, 1, 300, 2 ** 31, Infinity);

describe('useAutosave', () => {
  it('writes each change once, with the latest document, after its delay or when the page goes away', () => {
    const seen = tally();
    fc.assert(fc.property(delay, fc.boolean(), fc.array(op, { maxLength: 25 }), (delayMs, tracked, ops) => {
      vi.useFakeTimers();
      localStorage.clear();
      const ms = delayMs ?? 300;
      const writes: string[] = [];
      const reports: boolean[] = [];
      let doc = 'a';
      const props = (d: string): { d: string; o: AutosaveOptions } => ({
        d, o: { ...(delayMs !== undefined ? { delayMs } : {}), ...(tracked ? { revision: d } : {}), onSaved: (ok) => reports.push(ok) },
      });
      const hook = renderHook(({ d, o }) => useAutosave(() => { writes.push(d); return { primary: ['doc', d] }; }, o), { initialProps: props(doc) });
      // The model: when the pending save is due (Infinity for never), or null for none.
      let dueAt: number | null = ms;
      let now = 0;
      const expectWritten = (n: number) => {
        expect(writes).toHaveLength(n);
        expect(reports).toEqual(writes.map(() => true));
        if (n > 0) expect([writes[n - 1], localStorage.getItem('doc')]).toEqual([stored, stored]);
      };
      let written = 0;
      let stored = '';
      for (const o of ops) {
        if (o.op === 'render') {
          const changed = !tracked || o.doc !== doc;
          doc = o.doc;
          hook.rerender(props(doc));
          if (changed) dueAt = now + ms;
          seen.count(changed ? 'change' : 'same revision');
        } else if (o.op === 'wait') {
          vi.advanceTimersByTime(o.ms);
          now += o.ms;
          if (dueAt !== null && dueAt <= now) { written++; stored = doc; dueAt = null; seen.count(ms > 2 ** 31 - 1 && Number.isFinite(ms) ? 'long delay ran out' : 'timer'); }
        } else {
          window.dispatchEvent(new Event('pagehide'));
          if (dueAt !== null) { written++; stored = doc; dueAt = null; seen.count('flushed'); }
        }
        expectWritten(written);
      }
      hook.unmount();
      if (dueAt !== null) { written++; stored = doc; }
      // Nothing pending is left to fire.
      vi.advanceTimersByTime(3e9);
      expectWritten(written);
      vi.useRealTimers();
    }), runs(RUNS));
    for (const what of ['change', 'same revision', 'timer', 'flushed', 'long delay ran out']) seen.atLeast(what, RUNS / 30);
  }, timeoutFor(RUNS, 30));
});
