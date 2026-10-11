import { describe, expect, it } from 'vitest';
import type { PrefLeaf } from '@weasel-js/prefs';
import { prefFieldProps } from './prefField';

const leaf = (kind: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind, name: kind, description: '', default: undefined, ...extra }) as PrefLeaf;

const SINGLE: PrefLeaf[] = [
  leaf('boolean'),
  leaf('number'),
  leaf('string'),
  leaf('enum', { options: [{ value: 'a', label: 'A' }] }),
  leaf('color'),
  leaf('paint'),
  leaf('field'),
  leaf('font-family'),
  leaf('font-weight'),
];

describe('prefFieldProps disabled', () => {
  it('marks the control of every kind that is one control', () => {
    for (const pref of SINGLE) {
      expect(prefFieldProps(pref, { value: undefined, setValue: () => {}, disabled: true })?.disabled, pref.kind).toBe(true);
    }
  });

  it('leaves it off otherwise', () => {
    for (const pref of SINGLE) {
      expect(prefFieldProps(pref, { value: undefined, setValue: () => {} })?.disabled, pref.kind).toBeUndefined();
    }
  });
});
