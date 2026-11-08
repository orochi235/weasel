import { describe, expect, it } from 'vitest';
import { splitLoops } from './cutPolyline';

describe('splitLoops', () => {
  it('closes no loop where a run doubles back along its own line', () => {
    // Points on one line, which rounding leaves a hair off it.
    const run = [
      { x: 44.44377683352586, y: 25.686161347910453 },
      { x: 81.51266391816323, y: 60.04377702079519 },
      { x: 100.04710746048191, y: 77.22258485723756 },
      { x: 62.97822037584454, y: 42.86496918435282 },
    ];
    expect(splitLoops(run).loops).toEqual([]);
  });
});
