// @vitest-environment node
import type { Logger } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { warnNew } from './warnNew';

const loggerOf = () => ({ warn: vi.fn() }) as unknown as Logger & { warn: ReturnType<typeof vi.fn> };

describe('warnNew', () => {
  it('says each message once while it stays current', () => {
    const logger = loggerOf();
    warnNew(logger, 't', ['a', 'b']);
    warnNew(logger, 't', ['a', 'b', 'a']);
    expect(logger.warn.mock.calls).toEqual([['a'], ['b']]);
  });

  it('says a message again once it was gone, and keeps only the current ones', () => {
    const logger = loggerOf();
    warnNew(logger, 't', ['a']);
    warnNew(logger, 't', []);
    warnNew(logger, 't', ['a']);
    expect(logger.warn.mock.calls).toEqual([['a'], ['a']]);
  });

  it('keeps each topic apart', () => {
    const logger = loggerOf();
    warnNew(logger, 't', ['a']);
    warnNew(logger, 'u', []);
    warnNew(logger, 't', ['a']);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
