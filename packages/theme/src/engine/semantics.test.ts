import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { derive } from './derive';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const SHIPPING = ['#f5f5f6', '#e6e7e9', '#c9cbcf', '#9ea1a8', '#6f737b', '#4d5058', '#383b42', '#25272c', '#181a1e', '#0e0f12'];
const by = (dark: string, light: string) => ({ by: 'mode', dark, light });

const W: ThemeDefinition = {
  name: 'w',
  axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
  ramps: { gray: { kind: 'lightness', steps: STEPS, lightness: [0.973, 0.163], curve: 0.41, hue: 266, chroma: { peak: 0.0116, darkBias: 0.84 } } },
  semantics: {
    // Declared before the surfaces it reads, on purpose.
    'border-strong': { ramp: 'gray', contrast: { min: 3, against: ['surface', 'surface-raised', 'surface-sunken'] } },
    surface: { ramp: 'gray', step: by('800', '50') },
    'surface-raised': { ramp: 'gray', step: by('700', '100') },
    'surface-sunken': { ramp: 'gray', step: by('900', '200') },
    'fg-muted': { from: 'surface', offset: 5, dir: 'away' },
    deeper: { from: 'surface', offset: 1, dir: 'darker' },
    paler: { from: 'surface', offset: 1, dir: 'lighter' },
    fg: { ramp: 'gray', step: by('100', '900'), check: { contrast: 4.5, against: ['surface'] } },
    border: { ramp: 'gray', step: by('700', '200'), check: { contrast: 3, against: ['surface'] } },
  },
  pins: Object.fromEntries(STEPS.map((s, i) => [`gray-${s}`, SHIPPING[i]])),
};

const at = (mode: string) => derive(W, { mode });

describe('contrast rule', () => {
  it('walks away from the surfaces to the first step that clears every one', () => {
    expect(at('dark').tokens['border-strong'].value).toBe('{gray-400}');
    expect(at('light').tokens['border-strong'].value).toBe('{gray-500}');
  });

  it('reports when no step clears, and still yields a value', () => {
    const { tokens, issues } = derive(
      { ...W, semantics: { ...W.semantics, 'border-strong': { ramp: 'gray', contrast: { min: 30, against: ['surface'] } } } },
      { mode: 'dark' },
    );
    expect(issues).toContainEqual({ kind: 'contrast-unmet', token: 'border-strong', min: 30, against: ['surface'] });
    expect(tokens['border-strong'].value).toMatch(/^\{gray-\d+\}$/);
  });
});

describe('offset rule', () => {
  it('goes away from the reference toward the far end, so it flips with the mode', () => {
    expect(at('dark').tokens['fg-muted'].value).toBe('{gray-300}');
    expect(at('light').tokens['fg-muted'].value).toBe('{gray-500}');
  });

  it('reads darker and lighter from the ramp colors, not the step order', () => {
    expect(at('dark').tokens.deeper.value).toBe('{gray-900}');
    expect(at('dark').tokens.paler.value).toBe('{gray-700}');
  });
});

describe('check', () => {
  it('audits without changing the value', () => {
    const { tokens, issues } = at('dark');
    expect(tokens.border.value).toBe('{gray-700}');
    expect(issues.flatMap((i) => (i.kind === 'check-failed' ? [i.token] : []))).toEqual(['border']);
  });

  const failedChecks = (pins: Record<string, string>) =>
    derive({ ...W, pins: { ...W.pins, ...pins } }, { mode: 'dark' }).issues.flatMap((i) => (i.kind === 'check-failed' ? [i.token] : []));

  it('audits the pinned value when the rule passes and the pin fails', () => {
    expect(failedChecks({ fg: '#25272c' })).toEqual(['fg', 'border']);
  });

  it('reports nothing when the rule fails and the pin passes', () => {
    expect(failedChecks({ border: '#9ea1a8' })).toEqual([]);
  });
});

describe('alpha pins', () => {
  it('are not solid colors to measure contrast against', () => {
    const { issues } = derive({ ...W, pins: { ...W.pins, surface: { value: '#181a1e', alpha: 0.5 } } }, { mode: 'dark' });
    expect(issues).toContainEqual({ kind: 'invalid', path: 'semantics.border-strong', message: 'contrast needs solid colors on both sides' });
  });
});
