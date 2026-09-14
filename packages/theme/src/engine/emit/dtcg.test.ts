import { describe, expect, it } from 'vitest';
import { loadDTCG } from '../../loadDTCG';
import { resolveTheme } from '../../resolveTheme';
import { defineTheme, weaselTheme } from '../../theme';
import { toDTCG } from './dtcg';

describe('toDTCG', () => {
  it('round-trips the built-in theme through loadDTCG', () => {
    const back = loadDTCG({ ...toDTCG(weaselTheme), extends: null });
    for (const mode of ['dark', 'light']) {
      expect(resolveTheme(back, { mode })).toEqual(resolveTheme(weaselTheme, { mode }));
    }
  });

  it('round-trips a theme that leaves a mode out, so it still falls through', () => {
    const t = defineTheme({ name: 'x', pins: { backdrop: { by: 'mode', dark: { value: 'url(a.png)', type: 'gradient' } }, 'radius-md': { value: '9px', type: 'dimension' } } });
    const back = loadDTCG({ ...toDTCG(t), extends: weaselTheme });
    for (const mode of ['dark', 'light']) expect(resolveTheme(back, { mode })).toEqual(resolveTheme(t, { mode }));
  });

  it('refuses a theme with an axis other than mode', () => {
    const t = defineTheme({ name: 'd', axes: { density: { default: 'a', values: { a: {}, b: {} } } }, pins: { gap: { by: 'density', a: '1px', b: '2px' } } });
    expect(() => toDTCG(t)).toThrow(/mode/);
  });
});
