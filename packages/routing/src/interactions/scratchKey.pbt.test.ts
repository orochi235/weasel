/**
 * Stateful test of the scratch store's typed slots against a `Map`, through long runs of writes, reads, and
 * deletes over names of any spelling, `Object.prototype`'s member names among them.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally } from '../pbt.fixture';
import { deleteScratch, getScratch, scratchKey, setScratch, type ScratchStore } from './scratchKey';

const NAMES = ['__proto__', 'toString', 'constructor', 'hasOwnProperty', 'lasso.vertices', 'a', ''];
const name = fc.oneof(fc.constantFrom(...NAMES), fc.string({ maxLength: 3 }));
const op = fc.oneof(
  fc.record({ kind: fc.constant('set' as const), name, value: fc.oneof(fc.integer(), fc.constant(null), fc.object()) }),
  fc.record({ kind: fc.constant('delete' as const), name }),
);

describe('scratch store', () => {
  it('holds what each name was last given, by that name alone', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(op, { maxLength: 80 }), (ops) => {
      const store: ScratchStore = {};
      const model = new Map<string, unknown>();
      for (const o of ops) {
        const key = scratchKey<unknown>(o.name);
        if (o.kind === 'set') {
          setScratch(store, key, o.value);
          model.set(o.name, o.value);
          if (o.name === '__proto__') t.hit('set __proto__');
        } else {
          expect(deleteScratch(store, key)).toBe(model.delete(o.name));
        }
        expect(Object.getPrototypeOf(store)).toBe(Object.prototype);
        for (const n of new Set([...NAMES, ...model.keys()])) {
          expect(getScratch(store, scratchKey(n))).toBe(model.get(n));
        }
        expect(Object.keys(store).sort()).toEqual([...model.keys()].sort());
      }
    }), runs(300));
    t.expectHit('set __proto__');
  });
});
