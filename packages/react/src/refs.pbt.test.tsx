/**
 * Stateful property tests of the hooks that hold a committed value: renders that commit and renders React throws
 * away (a transition that suspends), in StrictMode or not, against a model of what committed. `useLatest` holds
 * the last committed value and `useStableByContent` the last committed identity while the content is equal;
 * `assignRef` writes into either shape of ref.
 */
import { Suspense, StrictMode, startTransition, useLayoutEffect, useState, type ReactNode } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { assignRef } from './assignRef';
import { Hang } from './testing/abandonRender';
import { useLatest } from './useLatest';
import { useStableByContent } from './useStableByContent';
import { runs, tally, timeoutFor } from './pbt.fixture';

interface Value { k: number }
const same = (a: Value, b: Value) => a.k === b.k;

describe('useLatest and useStableByContent against a model', () => {
  it('hold what the last committed render had, never an abandoned one', () => {
    const seen = tally();
    const step = fc.record({
      abandon: fc.boolean(),
      k: fc.integer({ min: 0, max: 2 }),
      reuse: fc.boolean(),
    });
    fc.assert(fc.property(fc.boolean(), fc.integer({ min: 0, max: 2 }), fc.array(step, { minLength: 1, maxLength: 12 }), (strict, k0, steps) => {
      let next!: (s: { v: Value; hang: boolean }) => void;
      let latest!: { readonly current: Value };
      const committed: Value[] = [];
      function Probe({ v }: { v: Value }): null {
        latest = useLatest(v);
        const stable = useStableByContent(v, same);
        useLayoutEffect(() => { committed.push(stable); });
        return null;
      }
      function Host({ first }: { first: Value }): ReactNode {
        const [s, set] = useState({ v: first, hang: false });
        next = set;
        return (
          <Suspense fallback={null}>
            <Probe v={s.v} />
            <Hang hang={s.hang} />
          </Suspense>
        );
      }
      let model = { v: { k: k0 } };
      let held = model.v;
      const view = render(strict ? <StrictMode><Host first={model.v} /></StrictMode> : <Host first={model.v} />);
      expect(committed.at(-1)).toBe(held);
      for (const s of steps) {
        const v = s.reuse ? model.v : { k: s.k };
        if (s.abandon) {
          seen.add('abandon');
          act(() => { startTransition(() => { next({ v, hang: true }); }); });
        } else {
          seen.add(v === held ? 'same' : same(held, v) ? 'equal' : 'changed');
          act(() => { next({ v, hang: false }); });
          model = { v };
          held = held === v || same(held, v) ? held : v;
        }
        expect(latest.current).toBe(model.v);
        expect(committed.at(-1)).toBe(held);
      }
      view.unmount();
    }), runs(100));
    for (const k of ['abandon', 'same', 'equal', 'changed']) expect(seen.get(k), k).toBeGreaterThan(30);
  }, timeoutFor(100, 30));
});

describe('assignRef', () => {
  it('calls a callback ref, sets an object ref, and ignores none, for any value', () => {
    fc.assert(fc.property(fc.anything(), fc.constantFrom('fn', 'object', 'null', 'undefined'), (value, shape) => {
      if (shape === 'fn') {
        const fn = vi.fn();
        assignRef(fn, value);
        expect(fn).toHaveBeenCalledExactlyOnceWith(value);
      } else if (shape === 'object') {
        const ref = { current: Symbol('before') as unknown };
        assignRef(ref, value);
        expect(ref.current).toBe(value);
      } else {
        expect(() => assignRef(shape === 'null' ? null : undefined, value)).not.toThrow();
      }
    }), runs(200));
  }, timeoutFor(200, 1));
});
