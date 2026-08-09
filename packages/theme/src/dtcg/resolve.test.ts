import { describe, it, expect } from 'vitest';
import { resolveTokens } from './resolve';
import type { FlatTokens } from './types';

const t = (value: string, extra: Partial<FlatTokens[string]> = {}): FlatTokens[string] => ({
  type: 'color', value, alpha: undefined, description: undefined, ...extra,
});

describe('resolveTokens', () => {
  it('resolves a reference chain to a literal', () => {
    const out = resolveTokens({ 'gray-100': t('#e6e7e9'), fg: t('{color.gray-100}'), text: t('{color.fg}') });
    expect(out.text).toBe('#e6e7e9');
  });

  it('applies the alpha extension against the resolved target', () => {
    const out = resolveTokens({ 'gray-100': t('#e6e7e9'), fg: t('{color.gray-100}'), line: t('{color.fg}', { alpha: 0.2 }) });
    expect(out.line).toBe('rgba(230, 231, 233, 0.2)');
  });

  it('serializes a font family list as a CSS font stack', () => {
    const out = resolveTokens({
      'font-ui': { type: 'fontFamily', value: ['Oswald', 'Arial Narrow', 'sans-serif'], alpha: undefined, description: undefined },
    });
    expect(out['font-ui']).toBe("Oswald, 'Arial Narrow', sans-serif");
  });

  it('serializes a cubic bezier', () => {
    const out = resolveTokens({
      'ease-out-cubic': { type: 'cubicBezier', value: [0.33, 1, 0.68, 1], alpha: undefined, description: undefined },
    });
    expect(out['ease-out-cubic']).toBe('cubic-bezier(0.33, 1, 0.68, 1)');
  });

  it('throws naming the token when a reference is unresolvable', () => {
    expect(() => resolveTokens({ fg: t('{color.nope}') })).toThrow(/fg.*nope/);
  });

  it('throws naming the cycle rather than recursing forever', () => {
    expect(() => resolveTokens({ a: t('{color.b}'), b: t('{color.a}') })).toThrow(/cycle/i);
  });
});
