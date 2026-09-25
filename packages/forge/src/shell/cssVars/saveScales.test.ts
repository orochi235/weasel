import { THEME_SOURCES, type ThemeDefinition } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { applyScaleEdits, selectionFor } from './saveScales';

const weasel = THEME_SOURCES.weasel as ThemeDefinition;
const fontFactors = [0.66, 0.77, 0.85, 1, 1.23, 1.54];

const saved = (result: ReturnType<typeof applyScaleEdits>): ThemeDefinition => {
  if (!result.ok) throw new Error(result.message);
  return result.definition;
};

describe('selectionFor', () => {
  it('reads each axis from the global named for it, defaulting an axis no global names', () => {
    expect(selectionFor(weasel.axes ?? {}, { density: 'roomy', mode: 'light' })).toEqual({ mode: 'light', density: 'roomy' });
    expect(selectionFor(weasel.axes ?? {}, {})).toEqual({ mode: 'dark', density: 'comfortable' });
  });

  it('leaves out an axis whose global holds a value the axis does not offer', () => {
    expect(selectionFor(weasel.axes ?? {}, { mode: 'auto', density: 'compact' })).toEqual({ density: 'compact' });
  });
});

describe('applyScaleEdits', () => {
  it('writes a referenced base into the seed, for the selected density only', () => {
    const next = saved(
      applyScaleEdits(weasel, { 'font-size': { base: 14, rule: { kind: 'factors', factors: fontFactors } } }, { density: 'comfortable' }),
    );
    expect(next.scales?.['font-size']?.base).toBe('{seeds.ui-base}');
    expect(next.seeds?.['ui-base']).toEqual({ by: 'density', compact: 11, comfortable: 14, roomy: 15 });
    expect({ ...next, seeds: weasel.seeds }).toEqual(weasel);
  });

  it('leaves the definition it was given alone', () => {
    const before = JSON.stringify(weasel);
    applyScaleEdits(weasel, { 'font-size': { base: 20, rule: { kind: 'factors', factors: fontFactors } } }, { density: 'roomy' });
    expect(JSON.stringify(weasel)).toBe(before);
  });

  it('writes a literal param in place, and a changed factor into its position', () => {
    const next = saved(
      applyScaleEdits(
        weasel,
        {
          space: { base: 3, rule: { kind: 'step', step: 4 } },
          'font-size': { base: 13, rule: { kind: 'factors', factors: [0.7, 0.77, 0.85, 1, 1.23, 1.54] } },
        },
        { density: 'comfortable' },
      ),
    );
    expect(next.scales?.space).toMatchObject({ base: 3, step: 4 });
    expect(next.scales?.['font-size']?.factors).toEqual([0.7, 0.77, 0.85, 1, 1.23, 1.54]);
    expect(next.seeds).toEqual(weasel.seeds);
  });

  it('refuses a referenced param when the axis it varies by is not known', () => {
    const result = applyScaleEdits(weasel, { 'font-size': { base: 14, rule: { kind: 'factors', factors: fontFactors } } }, {});
    expect(result).toEqual({ ok: false, message: expect.stringContaining('seeds.ui-base differs by density') });
  });

  it('writes into the selected branch of a param that varies by axis', () => {
    const def: ThemeDefinition = {
      name: 't',
      axes: { density: { default: 'a', values: { a: {}, b: {} } } },
      scales: { gap: { steps: ['1', '2'], base: 2, ratio: { by: 'density', a: 2, b: 3 } } },
    };
    const next = saved(applyScaleEdits(def, { gap: { base: 2, rule: { kind: 'ratio', ratio: 4 } } }, { density: 'b' }));
    expect(next.scales?.gap?.ratio).toEqual({ by: 'density', a: 2, b: 4 });
  });

  it('switches a literal rule to another kind in the same position', () => {
    const next = saved(applyScaleEdits(weasel, { space: { base: 2, rule: { kind: 'ratio', ratio: 1.5 } } }, {}));
    expect(Object.keys(next.scales?.space ?? {})).toEqual(['steps', 'base', 'ratio', 'description']);
    expect(next.scales?.space).toMatchObject({ base: 2, ratio: 1.5 });
    expect(next.scales?.space?.step).toBeUndefined();
  });

  it('refuses to switch the kind of a rule that is not a plain literal', () => {
    const def: ThemeDefinition = {
      name: 't',
      seeds: { r: 2 },
      scales: { gap: { steps: ['1', '2'], base: 2, ratio: '{seeds.r}' } },
    };
    const result = applyScaleEdits(def, { gap: { base: 2, rule: { kind: 'step', step: 1 } } }, {});
    expect(result).toEqual({ ok: false, message: expect.stringContaining('would lose its ratio') });
  });

  it('refuses two params that share a seed but were edited apart', () => {
    const def: ThemeDefinition = {
      name: 't',
      seeds: { b: 4 },
      scales: {
        a: { steps: ['1'], base: '{seeds.b}', step: 1 },
        c: { steps: ['1'], base: '{seeds.b}', step: 1 },
      },
    };
    const result = applyScaleEdits(def, { a: { base: 5, rule: { kind: 'step', step: 1 } }, c: { base: 6, rule: { kind: 'step', step: 1 } } }, {});
    expect(result).toEqual({ ok: false, message: expect.stringContaining('seeds.b would need to be both 5 and 6') });
  });

  it('refuses a seed the theme inherits', () => {
    const def: ThemeDefinition = { name: 't', extends: 'weasel', scales: { a: { steps: ['1'], base: '{seeds.ui-base}', step: 1 } } };
    const result = applyScaleEdits(def, { a: { base: 5, rule: { kind: 'step', step: 1 } } }, {});
    expect(result).toEqual({ ok: false, message: expect.stringContaining('inherits') });
  });
});
