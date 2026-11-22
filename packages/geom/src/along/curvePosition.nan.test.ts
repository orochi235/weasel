import { describe, expect, it } from 'vitest';
import { pathFromD } from '../paths/pathFromD';
import { lengthAtCurve } from './curvePosition';
import { pathLengthTable } from './pathTable';

const TWO_RUNS = pathFromD('M0 0 L10 0 L10 10 M20 0 L30 0');

describe('lengthAtCurve with an unusual run', () => {
  const t = pathLengthTable(TWO_RUNS);

  it('answers NaN for a NaN field', () => {
    expect(lengthAtCurve(t, { run: NaN, segment: 0, t: 0.5 })).toBeNaN();
    expect(lengthAtCurve(t, { run: 0, segment: NaN, t: 0.5 })).toBeNaN();
    expect(lengthAtCurve(t, { run: 0, segment: 0, t: NaN })).toBeNaN();
  });

  it('floors a fractional run as it floors a fractional segment', () => {
    expect(lengthAtCurve(t, { run: 0.5, segment: 0, t: 0.5 })).toBe(lengthAtCurve(t, { run: 0, segment: 0, t: 0.5 }));
    expect(lengthAtCurve(t, { run: 1.5, segment: 0, t: 0.5 })).toBe(lengthAtCurve(t, { run: 1, segment: 0, t: 0.5 }));
  });

});
