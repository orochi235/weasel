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

  it('applies the alpha extension to a non-hex target instead of throwing', () => {
    const out = resolveTokens({
      scrim: t('rgba(20, 20, 36, 0.55)'),
      named: t('rebeccapurple'),
      a: t('{color.scrim}', { alpha: 0.5 }),
      b: t('{color.named}', { alpha: 0.5 }),
    });
    expect(out.a).toBe('rgba(20, 20, 36, 0.275)');
    expect(out.b).toBe('color-mix(in srgb, rebeccapurple 50%, transparent)');
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

  it('passes gradient and number values through verbatim', () => {
    const out = resolveTokens({
      backdrop: {
        type: 'gradient',
        value: 'radial-gradient(ellipse at center, #0a0a18 0%, #02020a 100%)',
        alpha: undefined,
        description: undefined,
      },
      'z-modal': { type: 'number', value: 30, alpha: undefined, description: undefined },
    });
    expect(out.backdrop).toBe('radial-gradient(ellipse at center, #0a0a18 0%, #02020a 100%)');
    expect(out['z-modal']).toBe('30');
  });

  it('throws naming the token when a reference is unresolvable', () => {
    expect(() => resolveTokens({ fg: t('{color.nope}') })).toThrow(/fg.*nope/);
  });

  it('throws naming the cycle rather than recursing forever', () => {
    expect(() => resolveTokens({ a: t('{color.b}'), b: t('{color.a}') })).toThrow(/cycle/i);
  });
});
