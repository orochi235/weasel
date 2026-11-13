import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { prefAutoValue, prefIsReset, prefResetOf, prefResets } from './autoReset';
import { prefLeafAt } from './helpers';
import type { PrefGroup } from './groups';
import { openPrefsSync } from './open';
import { createPrefsStore } from './store';

const SCHEMA = {
  name: 'Test',
  children: {
    view: {
      name: 'View',
      resettable: true,
      children: {
        // Can be auto, starts pinned at its default, and reads its `auto.value` while auto.
        size: { kind: 'number', name: 'Size', description: '', default: 10, min: 0, max: 100, auto: { value: 40 } },
        // Starts auto, and reads its default while it is.
        gap: { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100, auto: { on: true } },
        // Never auto.
        grid: { kind: 'boolean', name: 'Grid', description: '', default: true, auto: false },
      },
    },
    // Unset `auto`: can be auto, starts pinned.
    name: { kind: 'string', name: 'Name', description: '', default: 'untitled' },
  },
} satisfies PrefGroup;

type Path = 'view.size' | 'view.gap' | 'view.grid' | 'name';

const make = (backing = new Map<string, unknown>()) => {
  const cache = createRecordCache({ storage: createMemoryAdapter(backing), prefix: 'p.' });
  return { cache, backing, store: createPrefsStore(SCHEMA, cache) };
};

describe('a prefs store honors auto', () => {
  it('starts a leaf auto only where it says `auto.on`, and reads `auto.value`, else the default, while auto', () => {
    const { store } = make();
    expect([...store.auto()]).toEqual(['view.gap']);
    expect(store.get('view.gap')).toBe(4);
    expect(store.get('view.size')).toBe(10);
    store.setAuto('view.size', true);
    expect(store.isAuto('view.size')).toBe(true);
    expect(store.get('view.size')).toBe(40);
  });

  it('pins a leaf at the value it reads when Auto turns off, and an edit pins it too', () => {
    const { store } = make();
    store.setAuto('view.size', true);
    store.setAuto('view.size', false);
    expect(store.isAuto('view.size')).toBe(false);
    expect(store.get('view.size')).toBe(40);
    store.set('view.gap', 7);
    expect(store.isAuto('view.gap')).toBe(false);
    expect(store.get('view.gap')).toBe(7);
  });

  it('keeps a leaf that says `auto: false` pinned', () => {
    const { store } = make();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.setAuto('view.grid', true);
    expect(store.isAuto('view.grid')).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('keeps a leaf auto across a reopen, where its schema starts it pinned', async () => {
    const backing = new Map<string, unknown>();
    const { store } = make(backing);
    store.setAuto('name', true);
    await store.flush();
    const reopened = openPrefsSync(SCHEMA, { storage: createMemoryAdapter(backing), prefix: 'p.' });
    expect(reopened.isAuto('name')).toBe(true);
    expect(reopened.get('name')).toBe('untitled');
  });

  it('resets a leaf or a group back to what the schema says', () => {
    const { store } = make();
    store.set('view.gap', 9);
    store.setAuto('view.size', true);
    store.set('view.grid', false);
    store.reset('view.gap');
    expect(store.isAuto('view.gap')).toBe(true);
    store.reset('view');
    expect([...store.auto()]).toEqual(['view.gap']);
    expect(store.get('view.size')).toBe(10);
    expect(store.get('view.grid')).toBe(true);
  });
});

const PATHS: readonly Path[] = ['view.size', 'view.gap', 'view.grid', 'name'];
const leafAt = (path: Path) => prefLeafAt(SCHEMA, path)!;
const nodeAt = (path: string) => (path === 'view' ? SCHEMA.children.view : leafAt(path as Path));
const VALUES: Record<Path, fc.Arbitrary<unknown>> = {
  'view.size': fc.integer({ min: 0, max: 100 }),
  'view.gap': fc.integer({ min: 0, max: 100 }),
  'view.grid': fc.boolean(),
  name: fc.string({ maxLength: 4 }),
};

type Step = { op: 'set'; path: Path; value: unknown } | { op: 'auto'; path: Path; next: boolean } | { op: 'reset'; path: string };
const step: fc.Arbitrary<Step> = fc.oneof(
  fc.constantFrom(...PATHS).chain((path) => VALUES[path].map((value): Step => ({ op: 'set', path, value }))),
  fc.record({ op: fc.constant('auto' as const), path: fc.constantFrom(...PATHS), next: fc.boolean() }),
  fc.record({ op: fc.constant('reset' as const), path: fc.constantFrom<string>(...PATHS, 'view') }),
);

describe('a prefs store against the one rule', () => {
  it('reads each leaf as `prefAutoValue` while auto, and as `prefResetOf` after a reset', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 12 }), (steps) => {
        const { store } = make();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // The model: each leaf's pinned value, or `auto`.
        const model = new Map<Path, { auto: boolean; value: unknown }>(PATHS.map((p) => [p, prefResetOf(leafAt(p))]));
        for (const s of steps) {
          if (s.op === 'set') {
            store.set(s.path, s.value as never);
            model.set(s.path, { auto: false, value: s.value });
          } else if (s.op === 'auto') {
            store.setAuto(s.path, s.next);
            const was = model.get(s.path)!;
            if (leafAt(s.path).auto !== false && was.auto !== s.next) model.set(s.path, { auto: s.next, value: s.next ? undefined : store.get(s.path) });
          } else {
            store.reset(s.path);
            for (const r of prefResets(nodeAt(s.path), s.path)) model.set(r.path as Path, { auto: r.auto, value: r.value });
          }
        }
        warn.mockRestore();
        for (const path of PATHS) {
          const want = model.get(path)!;
          const leaf = leafAt(path);
          expect(store.isAuto(path)).toBe(want.auto);
          expect(store.get(path)).toEqual(want.auto ? prefAutoValue(leaf) : want.value);
          expect(prefIsReset(leaf, { auto: store.isAuto(path), value: store.get(path) })).toBe(
            prefIsReset(leaf, want),
          );
        }
      }),
    );
  });
});
