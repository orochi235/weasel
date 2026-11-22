import { describe, it, expect } from 'vitest';
import { mixRgbaWeighted } from './mix';

describe('mixRgbaWeighted', () => {
  it('mixes a list weighing nothing to transparent', () => {
    expect(mixRgbaWeighted([{ color: [1, 0, 0, 1], weight: 0 }, { color: [0, 0, 1, 1], weight: 0 }])).toEqual([0, 0, 0, 0]);
    expect(mixRgbaWeighted([{ color: [1, 0, 0, 1], weight: 0 }])).toEqual([0, 0, 0, 0]);
  });

  it('leaves out a member weighing nothing', () => {
    const mixed = mixRgbaWeighted([{ color: [1, 0, 0, 1], weight: 0 }, { color: [0, 0, 1, 1], weight: 2 }]);
    [0, 0, 1, 1].forEach((c, i) => expect(mixed[i]).toBeCloseTo(c, 6));
  });
});
