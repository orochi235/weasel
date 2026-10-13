import type { ThemeDefinition } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { applyTokenEdits, writtenOut } from './saveTokens';

const theme: ThemeDefinition = {
  name: 't',
  axes: {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
    density: { default: 'comfortable', values: { compact: {}, comfortable: {} } },
  },
  ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16] } },
  scales: { space: { steps: ['1', '2'], base: 2, step: 2 } },
  semantics: {
    surface: { by: 'mode', dark: { ref: 'gray-900', type: 'color' }, light: { ref: 'gray-50', type: 'color' } },
    warn: { value: '#ff0000', type: 'color', description: 'Warnings.' },
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

  it('refuses a token another token, a rule, a ramp or a scale derives, and writes nothing', () => {
    expect(refusal(applyTokenEdits(theme, { 'panel-surface': '#111111' }, dark))).toMatch(/components\.panel-surface .*\{surface\}/);
    expect(refusal(applyTokenEdits(theme, { surface: '#111111' }, dark))).toMatch(/semantics\.surface\.dark/);
    expect(refusal(applyTokenEdits(theme, { line: '#111111' }, dark))).toMatch(/pins\.line .*alpha/);
    expect(refusal(applyTokenEdits(theme, { 'gray-900': '#111111' }, dark))).toMatch(/ramps\.gray/);
    expect(refusal(applyTokenEdits(theme, { 'space-2': '5px' }, dark))).toMatch(/scales\.space/);
    expect(refusal(applyTokenEdits(theme, { 'gray-50': '#eeeeee', nowhere: '1px' }, dark))).toMatch(/nowhere/);
  });

  it('refuses a branched value when the selection does not say which branch', () => {
    expect(refusal(applyTokenEdits(theme, { accent: '#000001' }, { density: 'comfortable' }))).toMatch(/differs by mode/);
  });
});

describe('writtenOut', () => {
  it('says whether a save has a place for a token', () => {
    expect(writtenOut(theme, 'gray-50', dark)).toBe(true);
    expect(writtenOut(theme, 'accent', { density: 'comfortable' })).toBe(false);
    expect(writtenOut(theme, 'space-2', dark)).toBe(false);
  });
});
