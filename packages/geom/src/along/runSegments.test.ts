import { describe, expect, it } from 'vitest';
import { pathFromD } from '../paths/pathFromD';
import { runSegments } from './curvePosition';
import { pathLengthTable } from './pathTable';

describe('runSegments', () => {
  const t = pathLengthTable(pathFromD('M0 0 L10 0 L10 10 M20 0 L30 0'));

  it('counts no segments for an index naming no run', () => {
    expect(runSegments(t, 0)).toBe(2);
    expect(runSegments(t, 0.5)).toBe(0);
    expect(runSegments(t, 5)).toBe(0);
    expect(runSegments(t, NaN)).toBe(0);
  });
});
