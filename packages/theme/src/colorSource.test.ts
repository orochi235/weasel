import { colorLiteralToHex, cssColorLiteral, type ColorSource, type Palette } from '@weasel-js/paint';
import { describe, expect, it } from 'vitest';
import { colorSourceCss, colorSourceLiteral, TINT_REF, type ColorSourceContext } from './colorSource';
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

describe('a ref to the tint list', () => {
  it('indexes the list in force, wrapping, as a custom property where the list is a ramp', () => {
    expect(colorSourceCss({ ref: TINT_REF, index: 12 }, dark)).toBe('var(--wzl-swatch-sky)');
    expect(hexOf({ ref: TINT_REF, index: 12 }, dark)).toBe(tokenHex(dark, '--wzl-swatch-sky'));
    expect(colorSourceCss({ ref: TINT_REF }, dark)).toBe('var(--wzl-swatch-fuchsia)');
  });

  it('reads a literal list, and passes a function list through as CSS', () => {
    const listed = at('dark', { tints: ['#111111', '#222222'] });
    expect(colorSourceCss({ ref: TINT_REF, index: 3 }, listed)).toBe('#222222');
    expect(hexOf({ ref: TINT_REF, index: 3 }, listed)).toBe('#222222');
    const computed = at('dark', { tints: (i) => `var(--mine-${i})` });
    expect(colorSourceCss({ ref: TINT_REF, index: 4 }, computed)).toBe('var(--mine-4)');
    expect(colorSourceLiteral({ ref: TINT_REF, index: 4 }, computed)).toBeNull();
  });
});

describe('a tint list of sources', () => {
  const palette: Palette = { entries: [{ name: 'brand', color: { space: 'srgb', coords: [1, 0, 0] } }] };

  it('lets a theme name a palette entry, a token, or a literal as a tint', () => {
    const ctx = at('dark', { palette, tints: [{ ref: 'brand' }, { ref: 'accent' }, { space: 'srgb', coords: [0, 0, 1] }] });
    expect(colorSourceCss({ ref: TINT_REF, index: 0 }, ctx)).toBe('#ff0000');
    expect(colorSourceCss({ ref: TINT_REF, index: 1 }, ctx)).toBe('var(--wzl-accent)');
    expect(hexOf({ ref: TINT_REF, index: 1 }, ctx)).toBe(tokenHex(dark, '--wzl-accent'));
    expect(colorSourceCss({ ref: TINT_REF, index: 2 }, ctx)).toBe('#0000ff');
  });

  it('answers null for a tint that names itself, directly or through another tint', () => {
    const ctx = at('dark', { tints: [{ ref: TINT_REF }, { ref: TINT_REF, index: 2 }, { ref: TINT_REF, index: 1 }, () => ({ ref: TINT_REF, index: 3 })] });
    for (const index of [0, 1, 2, 3]) {
      expect(colorSourceLiteral({ ref: TINT_REF, index }, ctx)).toBeNull();
      expect(colorSourceCss({ ref: TINT_REF, index }, ctx)).toBeNull();
    }
  });

  it('follows one tint to another', () => {
    const ctx = at('dark', { tints: ['#111111', { ref: TINT_REF }] });
    expect(colorSourceCss({ ref: TINT_REF, index: 1 }, ctx)).toBe('#111111');
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

  it('answers a name before the theme does', () => {
    expect(colorSourceCss({ ref: 'surface' }, ctx)).toBe('#0000ff');
    expect(hexOf({ ref: 'brand' }, ctx)).toBe(tokenHex(dark, '--wzl-accent'));
  });

  it("writes an entry that only names a theme color as that color's custom property", () => {
    expect(colorSourceCss({ ref: 'brand' }, ctx)).toBe('var(--wzl-accent)');
    const series = { name: 'series', colors: () => [{ ref: 'brand' }, { ref: 'swatch', index: 3 }] };
    const chained = at('dark', { palette: { entries: [...palette.entries, series] } });
    expect(colorSourceCss({ ref: 'series', index: 0 }, chained)).toBe('var(--wzl-accent)');
    expect(colorSourceCss({ ref: 'series', index: 1 }, chained)).toBe('var(--wzl-swatch-amber)');
    expect(colorSourceCss({ ref: 'series', index: 2 }, chained)).toBeNull();
  });

  it('writes a function that only names a color the same way', () => {
    expect(colorSourceCss(() => ({ ref: 'brand' }), ctx)).toBe('var(--wzl-accent)');
    expect(colorSourceCss(() => ({ ref: 'accent' }))).toBe('var(--wzl-accent)');
  });

  it('writes a function that reads a color to compute its own as the literal it resolves to', () => {
    const source: ColorSource = ({ resolve }) => resolve({ ref: 'brand' });
    expect(colorSourceCss(source, ctx)).toBe(tokenHex(dark, '--wzl-accent'));
  });

  it('answers null for entries that name each other', () => {
    const entries = [{ name: 'a', color: { ref: 'b' } }, { name: 'b', color: { ref: 'a' } }];
    expect(colorSourceCss({ ref: 'a' }, at('dark', { palette: { entries } }))).toBeNull();
  });
});

it('resolves against the built-in theme with no context', () => {
  expect(colorSourceCss({ ref: 'accent' })).toBe('var(--wzl-accent)');
  expect(colorSourceLiteral({ ref: 'accent' })).not.toBeNull();
});
