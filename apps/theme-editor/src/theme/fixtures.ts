import { THEME_SOURCES, type ThemeDefinition } from '@weasel-js/theme';
import type { Lookup } from '@weasel-js/theme/engine';

export const weasel = THEME_SOURCES.weasel as ThemeDefinition;

/** A pins-only child: one pin over a semantic weasel derives, one over a token weasel only pins. */
export const child: ThemeDefinition = {
  name: 'child',
  extends: 'weasel',
  pins: {
    surface: { by: 'mode', dark: { value: '#0a0a14', type: 'color' }, light: { value: '#fafaf7', type: 'color' } },
    'radius-md': { value: '6px', type: 'dimension' },
  },
};

export const lookupOf = (...defs: ThemeDefinition[]): Lookup => {
  const byName = new Map([weasel, ...defs].map((d) => [d.name, d]));
  return (name) => byName.get(name);
};

/** A root theme whose spacing scale steps differently per density. */
export const spaced: ThemeDefinition = {
  name: 'spaced',
  axes: { density: { default: 'comfortable', values: { comfortable: {}, compact: {} } } },
  scales: { space: { steps: ['xs', 'sm', 'md'], base: 4, step: { by: 'density', comfortable: 4, compact: 3 } } },
};
