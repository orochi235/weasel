import { describe, expect, it } from 'vitest';
import { enumerateSelections, fullSelection, isByAxis, pick, selectionKey, type AxisDefs } from './axes';

const AXES: AxisDefs = {
  mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
  density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
};

describe('axes', () => {
  it('fills missing and unknown axis values with defaults', () => {
    expect(fullSelection(AXES, { mode: 'light', density: 'nope' })).toEqual({ mode: 'light', density: 'comfortable' });
  });

  it('enumerates the cross product in declaration order', () => {
    expect(enumerateSelections(AXES).map((s) => selectionKey(AXES, s))).toEqual([
      'mode=dark,density=comfortable',
      'mode=dark,density=compact',
      'mode=light,density=comfortable',
      'mode=light,density=compact',
    ]);
  });

  it('recognizes a by object and nothing else', () => {
    expect(isByAxis({ by: 'mode', dark: 1, light: 2 })).toBe(true);
    expect(isByAxis({ value: '#fff', type: 'color' })).toBe(false);
    expect(isByAxis(['a'])).toBe(false);
  });

  it('picks through nested by objects', () => {
    const v = { by: 'mode', dark: { by: 'density', comfortable: 4, compact: 3 }, light: 5 };
    expect(pick(v, fullSelection(AXES, { density: 'compact' }))).toEqual({ ok: true, value: 3 });
    expect(pick(v, fullSelection(AXES, { mode: 'light' }))).toEqual({ ok: true, value: 5 });
  });

  it('reports a missing value instead of throwing', () => {
    expect(pick({ by: 'mode', dark: 1 }, fullSelection(AXES, { mode: 'light' }))).toEqual({
      ok: false, axis: 'mode', value: 'light',
    });
  });
});
