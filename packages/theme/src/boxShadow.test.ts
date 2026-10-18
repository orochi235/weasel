import { describe, expect, it } from 'vitest';
import { expandVars, parseBoxShadow } from './boxShadow';
import { resolveTheme } from './resolveTheme';
import { win9xTheme } from './themes/win9x';

describe('expandVars', () => {
  const tokens = { '--a': '#fff', '--b': 'inset 1px 1px 0 var(--a)' };

  it('substitutes a token, and the tokens its value names', () => {
    expect(expandVars('var(--b), 0 0 0 var(--a)', tokens)).toBe('inset 1px 1px 0 #fff, 0 0 0 #fff');
  });

  it('takes the fallback for a token the theme lacks, expanding it too', () => {
    expect(expandVars('var(--missing, 0 8px 24px var(--a))', tokens)).toBe('0 8px 24px #fff');
    expect(expandVars('var(--a, red)', tokens)).toBe('#fff');
  });

  it('throws on a reference with neither a token nor a fallback, and on a cycle', () => {
    expect(() => expandVars('var(--missing)', tokens)).toThrow(/no fallback/);
    expect(() => expandVars('var(--x)', { '--x': 'var(--x)' })).toThrow(/itself/);
  });
});

describe('parseBoxShadow', () => {
  it('reads each layer, inset or not, with its color wherever it is written', () => {
    expect(parseBoxShadow('0 8px 24px rgba(0, 0, 0, 0.18), inset -1px 2px 0 1px #000')).toEqual([
      { inset: false, x: 0, y: 8, blur: 24, spread: 0, color: 'rgba(0, 0, 0, 0.18)' },
      { inset: true, x: -1, y: 2, blur: 0, spread: 1, color: '#000' },
    ]);
    expect(parseBoxShadow('red 1px 1px')).toEqual([{ inset: false, x: 1, y: 1, blur: 0, spread: 0, color: 'red' }]);
  });

  it('reads none as no layers and a layer with no color as currentColor', () => {
    expect(parseBoxShadow('none')).toEqual([]);
    expect(parseBoxShadow('1px 1px')[0]!.color).toBe('currentColor');
  });

  it('reads a theme bevel once its references are expanded', () => {
    const t = resolveTheme(win9xTheme, { mode: 'light' }) as Readonly<Record<string, string>>;
    const layers = parseBoxShadow(expandVars(t['--wzl-bevel-raised']!, t));
    expect(layers.every((l) => l.inset && l.blur === 0)).toBe(true);
    expect(layers[0]).toMatchObject({ x: -1, y: -1, color: '#000000' });
  });

  it('refuses a length it cannot draw in px', () => {
    expect(() => parseBoxShadow('0 1em 2px #000')).toThrow(/px/);
  });
});
