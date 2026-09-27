import { describe, expect, it } from 'vitest';
import { applyTrialTheme, THEME_GLOBAL, THEMES } from './themes';

function applied(globals: Record<string, unknown>, mode: 'light' | 'dark' = 'light'): DOMStringMap {
  const root = document.createElement('div');
  applyTrialTheme(root, globals, mode);
  return root.dataset;
}

describe('the Theme global', () => {
  it('lists every registered theme, weasel first as the default', () => {
    expect(Object.keys(THEMES)).toEqual(['weasel', 'interstellar']);
    expect(THEME_GLOBAL.default).toBe('weasel');
    expect(THEME_GLOBAL.options).toEqual([
      { value: 'weasel', label: 'Weasel' },
      { value: 'interstellar', label: 'Interstellar' },
    ]);
  });

  it('applies the theme it names to a trial, through applyTheme, at the mode and density given', () => {
    expect(applied({ theme: 'interstellar', density: 'compact' }, 'dark')).toMatchObject({
      wzlTheme: 'interstellar',
      wzlMode: 'dark',
      wzlDensity: 'compact',
    });
    expect(applied({ theme: 'weasel' }).wzlTheme).toBe('weasel');
  });

  it('falls back to weasel, and comfortable, for values nothing is registered under', () => {
    expect(applied({ theme: 'gone', density: 'vast' })).toMatchObject({ wzlTheme: 'weasel', wzlDensity: 'comfortable' });
    expect(applied({}).wzlTheme).toBe('weasel');
  });
});
