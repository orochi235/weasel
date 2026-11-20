import { describe, expect, it } from 'vitest';
import { externalHash } from './module-cache.mjs';

const lock = (extra: Record<string, object>) => ({
  packages: {
    '': { version: '0.4.0' },
    'packages/core': { version: '1.0.0' },
    'node_modules/@weasel-js/core': { resolved: 'packages/core', link: true },
    'node_modules/react': { version: '19.0.0', integrity: 'sha512-a' },
    ...extra,
  },
});

describe('the module cache', () => {
  it('keeps its directory across a workspace version bump', () => {
    expect(externalHash(lock({ 'packages/core': { version: '1.0.1' } }))).toBe(externalHash(lock({})));
  });

  it('moves to a new directory when a workspace link moves', () => {
    expect(externalHash(lock({ 'node_modules/@weasel-js/core': { resolved: 'packages/core2', link: true } }))).not.toBe(externalHash(lock({})));
  });

  it('moves to a new directory when an external package changes', () => {
    expect(externalHash(lock({ 'node_modules/react': { version: '19.0.1', integrity: 'sha512-b' } }))).not.toBe(externalHash(lock({})));
  });
});
