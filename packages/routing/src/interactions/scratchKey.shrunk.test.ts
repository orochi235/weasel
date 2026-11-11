/** A slot named `__proto__`, as the scratch store's property test shrank it. */
import { expect, it } from 'vitest';
import { getScratch, scratchKey, setScratch, type ScratchStore } from './scratchKey';

it('writes a slot named __proto__ as a slot, leaving the store\'s prototype alone', () => {
  const store: ScratchStore = {};
  const key = scratchKey<null>('__proto__');
  setScratch(store, key, null);
  expect(getScratch(store, key)).toBe(null);
  expect(Object.getPrototypeOf(store)).toBe(Object.prototype);
});
