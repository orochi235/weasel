import { colorLiteralToHex, cssColorLiteral, type ColorSource, type Palette } from '@weasel-js/paint';
import { describe, expect, it } from 'vitest';
import { colorSourceCss, colorSourceLiteral, TONE_REF, type ColorSourceContext } from './colorSource';
import { resolveTheme } from './resolveTheme';
import { weaselTheme } from './theme';

const at = (mode: string, extra: Partial<ColorSourceContext> = {}): ColorSourceContext => ({
  theme: weaselTheme,
  resolved: resolveTheme(weaselTheme, { mode }),
  ...extra,
});
const dark = at('dark');
const light = at('light');
const hexOf = (source: ColorSource, ctx: ColorSourceContext) => {
  const literal = colorSourceLiteral(source, ctx);
  return literal && colorLiteralToHex(literal);
};
const tokenHex = (ctx: ColorSourceContext, name: keyof ColorSourceContext['resolved']) =>
  colorLiteralToHex(cssColorLiteral(ctx.resolved[name]));

describe('a literal', () => {
  it('is written as CSS and resolves to itself', () => {
    const red = { space: 'srgb', coords: [1, 0, 0] };
    expect(colorSourceCss(red, dark)).toBe('#ff0000');
    expect(colorSourceLiteral(red, dark)).toBe(red);
  });
});

describe('a ref to a theme token', () => {
  it('is written as its custom property, and resolves in the mode of the context', () => {
    expect(colorSourceCss({ ref: 'accent' }, dark)).toBe('var(--wzl-accent)');
    expect(hexOf({ ref: 'accent' }, dark)).toBe(tokenHex(dark, '--wzl-accent'));
    expect(hexOf({ ref: 'surface' }, light)).toBe(tokenHex(light, '--wzl-surface'));
    expect(hexOf({ ref: 'surface' }, light)).not.toBe(hexOf({ ref: 'surface' }, dark));
  });

  it('flattens a token written against currentColor onto the foreground', () => {
    const muted = colorSourceLiteral({ ref: 'fg-muted' }, dark);
    expect(muted?.alpha).toBeLessThan(1);
    expect(colorLiteralToHex({ ...muted!, alpha: 1 })).toBe(tokenHex(dark, '--wzl-fg'));
  });

  it('answers null for a token that is not a color, and for a name the theme lacks', () => {
    for (const ref of ['font-size-sm', 'nope']) {
      expect(colorSourceCss({ ref }, dark)).toBeNull();
      expect(colorSourceLiteral({ ref }, dark)).toBeNull();
    }
  });
});

describe('a ref with an index', () => {
  it('reads a step of the ramp of that name', () => {
    expect(colorSourceCss({ ref: 'swatch', index: 3 }, dark)).toBe('var(--wzl-swatch-amber)');
    expect(hexOf({ ref: 'swatch', index: 3 }, dark)).toBe(tokenHex(dark, '--wzl-swatch-amber'));
    expect(colorSourceCss({ ref: 'accent', index: 0 }, dark)).toBe('var(--wzl-accent-soft)');
  });

  it('answers null past the end of the ramp, and for a ramp named without an index', () => {
    expect(colorSourceCss({ ref: 'swatch', index: 10 }, dark)).toBeNull();
    expect(colorSourceCss({ ref: 'swatch' }, dark)).toBeNull();
  });
});

describe('a ref to the tone list', () => {
  it('indexes the list in force, wrapping, as a custom property where the list is a ramp', () => {
    expect(colorSourceCss({ ref: TONE_REF, index: 12 }, dark)).toBe('var(--wzl-swatch-sky)');
    expect(hexOf({ ref: TONE_REF, index: 12 }, dark)).toBe(tokenHex(dark, '--wzl-swatch-sky'));
    expect(colorSourceCss({ ref: TONE_REF }, dark)).toBe('var(--wzl-swatch-fuchsia)');
  });

  it('reads a literal list, and passes a function list through as CSS', () => {
    const listed = at('dark', { tones: ['#111111', '#222222'] });
    expect(colorSourceCss({ ref: TONE_REF, index: 3 }, listed)).toBe('#222222');
    expect(hexOf({ ref: TONE_REF, index: 3 }, listed)).toBe('#222222');
    const computed = at('dark', { tones: (i) => `var(--mine-${i})` });
    expect(colorSourceCss({ ref: TONE_REF, index: 4 }, computed)).toBe('var(--mine-4)');
    expect(colorSourceLiteral({ ref: TONE_REF, index: 4 }, computed)).toBeNull();
  });
});

describe('a ref spelled as a custom property', () => {
  it('is written as that property, which only the cascade can resolve', () => {
    expect(colorSourceCss({ ref: '--mine' }, dark)).toBe('var(--mine)');
    expect(colorSourceLiteral({ ref: '--mine' }, dark)).toBeNull();
  });

  it('resolves when the property is a token of the theme', () => {
    expect(hexOf({ ref: '--wzl-accent' }, dark)).toBe(tokenHex(dark, '--wzl-accent'));
  });
});

describe('a palette on the context', () => {
  const palette: Palette = {
    entries: [
      { name: 'brand', color: { ref: 'accent' } },
      { name: 'surface', color: { space: 'srgb', coords: [0, 0, 1] } },
    ],
  };
  const ctx = at('dark', { palette });

  it('answers a name before the theme does, and may name the theme in turn', () => {
    expect(colorSourceCss({ ref: 'surface' }, ctx)).toBe('#0000ff');
    expect(colorSourceCss({ ref: 'brand' }, ctx)).toBe(tokenHex(dark, '--wzl-accent'));
  });

  it('is what a function source resolves against', () => {
    const source: ColorSource = ({ resolve }) => resolve({ ref: 'brand' });
    expect(colorSourceCss(source, ctx)).toBe(tokenHex(dark, '--wzl-accent'));
  });
});

it('resolves against the built-in theme with no context', () => {
  expect(colorSourceCss({ ref: 'accent' })).toBe('var(--wzl-accent)');
  expect(colorSourceLiteral({ ref: 'accent' })).not.toBeNull();
});
