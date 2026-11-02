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
      strokeTrimKey({ start: 0.1 }),
      strokeTrimKey({ start: { anchor: 2 } }),
      strokeTrimKey({ start: { length: 2 } }),
      strokeTrimKey({ start: { subpath: 2 } }),
      strokeTrimKey({ end: 0.5 }),
      strokeTrimKey({ end: 0.5, pace: 'anchor' }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).not.toBe('');
  });

  it('keys an omitted start as 0 and an omitted end as 1', () => {
    expect(strokeTrimKey({ end: 0.5 })).toBe(strokeTrimKey({ start: 0, end: 0.5 }));
    expect(strokeTrimKey({ start: 0.5 })).toBe(strokeTrimKey({ start: 0.5, end: 1 }));
    expect(strokeTrimKey({})).toBe(strokeTrimKey({ start: 0, end: 1 }));
  });

  it('keys an omitted pace as the default, length', () => {
    expect(strokeTrimKey({ end: 0.5 })).toBe(strokeTrimKey({ end: 0.5, pace: 'length' }));
  });
});
