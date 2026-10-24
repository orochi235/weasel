import { describe, expect, it } from 'vitest';
import { colorAt, colorCount, colorCssAt, rampSteps, themeTints } from './colorList';
import { resolveTheme } from './resolveTheme';
import { defineTheme, weaselTheme } from './theme';

const dark = { theme: weaselTheme, resolved: resolveTheme(weaselTheme, { mode: 'dark' }) };
const light = { theme: weaselTheme, resolved: resolveTheme(weaselTheme, { mode: 'light' }) };

describe('colorAt', () => {
  it('reads a literal list by index, wrapping both ways', () => {
    const list = ['#111', '#222', '#333'];
    expect(colorAt(list, 0)).toBe('#111');
    expect(colorAt(list, 4)).toBe('#222');
    expect(colorAt(list, -1)).toBe('#333');
  });

  it('calls a function list with the raw index', () => {
    expect(colorAt((i) => `hsl(${i * 10} 50% 50%)`, 3)).toBe('hsl(30 50% 50%)');
  });

  it('walks a ramp in step order, in the mode it is resolved for', () => {
    const steps = rampSteps(weaselTheme, 'swatch');
    expect(steps[0]).toBe('fuchsia');
    expect(colorAt({ ramp: 'swatch' }, 0, dark)).toBe(dark.resolved['--wzl-swatch-fuchsia']);
    expect(colorAt({ ramp: 'swatch' }, steps.length + 1, light)).toBe(light.resolved['--wzl-swatch-green']);
  });

  it('answers a ramp with its custom property when asked for CSS', () => {
    expect(colorCssAt({ ramp: 'swatch' }, 2)).toBe('var(--wzl-swatch-sky)');
    expect(colorCssAt(['#abc'], 7)).toBe('#abc');
  });

  it('generates count colors once per parameter set', () => {
    const list = { generate: { count: 4 } };
    const first = [0, 1, 2, 3].map((i) => colorAt(list, i));
    expect(new Set(first).size).toBe(4);
    for (const c of first) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorAt({ generate: { count: 4 } }, 5)).toBe(first[1]);
  });

  it('throws on a ramp the theme does not have', () => {
    expect(() => colorAt({ ramp: 'nope' }, 0)).toThrow(/no ramp "nope"/);
  });
});

describe('a list of color sources', () => {
  const palette = { entries: [{ name: 'brand', color: { space: 'srgb', coords: [1, 0, 0] } }] };
  const list = [{ ref: 'brand' }, { ref: 'accent' }, { space: 'srgb', coords: [0, 0, 1] }, '#abc'] as const;

  it('resolves an item against the palette and the theme, and passes a string through', () => {
    const ctx = { ...dark, palette };
    expect(colorAt(list, 0, ctx)).toBe('#ff0000');
    expect(colorAt(list, 2, ctx)).toBe('#0000ff');
    expect(colorAt(list, 3, ctx)).toBe('#abc');
    expect(colorAt(list, 5, ctx)).not.toBe(colorAt(list, 5, { ...light, palette }));
  });

  it('writes a theme ref as its custom property when asked for CSS', () => {
    const ctx = { ...dark, palette };
    expect(colorCssAt(list, 1, ctx)).toBe('var(--wzl-accent)');
    expect(colorCssAt(list, 0, ctx)).toBe('#ff0000');
  });

  it('takes a source from a function list', () => {
    expect(colorAt((i) => ({ space: 'srgb', coords: [0, i, 0] }), 1)).toBe('#00ff00');
  });

  it('throws on an item nothing answers', () => {
    expect(() => colorAt(list, 0, dark)).toThrow(/item 0/);
    expect(() => colorCssAt(list, 0, dark)).toThrow(/item 0/);
  });

  it('counts sources as it counts strings', () => {
    expect(colorCount(list)).toBe(4);
  });
});

describe('themeTints', () => {
  it('is the swatch ramp for the built-in theme', () => {
    expect(themeTints(weaselTheme)).toEqual({ ramp: 'swatch' });
  });

  it('comes from the nearest theme in the chain that declares one', () => {
    const child = defineTheme({ name: 'child', tints: ['#f00', '#0f0'] });
    const grandchild = defineTheme({ name: 'grandchild', extends: child });
    expect(themeTints(grandchild)).toEqual(['#f00', '#0f0']);
    expect(rampSteps(grandchild, 'swatch')).toEqual(rampSteps(weaselTheme, 'swatch'));
  });
});

describe('colorCount', () => {
  it('counts each form before it wraps, and a function as unbounded', () => {
    expect(colorCount(['#1', '#2'])).toBe(2);
    expect(colorCount({ generate: { count: 6 } })).toBe(6);
    expect(colorCount({ ramp: 'swatch' })).toBe(rampSteps(weaselTheme, 'swatch').length);
    expect(colorCount(() => '#000')).toBeUndefined();
  });
});
