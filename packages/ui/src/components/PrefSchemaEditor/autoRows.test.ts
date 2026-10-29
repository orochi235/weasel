import { describe, expect, it } from 'vitest';
import type { PrefLeaf } from '@weasel-js/prefs';
import { autoRowsOf, withAutoRow } from './autoRows';
import { convertLeaf } from './kindSchemas';

const num = (auto?: PrefLeaf['auto']) => ({ kind: 'number', name: 'N', description: '', default: 1, ...(auto === undefined ? {} : { auto }) }) as PrefLeaf;

describe('autoRowsOf', () => {
  it('reads each row out of the one field', () => {
    expect(autoRowsOf(num())).toEqual({});
    expect(autoRowsOf(num(false))).toEqual({ never: true });
    expect(autoRowsOf(num({ on: true, value: 0 }))).toEqual({ on: true, value: 0 });
  });
});

describe('withAutoRow', () => {
  it('makes never auto false, and clears it back to unset', () => {
    expect(withAutoRow({ on: true }, 'never', true)).toBe(false);
    expect(withAutoRow(false, 'never', false)).toBeUndefined();
    expect(withAutoRow({ on: true }, 'never', false)).toEqual({ on: true });
  });

  it('sets starts auto or a value beside the other, and clears never auto to do so', () => {
    expect(withAutoRow({ value: 3 }, 'on', true)).toEqual({ value: 3, on: true });
    expect(withAutoRow(false, 'value', false)).toEqual({ value: false });
    expect(withAutoRow({ on: true, value: 3 }, 'value', undefined)).toEqual({ on: true });
    expect(withAutoRow({ on: true }, 'on', false)).toBeUndefined();
  });

  it('leaves a leaf that is never auto so when a row it does not show is cleared', () => {
    expect(withAutoRow(false, 'value', undefined)).toBe(false);
  });
});

describe('convertLeaf', () => {
  it('keeps how a leaf is auto across a change of kind, less the value it read', () => {
    const kept = convertLeaf(num({ on: true, value: 4 }), 'string');
    expect(kept.leaf.auto).toEqual({ on: true });
    expect(kept.dropped).toContain('auto.value');
    const never = convertLeaf(num(false), 'string');
    expect(never.leaf.auto).toBe(false);
    expect(never.dropped).not.toContain('auto.value');
  });
});
