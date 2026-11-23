import { describe, expect, it } from 'vitest';
import { canonicalModifiers } from './canonicalModifiers';

describe('canonicalModifiers', () => {
  it('sorts by name and keys a modifier set to undefined as an absent one', () => {
    expect(canonicalModifiers({ shift: 'required', alt: 'optional' })).toBe('alt=optional&shift=required');
    expect(canonicalModifiers({ shift: undefined, alt: 'optional' })).toBe(canonicalModifiers({ alt: 'optional' }));
  });
});
