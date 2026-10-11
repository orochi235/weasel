import { afterEach, expect, test } from 'vitest';
import type { ThemeDefinition } from './definition';
import { bakeChain } from './engine/bake';
import { axisDependencies } from './engine/deps';
import { emitCss } from './engine/emit/css';
import { resolveTheme } from './resolveTheme';
import type { Theme } from './theme';

const base: ThemeDefinition = {
  name: 'base',
  axes: {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  pins: {
    ink: { value: '#111111', type: 'color' },
    paper: { value: '#eeeeee', type: 'color' },
    surface: { by: 'mode', dark: { value: '{ink}', type: 'color' }, light: { value: '{paper}', type: 'color' } },
    panel: { value: '{surface}', type: 'color' },
    gap: { by: 'density', comfortable: { value: '10px', type: 'dimension' }, compact: { value: '6px', type: 'dimension' } },
    pad: { value: '{gap}', type: 'dimension' },
  },
};

/** Adds a density and a mode, and supplies no value of its own for either. */
const wide: ThemeDefinition = {
  name: 'wide',
  extends: 'base',
  axes: { mode: { default: 'dark', values: { sepia: { scheme: 'light' } } }, density: { default: 'comfortable', values: { huge: {} } } },
  pins: { paper: { value: '#f4ecd8', type: 'color' } },
};

const defs: Record<string, ThemeDefinition> = { base, wide };
const lookup = (name: string) => defs[name];

const style = document.createElement('style');
afterEach(() => {
  document.body.replaceChildren();
  style.remove();
});

test('the stylesheet and resolveTheme agree on a token that references an axis-scoped one, at axis values a theme adds', () => {
  const chain = bakeChain(wide, lookup);
  style.textContent = emitCss(chain.map((baked) => ({ baked, deps: axisDependencies(defs[baked.name], lookup), isDefault: baked.extends === null })));
  document.head.append(style);

  const theme = chain.reduce<Theme | null>((parent, b) => ({ name: b.name, extends: parent, axes: b.axes, tokens: b.tokens }), null)!;

  for (const selection of [{ mode: 'sepia', density: 'huge' }, { mode: 'light', density: 'huge' }, { mode: 'sepia', density: 'compact' }]) {
    const el = document.createElement('div');
    el.dataset.wzlTheme = 'wide';
    el.dataset.wzlMode = selection.mode;
    el.dataset.wzlDensity = selection.density;
    document.body.append(el);
    const computed = getComputedStyle(el);
    const resolved = resolveTheme(theme, selection) as Record<string, string>;
    for (const name of ['--wzl-pad', '--wzl-gap', '--wzl-panel', '--wzl-surface', '--wzl-paper']) {
      expect(`${name}: ${computed.getPropertyValue(name).trim()}`, JSON.stringify(selection)).toBe(`${name}: ${resolved[name]}`);
    }
  }
  expect((resolveTheme(theme, { mode: 'sepia', density: 'huge' }) as Record<string, string>)['--wzl-pad']).toBe('10px');
  expect((resolveTheme(theme, { mode: 'light', density: 'huge' }) as Record<string, string>)['--wzl-panel']).toBe('#f4ecd8');
});
