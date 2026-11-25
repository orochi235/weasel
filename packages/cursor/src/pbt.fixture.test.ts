import { afterEach, describe, expect, it, vi } from 'vitest';
import { runs } from './pbt.fixture';

describe('runs', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('rounds a fractional WEASEL_PBT_RUNS down to a whole run count', () => {
    vi.stubEnv('WEASEL_PBT_RUNS', '2.5');
    expect(runs(10)).toEqual({ numRuns: 2 });
  });

  it('keeps the default for a count under one run', () => {
    vi.stubEnv('WEASEL_PBT_RUNS', '0.5');
    expect(runs(10)).toEqual({ numRuns: 10 });
  });
});
