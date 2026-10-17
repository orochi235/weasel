import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIconRegistry, IconNamespaceClaimedError } from './registry';
import type { IconTable } from './table';
import type { IconRef } from './names';

const glyph = (body: string) => ({ body, group: 'Test', tags: [] });
const core = (icons: Record<string, string>): IconTable => ({
  namespace: 'core',
  owner: '@weasel-js/core',
  icons: Object.fromEntries(Object.entries(icons).map(([k, b]) => [k, glyph(b)])),
});
const ref = (s: string) => s as IconRef;

describe('createIconRegistry', () => {
  it('looks a glyph up by qualified name', () => {
    const r = createIconRegistry(core({ undo: '<path d="u"/>' }));
    expect(r.get('core:undo')?.body).toBe('<path d="u"/>');
    expect(r.get('core:redo')).toBeUndefined();
    expect(r.get('undo')).toBeUndefined();
  });

  it('merges a second table with the same namespace and owner', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    r.add(core({ undo: 'u', redo: 'r' }));
    expect(r.get('core:redo')?.body).toBe('r');
    expect(r.entries().every((e) => !e.overridden)).toBe(true);
  });

  it('refuses a table claiming a namespace another owner holds', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    const rival: IconTable = { namespace: 'core', owner: '@acme/core', icons: { undo: glyph('x') } };
    expect(() => r.add(rival)).toThrow(IconNamespaceClaimedError);
    expect(r.get('core:undo')?.body).toBe('u');
  });

  it('releases a table, freeing its namespace', () => {
    const r = createIconRegistry();
    const release = r.add(core({ undo: 'u' }));
    release();
    expect(r.get('core:undo')).toBeUndefined();
    expect(r.owner('core')).toBeUndefined();
  });

  it('overrides one icon explicitly, and releasing the override uncovers the original', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    const release = r.override(ref('core:undo'), glyph('mine'), 'app');
    expect(r.get('core:undo')?.body).toBe('mine');
    expect(r.entries().find((e) => e.ref === 'core:undo')?.overridden).toBe(true);
    release();
    expect(r.get('core:undo')?.body).toBe('u');
  });

  it('notifies subscribers and advances its version on change', () => {
    const r = createIconRegistry();
    const listener = vi.fn();
    r.subscribe(listener);
    const v = r.getVersion();
    r.add(core({ undo: 'u' }));
    expect(listener).toHaveBeenCalled();
    expect(r.getVersion()).toBeGreaterThan(v);
  });

  it('returns the same entries array between changes, and a new one after', () => {
    const r = createIconRegistry();
    r.add(core({ undo: 'u' }));
    const first = r.entries();
    expect(r.entries()).toBe(first);
    r.add(core({ redo: 'r' }));
    expect(r.entries()).not.toBe(first);
    expect(r.entries()).toBe(r.entries());
  });
});

describe('merged namespaces and overrides', () => {
  const partial = (icons: string[]) => core(Object.fromEntries(icons.map((n) => [n, n])));

  it.each([
    ['in order', false],
    ['reversed', true],
  ])('leaves nothing behind when two partial tables are released %s', (_l, reversed) => {
    const r = createIconRegistry();
    const a = r.add(partial(['undo']));
    const b = r.add(partial(['redo']));
    (reversed ? [b, a] : [a, b]).forEach((release) => release());
    expect(r.entries()).toEqual([]);
    expect(r.get('core:undo')).toBeUndefined();
    expect(r.get('core:redo')).toBeUndefined();
    expect(r.owner('core')).toBeUndefined();
  });

  it('keeps an override when a same-owner table touching it is added', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    const release = r.override(ref('core:undo'), glyph('mine'), 'app');
    r.add(core({ undo: 'u2' }));
    expect(r.get('core:undo')?.body).toBe('mine');
    expect(r.entries().find((e) => e.ref === 'core:undo')?.overridden).toBe(true);
    release();
    expect(r.get('core:undo')?.body).toBe('u2');
  });

  it('releasing a table while overridden, then the override, leaves nothing', () => {
    const r = createIconRegistry();
    const table = r.add(core({ undo: 'u' }));
    const release = r.override(ref('core:undo'), glyph('mine'));
    table();
    expect(r.get('core:undo')?.body).toBe('mine');
    release();
    expect(r.get('core:undo')).toBeUndefined();
  });

  it('releasing the override uncovers the table glyph', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    r.override(ref('core:undo'), glyph('mine'))();
    expect(r.get('core:undo')?.body).toBe('u');
  });

  it('does not report the same glyph from two same-owner tables as overridden', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    r.add(core({ undo: 'u' }));
    expect(r.entries()).toHaveLength(1);
    expect(r.entries()[0]!.overridden).toBe(false);
  });

  it('registers nothing when one batch holds rival owners of a namespace', () => {
    const r = createIconRegistry();
    const rival: IconTable = { namespace: 'core', owner: '@acme/core', icons: { redo: glyph('x') } };
    expect(() => r.add([core({ undo: 'u' }), rival])).toThrow(IconNamespaceClaimedError);
    expect(r.entries()).toEqual([]);
    expect(r.owner('core')).toBeUndefined();
  });
});

describe('variants', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads a variant once and adds its tables', async () => {
    const r = createIconRegistry();
    const loader = vi.fn(async () => ({ default: [core({ undo: 'u' })] }));
    r.provideVariants({ all: loader });
    expect(r.variantState('all')).toBe('idle');
    await Promise.all([r.loadVariant('all'), r.loadVariant('all')]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(r.variantState('all')).toBe('loaded');
    expect(r.get('core:undo')).toBeDefined();
  });

  it('reports an unknown variant without throwing', async () => {
    const r = createIconRegistry();
    expect(r.variantState('picker')).toBe('unknown');
    await expect(r.loadVariant('picker')).resolves.toBeUndefined();
  });

  it('marks a rejected loader failed, keeps what it had, and retries on the next call', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = createIconRegistry(core({ undo: 'u' }));
    let fail = true;
    r.provideVariants({
      all: async () => {
        if (fail) throw new Error('offline');
        return { default: [core({ redo: 'r' })] };
      },
    });
    await r.loadVariant('all');
    expect(r.variantState('all')).toBe('failed');
    expect(r.get('core:undo')).toBeDefined();
    fail = false;
    await r.loadVariant('all');
    expect(r.variantState('all')).toBe('loaded');
    expect(r.get('core:redo')).toBeDefined();
  });

  it('logs why a variant failed in development, and stays quiet in production', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const cause = new Error('offline');
      const r = createIconRegistry();
      r.provideVariants({ all: async () => { throw cause; } });
      await r.loadVariant('all');
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0]).toContain(cause);
      expect(String(error.mock.calls[0]![0])).toContain('all');

      error.mockClear();
      vi.stubEnv('NODE_ENV', 'production');
      const quiet = createIconRegistry();
      quiet.provideVariants({ all: async () => { throw cause; } });
      await quiet.loadVariant('all');
      expect(quiet.variantState('all')).toBe('failed');
      expect(error).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      error.mockRestore();
    }
  });

  it('marks a loader that throws synchronously failed, not stuck loading', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = createIconRegistry();
    r.provideVariants({
      all: () => {
        throw new Error('sync');
      },
    });
    await r.loadVariant('all');
    expect(r.variantState('all')).toBe('failed');
  });
});
