import { describe, expect, it } from 'vitest';
import { bytes, parseAs, present } from './index';
import { formatCompact, parseNumber } from './number';

describe('a value that rounds up to the next magnitude', () => {
  it('takes the suffix in formatCompact', () => {
    expect(formatCompact(999.6)).toBe('1.00K');
    expect(formatCompact(999.4)).toBe('999');
    expect(formatCompact(999.96, 1)).toBe('1.00K');
    expect(formatCompact(999.94, 1)).toBe('999.9');
    expect(formatCompact(-999.6)).toBe('−1.00K');
    expect(formatCompact(999_950)).toBe('1.00M');
  });

  it('takes the next unit in bytes', () => {
    expect(present(999_999, bytes()).text).toBe('1 MB');
    expect(present(999_949, bytes()).text).toBe('999.9 kB');
    expect(present(999.6, bytes()).text).toBe('1 kB');
    expect(present(1024 * 1024 - 1, bytes({ base: 1024 })).text).toBe('1 MiB');
    expect(present(-999_999, bytes()).text).toBe('−1 MB');
  });

  it('stays in the largest unit there is', () => {
    expect(present(1e18, bytes()).text).toBe('1,000 PB');
    expect(present(999_999e12, bytes()).text).toBe('1,000 PB');
  });
});

describe('parseNumber and text that is not a decimal number', () => {
  it.each(['0x10', '0xb', '0b11', '0o17', '0x', '1e400', '-1e400', '1_000', 'Infinity'])('reads %s as NaN', (text) => {
    expect(parseNumber(text)).toBeNaN();
  });

  it('still reads the decimal forms', () => {
    expect(parseNumber('1e3')).toBe(1000);
    expect(parseNumber('1.5E-2')).toBe(0.015);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('5.')).toBe(5);
    expect(parseNumber('+5')).toBe(5);
    expect(parseNumber('−2.5k')).toBe(-2500);
    expect(parseNumber('3b')).toBe(3e9);
  });

  it('keeps hex out of a display kind too', () => {
    expect(parseAs('0x10')).toBeNaN();
  });
});
