import { createMemoryAdapter } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import { pref } from './build';
import { prefsCss } from './css';
import { prefsDefaultsSource } from './defaultsSource';
import { openPrefsSync } from './open';

const byMode = (dark: unknown, light: unknown) => ({ $by: 'look.mode', $in: { dark, light } });

const SCHEMA = pref.group('Prefs', {
  look: pref.group('Look', {
    mode: pref.enum('Mode', 'dark', ['dark', 'light']),
    density: pref.enum('Density', 'compact', ['compact', 'roomy']),
    inner: pref.group('Inner', { gridGap: pref.number('Grid gap', 2), face: pref.string('Face', 'Sans') }),
  }),
  gap: { ...pref.number('Gap', 4, { unit: { scale: 1, suffix: 'px' }, scopes: [{ selector: 'look.mode' }, { selector: 'look.density' }] }), defaultScope: byMode(4, { $by: 'look.density', $in: { compact: 6, roomy: 9 } }) },
  surface: pref.color('Surface', '#000000', { scopes: [{ selector: 'look.mode' }] }),
  shown: pref.boolean('Shown', true),
});

describe('prefsDefaultsSource', () => {
  it('writes the same CSS as a store opened at defaults', () => {
    const store = openPrefsSync(SCHEMA, { storage: createMemoryAdapter(), prefix: 'x.' });
    const css = prefsCss(prefsDefaultsSource(SCHEMA));
    expect(css).toBe(prefsCss(store));
    expect(css).toContain('--gap: 9px;');
  });

  it('reads a split default at a selection, and its scope', () => {
    const source = prefsDefaultsSource(SCHEMA);
    expect(source.get('gap')).toBe(4);
    expect(source.values({ at: { 'look.mode': 'light' } }).gap).toBe(6);
    expect(source.scope('gap')).toEqual(SCHEMA.children.gap.defaultScope);
    expect(source.scope('surface')).toEqual({ $by: 'look.mode', $in: {} });
  });
});
