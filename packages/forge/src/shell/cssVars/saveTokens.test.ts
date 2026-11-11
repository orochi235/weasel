import type { ThemeDefinition } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { derive } from '@weasel-js/theme/engine';
import { applyTokenEdits, canSave } from './saveTokens';

const theme: ThemeDefinition = {
  name: 't',
  axes: {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
    density: { default: 'comfortable', values: { compact: {}, comfortable: {} } },
  },
  ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16] } },
  scales: { space: { steps: ['1', '2'], base: { by: 'density', compact: 2, comfortable: 3 }, step: 2 } },
  semantics: {
    surface: { by: 'mode', dark: { ref: 'gray-900', type: 'color' }, light: { ref: 'gray-50', type: 'color' } },
    warn: { value: '#ff0000', type: 'color', description: 'Warnings.' },
    text: { ramp: 'gray', contrast: { min: 4.5, against: ['surface'] }, type: 'color' },
    scrim: { ref: 'gray-900', alpha: 0.5, type: 'color' },
    edge: { ref: 'surface', type: 'color' },
  },
  components: {
    'panel-border-width': { value: '1px', type: 'dimension' },
    'panel-surface': { value: '{surface}', type: 'color' },
    'row-h': { by: 'density', compact: '20px', comfortable: '24px' },
  },
  pins: {
    'gray-50': { value: '#f5f5f6', type: 'color' },
    accent: { by: 'mode', dark: { value: '#5b63c9', type: 'color' }, light: { value: '#4338ca', type: 'color' } },
    line: { value: '#ffffff', type: 'color', alpha: 0.2 },
    ring: '{accent}',
    edge: { by: 'mode', light: '#eeeeee' },
  },
};

const dark = { mode: 'dark', density: 'comfortable' };

const saved = (result: ReturnType<typeof applyTokenEdits>): ThemeDefinition => {
  if (!result.ok) throw new Error(result.message);
  return result.definition;
};
const refusal = (result: ReturnType<typeof applyTokenEdits>): string => (result.ok ? '' : result.message);

describe('applyTokenEdits', () => {
  it('writes a pin, a component and a literal semantic where each is written out, keeping what sits beside the value', () => {
    const next = saved(
      applyTokenEdits(theme, { 'gray-50': '#eeeeee', 'panel-border-width': '2px', warn: '#ee0000' }, dark),
    );
    expect(next.pins?.['gray-50']).toEqual({ value: '#eeeeee', type: 'color' });
    expect(next.components?.['panel-border-width']).toEqual({ value: '2px', type: 'dimension' });
    expect(next.semantics?.warn).toEqual({ value: '#ee0000', type: 'color', description: 'Warnings.' });
  });

  it('writes only the branch the selection reads, a bare value included', () => {
    const next = saved(applyTokenEdits(theme, { accent: '#000001', 'row-h': '26px' }, dark));
    expect(next.pins?.accent).toEqual({
      by: 'mode',
      dark: { value: '#000001', type: 'color' },
      light: { value: '#4338ca', type: 'color' },
    });
    expect(next.components?.['row-h']).toEqual({ by: 'density', compact: '20px', comfortable: '26px' });
  });

  it('leaves the definition it was given alone', () => {
    const before = JSON.stringify(theme);
    applyTokenEdits(theme, { 'gray-50': '#eeeeee' }, dark);
    expect(JSON.stringify(theme)).toBe(before);
  });

  it('pins a token the theme derives over only the axis values its value varies on, leaving the derivation', () => {
    const edits = {
      'panel-surface': '#111111',
      surface: '#222222',
      text: '#333333',
      scrim: '#444444',
      line: '#555555',
      'gray-900': '#666666',
      'space-2': '9px',
    };
    const next = saved(applyTokenEdits(theme, edits, dark));
    expect(next.pins?.['panel-surface']).toEqual({ by: 'mode', dark: '#111111' });
    expect(next.pins?.surface).toEqual({ by: 'mode', dark: '#222222' });
    expect(next.pins?.text).toEqual({ by: 'mode', dark: '#333333' });
    expect(next.pins?.scrim).toBe('#444444');
    expect(next.pins?.line).toEqual({ value: '#555555', type: 'color' });
    expect(next.pins?.['gray-900']).toBe('#666666');
    expect(next.pins?.['space-2']).toEqual({ by: 'density', comfortable: '9px' });
    for (const layer of ['ramps', 'scales', 'semantics', 'components'] as const) expect(next[layer]).toEqual(theme[layer]);

    const at = (selection: Record<string, string>) => derive(next, selection).tokens;
    expect(at(dark)['panel-surface']?.value).toBe('#111111');
    expect(at({ mode: 'light', density: 'comfortable' })['panel-surface']?.value).toBe('{surface}');
    expect(at({ mode: 'light', density: 'comfortable' }).surface?.value).toEqual(derive(theme, { mode: 'light' }).tokens.surface?.value);
    expect(at({ mode: 'dark', density: 'compact' })['space-2']?.value).toBe(derive(theme, { mode: 'dark', density: 'compact' }).tokens['space-2']?.value);
    expect(at(dark)['gray-50']?.value).toBe('#f5f5f6');
  });

  it('adds the branch a pin leaves out, and splits a derived pin so its other branches keep deriving', () => {
    const next = saved(applyTokenEdits(theme, { edge: '#111111', ring: '#222222' }, dark));
    expect(next.pins?.edge).toEqual({ by: 'mode', light: '#eeeeee', dark: '#111111' });
    expect(next.pins?.ring).toEqual({ by: 'mode', light: '{accent}', dark: '#222222' });
    expect(next.semantics?.edge).toEqual(theme.semantics?.edge);
  });

  it('pins a scale step over the scale edit it was changed after', () => {
    const scaled = { ...theme, scales: { space: { ...theme.scales!.space!, step: 4 } } };
    const next = saved(applyTokenEdits(scaled, { 'space-2': '11px' }, dark));
    expect(next.scales?.space?.step).toBe(4);
    expect(derive(next, dark).tokens['space-2']?.value).toBe('11px');
    expect(derive(next, dark).tokens['space-1']?.value).toBe(derive(scaled, dark).tokens['space-1']?.value);
  });

  it('refuses a token the theme does not define, and writes nothing', () => {
    expect(refusal(applyTokenEdits(theme, { 'gray-50': '#eeeeee', nowhere: '1px' }, dark))).toMatch(/nowhere/);
  });

  it('refuses a branched value when the selection does not say which branch', () => {
    expect(refusal(applyTokenEdits(theme, { accent: '#000001' }, { density: 'comfortable' }))).toMatch(/differs by mode/);
    expect(refusal(applyTokenEdits(theme, { 'panel-surface': '#000001' }, { density: 'comfortable' }))).toMatch(/pins\.panel-surface differs by mode/);
  });
});

describe('canSave', () => {
  it('says whether a save has a place for a token', () => {
    expect(canSave(theme, 'gray-50', dark)).toBe(true);
    expect(canSave(theme, 'space-2', dark)).toBe(true);
    expect(canSave(theme, 'accent', { density: 'comfortable' })).toBe(false);
    expect(canSave(theme, 'nowhere', dark)).toBe(false);
  });
});
