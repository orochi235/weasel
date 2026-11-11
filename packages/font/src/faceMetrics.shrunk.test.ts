/** Counterexamples `faceMetrics.pbt.test.ts` shrank to, kept as examples. */
import { describe, expect, it } from 'vitest';
import { faceMetricsFromTables } from './faceMetrics';

describe('faceMetricsFromTables, shrunk', () => {
  it('drops a rule whose weight rounds to 0 ems, or whose offset overflows', () => {
    expect(faceMetricsFromTables({ unitsPerEm: 1000, os2: { yStrikeoutPosition: 1e308, yStrikeoutSize: 5e-324 } })).toBeUndefined();
    expect(faceMetricsFromTables({ unitsPerEm: 1e-300, os2: { yStrikeoutPosition: 1e10, yStrikeoutSize: 1 } })).toBeUndefined();
  });
});
