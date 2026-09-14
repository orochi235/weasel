import { describe, expect, it } from 'vitest';
import { enumerateSelections, fullSelection, isByAxis, pick, selectionKey, type AxisDefs } from './axes';
import type { LightnessRampDef, ThemeDefinition } from './definition';

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

  it('accepts a by nested inside a by in a typed ramp literal', () => {
    const ramp: LightnessRampDef = {
      kind: 'lightness',
      steps: ['50', '100'],
      lightness: [0.9, 0.2],
      chroma: { peak: { by: 'mode', dark: { by: 'density', comfortable: 0.01, compact: 0.02 }, light: 0.03 } },
    };
    expect(pick(ramp.chroma!.peak, fullSelection(AXES, { mode: 'dark', density: 'compact' }))).toEqual({
      ok: true, value: 0.02,
    });
  });

  it('accepts a by nested inside a by in a typed theme definition', () => {
    const def: ThemeDefinition = {
      name: 'test',
      semantics: {
        fg: {
          by: 'mode',
          dark: {
            by: 'density',
            comfortable: { ramp: 'gray', step: '900' },
            compact: { ramp: 'gray', step: '800' },
          },
          light: { ramp: 'gray', step: '100' },
        },
      },
    };
    expect(pick(def.semantics!.fg, fullSelection(AXES, { mode: 'dark', density: 'compact' }))).toEqual({
      ok: true, value: { ramp: 'gray', step: '800' },
    });
  });
});
