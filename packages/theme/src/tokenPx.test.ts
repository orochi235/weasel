import { describe, expect, it } from 'vitest';
import { tokenPx } from './tokenPx';

describe('tokenPx', () => {
  it('reads a dimension token default as a number', () => {
    expect(tokenPx('--wzl-handle-size')).toBe(9);
    expect(tokenPx('--wzl-handle-size-sm')).toBe(7);
    expect(tokenPx('--wzl-handle-size-lg')).toBe(10);
  });

  it('prefers a resolved theme over the default', () => {
    expect(tokenPx('--wzl-handle-size', { '--wzl-handle-size': '14px' } as never)).toBe(14);
  });

  it('falls back to the default when the resolved record omits the token', () => {
    expect(tokenPx('--wzl-handle-size', {} as never)).toBe(9);
  });

  it('refuses a token whose value is not a plain px length', () => {
    expect(() => tokenPx('--wzl-surface')).toThrow(/not a px length/);
    expect(() => tokenPx('--wzl-handle-size', { '--wzl-handle-size': '1rem' } as never)).toThrow(/not a px length/);
  });
});
