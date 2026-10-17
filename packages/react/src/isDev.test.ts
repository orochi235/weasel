import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDev } from './isDev';

const realProcess = globalThis.process;
afterEach(() => {
  globalThis.process = realProcess;
  vi.unstubAllEnvs();
});

describe('isDev', () => {
  it('is false when NODE_ENV is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isDev()).toBe(false);
  });

  it('is true when NODE_ENV is development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDev()).toBe(true);
  });

  // A published ESM file loaded from a CDN, or bundled with no define for it, has no `process`;
  // a bare read there is a ReferenceError rather than a falsy value.
  it('answers rather than throwing when there is no process', () => {
    // @ts-expect-error — deleting a global the runtime guarantees is the point.
    delete globalThis.process;
    expect(isDev()).toBe(true);
  });
});
