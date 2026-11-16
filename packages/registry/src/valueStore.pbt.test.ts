/**
 * Stateful test of `createValueStore`: runs of writes drawn from values equal in meaning to one another
 * (`NaN`, signed zeros, fresh lists of the same items) against a model. A write notifies once exactly when
 * the store's `equal` reads it as a change, and `set(get())` notifies nobody.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createValueStore } from './valueStore';
import { sameList } from './sameList';

const num = fc.constantFrom(Number.NaN, 0, -0, 1, Infinity);

describe('createValueStore', () => {
  it('notifies once for a write Object.is reads as a change, and never for one it does not', () => {
    fc.assert(fc.property(num, fc.array(num, { maxLength: 30 }), (first, writes) => {
      const store = createValueStore(first);
      let calls = 0;
      store.subscribe(() => { calls++; });
      let model = first;
      let expected = 0;
      for (const w of writes) {
        if (!Object.is(model, w)) { model = w; expected++; }
        store.set(w);
        expect(Object.is(store.get(), model)).toBe(true);
      }
      store.set(store.get());
      expect(calls).toBe(expected);
    }));
  });

  it('keeps the list it holds for a fresh list sameList reads as equal', () => {
    fc.assert(fc.property(fc.array(fc.array(fc.integer({ min: 0, max: 2 }), { maxLength: 2 }), { maxLength: 20 }), (writes) => {
      const store = createValueStore<readonly number[]>([], sameList);
      let calls = 0;
      store.subscribe(() => { calls++; });
      let model: readonly number[] = store.get();
      let expected = 0;
      for (const w of writes) {
        if (!sameList(model, w)) { model = w; expected++; }
        store.set(w);
        expect(store.get()).toBe(model);
      }
      expect(calls).toBe(expected);
    }));
  });
});
