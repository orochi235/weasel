import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWarnOnce } from './warnOnce';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('createWarnOnce', () => {
  it('says each message once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const once = createWarnOnce();
    once('a'); once('a'); once('b');
    expect(warn.mock.calls).toEqual([['a'], ['b']]);
  });

  it('keeps only the last `cap` messages, so one pushed out says itself again', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const once = createWarnOnce(2);
    once('a'); once('b'); once('c'); once('a');
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it('says nothing and keeps nothing in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const once = createWarnOnce();
    vi.stubEnv('NODE_ENV', 'production');
    once('a');
    vi.unstubAllEnvs();
    once('a');
    expect(warn.mock.calls).toEqual([['a']]);
  });
});
