// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Plugin } from 'vite';
import { forge } from './plugin';
import { settledWatch, WRITE_SETTLE } from './watchSettle';

const configOf = (watch?: Record<string, unknown> | null) => {
  const own = forge({ stories: ['*.stories.tsx'] }).find((p) => p.name === 'weaselforge') as Plugin;
  const hook = own.config as (config: object, env: { command: 'serve' | 'build'; mode: string }) => { server?: { watch?: unknown } };
  return hook({ root: '/repo', ...(watch === undefined ? {} : { server: { watch } }) }, { command: 'serve', mode: 'development' });
};

describe('settledWatch', () => {
  it('waits for a write to settle off macOS, and not on it', () => {
    expect(settledWatch(undefined, 'linux')).toEqual({ awaitWriteFinish: WRITE_SETTLE });
    expect(settledWatch(undefined, 'darwin')).toBeUndefined();
  });

  it('leaves a config that says how to wait, or that watches nothing, as it is', () => {
    expect(settledWatch({ awaitWriteFinish: false }, 'linux')).toBeUndefined();
    expect(settledWatch(null, 'linux')).toBeUndefined();
  });
});

describe('the forge plugin', () => {
  it("waits for writes to settle off macOS, as the repo's own dev servers do", () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
    try {
      expect(configOf().server?.watch).toEqual({ awaitWriteFinish: WRITE_SETTLE });
      expect(configOf({ awaitWriteFinish: false }).server?.watch).toBeUndefined();
    } finally {
      Object.defineProperty(process, 'platform', platform);
    }
  });
});
