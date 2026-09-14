import { derive, type LightnessRampDef } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { deriveDraft } from './draft';
import { lookupOf, weasel } from './fixtures';
import { rampView, readParam, writeParam } from './ramps';

describe('rampView', () => {
  const d = deriveDraft(weasel, lookupOf(), {});
  const gray = rampView('gray', d.merged.ramps!.gray, d.primary.result, d.primary.resolved);

  it('lists each step with its final color, and the generated one under a pin', () => {
    expect(gray.steps.map((s) => s.step)).toEqual(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']);
    expect(gray.steps.every((s) => s.pinned)).toBe(true);
    expect(gray.steps.find((s) => s.step === '800')?.generated).toBe('#1a1c21');
  });

  it('measures the spread of the lightness steps, pinned and generated', () => {
    expect(gray.dL).toHaveLength(9);
    expect(gray.spread).toBeCloseTo(3.609, 2);
    expect(gray.generatedSpread).toBeCloseTo(1.753, 2);
  });
});

describe('writeParam', () => {
  const entry = { kind: 'lightness' as const, steps: ['a', 'b'], lightness: [0.9, 0.2] as [number, number] };

  it('writes into the lightness pair and into chroma, creating it', () => {
    expect(writeParam(entry, 'lightness.1', 0.3).lightness).toEqual([0.9, 0.3]);
    expect(writeParam(entry, 'chroma.darkBias', 0.5).chroma).toEqual({ peak: 0, darkBias: 0.5 });
    expect(readParam(writeParam(entry, 'curve', 0.4), 'curve')).toBe(0.4);
  });

  it('keeps a ramp deriving when a bias creates its chroma', () => {
    const edited = { ...weasel, ramps: { ...weasel.ramps!, accent: writeParam(weasel.ramps!.accent as LightnessRampDef, 'chroma.lightBias', 0.5) } };
    const result = derive(edited, { mode: 'dark' });
    expect(result.issues).toEqual([]);
    expect(result.provenance['accent-soft'].pinned).toBe(true);
  });
});

describe('a parameter that varies as a whole', () => {
  const varying = {
    kind: 'lightness',
    steps: ['a', 'b'],
    lightness: { by: 'mode', dark: [0.3, 0.5], light: [0.8, 0.6] },
    chroma: { by: 'mode', dark: { peak: 0.1 }, light: { peak: 0.05 } },
  } as unknown as LightnessRampDef;

  it('reads as its by object', () => {
    expect(readParam(varying, 'lightness.0')).toBe(varying.lightness);
    expect(readParam(varying, 'chroma.peak')).toBe(varying.chroma);
  });

  it('is not written into', () => {
    expect(() => writeParam(varying, 'lightness.0', 0.4)).toThrow();
    expect(() => writeParam(varying, 'chroma.peak', 0.2)).toThrow();
  });
});
