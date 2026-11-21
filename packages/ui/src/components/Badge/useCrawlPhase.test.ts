import { describe, expect, it } from 'vitest';
import { advancePhase } from './useCrawlPhase';

describe('advancePhase', () => {
  it('stays in 0..1 when the crawl runs backward', () => {
    const p = advancePhase(0.1, -0.3, 1000);
    expect(p).toBeCloseTo(0.8, 9);
  });

  it('wraps forward past 1', () => {
    expect(advancePhase(0.9, 0.2, 1000)).toBeCloseTo(0.1, 9);
  });
});
