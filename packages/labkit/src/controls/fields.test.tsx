import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { labField } from './fields';

const leaf = (kind: string, rest: object = {}): PrefLeaf =>
  ({ kind, name: 'Leaf', description: '', default: undefined, ...rest }) as PrefLeaf;

describe('labField', () => {
  it('draws the font pickers ui draws, though the schema does not list their kinds', () => {
    expect(labField(leaf('font-family'), 'Inter', () => {}, [])).toMatchObject({
      kind: 'font-family',
      value: 'Inter',
    });
    expect(labField(leaf('font-weight'), 700, () => {}, [])).toMatchObject({
      kind: 'font-weight',
      value: 700,
    });
  });

  it('has no control for a kind nobody draws, nor for a paint or an object', () => {
    expect(labField(leaf('my-kind'), 1, () => {}, [])).toBeNull();
    expect(labField(leaf('paint'), null, () => {}, [])).toBeNull();
    expect(labField(leaf('object', { children: {}, default: {} }), {}, () => {}, [])).toBeNull();
  });
});
