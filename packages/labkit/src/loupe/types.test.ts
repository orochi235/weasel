import { describe, expect, it } from 'vitest';
import { LOUPE_DEFAULTS, resolveLoupe } from './types';

describe('resolveLoupe', () => {
  it('takes every default from a bare `true`', () => {
    expect(resolveLoupe(true)).toMatchObject(LOUPE_DEFAULTS);
  });

  it('keeps what the instrument declared', () => {
    const cap = resolveLoupe({ factor: 12, diameter: 320, minFactor: 1, maxFactor: 40 });
    expect(cap).toMatchObject({ factor: 12, diameter: 320, minFactor: 1, maxFactor: 40 });
  });

  it('clamps an opening factor outside the bounds it also declared', () => {
    expect(resolveLoupe({ factor: 100, maxFactor: 16 }).factor).toBe(16);
    expect(resolveLoupe({ factor: 1, minFactor: 4 }).factor).toBe(4);
  });

  it('forces vector on a DOM loupe, which has no framebuffer to enlarge', () => {
    expect(resolveLoupe({ render: () => null, mode: 'pixel' }).mode).toBe('vector');
    expect(resolveLoupe({ mode: 'pixel' }).mode).toBe('pixel');
  });

  it('distinguishes an unset peek key from one turned off', () => {
    expect(resolveLoupe({}).peekKey).toBe('Alt');
    expect(resolveLoupe({ peekKey: null }).peekKey).toBeNull();
    expect(resolveLoupe({ peekKey: 'Shift' }).peekKey).toBe('Shift');
  });
});
