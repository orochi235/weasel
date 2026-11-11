/** Counterexamples the icon registry's second-pass properties shrank to. */
import { describe, expect, it } from 'vitest';
import { createIconRegistry } from './registry';
import type { IconTable } from './table';

describe('shrunk counterexamples', () => {
  it('refuses a batch holding a malformed table before registering any of it', () => {
    const r = createIconRegistry();
    const batch = [
      { namespace: 'a', owner: '@a', icons: { x: { body: '', group: 'g', tags: [] } } },
      { namespace: 'core', owner: '@a', icons: null },
    ] as unknown as IconTable[];
    expect(() => r.add(batch)).toThrow(TypeError);
    expect(r.owner('a')).toBeUndefined();
    expect(r.get('a:x')).toBeUndefined();
    expect(r.getVersion()).toBe(0);
  });
});

describe('shrunk counterexamples: variants', () => {
  it('starts a fresh load when a listener retries a variant from its failure notice', async () => {
    const r = createIconRegistry();
    let calls = 0;
    r.provideVariants({
      v: async () => {
        if (++calls === 1) throw new Error('offline');
        return { default: [{ namespace: 'v', owner: '@v', icons: { a: { body: 'va', group: 'g', tags: [] } } }] };
      },
    });
    let retry: Promise<void> | undefined;
    r.subscribe(() => {
      if (r.variantState('v') === 'failed' && !retry) retry = r.loadVariant('v');
    });
    const errors = console.error;
    console.error = () => {};
    try {
      await r.loadVariant('v');
      await retry;
    } finally {
      console.error = errors;
    }
    expect(calls).toBe(2);
    expect(r.variantState('v')).toBe('loaded');
  });
});
