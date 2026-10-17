import { describe, expect, it } from 'vitest';
import { formatNumber, MINUS_SIGN } from './weasel-ui';

describe('weasel-ui passthrough', () => {
  it('re-exports formatNumber with MINUS_SIGN convention', () => {
    expect(formatNumber(-3.14)).toBe(`${MINUS_SIGN}3.14`);
  });
});
