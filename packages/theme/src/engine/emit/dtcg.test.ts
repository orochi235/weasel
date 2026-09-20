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

  // DTCG carries one variant dimension, so a second axis cannot be written. Exporting
  // its default branch loses the others; refusing the export loses the whole document.
  it('writes a non-mode axis at its default branch and drops the rest', () => {
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
});
