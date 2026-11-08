import { describe, expect, it } from 'vitest';
import { envPx, type MeasureEnv } from './measure';

const env = (tokens: Record<string, string>): MeasureEnv => ({
  token: (name) => tokens[name],
  text: () => ({ width: 0, ascent: 0, descent: 0 }),
});

describe('envPx', () => {
  it('reads a px length, else the fallback', () => {
    expect(envPx(env({ '--a': ' 12.5px ' }), '--a')).toBe(12.5);
    expect(envPx(env({}), '--a', 4)).toBe(4);
    expect(envPx(env({ '--b': '6px' }), '--a', '--b')).toBe(6);
  });

  it('reads a unitless zero, which CSS takes as a length', () => {
    expect(envPx(env({ '--a': '0' }), '--a', 4)).toBe(0);
  });

  it('throws where neither the token nor the fallback is a px length', () => {
    expect(() => envPx(env({ '--a': '1em' }), '--a')).toThrow(/--a is not a px length/);
  });
});
