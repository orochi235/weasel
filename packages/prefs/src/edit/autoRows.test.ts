import { describe, expect, it } from 'vitest';
import type { PrefLeaf } from '@weasel-js/prefs';
import { autoRowsOf, withAutoRow } from './autoRows';
import { convertLeaf } from './kindSchemas';

const num = (auto?: PrefLeaf['auto']) => ({ kind: 'number', name: 'N', description: '', default: 1, ...(auto === undefined ? {} : { auto }) }) as PrefLeaf;

describe('autoRowsOf', () => {
  it('reads each row out of the one field', () => {
    expect(autoRowsOf(num())).toEqual({});
    expect(autoRowsOf(num({}))).toEqual({ can: true });
    expect(autoRowsOf(num({ on: true, value: 0 }))).toEqual({ can: true, on: true, value: 0 });
  });
});

describe('withAutoRow', () => {
  it('opts a leaf in with can be auto, and clearing it drops the whole field', () => {
    expect(withAutoRow(undefined, 'can', true)).toEqual({});
    expect(withAutoRow({ on: true }, 'can', true)).toEqual({ on: true });
    expect(withAutoRow({ on: true, value: 3 }, 'can', false)).toBeUndefined();
  });

  it('sets starts auto or a value beside the other, opting the leaf in to do so', () => {
    expect(withAutoRow({ value: 3 }, 'on', true)).toEqual({ value: 3, on: true });
    expect(withAutoRow(undefined, 'value', false)).toEqual({ value: false });
    expect(withAutoRow({ on: true, value: 3 }, 'value', undefined)).toEqual({ on: true });
    expect(withAutoRow({ on: true }, 'on', false)).toEqual({});
  });

  it('leaves a leaf that does not opt in so when a row it does not show is cleared', () => {
    expect(withAutoRow(undefined, 'value', undefined)).toBeUndefined();
  });
});

describe('convertLeaf', () => {
  it('keeps how a leaf is auto across a change of kind, less the value it read', () => {
    const kept = convertLeaf(num({ on: true, value: 4 }), 'string');
    expect(kept.leaf.auto).toEqual({ on: true });
    expect(kept.dropped).toContain('auto.value');
    const plain = convertLeaf(num(), 'string');
    expect(plain.leaf.auto).toBeUndefined();
    expect(plain.dropped).not.toContain('auto.value');
  });
});
