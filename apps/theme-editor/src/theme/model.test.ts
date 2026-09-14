import { resolveTheme, type ThemeDefinition } from '@weasel-js/theme';
import { derive } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { child, lookupOf, weasel } from './fixtures';
import { adoptGenerated, countTokens, removePin, ruleSummary, runtimeTheme, setPin, stepOf } from './model';

const lookup = lookupOf(child);

describe('countTokens', () => {
  it("counts weasel's own tokens and the pins over generated ones", () => {
    const counts = countTokens(weasel, derive(weasel, { mode: 'dark' }, lookup));
    expect(counts).toMatchObject({ overridden: 23, total: 100 });
    expect(counts.layers).toEqual({
      seeds: { count: 0, pinned: 0 },
      ramps: { count: 23, pinned: 23 },
      scales: { count: 0, pinned: 0 },
      semantics: { count: 11, pinned: 0 },
      components: { count: 0, pinned: 0 },
      pins: { count: 89, pinned: 23 },
    });
  });

  it("counts a child's own tokens only", () => {
    const counts = countTokens(child, derive(child, { mode: 'dark' }, lookup));
    expect(counts).toMatchObject({ overridden: 1, total: 2 });
    expect(counts.layers.semantics).toEqual({ count: 1, pinned: 1 });
    expect(counts.layers.pins).toEqual({ count: 2, pinned: 1 });
  });

  it('counts a pin only at a selection where it applies', () => {
    const def = { ...weasel, pins: { ...weasel.pins, gap: { by: 'mode', dark: { value: '4px', type: 'dimension' } } } } as ThemeDefinition;
    const at = (mode: string) => countTokens(def, derive(def, { mode }, lookup)).layers.pins.count;
    expect(at('dark')).toBe(at('light') + 1);
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
    expect(countTokens(adopted, result).overridden).toBe(13);
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
