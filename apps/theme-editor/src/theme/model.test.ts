import { resolveTheme, type ThemeDefinition } from '@weasel-js/theme';
import { derive, mergeChain } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { child, lookupOf, weasel } from './fixtures';
import { layerEntries } from './entries';
import { adoptGenerated, clearAt, countTokens, removePin, ruleSummary, runtimeTheme, setPin, setRamp, stepOf, writeAt } from './model';

const lookup = lookupOf(child);

describe('countTokens', () => {
  it("counts weasel's own tokens and the pins over generated ones", () => {
    const counts = countTokens(weasel, derive(weasel, { mode: 'dark' }, lookup), weasel, { mode: 'dark', density: 'comfortable' });
    expect(counts).toMatchObject({ overridden: 23, total: 182 });
    expect(counts.layers).toEqual({
      seeds: { count: 1, pinned: 0 },
      ramps: { count: 26, pinned: 23 },
      scales: { count: 14, pinned: 0 },
      semantics: { count: 22, pinned: 0 },
      components: { count: 33, pinned: 0 },
      pins: { count: 110, pinned: 23 },
    });
  });

  it("totals a child's own tokens, and counts in each layer what its page lists, the inherited included", () => {
    const merged = mergeChain(child, lookup);
    const result = derive(child, { mode: 'dark' }, lookup);
    const counts = countTokens(child, result, merged, { mode: 'dark' });
    expect(counts).toMatchObject({ overridden: 1, total: 2 });
    const weaselCounts = countTokens(weasel, derive(weasel, { mode: 'dark' }, lookup), weasel, { mode: 'dark' }).layers;
    expect(counts.layers.components).toEqual(weaselCounts.components);
    expect(counts.layers.components.count).toBe(layerEntries('components', child, result, { mode: 'dark' }, merged).length);
    expect(counts.layers.semantics).toEqual({ count: weaselCounts.semantics.count, pinned: 1 });
    expect(counts.layers.pins).toEqual({ count: 2, pinned: 1 });
  });

  it('counts only the seeds with a value at the selection, as the seeds page lists them', () => {
    const def = { ...weasel, seeds: { ...weasel.seeds, gap: { by: 'mode', light: 4 } } } as ThemeDefinition;
    const at = (mode: string) => countTokens(def, derive(def, { mode }, lookup), def, { mode }).layers.seeds.count;
    expect(at('light')).toBe(at('dark') + 1);
  });

  it('counts a pin only at a selection where it applies', () => {
    const def = { ...weasel, pins: { ...weasel.pins, gap: { by: 'mode', dark: { value: '4px', type: 'dimension' } } } } as ThemeDefinition;
    const at = (mode: string) => countTokens(def, derive(def, { mode }, lookup), def, { mode }).layers.pins.count;
    expect(at('dark')).toBe(at('light') + 1);
  });
});

describe('names Object.prototype holds', () => {
  it('counts no token for a pin named constructor that has no value at this selection', () => {
    const def = { name: 'p', pins: { constructor: { by: 'mode', light: { value: '#ffffff', type: 'color' } } } } as ThemeDefinition;
    const counts = countTokens(def, derive(def, { mode: 'dark' }), def, { mode: 'dark' });
    expect(counts).toMatchObject({ overridden: 0, total: 0 });
  });

  it('copies in an inherited ramp named constructor before editing it', () => {
    const gray = { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16] } as const;
    const base: ThemeDefinition = { name: 'base', ramps: { constructor: gray } };
    const kid: ThemeDefinition = { name: 'kid', extends: 'base', ramps: {} };
    const edited = setRamp(kid, (n) => (n === 'base' ? base : undefined), 'constructor', (e) => ({ ...e, curve: 0.5 }) as typeof e);
    expect(edited.ramps!.constructor).toEqual({ ...gray, curve: 0.5 });
  });
});

describe('pins', () => {
  it('replaces a pin where it stands and appends a new one', () => {
    const keys = Object.keys(weasel.pins!);
    expect(Object.keys(setPin(weasel, 'gray-800', '#000000').pins!)).toEqual(keys);
    expect(Object.keys(setPin(weasel, 'brand-new', '#000000').pins!)).toEqual([...keys, 'brand-new']);
  });

  it('removes a pin, and returns the definition untouched when there is none', () => {
    expect(removePin(weasel, 'gray-800').pins).not.toHaveProperty('gray-800');
    expect(removePin(weasel, 'not-pinned')).toBe(weasel);
  });

  it('adopting a generated ramp drops its step pins so the generator shows', () => {
    const adopted = adoptGenerated(weasel, lookup, 'gray');
    expect(Object.keys(adopted.pins!).filter((n) => n.startsWith('gray-'))).toEqual([]);
    const result = derive(adopted, { mode: 'dark' }, lookup);
    expect(result.tokens['gray-800'].value).toBe('#1a1c21');
    expect(countTokens(adopted, result, adopted, { mode: 'dark' }).overridden).toBe(13);
  });
});

describe('runtimeTheme', () => {
  it('bakes the draft and the chain above it under the given name', () => {
    const theme = runtimeTheme(child, lookup, 'draft-child');
    expect(theme.name).toBe('draft-child');
    expect(theme.extends?.name).toBe('weasel');
    expect(resolveTheme(theme, { mode: 'dark' })['--wzl-surface']).toBe('#0a0a14');
    expect(resolveTheme(theme, { mode: 'light' })['--wzl-radius-md']).toBe('6px');
  });
});

describe('ruleSummary', () => {
  it('reads each rule kind in short form', () => {
    expect(ruleSummary(weasel.semantics!.surface)).toBe('by mode: gray-800 / gray-50');
    expect(ruleSummary({ ref: 'fg', alpha: 0.1 })).toBe('fg at 10%');
    expect(ruleSummary({ ramp: 'gray', contrast: { min: 3, against: ['surface', 'surface-raised'] } })).toBe(
      'gray ≥ 3:1 against surface, surface-raised',
    );
    expect(ruleSummary({ from: 'surface', offset: 1, dir: 'darker' })).toBe('surface 1 darker');
    expect(ruleSummary({ ramp: 'gray', step: '800' })).toBe('gray-800');
    expect(ruleSummary({ ramp: 'gray', step: { by: 'mode', dark: '800', light: '50' } })).toBe('gray by mode');
    expect(ruleSummary({ value: 'rgba(0, 0, 0, 0.6)' })).toBe('rgba(0, 0, 0, 0.6)');
  });
});

describe('stepOf', () => {
  it('follows references to the ramp step they end on', () => {
    expect(stepOf('surface', derive(weasel, { mode: 'light' }, lookup))).toBe('gray-50');
    expect(stepOf('shadow', derive(weasel, { mode: 'dark' }, lookup))).toBeUndefined();
  });
});

describe('writeAt and clearAt', () => {
  const byDensity = { by: 'density', compact: 4, comfy: 6 };

  it('refuse a variation whose axis the selection does not choose, where leafAt reads no value', () => {
    expect(() => writeAt(byDensity, { mode: 'dark' }, 8)).toThrow(/no density value is chosen/);
    expect(() => clearAt(byDensity, { mode: 'dark' })).toThrow(/no density value is chosen/);
  });

  it('touch only the branch the selection chooses', () => {
    expect(writeAt(byDensity, { density: 'compact' }, 8)).toEqual({ by: 'density', compact: 8, comfy: 6 });
    expect(clearAt(byDensity, { density: 'compact' })).toEqual({ by: 'density', comfy: 6 });
    expect(clearAt({ by: 'density', comfy: 6 }, { density: 'comfy' })).toBeUndefined();
  });

  it('clear nothing, returning the variation itself, where it holds no leaf at the selection', () => {
    const nested = { by: 'mode', dark: { by: 'density', compact: 4 } };
    expect(clearAt(nested, { mode: 'dark', density: 'comfy' })).toBe(nested);
    expect(clearAt(nested, { mode: 'light', density: 'compact' })).toBe(nested);
  });
});
