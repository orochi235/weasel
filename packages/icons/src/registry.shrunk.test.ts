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
