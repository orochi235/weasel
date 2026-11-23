import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefConditionHolds } from './condition';

describe('the warning for a condition read from its group', () => {
  afterEach(() => vi.restoreAllMocks());

  it('remembers a bounded number of paths, so generated paths cannot grow it forever', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const holds = (path: string): boolean => prefConditionHolds({ from: 'group', path }, () => undefined);
    holds('bounded.first');
    holds('bounded.first');
    expect(warn).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 1000; i++) holds(`bounded.${i}`);
    warn.mockClear();
    holds('bounded.first');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
