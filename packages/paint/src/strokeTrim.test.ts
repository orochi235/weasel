import { describe, it, expect } from 'vitest';
import { strokeTrimKey } from './strokeTrim';

describe('strokeTrimKey', () => {
  it('is empty for no trim', () => {
    expect(strokeTrimKey(undefined)).toBe('');
  });

  it('is equal for structurally equal trims', () => {
    expect(strokeTrimKey({ start: { anchor: 2 }, end: 1, pace: 'length' }))
      .toBe(strokeTrimKey({ pace: 'length', end: 1, start: { anchor: 2 } }));
  });

  it('tells apart trims that read differently', () => {
    const keys = [
      strokeTrimKey({}),
      strokeTrimKey({ start: 0 }),
      strokeTrimKey({ start: { anchor: 2 } }),
      strokeTrimKey({ start: { length: 2 } }),
      strokeTrimKey({ start: { subpath: 2 } }),
      strokeTrimKey({ end: 0.5 }),
      strokeTrimKey({ end: 0.5, pace: 'anchor' }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).not.toBe('');
  });
});
