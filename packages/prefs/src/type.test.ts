import { describe, expect, it } from 'vitest';
import { repairPrefValue } from './repair';
import type { PrefLeaf } from './schema';
import { prefType } from './type';

const Stop = prefType('GradientStop', {
  kind: 'object', name: 'Stop', description: '', default: { at: 0.5 },
  children: { at: { kind: 'number', name: 'At', description: '', default: 0.5, min: 0, max: 1 } },
} as PrefLeaf);

describe('prefType', () => {
  it('names the leaf and leaves the rest of it as it was', () => {
    expect(Stop).toMatchObject({ type: 'GradientStop', kind: 'object', name: 'Stop' });
  });

  it('keeps its name through a spread at the place it is used', () => {
    expect({ ...Stop, name: 'First stop' }).toMatchObject({ type: 'GradientStop', name: 'First stop' });
  });

  it('repairs as the leaf it wraps', () => {
    expect(repairPrefValue(Stop, { at: 7 })).toEqual({ at: 1 });
  });
});
