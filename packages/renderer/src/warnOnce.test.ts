import { afterEach, describe, expect, it, vi } from 'vitest';
import { warnOnce } from './warnOnce';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('warnOnce', () => {
  it('says one key once, whatever its message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnce('one-key', 'a');
    warnOnce('one-key', 'b');
    expect(warn.mock.calls).toEqual([['a']]);
  });

  it('keeps nothing in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    warnOnce('prod-key', 'a');
    vi.unstubAllEnvs();
    warnOnce('prod-key', 'a');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('keeps a bounded number of keys, so data-derived ones cannot grow it for good', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnce('first', 'first');
    for (let i = 0; i < 1000; i++) warnOnce(`data:${i}`, 'x');
    warnOnce('first', 'first');
    expect(warn.mock.calls.filter(([m]) => m === 'first')).toHaveLength(2);
  });
});
