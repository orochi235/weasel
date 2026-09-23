import { describe, expect, it } from 'vitest';
import { loadDTCG } from '../../loadDTCG';
import { enumerateSelections } from '../../axes';
import { AXES_EXT } from '../../dtcg/axesExtension';
import { resolveTheme, themeAxes } from '../../resolveTheme';
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

  const valueOf = (groups: Record<string, Record<string, unknown>>, type: string, name: string) =>
    (groups[type]?.[name] as { $value?: unknown } | undefined)?.$value;

  it('writes an alias as a path through its target’s type group', () => {
    const doc = toDTCG(weaselTheme);
    expect(valueOf(doc.modes.dark, 'color', 'surface')).toBe('{color.gray-800}');
    expect(valueOf(doc.primitives, 'color', 'gray-800')).toBeDefined();
  });

  it('finds an alias target’s type in the theme it extends', () => {
    const t = defineTheme({ name: 'x', pins: { edge: { value: '{space-md}', type: 'dimension' } } });
    expect(valueOf(toDTCG(t).primitives, 'dimension', 'edge')).toBe('{dimension.space-md}');
  });

  it('leaves an alias bare when no theme in the chain has its target', () => {
    const t = defineTheme({ name: 'x', extends: null, pins: { a: { value: '{nope}', type: 'color' } } });
    expect(valueOf(toDTCG(t).primitives, 'color', 'a')).toBe('{nope}');
  });

  it('exports a theme whose parent has an axis besides mode that the theme never varies by', () => {
    const parent = defineTheme({ name: 'dp', axes: { density: { default: 'a', values: { a: {}, b: {} } } }, pins: { gap: { by: 'density', a: '1px', b: '2px' } } });
    const kid = defineTheme({ name: 'k', extends: parent, pins: { 'radius-md': { value: '9px', type: 'dimension' } } });
    expect(valueOf(toDTCG(kid).primitives, 'dimension', 'radius-md')).toBe('9px');
  });

  it('writes a non-mode axis at its default branch in the plain groups', () => {
    const t = defineTheme({
      name: 'd',
      axes: { density: { default: 'a', values: { a: {}, b: {} } } },
      pins: { gap: { by: 'density', a: { value: '1px', type: 'dimension' }, b: { value: '2px', type: 'dimension' } } },
    });
    expect(valueOf(toDTCG(t).primitives, 'dimension', 'gap')).toBe('1px');
  });

  it('keeps mode varying underneath a flattened non-mode axis', () => {
    const t = defineTheme({
      name: 'd',
      axes: { density: { default: 'a', values: { a: {}, b: {} } } },
      pins: {
        edge: {
          by: 'density',
          a: { by: 'mode', dark: { value: '1px', type: 'dimension' }, light: { value: '3px', type: 'dimension' } },
          b: { value: '9px', type: 'dimension' },
        },
      },
    });
    const doc = toDTCG(t);
    expect(valueOf(doc.modes.dark, 'dimension', 'edge')).toBe('1px');
    expect(valueOf(doc.modes.light, 'dimension', 'edge')).toBe('3px');
  });

  const dim = (value: string) => ({ value, type: 'dimension' });
  const col = (value: string) => ({ value, type: 'color' });
  const axes = {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' as const }, light: { scheme: 'light' as const } } },
    density: { default: 'comfortable', values: { compact: {}, comfortable: {}, roomy: {} } },
    contrast: { default: 'normal', values: { normal: {}, high: {} } },
  };
  const pins = {
    gap: { by: 'density', compact: dim('2px'), comfortable: dim('4px'), roomy: dim('8px') },
    surface: { by: 'mode', dark: col('#000000'), light: col('#ffffff') },
    'focus-ring': { by: 'contrast', normal: col('{surface}'), high: col('#ff0000') },
    edge: {
      by: 'density',
      compact: { by: 'mode', dark: dim('1px'), light: dim('2px') },
      comfortable: { by: 'mode', dark: dim('3px'), light: dim('4px') },
      roomy: { by: 'contrast', normal: { by: 'mode', dark: dim('5px'), light: dim('6px') }, high: dim('7px') },
    },
    pad: { by: 'mode', dark: { by: 'density', compact: dim('11px'), comfortable: dim('12px'), roomy: dim('13px') }, light: dim('15px') },
    'radius-md': { by: 'density', roomy: dim('20px') },
  } as const;

  for (const [label, base] of [['no parent', null], ['the built-in parent', weaselTheme]] as const) {
    it(`round-trips every axis losslessly, over ${label}`, () => {
      const t = defineTheme({ name: 'three', extends: base, axes, pins });
      const back = loadDTCG({ ...JSON.parse(JSON.stringify(toDTCG(t))), extends: base });
      const selections = enumerateSelections(themeAxes(t));
      expect(selections).toHaveLength(12);
      for (const sel of selections) expect(resolveTheme(back, sel), JSON.stringify(sel)).toEqual(resolveTheme(t, sel));
      expect(themeAxes(back)).toEqual(themeAxes(t));
    });
  }

  it('round-trips the built-in theme at every selection', () => {
    const back = loadDTCG({ ...toDTCG(weaselTheme), extends: null });
    for (const sel of enumerateSelections(themeAxes(weaselTheme))) expect(resolveTheme(back, sel)).toEqual(resolveTheme(weaselTheme, sel));
  });

  it('keeps the plain groups at every non-mode axis’s default, so a tool ignoring the extension reads them', () => {
    const doc = toDTCG(defineTheme({ name: 'three', extends: null, axes, pins }));
    expect(valueOf(doc.primitives, 'dimension', 'gap')).toBe('4px');
    expect(valueOf(doc.modes.light, 'dimension', 'edge')).toBe('4px');
    expect(valueOf(doc.modes.dark, 'dimension', 'pad')).toBe('12px');
    expect(valueOf(doc.primitives, 'color', 'focus-ring')).toBe('{color.surface}');
    expect(valueOf(doc.primitives, 'dimension', 'radius-md')).toBeUndefined();
  });

  it('writes an override per axis value a token varies by, not per combination of axes', () => {
    const t = defineTheme({
      name: 'sparse',
      extends: null,
      axes,
      pins: { gap: pins.gap, 'focus-ring': pins['focus-ring'], surface: pins.surface },
    });
    const ext = toDTCG(t).$extensions?.[AXES_EXT];
    expect(Object.keys(ext?.overrides ?? {}).sort()).toEqual(['contrast=high', 'density=compact', 'density=roomy']);
    expect(valueOf(ext!.overrides['contrast=high'].primitives, 'color', 'focus-ring')).toBe('#ff0000');
  });

  it('writes a theme varying by mode alone with its axes and no overrides', () => {
    const t = defineTheme({ name: 'm', extends: null, axes: { mode: axes.mode }, pins: { surface: pins.surface } });
    expect(toDTCG(t).$extensions?.[AXES_EXT]).toEqual({ axes: { mode: axes.mode }, varies: {}, overrides: {} });
  });
});
