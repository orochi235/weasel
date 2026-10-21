import { describe, expect, it } from 'vitest';
import { INHERIT, resolveFill, resolveStroke } from './resolvePaint';

const red = { paint: { color: '#ff0000' } };

describe('resolveFill', () => {
  it('reads absent, null and a record with no paint as none', () => {
    expect(resolveFill(undefined)).toBeNull();
    expect(resolveFill(null)).toBeNull();
    expect(resolveFill({})).toBeNull();
  });

  it('keeps a paint with alpha 0, which is a paint', () => {
    const clear = { paint: { color: '#000000', opacity: 0 } };
    expect(resolveFill(clear)).toBe(clear);
  });

  it('takes what it inherits, or none when it inherits nothing', () => {
    expect(resolveFill(INHERIT, red)).toBe(red);
    expect(resolveFill(INHERIT)).toBeNull();
  });
});

describe('resolveStroke', () => {
  it('reads a stroke with no paint as none, whatever its width', () => {
    expect(resolveStroke({ width: 4 })).toBeNull();
    expect(resolveStroke(null)).toBeNull();
  });

  it('takes the inherited stroke whole', () => {
    const wide = { ...red, width: 6 };
    expect(resolveStroke(INHERIT, wide)).toBe(wide);
  });
});
