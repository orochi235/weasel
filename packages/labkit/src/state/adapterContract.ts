import { describe, expect, it } from 'vitest';
import type { StorageAdapter, StorageChange } from './types';

/** How the contract suite drives one adapter. */
export interface AdapterHarness {
  adapter: StorageAdapter;
  /** Whether a `Uint8Array` survives the round trip unchanged. */
  binary: boolean;
  /** Make a change the way another writer would, or omit when the adapter
   *  has no `subscribe`. */
  foreign?: {
    set(key: string, value: unknown): Promise<void> | void;
    delete(key: string): Promise<void> | void;
  };
}

async function until(check: () => boolean, ms = 1000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out waiting for a change');
    await new Promise((r) => setTimeout(r, 5));
  }
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 50));

/** Every shipped adapter answers to these. `setup` runs once per test. */
export function describeAdapterContract(name: string, setup: () => AdapterHarness): void {
  describe(`${name} — the adapter contract`, () => {
    it('reads back what it stored, as a copy', async () => {
      const { adapter } = setup();
      const value = { trial: 'a', nested: { n: 1, list: [1, 'two', null] } };
      await adapter.set('lk:x:one', value);
      value.nested.n = 99;
      expect(await adapter.get('lk:x:one')).toEqual({
        trial: 'a',
        nested: { n: 1, list: [1, 'two', null] },
      });
    });

    it('answers undefined for a key it never held', async () => {
      const { adapter } = setup();
      expect(await adapter.get('lk:x:absent')).toBeUndefined();
    });

    it('lists only the keys under a prefix', async () => {
      const { adapter } = setup();
      await adapter.set('lk:x:a', 1);
      await adapter.set('lk:x:b', 2);
      await adapter.set('lk:y:a', 3);
      const listed = await adapter.list('lk:x:');
      expect(new Map(listed)).toEqual(
        new Map<string, unknown>([
          ['lk:x:a', 1],
          ['lk:x:b', 2],
        ]),
      );
    });

    it('deletes a key', async () => {
      const { adapter } = setup();
      await adapter.set('lk:x:gone', { a: 1 });
      await adapter.delete('lk:x:gone');
      expect(await adapter.get('lk:x:gone')).toBeUndefined();
      expect(await adapter.list('lk:x:')).toEqual([]);
    });

    it('keeps binary values exactly when it says it can', async () => {
      const { adapter, binary } = setup();
      if (!binary) return;
      await adapter.set('lk:x:bytes', new Uint8Array([1, 2, 255]));
      const back = await adapter.get('lk:x:bytes');
      // Not `toBeInstanceOf`: under jsdom, structuredClone hands back Node's
      // Uint8Array, which is not the test realm's.
      expect(Object.prototype.toString.call(back)).toBe('[object Uint8Array]');
      expect([...(back as Uint8Array)]).toEqual([1, 2, 255]);
    });

    it("reports another writer's changes under its prefix, and nothing else", async () => {
      const { adapter, foreign } = setup();
      if (!foreign) {
        expect(adapter.subscribe).toBeUndefined();
        return;
      }
      if (!adapter.subscribe) throw new Error(`${name} has a foreign writer but no subscribe`);
      const heard: StorageChange[] = [];
      const off = adapter.subscribe('lk:x:', (changes) => heard.push(...changes));
      try {
        await adapter.set('lk:x:own', 'mine');
        await foreign.set('lk:y:elsewhere', 'not this prefix');
        await settle();
        expect(heard).toEqual([]);

        await foreign.set('lk:x:theirs', { from: 'peer' });
        await until(() => heard.length > 0);
        expect(heard).toEqual([['lk:x:theirs', { from: 'peer' }]]);

        await foreign.delete('lk:x:theirs');
        await until(() => heard.length > 1);
        expect(heard[1]).toEqual(['lk:x:theirs', undefined]);
      } finally {
        off();
      }
    });

    it('stops reporting once unsubscribed', async () => {
      const { adapter, foreign } = setup();
      if (!foreign || !adapter.subscribe) return;
      const heard: StorageChange[] = [];
      adapter.subscribe('lk:x:', (changes) => heard.push(...changes))();
      await foreign.set('lk:x:late', 1);
      await settle();
      expect(heard).toEqual([]);
    });
  });
}
