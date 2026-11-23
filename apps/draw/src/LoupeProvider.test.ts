import { describe, expect, it } from 'vitest';
import { uiFontFamily } from './LoupeProvider';

describe('uiFontFamily', () => {
  it('takes the first family of a list, unquoted', () => {
    expect(uiFontFamily("Oswald, 'Arial Narrow', sans-serif")).toBe('Oswald');
    expect(uiFontFamily("'Helvetica Neue Condensed', Arial")).toBe('Helvetica Neue Condensed');
    expect(uiFontFamily('"A, B", serif')).toBe('A, B');
    expect(uiFontFamily('system-ui, sans-serif')).toBe('system-ui');
  });

  it('falls back to sans-serif for no list, or one a var() computes', () => {
    expect(uiFontFamily(undefined)).toBe('sans-serif');
    expect(uiFontFamily('  ')).toBe('sans-serif');
    expect(uiFontFamily('var(--x, Oswald, serif)')).toBe('sans-serif');
  });
});
