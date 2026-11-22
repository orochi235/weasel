import { describe, expect, it } from 'vitest';
import { gridBars } from '../AutoControlsDemo';

describe('AutoControlsDemo', () => {
  it('fits every bar inside the width when pinned columns and gap overfill it', () => {
    const bars = gridBars(240, 16, 48);
    expect(bars).toHaveLength(16);
    const last = bars[bars.length - 1]!;
    expect(last.x + last.width).toBeLessThanOrEqual(240);
    for (let i = 1; i < bars.length; i++) expect(bars[i]!.x).toBeGreaterThanOrEqual(bars[i - 1]!.x + bars[i - 1]!.width);
  });

  it('keeps the gap it was given when it fits', () => {
    const bars = gridBars(640, 6, 12);
    expect(bars[1]!.x - (bars[0]!.x + bars[0]!.width)).toBe(12);
    expect(bars[5]!.x + bars[5]!.width).toBeCloseTo(640);
  });
});
