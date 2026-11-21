import { afterEach, describe, expect, it, vi } from 'vitest';
import { runs, timeoutFor } from './pbt.fixture';

describe('runs', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('takes a whole positive WEASEL_PBT_RUNS', () => {
    vi.stubEnv('WEASEL_PBT_RUNS', '500');
    expect(runs(20)).toEqual({ numRuns: 500 });
  });

  it('floors a fractional count and ignores one that is not finite or under one', () => {
    vi.stubEnv('WEASEL_PBT_RUNS', '2.5');
    expect(runs(20)).toEqual({ numRuns: 2 });
    for (const raw of ['Infinity', '0.5', '-3', 'many']) {
      vi.stubEnv('WEASEL_PBT_RUNS', raw);
      expect(runs(20), raw).toEqual({ numRuns: 20 });
    }
    vi.stubEnv('WEASEL_PBT_RUNS', 'Infinity');
    expect(timeoutFor(20, 10)).toBe(5_000);
  });
});
