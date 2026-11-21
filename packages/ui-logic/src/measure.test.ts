import { describe, expect, it } from 'vitest';
import { envNumber, envPx, type MeasureEnv } from './measure';

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

describe('envNumber', () => {
  it('reads a unitless number, else the fallback', () => {
    expect(envNumber(env({ '--a': ' 1.5 ' }), '--a', 1.2)).toBe(1.5);
    expect(envNumber(env({ '--a': '600' }), '--a', 400)).toBe(600);
    expect(envNumber(env({}), '--a', 1.2)).toBe(1.2);
  });

  it('falls back on a value with a unit, which is not a multiplier', () => {
    for (const raw of ['150%', '18px', '1.5em', 'normal', '1.5 2']) {
      expect(envNumber(env({ '--a': raw }), '--a', 1.2), raw).toBe(1.2);
    }
  });
});
