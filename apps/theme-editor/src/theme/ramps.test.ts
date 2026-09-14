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
    expect(writeParam(entry, 'chroma.darkBias', 0.5).chroma).toEqual({ darkBias: 0.5 });
    expect(readParam(writeParam(entry, 'curve', 0.4), 'curve')).toBe(0.4);
  });
});
