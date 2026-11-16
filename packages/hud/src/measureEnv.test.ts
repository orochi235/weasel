import { describe, expect, it } from 'vitest';
import type { ResolvedTheme } from '@weasel-js/theme';
import { hudMeasureEnv } from './measureEnv';

describe('hudMeasureEnv', () => {
  it('reads a token named for an Object.prototype member as absent', () => {
    const env = hudMeasureEnv({ tokens: { '--a': '1px' } as unknown as ResolvedTheme, defaultFont: 'sans-serif' }, undefined, {});
    expect(env.token('constructor')).toBeUndefined();
    expect(env.token('toString')).toBeUndefined();
    expect(env.token('--a')).toBe('1px');
  });
});
