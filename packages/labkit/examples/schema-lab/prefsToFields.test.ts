import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { decodePrefValue, prefToField } from './prefsToFields';

const angle = (extra: Record<string, unknown>): PrefLeaf =>
  ({ kind: 'number', name: 'Angle', description: '', default: 0, ...extra }) as PrefLeaf;

describe('prefToField on a number shown in a unit', () => {
  it("converts the step as a distance in the unit, as the leaf's bounds are converted", () => {
    const field = prefToField('pose.rotation', angle({ step: Math.PI / 180, unit: { scale: Math.PI / 180 } }));
    expect(field).toMatchObject({ type: 'number' });
    expect((field as { step: number }).step).toBeCloseTo(1, 9);
  });

  it('keeps the lower end the lower one under a unit that decreases', () => {
    const field = prefToField('data.depth', angle({ min: 0, max: 10, unit: { scale: -1 } }));
    expect(field).toMatchObject({ type: 'slider', min: -10 });
    expect((field as { max: number }).max).toBeCloseTo(0, 9);
  });
});

describe('decodePrefValue', () => {
  it("stores a boolean through its leaf's encoding", () => {
    const leaf = {
      kind: 'boolean', name: 'Italic', description: '', default: false,
      encoding: { read: (stored: unknown) => stored === 'italic', write: (on: boolean) => (on ? 'italic' : undefined) },
    } as PrefLeaf;
    expect(decodePrefValue(leaf, true)).toBe('italic');
    expect(decodePrefValue(leaf, false)).toBeUndefined();
  });
});
