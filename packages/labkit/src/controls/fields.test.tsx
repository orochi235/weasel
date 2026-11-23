import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { labField } from './fields';

const leaf = (kind: string, rest: object = {}): PrefLeaf =>
  ({ kind, name: 'Leaf', description: '', default: undefined, ...rest }) as PrefLeaf;

describe('labField', () => {
  it('draws the font pickers ui draws, though the schema does not list their kinds', () => {
    expect(
      labField(leaf('font-family'), { value: 'Inter', write: () => {}, fields: [] }),
    ).toMatchObject({
      kind: 'font-family',
      value: 'Inter',
    });
    expect(
      labField(leaf('font-weight'), { value: 700, write: () => {}, fields: [] }),
    ).toMatchObject({
      kind: 'font-weight',
      value: 700,
    });
  });

  it('has no control for a kind nobody draws, nor for a paint or an object', () => {
    expect(labField(leaf('my-kind'), { value: 1, write: () => {}, fields: [] })).toBeNull();
    expect(labField(leaf('paint'), { value: null, write: () => {}, fields: [] })).toBeNull();
    expect(
      labField(leaf('object', { children: {}, default: {} }), {
        value: {},
        write: () => {},
        fields: [],
      }),
    ).toBeNull();
  });
});
