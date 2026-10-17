// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { withLinks } from './links';

describe('withLinks with no window', () => {
  it('goes nowhere, and does not throw, with no navigator', () => {
    expect(typeof window).toBe('undefined');
    const out = withLinks([{ kind: 'item', key: 'a', label: 'A', href: '/a', run: () => {} }])[0];
    if (out?.kind !== 'item') throw new Error('shape');
    expect(() => out.run()).not.toThrow();
  });
});
