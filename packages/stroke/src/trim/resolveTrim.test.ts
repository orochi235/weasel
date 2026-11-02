import { describe, expect, it } from 'vitest';
import { lengthTable } from '@weasel-js/geom';
import { resolveTrim } from './resolveTrim';

const ids = [0, 1, 2];
const openL = () => lengthTable([{ points: [0, 0, 3, 0, 3, 4], closed: false, anchorA: ids, anchorB: ids, anchorT: [0, 0, 0] }], 2);

describe('resolveTrim', () => {
  it('default trim is the whole path', () => {
    expect(resolveTrim(openL(), undefined)).toEqual({ from: 0, to: 7 });
    expect(resolveTrim(openL(), {})).toEqual({ from: 0, to: 7 });
  });

  it('fraction under length pace', () => {
    expect(resolveTrim(openL(), { end: 0.5 })).toEqual({ from: 0, to: 3.5 });
  });

  it('fraction under anchor pace', () => {
    expect(resolveTrim(openL(), { end: 0.5, pace: 'anchor' })).toEqual({ from: 0, to: 3 });
  });

  it('absolute measures ignore pace', () => {
    for (const pace of ['length', 'anchor'] as const) {
      expect(resolveTrim(openL(), { start: { length: 1 }, end: { anchor: 1.5 }, pace })).toEqual({ from: 1, to: 5 });
      expect(resolveTrim(openL(), { start: { subpath: 0 }, end: { subpath: 0.5 }, pace })).toEqual({ from: 0, to: 3.5 });
    }
  });

  it('resolveTrim clamps and empties', () => {
    const t = openL();
    expect(resolveTrim(t, { start: -1 })).toEqual({ from: 0, to: 7 });
    expect(resolveTrim(t, { end: { length: 99 } })).toEqual({ from: 0, to: 7 });
    expect(resolveTrim(t, { start: 0.6, end: 0.4 })).toBeNull();
    expect(resolveTrim(t, { start: 0.5, end: 0.5 })).toBeNull();
    expect(resolveTrim(t, { end: NaN })).toBeNull();
    expect(resolveTrim(t, { start: { anchor: NaN } })).toBeNull();
    expect(resolveTrim(t, { start: { length: 7 } })).toBeNull();
  });
});
